// The caller supplies the exact filtered pool. Selection never broadens filters.
(() => {
  'use strict';

  const MAX_TASKS = 60;
  const DEFAULT_COUNT = 10;
  const compareText = (a, b) => a < b ? -1 : a > b ? 1 : 0;
  const text = value => typeof value === 'string' && value.trim() ? value : '';
  const uniqueStrings = values => [...new Set(Array.isArray(values) ? values.filter(text) : [])];

  function boundedInteger(value, fallback, minimum, maximum) {
    const number = typeof value === 'number' || typeof value === 'string' && value.trim() ? Number(value) : NaN;
    return Number.isFinite(number) ? Math.max(minimum, Math.min(maximum, Math.floor(number))) : fallback;
  }

  function shuffled(rows, seed) {
    let state = 2166136261;
    for (let i = 0; i < seed.length; i++) {
      state ^= seed.charCodeAt(i);
      state = Math.imul(state, 16777619) >>> 0;
    }
    const random = () => {
      state = (state + 0x6D2B79F5) >>> 0;
      let value = Math.imul(state ^ state >>> 15, state | 1);
      value ^= value + Math.imul(value ^ value >>> 7, value | 61);
      return ((value ^ value >>> 14) >>> 0) / 4294967296;
    };
    const result = rows.slice();
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  function makeRow(task) {
    const examId = text(task.examId);
    const isExam = task.source === 'exam' || !!examId;
    const number = typeof task.number === 'number' || typeof task.number === 'string' && task.number.trim() ? Number(task.number) : NaN;
    const examNumber = Number.isFinite(number) ? number : null;
    const exampleNumber = boundedInteger(task.exampleNumber, 0, 0, Number.MAX_SAFE_INTEGER);
    // Examples separated by «ИЛИ» belong to the same original exam number.
    // A class topic is the corresponding unit of variety for class tasks.
    const group = isExam
      ? JSON.stringify(['exam', examId, examNumber === null ? task.id : examNumber])
      : JSON.stringify(['class', task.grade ?? null, task.level ?? null, text(task.topicId) || task.id]);
    return {id: task.id, isExam, examId, examNumber, exampleNumber, group, competencies: uniqueStrings(task.competencies)};
  }

  /**
   * select(filteredTasks, {count, seed, competencies, excludeIds, limit})
   *
   * count defaults to 10 and is restricted to 1..60; limit is the remaining
   * capacity (0..60, default 60). available counts unique eligible IDs after
   * exclusions. shortfall is requested - selected, including capacity limits.
   * covered/missingCompetencies refer only to the requested competencies.
   * Input tasks, metadata and options are never mutated.
   */
  function select(tasks, options) {
    options = options && typeof options === 'object' && !Array.isArray(options) ? options : {};
    const requested = boundedInteger(options.count, DEFAULT_COUNT, 1, MAX_TASKS);
    const limit = boundedInteger(options.limit, MAX_TASKS, 0, MAX_TASKS);
    const target = Math.min(requested, limit);
    const competencies = uniqueStrings(options.competencies);
    const excluded = new Set(uniqueStrings(options.excludeIds));
    const byId = new Map();
    for (const task of Array.isArray(tasks) ? tasks : []) {
      if (!task || typeof task !== 'object' || !text(task.id) || excluded.has(task.id) || byId.has(task.id)) continue;
      byId.set(task.id, makeRow(task));
    }
    const seed = typeof options.seed === 'string' ? options.seed : typeof options.seed === 'number' && Number.isFinite(options.seed) ? String(options.seed) : '1430';
    const rows = shuffled([...byId.values()].sort((a, b) => compareText(a.id, b.id)), seed);
    const selected = [];
    const chosen = new Set();
    const covered = new Set();
    const groupCounts = new Map();

    while (selected.length < target && selected.length < rows.length) {
      let best = null;
      let bestCoverage = -1;
      let bestGroupCount = Infinity;
      // First cover as many still-missing selected skills as possible. Then
      // prefer a new exam number/class topic, using the seed to break ties.
      for (const row of rows) {
        if (chosen.has(row.id)) continue;
        const coverage = competencies.reduce((total, id) => total + (!covered.has(id) && row.competencies.includes(id) ? 1 : 0), 0);
        const groupCount = groupCounts.get(row.group) || 0;
        if (coverage > bestCoverage || coverage === bestCoverage && groupCount < bestGroupCount) {
          best = row;
          bestCoverage = coverage;
          bestGroupCount = groupCount;
        }
      }
      if (!best) break;
      selected.push(best);
      chosen.add(best.id);
      groupCounts.set(best.group, (groupCounts.get(best.group) || 0) + 1);
      for (const id of best.competencies) covered.add(id);
    }

    // Keep one-exam worksheets in the familiar order of the demo version.
    const examId = selected[0]?.examId;
    if (examId && selected.every(row => row.isExam && row.examId === examId)) {
      selected.sort((a, b) => (a.examNumber ?? Infinity) - (b.examNumber ?? Infinity) || a.exampleNumber - b.exampleNumber || compareText(a.id, b.id));
    }

    return {
      ids: selected.map(row => row.id),
      requested,
      available: rows.length,
      selected: selected.length,
      shortfall: requested - selected.length,
      coveredCompetencies: competencies.filter(id => covered.has(id)),
      missingCompetencies: competencies.filter(id => !covered.has(id))
    };
  }

  globalThis.MathAutoWork = Object.freeze({select});
})();
