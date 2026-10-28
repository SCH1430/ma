// Selection contracts for family-aware work assembly and difficulty quotas.
const fs = require('fs'), path = require('path'), vm = require('vm');
const context = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(__dirname, '../src/auto-work.js'), 'utf8'), context);
const select = (tasks, options) => JSON.parse(JSON.stringify(context.MathAutoWork.select(tasks, options)));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const sorted = values => [...values].sort();
const freeze = value => { if (value && typeof value === 'object') { Object.freeze(value); Object.values(value).forEach(freeze); } return value; };
let checks = 0;
const errors = [];
function test(condition, label) { checks++; if (!condition) errors.push(label); }
const row = (id, family, difficulty = 'Базовый', extra = {}) => ({id, family, difficulty, topicId: 'topic', competencies: [], ...extra});
const family = task => task.family || task.subtypeId || task.canonicalId || task.id;

const pool = [row('a1', 'a'), row('a2', 'a'), row('b1', 'b'), row('b2', 'b'), row('c', 'c')];
const before = JSON.stringify(pool);
const balanced = select(pool, {count: 5, seed: 'lesson'});
test(balanced.selected === 5 && balanced.mode === 'balanced' && balanced.familyCount === 3, 'balanced mode continues to allow numerical variants');
test(same(balanced, select(pool, {count: 5, seed: 'lesson', mode: 'invalid'})), 'unknown mode falls back to balanced');
const diverse = select(pool, {count: 5, seed: 'lesson', mode: 'diverse'});
test(diverse.selected === 3 && diverse.shortfall === 2 && diverse.familyCount === 3, 'diverse mode reports a family shortage rather than adding duplicate methods');
test(new Set(diverse.ids.map(id => family(pool.find(task => task.id === id)))).size === 3, 'each diverse selected task has a distinct family');
test(same(diverse, select([...pool].reverse(), {count: 5, seed: 'lesson', mode: 'diverse'})), 'seeded selection does not depend on input order');
const excluded = select(pool, {count: 5, mode: 'diverse', excludeIds: ['a1']});
test(excluded.selected === 2 && excluded.ids.every(id => !id.startsWith('a')), 'excluded IDs resolve family metadata before removing pool entries');
const external = select(pool, {count: 5, mode: 'diverse', excludeTasks: [row('external-a', 'a')]});
test(external.selected === 2 && external.ids.every(id => !id.startsWith('a')), 'selected work items outside the filtered pool still reserve their family');
const sparseExcluded = select(pool, {count: 5, mode: 'diverse', excludeTasks: [{id: 'a1'}]});
test(sparseExcluded.selected === 2 && sparseExcluded.ids.every(id => !id.startsWith('a')), 'known pool metadata resolves sparse excluded task records');
const canonicals = [row('original', 'one', 'Базовый', {canonicalId: 'shared'}), row('copy', 'two', 'Базовый', {canonicalId: 'shared'}), row('other', 'three')];
const canonicalResult = select(canonicals, {count: 3, mode: 'diverse'});
test(canonicalResult.selected === 2 && canonicalResult.ids.includes('other'), 'different family labels cannot duplicate one canonical condition');
const externalCanonical = select(canonicals, {count: 3, mode: 'diverse', excludeTasks: [row('another-copy', 'outside', 'Базовый', {canonicalId: 'shared'})]});
test(same(externalCanonical.ids, ['other']), 'canonical exclusion also works across different family labels and filtered sources');
const fallbacks = [{id: 's1', subtypeId: 'subtype'}, {id: 's2', subtypeId: 'subtype'}, {id: 'p1', canonicalId: 'parent'}, {id: 'p2', canonicalId: 'parent'}, {id: 'plain'}];
const fallbackResult = select(fallbacks, {mode: 'diverse', count: 5});
test(fallbackResult.selected === 3 && fallbackResult.familyCount === 3, 'family keys fall back through subtype, canonical ID, and task ID');

