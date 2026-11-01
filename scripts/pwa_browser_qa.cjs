// Real-browser PWA checks against the exact GitHub Pages artifact below a subpath.
// Run after scripts/check.py. Playwright is a QA dependency, not an app dependency.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const http = require('node:http');
const path = require('node:path');
const {chromium} = require('playwright');
const {PDFDocument} = require('../src/vendor/pdf-lib.min.js');

const root = path.resolve(__dirname, '../_site');
const out = path.resolve(__dirname, '../output/pwa-browser-qa');
const prefix = '/baza-math/';
const blocked = new Set();
let workerRevision = 0;
let realRoot;
const report = {scenarios: [], pageErrors: [], externalRequests: []};
const types = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml'};

function inside(file, base = root) { return file === base || file.startsWith(base + path.sep); }
async function serve(request, response) {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    if (!pathname.startsWith(prefix)) { response.writeHead(404).end(); return; }
    const relative = pathname.slice(prefix.length) || 'index.html';
    if (blocked.has(relative)) { response.writeHead(503).end('QA: deliberately unavailable'); return; }
    let file = path.resolve(root, relative);
    if (!inside(file)) { response.writeHead(403).end(); return; }
    if ((await fs.stat(file)).isDirectory()) file = path.join(file, 'index.html');
    if (!inside(await fs.realpath(file), realRoot)) { response.writeHead(403).end(); return; }
    let content = await fs.readFile(file);
    if (relative === 'service-worker.js' && workerRevision) {
      // An HTTP-only candidate build with identical, still verifiable assets.
      // This exercises the real worker lifecycle without rewriting _site.
      const original = content.toString('utf8');
      const updated = original.replace(/("version"\s*:\s*")([^"\r\n]+)(")/,
        (_match, open, version, close) => open + version + '-qa' + workerRevision + close);
      assert.notEqual(updated, original, 'generated worker includes a JSON build version');
      content = Buffer.from(updated);
    }
    response.writeHead(200, {'Content-Type': types[path.extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-store', ...(relative === 'service-worker.js' ? {'Service-Worker-Allowed': prefix} : {})});
    response.end(content);
  } catch { response.writeHead(404).end(); }
}
const server = http.createServer((request, response) => { void serve(request, response); });
function observe(page, scenario) {
  page.setDefaultTimeout(25000);
  page.on('pageerror', error => report.pageErrors.push({scenario, message: error.message}));
  page.on('request', request => {
    if (/^https?:/.test(request.url()) && !request.url().startsWith(origin)) report.externalRequests.push(request.url());
  });
}
async function noOverflow(page, label) {
  const size = await page.evaluate(() => ({viewport: innerWidth, content: document.documentElement.scrollWidth}));
  assert(size.content <= size.viewport + 1, label + ': horizontal overflow ' + JSON.stringify(size));
}
async function state(page) { return page.evaluate(() => MathPWA.getState()); }
async function pwaReady(page) {
  await page.waitForFunction(() => globalThis.MathPWA?.getState().ready && navigator.serviceWorker.controller);
}
async function chooseRole(page, role) {
  await page.locator('[data-role="' + role + '"]:enabled').click();
  await page.locator('#dashboard').waitFor();
}
async function devices(page) {
  await page.locator('.app-navigation [data-action="nav-device"]').click();
  await page.locator('#offline-grade').waitFor();
}
async function downloaded(page, grade, expected) {
  await page.waitForFunction(({grade, expected}) =>
    globalThis.MathPWA.getState().grades.find(item => item.grade === grade)?.downloaded === expected,
  {grade, expected});
}
let origin;

(async () => {
  await fs.mkdir(out, {recursive: true});
  realRoot = await fs.realpath(root);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = 'http://127.0.0.1:' + server.address().port;
  const entry = origin + prefix;
  const browser = await chromium.launch({headless: true, ...(process.platform === 'win32' ? {channel: 'msedge'} : {})});
  try {
    for (const [name, width, height] of [['desktop', 1440, 1000], ['tablet', 768, 1024], ['mobile', 390, 844]]) {
      for (const role of ['student', 'teacher']) {
        const context = await browser.newContext({viewport: {width, height}, reducedMotion: 'reduce'});
        try {
          const page = await context.newPage(); observe(page, name + '-' + role);
          await page.goto(entry); await chooseRole(page, role); await pwaReady(page);
          await noOverflow(page, name + '-' + role + ' dashboard');
          assert(await page.locator('.app-navigation [data-action="nav-home"]').isVisible());
          assert(await page.locator('.app-navigation [data-action="nav-catalog"]').isVisible());
          assert(await page.locator('.app-navigation [data-action="nav-works"]').isVisible());
          assert(await page.locator('.app-navigation [data-action="nav-device"]').isVisible());
          if (role === 'teacher') assert(await page.locator('[data-action="builder-home"]').first().isVisible());
          else assert(await page.locator('[data-action="learning-home"]').first().isVisible());
          await page.screenshot({path: path.join(out, name + '-' + role + '-home.png'), fullPage: true});
          await devices(page); await noOverflow(page, name + '-' + role + ' device');
          await page.screenshot({path: path.join(out, name + '-' + role + '-device.png'), fullPage: true});
          await page.locator('.app-navigation [data-action="nav-home"]').click(); await page.locator('#dashboard').waitFor();
          await page.reload(); await page.locator('#dashboard').waitFor();
          assert(!(await page.locator('#welcome').isVisible()), 'saved role opens its home on reload');
          report.scenarios.push({name: name + '-' + role, roleHome: true, persistentNavigation: true,
            rememberedRole: true, noHorizontalOverflow: true});
        } finally { await context.close(); }
      }
    }

    const context = await browser.newContext({viewport: {width: 1440, height: 1000}, reducedMotion: 'reduce', acceptDownloads: true});
    try {
      let page = await context.newPage(); observe(page, 'offline-lifecycle');
      await page.goto(entry); await chooseRole(page, 'teacher'); await pwaReady(page);
      const metadata = await page.evaluate(async () => {
        const link = document.querySelector('link[rel="manifest"]');
        const url = new URL(link.href);
        const response = await fetch(url); const manifest = await response.json();
        return {url: url.href, manifest};
      });
      assert.equal(metadata.manifest.display, 'standalone');
      assert(new URL(metadata.manifest.start_url, metadata.url).pathname.startsWith(prefix));
      assert(new URL(metadata.manifest.scope || './', metadata.url).pathname.startsWith(prefix));
      assert(metadata.manifest.icons.some(icon => icon.sizes.includes('192x192')));
      assert(metadata.manifest.icons.some(icon => icon.sizes.includes('512x512')));
      for (const icon of metadata.manifest.icons) {
        const url = new URL(icon.src, metadata.url); assert(url.pathname.startsWith(prefix));
        const response = await page.request.get(url.href); assert(response.ok()); assert((await response.body()).length > 0);
      }
      const registration = await page.evaluate(async () => (await navigator.serviceWorker.ready).scope);
      assert.equal(registration, entry, 'worker must stay inside the repository subpath');
      assert.deepEqual(await page.evaluate(() => MathDataLoader.snapshot().loaded), [], 'home does not hydrate the bank');
      await devices(page);

      // Headless browsers cannot install an OS app. Exercise the browser-event
      // wiring separately from the real manifest/scope/assets checks above.
      await page.evaluate(() => {
        globalThis.__qaInstallPrompted = false;
        const event = new Event('beforeinstallprompt', {cancelable: true});
        event.prompt = async () => { globalThis.__qaInstallPrompted = true; };
        event.userChoice = Promise.resolve({outcome: 'dismissed', platform: 'web'});
        window.dispatchEvent(event);
      });
      await page.waitForFunction(() => MathPWA.getState().canInstall);
      await page.locator('[data-action="pwa-install"]').click();
      assert(await page.evaluate(() => globalThis.__qaInstallPrompted), 'install button calls the browser prompt');
      assert.equal((await state(page)).installed, false, 'dismissed prompt does not claim installation');

      // A failed response must never create a downloaded badge or partial usable pack.
      blocked.add('data/tasks/grade_06.js');
      const failed = await page.evaluate(async () => {
        try { await MathPWA.downloadGrade(6); return {resolved: true, state: MathPWA.getState()}; }
        catch (error) { return {resolved: false, message: error.message, state: MathPWA.getState()}; }
      });
      blocked.delete('data/tasks/grade_06.js');
      assert.equal(failed.resolved, false, 'failed download rejects instead of claiming success');
      assert.equal(failed.state.grades.find(item => item.grade === 6).downloaded, false);
      assert(!failed.state.busy, 'failed download releases busy state');

      await page.locator('#offline-grade').selectOption('5');
      await page.locator('[data-action="pwa-download"][data-grade="5"]').click();
      await downloaded(page, 5, true);
      assert((await state(page)).grades.filter(item => item.downloaded).every(item => item.grade === 5));
      await noOverflow(page, 'downloaded class device');
      await page.screenshot({path: path.join(out, 'desktop-class-downloaded.png'), fullPage: true});

      // A new worker may prepare in the background, but it must not replace a
      // running lesson. Typed work survives until the explicit update action.
      await page.locator('.app-navigation [data-action="nav-home"]').click(); await page.locator('#dashboard').waitFor();
      await page.locator('[data-action="grade"][data-grade="5"]').click();
      await page.locator('.topic-card').first().waitFor();
      await page.locator('[data-action="train"]').first().click();
      const updateDraft = '12345/67';
      await page.locator('#answer').fill(updateDraft);
      const oldVersion = (await state(page)).version;
      await page.evaluate(() => { globalThis.__qaSessionMarker = 'lesson-still-running'; });
      workerRevision = 1;
      await page.evaluate(async () => { await (await navigator.serviceWorker.getRegistration()).update(); });
      await page.waitForFunction(() => MathPWA.getState().updateAvailable, null, {timeout: 60000});
      assert.equal(await page.evaluate(() => globalThis.__qaSessionMarker), 'lesson-still-running');
      assert.equal(await page.locator('#answer').inputValue(), updateDraft);
      assert.equal((await state(page)).version, oldVersion, 'candidate does not replace the active version');

      const other = await context.newPage(); observe(other, 'update-other-window');
      await other.goto(entry); await other.locator('#dashboard').waitFor(); await pwaReady(other);
      const refused = await page.evaluate(async () => {
        try { await MathPWA.applyUpdate(); return ''; } catch (error) { return error.message; }
      });
      assert(refused.includes('вкладки') || refused.includes('окна'), 'update explains the second open window');
      assert.equal(await page.evaluate(() => globalThis.__qaSessionMarker), 'lesson-still-running');
      await other.close();
      await page.locator('[data-action="back"]').first().click(); await page.locator('.topic-card').first().waitFor();
      await devices(page);
      await Promise.all([page.waitForEvent('load'), page.locator('[data-action="pwa-update"]').click()]);
      await page.locator('#dashboard').waitFor(); await pwaReady(page);
      assert.equal((await state(page)).version, oldVersion + '-qa1');
      await downloaded(page, 5, true);
      await page.waitForFunction(async version => !(await caches.keys()).some(name =>
        name.startsWith('baza-pwa:') && (name.endsWith(':' + version) || name.includes(':' + version + ':'))), oldVersion);
      const staleCaches = await page.evaluate(async version => (await caches.keys()).filter(name =>
        name.startsWith('baza-pwa:') && (name.endsWith(':' + version) || name.includes(':' + version + ':'))), oldVersion);
      assert.deepEqual(staleCaches, [], 'activated update removes old caches so removed classes cannot reappear later');
      const savedDraft = await page.evaluate(draft => {
        const saved = JSON.parse(localStorage.getItem('mat1430.workspace.v2'));
        return saved.attempts.some(([, record]) => record.draft === draft);
      }, updateDraft);
      assert(savedDraft, 'explicit update retains the saved answer draft');
      await page.close();

      // An empty tab has no JS/module cache. The shell, grade data and PDF libraries
      // must all be served by the registered worker with the network unavailable.
      await context.setOffline(true);
      page = await context.newPage(); observe(page, 'offline-cold-start');
      await page.goto(entry); await page.locator('#dashboard').waitFor(); await pwaReady(page);
      await downloaded(page, 5, true);
      assert.equal((await state(page)).online, false);
      await page.locator('[data-action="grade"][data-grade="5"]').click();
      await page.locator('.topic-card').first().waitFor();
      assert.deepEqual(await page.evaluate(() => MathDataLoader.snapshot().loaded), ['class:5']);
      const task = await page.evaluate(() => BANK.find(topic => topic.grade === 5).tasks[0]);
      await page.locator('[data-action="train"]').first().click();
      await page.locator('#answer').fill(task.display); await page.locator('#answer-form button').click();
      assert((await page.locator('#feedback').textContent()).includes('Верно'));
      await noOverflow(page, 'offline trainer');
      await page.screenshot({path: path.join(out, 'desktop-offline-trainer.png')});
      const pdfBytes = await page.evaluate(async () => {
        const topic = BANK.find(topic => topic.grade === 5);
        return [...await createMathPDF({tasks: [topic.tasks[0]], title: 'Офлайн-проверка',
          variant: '1', grade: 5, level: 'basic', answers: true})];
      });
      const bytes = Buffer.from(pdfBytes); assert.equal(bytes.subarray(0, 4).toString(), '%PDF');
      const pdf = await PDFDocument.load(bytes); assert(pdf.getPageCount() > 0);
      await fs.writeFile(path.join(out, 'offline-class-work.pdf'), bytes);
      await page.locator('[data-action="back"]').first().click(); await page.locator('.topic-card').first().waitFor();
      await page.locator('.app-navigation [data-action="nav-home"]').click(); await page.locator('#dashboard').waitFor();
      await page.locator('[data-action="builder-home"]').click(); await page.locator('#source-filter').waitFor();
      assert.equal(await page.locator('#source-filter').inputValue(), 'class:5:basic', 'offline work creation opens the downloaded class');
      await page.locator('#bank-search').fill(task.id); await page.locator('[data-action="add"]').first().click();
      await page.locator('[data-action="print-preview"]').click(); await page.locator('[data-action="download"]').waitFor();
      const downloadEvent = page.waitForEvent('download'); await page.locator('[data-action="download"]').click();
      await (await downloadEvent).saveAs(path.join(out, 'offline-teacher-work.pdf'));
      await page.locator('[data-action="back"]').first().click(); await page.locator('#source-filter').waitFor();
      await page.locator('.app-navigation [data-action="nav-home"]').click(); await page.locator('#dashboard').waitFor();
      await page.locator('[data-action="grade"][data-grade="7"]').click();
      await page.waitForFunction(() => document.querySelector('#notice')?.textContent.includes('не сохранены для работы без интернета'));
      assert(!(await page.evaluate(() => MathDataLoader.snapshot().loaded)).includes('class:7'));
      assert(await page.locator('#dashboard').isVisible(), 'unavailable class leaves the current screen usable');
      assert((await page.locator('#notice').textContent()).trim().length > 0, 'unavailable class has an explanatory message');
      await devices(page); await page.locator('#offline-grade').selectOption('5');
      await page.locator('[data-action="pwa-remove"][data-grade="5"]').click();
      await downloaded(page, 5, false);
      assert.equal((await state(page)).online, false, 'removal works while offline');
      report.scenarios.push({name: 'offline-lifecycle', repositorySubpath: true, installMetadata: true,
        installPromptWiringSimulated: true, dismissedInstallNotMarkedInstalled: true,
        backgroundUpdateKeepsLesson: true, updateRefusesOtherWindow: true, explicitUpdate: true,
        updateMigratesDownloadedClass: true, updateRetainsDraft: true, oldVersionCachesRemoved: true,
        failedDownloadNotMarkedReady: true, explicitClassDownload: true, onlySelectedClassDownloaded: true,
        offlineNewTab: true, offlineAnswerCheck: true, offlinePDFPages: pdf.getPageCount(), offlineTeacherWorkFromHome: true,
        unselectedClassGracefulFailure: true, offlinePackRemoval: true});
    } finally { blocked.clear(); await context.close(); }

    assert.deepEqual(report.pageErrors, [], 'no uncaught app errors');
    assert.deepEqual(report.externalRequests, [], 'the app uses no external network service');
    await fs.writeFile(path.join(out, 'results.json'), JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify(report, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; })
  .finally(() => new Promise(resolve => server.close(resolve)));
