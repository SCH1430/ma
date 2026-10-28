// Actual application events, persistence and export boundaries for bank tools.
const path = require('path');
const {createHarness, BANK, KEY} = require('./validate_ui_state.cjs');
const {THINKING_BANK} = require('./load_page.cjs').loadPage(path.resolve(__dirname, '..')).dataValues();
const classes = BANK.flatMap(topic => topic.tasks.map(task => ({...task, source: 'class', grade: topic.grade, level: topic.level, topicId: topic.id, topic: topic.title})));
const thinking = THINKING_BANK.tasks;
const byId = new Map([...classes, ...thinking].map(task => [task.id, task]));
const family = task => task.family || task.subtypeId || task.canonicalId || task.id;
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const sorted = values => [...values].sort();
const work = h => h.state().works.find(([key]) => key === 'unified')[1];
const cards = h => h.document.querySelectorAll('.bank-task').map(card => card.dataset.taskId);
const state = h => h.state().bankTools;
let checks = 0;
const errors = [];
const test = (condition, label) => { checks++; if (!condition) errors.push(label); };
async function scenario(label, fn) { try { await fn(); } catch (error) { test(false, label + ': ' + error.stack); } }
async function teacher(h) { await h.click('[data-role="teacher"]'); await h.click('[data-action="builder-home"]'); }
async function quantity(h, value) { await h.input('#auto-count', String(value)); }
async function searchTask(h, task) { await h.input('#bank-search', task.id); }
async function add(h, task) { await searchTask(h, task); await h.click(`[data-action="add"][data-id="${task.id}"]`); }
async function resetQuotas(h, counts = {}) { for (const input of h.document.querySelectorAll('[data-quota]')) await h.input(`[data-quota="${input.dataset.quota}"]`, String(counts[input.dataset.quota] || 0)); }