const practice = select(pool, {mode: 'practice', count: 4, familyId: 'a'});
test(same(sorted(practice.ids), ['a1', 'a2']) && practice.shortfall === 2 && practice.familyId === 'a', 'practice stays within the explicit family and reports its shortage');
const missingPractice = select(pool, {mode: 'practice', count: 2, familyId: 'absent'});
test(missingPractice.selected === 0 && missingPractice.shortfall === 2 && missingPractice.familyId === 'absent', 'missing practice family never falls back to unrelated tasks');
const autoPractice = select(pool, {mode: 'practice', count: 2, seed: 'pick-family'});
test(autoPractice.selected === 2 && autoPractice.familyCount === 1 && ['a', 'b'].includes(autoPractice.familyId), 'automatic practice chooses a family that can fill the requested count');
test(same(autoPractice, select(pool, {mode: 'practice', count: 2, seed: 'pick-family'})), 'automatic family choice is deterministic');
const practiceCanonical = select(canonicals.map(task => ({...task, family: 'same'})), {count: 3, mode: 'practice'});
test(practiceCanonical.selected === 2, 'practice does not repeat an identical canonical condition stored twice');

const levels = [row('e1', 'f1'), row('e2', 'f2'), row('e3', 'f3'), row('m1', 'f4', 'Средний'), row('m2', 'f5', 'Средний'), row('h1', 'f6', 'Повышенный')];
const difficultyQuotas = [{difficulty: 'Базовый', count: 2}, {difficulty: 'Средний', count: 1}, {difficulty: 'Повышенный', count: 1}];
const quotaResult = select(levels, {count: 60, difficultyQuotas, seed: 'quotas'});
test(quotaResult.requested === 4 && quotaResult.selected === 4 && quotaResult.shortfall === 0, 'difficulty quotas replace the plain requested count');
test(same(quotaResult.quotaResults.map(item => item.selected), [2, 1, 1]), 'each difficulty quota is filled exactly');
const quotaShort = select(levels, {difficultyQuotas: [{difficulty: 'Средний', count: 4}, {difficulty: 'Высокий', count: 1}]});
test(quotaShort.selected === 2 && quotaShort.shortfall === 3 && quotaShort.ids.every(id => id.startsWith('m')), 'shortage never broadens to other difficulty levels');
test(same(quotaShort.quotaResults.map(item => item.shortfall), [2, 1]), 'each missing difficulty has an explicit shortfall');
const capacity = select(levels, {difficultyQuotas, limit: 2});
test(capacity.selected === 2 && capacity.shortfall === 2 && capacity.quotaResults.reduce((sum, item) => sum + item.shortfall, 0) === 2, 'capacity loss is included in per-difficulty shortages');
const duplicates = select(levels, {difficultyQuotas: [{difficulty: 'Базовый', count: 1}, {difficulty: 'Базовый', count: 2}]});
test(duplicates.quotaResults.length === 1 && duplicates.quotaResults[0].requested === 3 && duplicates.selected === 3, 'duplicate difficulty quotas are combined');
test(select(levels, {difficultyQuotas: []}).requested === 0 && select(levels, {difficultyQuotas: []}).selected === 0, 'empty quota plans request no work');
test(select(levels, {difficultyQuotas: [null, {}, {difficulty: 'Базовый', count: -2}]}).selected === 0, 'malformed or negative quotas cannot select unintended tasks');
const capped = select(levels, {difficultyQuotas: [{difficulty: 'Базовый', count: 40}, {difficulty: 'Средний', count: 40}]});
test(capped.requested === 60 && same(capped.quotaResults.map(item => item.requested), [40, 20]), 'quota requests respect the 60-task work limit');
const filtered = select(levels.slice(0, 2), {difficultyQuotas: [{difficulty: 'Повышенный', count: 2}]});
test(filtered.available === 0 && filtered.selected === 0 && filtered.shortfall === 2, 'quotas operate only inside the caller supplied filtered pool');
const withReasoning = [...levels, row('open-basic', 'open-b', 'Базовый', {kind: 'open'}), row('open-high', 'open-h', 'Высокий', {answerKind: 'open'})];
const reasoningPlan = select(withReasoning, {difficultyQuotas: [{difficulty: 'Базовый', count: 3}, {difficulty: 'Повышенный', count: 1}], openCount: 1});
test(reasoningPlan.selected === 5 && same(reasoningPlan.quotaResults.map(quota => quota.selected), [3, 1, 1]) && reasoningPlan.ids.filter(id => id.startsWith('open-')).length === 1, 'reasoning is a separate slot, never counted again in its numeric difficulty bucket');
test(reasoningPlan.quotaResults[0].kind === 'short' && reasoningPlan.quotaResults[2].kind === 'open' && reasoningPlan.quotaResults[2].label === 'Рассуждение', 'exclusive reasoning quota exposes UI labels and answer kind');
const reasoningShort = select(withReasoning, {difficultyQuotas: [{difficulty: 'Базовый', count: 4}], openCount: 3});
test(reasoningShort.selected === 5 && same(reasoningShort.quotaResults.map(quota => quota.shortfall), [1, 1]), 'surplus open tasks cannot hide a short-answer shortage, and both shortages remain explicit');
test(same(select(withReasoning, {count: 4, openCount: 2}), select(withReasoning, {count: 4})), 'openCount has no effect without an explicit structured plan');

const overlapping = [row('shared-easy', 'shared'), row('shared-hard', 'shared', 'Повышенный'), row('easy-only', 'easy')];
const overlapQuotas = [{difficulty: 'Базовый', count: 1}, {difficulty: 'Повышенный', count: 1}];
for (let seed = 0; seed < 12; seed++) {
  const result = select(overlapping, {mode: 'diverse', difficultyQuotas: overlapQuotas, seed});
  test(same(sorted(result.ids), ['easy-only', 'shared-hard']), 'diverse quotas reserve the only hard family instead of consuming it at the easy level, seed ' + seed);
}
const diversityShort = select(overlapping, {mode: 'diverse', difficultyQuotas: [{difficulty: 'Базовый', count: 2}, {difficulty: 'Повышенный', count: 1}]});
test(diversityShort.selected === 2 && diversityShort.shortfall === 1 && diversityShort.familyCount === 2, 'family restrictions remain effective when difficulty quotas cannot all fit');
const crossing = [
  ['f0', 'c2', 'c'], ['f3', 'c6', 'b'], ['f6', 'c7', 'b'], ['f3', 'c8', 'a'],
  ['f4', 'c2', 'c'], ['f4', 'c8', 'a'], ['f5', 'c4', 'c'], ['f1', 'c3', 'a'],
  ['f5', 'c0', 'c'], ['f5', 'c8', 'c'], ['f2', 'c8', 'b'], ['f6', 'c7', 'c']
].map(([family, canonicalId, difficulty], i) => row('cross-' + i, family, difficulty, {canonicalId}));
for (let seed = 0; seed < 8; seed++) {
  const result = select(crossing, {mode: 'diverse', difficultyQuotas: ['a', 'b', 'c'].map(difficulty => ({difficulty, count: 2})), seed});
  const chosen = result.ids.map(id => crossing.find(task => task.id === id));
  test(result.selected === 6 && result.quotaResults.every(quota => quota.selected === 2) && new Set(chosen.map(task => task.family)).size === 6 && new Set(chosen.map(task => task.canonicalId)).size === 6, 'reassignment fills feasible quotas across crossing family and canonical conflicts, seed ' + seed);
}
const practiceQuotas = select([...overlapping, row('single-easy', 'single')], {mode: 'practice', difficultyQuotas: overlapQuotas});
test(practiceQuotas.familyId === 'shared' && practiceQuotas.selected === 2 && practiceQuotas.shortfall === 0, 'automatic practice family choice considers the entire requested difficulty plan');
const anchoredShort = select(overlapping, {mode: 'practice', familyId: 'easy', difficultyQuotas: overlapQuotas});
test(anchoredShort.selected === 1 && anchoredShort.quotaResults[1].shortfall === 1, 'anchored practice reports missing difficulty without leaving its family');
const allExcluded = select(levels, {mode: 'diverse', count: 4, excludeTasks: levels});
test(allExcluded.selected === 0 && allExcluded.available === 0 && allExcluded.shortfall === 4, 'fully excluded pools give an honest empty result');
const zeroCapacity = select(pool, {mode: 'practice', count: 3, limit: 0});
test(zeroCapacity.selected === 0 && zeroCapacity.shortfall === 3 && zeroCapacity.familyCount === 0, 'zero remaining work capacity never selects tasks');
const frozenTasks = freeze(JSON.parse(JSON.stringify(pool))), frozenOptions = freeze({mode: 'diverse', count: 3, excludeTasks: [row('outside', 'a')], difficultyQuotas: [{difficulty: 'Базовый', count: 3}]});
select(frozenTasks, frozenOptions);
test(JSON.stringify(pool) === before && JSON.stringify(frozenTasks) === before, 'selection leaves input rows and nested options unchanged');

const report = {checks, errors, scope: 'Family/canonical diversity, deterministic practice, strict difficulty quotas, exclusions, capacity and immutable inputs'};
console.log(JSON.stringify(report, null, 2));
if (errors.length) process.exitCode = 1;