(async () => {
  await scenario('family display, practice anchor and diverse assembly', async () => {
    const h = createHarness(); await teacher(h);
    const first = classes.find(task => task.family && classes.filter(other => other.topicId === task.topicId && other.family === task.family).length >= 4);
    const topicPool = classes.filter(task => task.topicId === first.topicId);
    await h.change('#source-filter', `class:${first.grade}:${first.level}`); await h.change('#bank-filter', first.topicId);
    await h.change('#group-families', true);
    const familyCount = new Set(topicPool.map(family)).size;
    test(h.document.querySelectorAll('.bank-family').length === Math.min(24, familyCount) && state(h).grouped, 'grouped catalogue displays one representative per family');
    const button = h.document.querySelectorAll('[data-action="family-toggle"]').find(button => button.dataset.family === first.family);
    test(!!button && button.getAttribute('aria-expanded') === 'false', 'a family exposes a collapsed, keyboard-operable variants action');
    await h.click(`[data-action="family-toggle"][data-family="${first.family}"]`);
    const members = topicPool.filter(task => family(task) === first.family);
    test(members.every(task => cards(h).includes(task.id)) && h.get(`[data-action="family-toggle"][data-family="${first.family}"]`).getAttribute('aria-expanded') === 'true', 'expanding a family reveals each distinct numerical variant');
    await h.click(`[data-action="family-practice"][data-family="${first.family}"]`);
    test(h.get('#selection-mode').value === 'practice' && h.get('#practice-family').value === first.family, 'family practice action selects its exact family and opens assembly');
    await quantity(h, 4); await h.click('[data-action="auto-build"]');
    test(work(h).ids.length === 4 && work(h).ids.every(id => family(byId.get(id)) === first.family), 'practice assembly stays in the explicitly selected family');
    const previous = [...work(h).ids], sibling = members.find(task => !previous.includes(task.id));
    await h.change('#selection-mode', 'diverse');
    if (sibling) {
      await searchTask(h, sibling); await h.click('[data-action="auto-append"]');
      test(same(work(h).ids, previous) && h.get('#auto-result').textContent.includes('Нет новых подходящих заданий'), 'diverse append reserves families from selected tasks outside the current exact-ID filter');
      await h.input('#bank-search', '');
    }
    await quantity(h, 60); await h.click('[data-action="auto-build"]');
    const selected = work(h).ids.map(id => byId.get(id));
    test(selected.length > 1 && new Set(selected.map(family)).size === selected.length && new Set(selected.map(task => task.canonicalId || task.id)).size === selected.length, 'diverse assembly has no repeated family or canonical condition');
    test(h.get('#auto-result').textContent.includes('Не хватает') && selected.length <= familyCount, 'family shortage is visible rather than filled with numerical duplicates');
  });

  await scenario('micro skills intersect filters and reset independently', async () => {
    const h = createHarness(); await teacher(h);
    const skill = 'linear-equation';
    const task = classes.find(task => task.grade === 7 && h.context.MathBankPedagogy.forTask(task).includes(skill) && h.context.MathCompetencies.forTask(task).includes('equations'));
    await h.change('#source-filter', `class:${task.grade}:${task.level}`); await h.change('#bank-filter', task.topicId); await h.change('#difficulty-filter', task.difficulty);
    await h.change('[data-competency="equations"]', true); await h.change(`[data-skill="${skill}"]`, true); await searchTask(h, task);
    test(same(cards(h), [task.id]), 'micro skill, competency, source, topic, difficulty and exact ID intersect on one task');
    await h.click(`[data-action="add"][data-id="${task.id}"]`);
    const absent = h.context.MathBankPedagogy.definitions.find(definition => !h.context.MathBankPedagogy.forTask(task).includes(definition.id));
    await h.change(`[data-skill="${absent.id}"]`, true);
    test(same(cards(h), [task.id]), 'multiple micro skills use the documented OR union');
    await h.change(`[data-skill="${skill}"]`, false);
    test(cards(h).length === 0 && h.get('[data-action="auto-build"]').disabled, 'a nonmatching micro skill does not silently disable filtering');
    await h.click('[data-action="clear-skills"]');
    test(same(cards(h), [task.id]) && h.get('#bank-search').value === task.id && h.get('#difficulty-filter').value === task.difficulty && h.get('[data-competency="equations"]').checked, 'clearing micro skills preserves other filters');
    await h.change(`[data-skill="${skill}"]`, true); await h.click('[data-action="reset-builder-filters"]');
    test(!h.document.querySelectorAll('[data-skill]').some(input => input.checked) && h.get('#source-filter').value === 'all' && h.get('#bank-search').value === '' && same(work(h).ids, [task.id]), 'reset clears skill filters without changing the assembled work');
  });

  await scenario('structured counts, shortage and reusable template persistence', async () => {
    const h = createHarness(); await teacher(h); await h.change('#source-filter', 'classes'); await h.change('#structured-work', true);
    await resetQuotas(h, {'Базовый': 3, 'Повышенный': 2}); await h.input('#open-quota', '1'); await h.click('[data-action="auto-build"]');
    const selected = work(h).ids.map(id => byId.get(id)), short = selected.filter(task => task.kind !== 'open');
    test(selected.length === 6 && short.filter(task => task.difficulty === 'Базовый').length === 3 && short.filter(task => task.difficulty === 'Повышенный').length === 2 && selected.filter(task => task.kind === 'open').length === 1, '3 basic + 2 elevated + 1 reasoning produces six separate tasks');
    test(h.get('#auto-result').textContent.includes('Рассуждение: 1 из 1'), 'reasoning quota has its own readable result');
    await h.change('#difficulty-filter', 'Базовый'); await h.click('[data-action="auto-build"]');
    test(work(h).ids.map(id => byId.get(id)).every(task => task.difficulty === 'Базовый') && h.get('#auto-result').textContent.includes('Повышенный: 0 из 2'), 'global difficulty remains a hard constraint and missing quota is reported');
    await h.change('#selection-mode', 'diverse'); await h.change('[data-skill="operations"]', true); await h.input('#template-name', 'Проверочная: структура и навык'); await h.click('[data-action="template-save"]');
    const template = state(h).templates[0], savedWork = [...work(h).ids]; h.pagehide();
    const restored = createHarness(h.store); await restored.click('[data-action="resume"]');
    test(state(restored).templates.length === 1 && state(restored).templates[0].name === template.name, 'named template survives a full reload');
    await restored.click('[data-action="reset-builder-filters"]'); await restored.change('#selection-mode', 'balanced'); await restored.change('#structured-work', false);
    await restored.click(`[data-action="template-load"][data-template="${template.id}"]`);
    test(restored.get('#source-filter').value === 'classes' && restored.get('#difficulty-filter').value === 'Базовый' && restored.get('[data-skill="operations"]').checked && restored.get('#selection-mode').value === 'diverse' && restored.get('#structured-work').checked, 'applying a saved template restores filters, skills, purpose and structured mode');
    test(restored.get('[data-quota="Базовый"]').value === '3' && restored.get('[data-quota="Повышенный"]').value === '2' && restored.get('#open-quota').value === '1' && same(work(restored).ids, savedWork), 'template restores exact quotas without overwriting current work');
    await restored.input('[data-quota="Базовый"]', '59'); await restored.click('[data-action="auto-build"]');
    test(same(work(restored).ids, savedWork) && restored.get('#auto-result').textContent.includes('от 1 до 60'), 'oversized structured request is rejected without changing the work');
  });

  await scenario('teacher notes survive, constrain automatic selection and remain private', async () => {
    const h = createHarness(); await teacher(h); const task = classes.find(task => task.grade === 5 && task.kind === 'number');
    await h.change('#source-filter', `class:${task.grade}:${task.level}`); await h.change('#bank-filter', task.topicId); await searchTask(h, task);
    const comment = 'Личная заметка <b>проверить условие</b>';
    await h.input(`[data-note-text="${task.id}"]`, comment); await h.change(`[data-note-flag="${task.id}"]`, 'revision'); await h.change(`[data-note-excluded="${task.id}"]`, true); h.flush();
    test(state(h).notes[task.id].text === comment && state(h).notes[task.id].flag === 'revision' && state(h).notes[task.id].excluded, 'note text, editorial flag and exclusion are stored together');
    await quantity(h, 1); await h.click('[data-action="auto-build"]');
    test(work(h).ids.length === 0 && h.get('#auto-result').textContent.includes('Нет новых подходящих заданий'), 'excluded task is still visible but is omitted from automatic assembly');
    test(h.document.querySelectorAll('[data-action="preset-preview"]').every(button => button.disabled), 'excluded-only pool cannot populate a topic preset');
    await h.click(`[data-action="add"][data-id="${task.id}"]`);
    test(same(work(h).ids, [task.id]), 'manual choice remains possible for an excluded task');
    await h.change('#exclude-marked', false); await h.click('[data-action="auto-build"]');
    test(same(work(h).ids, [task.id]) && h.document.querySelectorAll('[data-action="preset-preview"]').some(button => !button.disabled), 'teacher can explicitly include marked tasks in automatic and preset selection');
    await h.change('#note-filter', 'excluded'); test(same(cards(h), [task.id]), 'teacher can find excluded tasks through the note filter');
    await h.click('[data-action="export-work"]');
    const download = h.document.downloads.at(-1), payloadText = await h.blobs.get(download.url).text();
    test(!payloadText.includes(comment) && !payloadText.includes('bankTools') && !payloadText.includes('Личная заметка'), 'teacher notes do not leak into portable student work');
    h.pagehide(); const restored = createHarness(h.store); await restored.click('[data-action="resume"]');
    test(state(restored).notes[task.id].text === comment && restored.get(`[data-note-text="${task.id}"]`).value === comment, 'note and editorial controls restore correctly after reload');
    await restored.click('[data-action="home"]'); await restored.click('[data-role="student"]'); await restored.click('[data-action="works-home"]'); await restored.click('[data-action="end-session"]');
    test(state(restored).notes[task.id].text === comment && same(work(restored).ids, [task.id]), 'changing student clears student session while preserving teacher notes and work');
  });

  await scenario('understanding tasks filter, export, print and use honest self-review', async () => {
    const calls = [], h = createHarness(new Map(), {createMathPDF: async payload => {calls.push(payload); return new Uint8Array(Buffer.from('%PDF-thinking-test'));}});
    await teacher(h); await h.change('#source-filter', 'enrichment');
    test(thinking.length === 36 && h.get('#source-filter').value === 'enrichment', 'new understanding source is deployed with 36 tasks');
    await h.change('#task-format', 'error');
    const expected = thinking.filter(task => task.format === 'error');
    test(same(sorted(cards(h)), sorted(expected.map(task => task.id))), 'understanding format filter selects the exact error-analysis tasks');
    await h.change('[data-skill="error-analysis"]', true); await h.change('[data-competency="reasoning"]', true);
    test(same(sorted(cards(h)), sorted(expected.map(task => task.id))), 'understanding formats combine with skill and competency metadata');
    const task = expected[0]; await add(h, task); await h.click('[data-action="export-work"]');
    const download = h.document.downloads.at(-1), payload = JSON.parse(await h.blobs.get(download.url).text());
    test(same(payload.work.ids, [task.id]) && payload.format === 'mat1430-work' && payload.version === 2, 'portable work preserves the new task ID in the supported file format');
    const imported = createHarness(); await teacher(imported); await imported.import(payload);
    test(same(work(imported).ids, [task.id]), 'a new understanding task survives import into a separate workspace');
    await h.change('#include-answers', true); await h.click('[data-action="print-preview"]');
    test(h.text().includes(task.prompt) && h.text().includes('Критерии'), 'print preview includes the actual understanding condition and self-review criteria');
    await h.click('[data-action="download"]');
    test(calls.length === 1 && calls[0].tasks[0].id === task.id && calls[0].tasks[0].source === 'enrichment' && calls[0].tasks[0].rubric.length === task.rubric.length, 'PDF pipeline receives source, condition and criteria for the new open task');
    await h.click('[data-action="builder"]'); await h.click('[data-action="run-work"]');
    test(!!h.document.querySelector('#work-run-draft') && !h.document.querySelector('#work-run-answer-form'), 'understanding task launches with a written reasoning field, not numeric autograding');
    await h.input('#work-run-draft', 'Сначала нужно выполнить деление. Затем вычитание.'); await h.click('[data-action="run-reveal"]');
    for (const input of h.document.querySelectorAll('[data-run-rubric]')) await h.change(`[data-run-rubric="${input.dataset.runRubric}"]`, true);
    await h.click('[data-action="run-review"]');
    test(h.state().activeRun.records[task.id].reviewed && !h.state().activeRun.records[task.id].correct, 'self-review is recorded separately from automatically correct answers');
    test(h.networkCalls() === 0, 'new task filters, exports and work-run events remain offline');
  });

  await scenario('coverage exposes source-wide counts and gaps', async () => {
    const h = createHarness(); await teacher(h); await h.change('#source-filter', 'class:5:basic');
    await h.click('[data-action="toggle-builder-section"][data-section="coverage"]');
    const rows = h.document.querySelectorAll('#builder-coverage tbody tr');
    const topics = BANK.filter(topic => topic.grade === 5 && topic.level === 'basic');
    test(rows.length === topics.length && rows.length > 0, 'coverage map has one row per topic in the chosen source');
    const first = topics[0], matching = rows.find(row => row.querySelector('th').textContent.includes(first.title));
    const cells = matching.querySelectorAll('td');
    test(cells[0].textContent === String(first.tasks.length) && cells[1].textContent.startsWith(String(new Set(first.tasks.map(family)).size)), 'coverage displays independently counted task and family totals');
    test(h.get('#builder-coverage').textContent.includes('Нет заданий с развёрнутым рассуждением') && h.get('#builder-coverage').textContent.includes('не равно числу доказанно разных способов'), 'coverage gaps and limits of family counts are explicitly explained');
    await searchTask(h, classes.find(task => task.topicId === first.id));
    test(h.document.querySelectorAll('#builder-coverage tbody tr').length === topics.length && cards(h).length === 1, 'coverage remains source-wide when catalogue is narrowed to one task');
  });

  await scenario('malformed optional preferences cannot erase valid saved work', async () => {
    const invalid = {toString: 0, valueOf: 0}, task = classes.find(task => task.kind === 'number');
    const saved = {
      version: 2,
      works: [['unified', {ids: [task.id], title: 'Работа до повреждения настроек', variant: '2', answers: false}]],
      favorites: [task.id],
      resumeRoute: {role: 'teacher', view: 'builder'},
      bankTools: {
        quotas: {'Базовый': invalid}, openCount: invalid, format: invalid, noteFilter: invalid,
        notes: {[task.id]: {text: 'Сохранить этот комментарий', flag: invalid, excluded: false}},
        templates: [null, {id: 'malformed-template', name: 'Повреждённые настройки', count: invalid, settings: {quotas: {'Средний': invalid}, openCount: invalid, format: invalid, noteFilter: invalid}, context: {source: 'classes'}}]
      }
    };
    const store = new Map([[KEY, JSON.stringify(saved)]]), h = createHarness(store);
    test(same(work(h).ids, [task.id]) && work(h).title === saved.works[0][1].title, 'unsafe JSON coercion in optional settings cannot discard the saved work');
    test(h.state().favorites.includes(task.id) && h.state().resumeRoute.view === 'builder', 'malformed preferences do not interrupt restoration of unrelated workspace state');
    test(state(h).quotas['Базовый'] === 0 && state(h).openCount === 0 && state(h).format === 'all' && state(h).noteFilter === 'all', 'malformed count and property-key objects use safe preference defaults');
    test(state(h).notes[task.id].text === 'Сохранить этот комментарий' && state(h).notes[task.id].flag === '', 'a malformed editorial flag does not erase the valid note text');
    await h.click('[data-action="resume"]');
    await h.click('[data-action="template-load"][data-template="malformed-template"]');
    test(same(work(h).ids, [task.id]) && state(h).quotas['Средний'] === 0 && state(h).openCount === 0, 'applying a sanitized malformed template preserves the work and bounded settings');
  });

  const report = {checks, errors, scope: 'Actual events for family groups, micro skills, exclusive structured quotas, templates, teacher notes, thinking tasks and coverage'};
  console.log(JSON.stringify(report, null, 2));
  if (errors.length) process.exitCode = 1;
})().catch(error => {console.error(error); process.exitCode = 1;});
