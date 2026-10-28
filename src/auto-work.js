// The caller supplies the exact filtered pool. Selection never broadens filters.
(() => {
  'use strict';

  const MAX_TASKS = 60;
  const DEFAULT_COUNT = 10;
  const OPEN_QUOTA = '\u0000open';
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
    return {id: task.id, isExam, examId, examNumber, exampleNumber, group,
      family: text(task.family) || text(task.subtypeId) || text(task.canonicalId) || task.id,
      canonical: text(task.canonicalId) || task.id, difficulty: text(task.difficulty), open: task.kind === 'open' || task.answerKind === 'open',
      competencies: uniqueStrings(task.competencies)};
  }

  function quotaPlan(value) {
    if (!Array.isArray(value)) return null;
    const quotas = new Map();
    let capacity = MAX_TASKS;
    for (const item of value) {
      if (!item || !text(item.difficulty)) continue;
      const count = Math.min(capacity, boundedInteger(item.count, 0, 0, MAX_TASKS));
      quotas.set(item.difficulty, (quotas.get(item.difficulty) || 0) + count);
      capacity -= count;
    }
    return [...quotas].map(([difficulty, count]) => ({difficulty, count}));
  }

  /**
   * select(filteredTasks, {count, seed, competencies, excludeIds, excludeTasks,
   *   limit, mode, familyId, difficultyQuotas, openCount})
   *
   * count defaults to 10 and is restricted to 1..60; limit is the remaining
   * capacity (0..60, default 60). available counts unique eligible IDs after
   * exclusions. shortfall is requested - selected, including capacity limits.
   * covered/missingCompetencies refer only to the requested competencies.
   * balanced preserves the ordinary topic/skill selection. diverse uses each
   * family and canonical condition at most once, including excluded tasks.
   * practice stays in familyId, or chooses a family suited to the request.
   * excludeTasks supplies metadata for work items outside the filtered pool.
   * difficultyQuotas replaces count; duplicate levels are combined, total is
   * capped at 60 in input order, and missing levels are never substituted.
   * An empty quota array requests no tasks. quotaResults reports each shortage.
   * With difficultyQuotas, openCount adds an exclusive reasoning quota: ordinary
   * difficulty quotas then select short answers, and open tasks fill only the
   * reasoning quota at any difficulty. Without a quota plan openCount is ignored.
   * Input tasks, metadata and options are never mutated.
   */
  function select(tasks, options) {
    options = options && typeof options === 'object' && !Array.isArray(options) ? options : {};
    const mode = ['balanced', 'diverse', 'practice'].includes(options.mode) ? options.mode : 'balanced';
    const quotas = quotaPlan(options.difficultyQuotas);
    const openCount = quotas ? Math.min(MAX_TASKS - quotas.reduce((sum, quota) => sum + quota.count, 0), boundedInteger(options.openCount, 0, 0, MAX_TASKS)) : 0;
    if (openCount > 0) quotas.push({difficulty: OPEN_QUOTA, count: openCount});
    const requested = quotas ? quotas.reduce((sum, quota) => sum + quota.count, 0) : boundedInteger(options.count, DEFAULT_COUNT, 1, MAX_TASKS);
    const limit = boundedInteger(options.limit, MAX_TASKS, 0, MAX_TASKS);
    const target = Math.min(requested, limit);
    const competencies = uniqueStrings(options.competencies);
    const excluded = new Set(uniqueStrings(options.excludeIds));
    const byId = new Map();
    for (const task of Array.isArray(tasks) ? tasks : []) {
      if (!task || typeof task !== 'object' || !text(task.id) || byId.has(task.id)) continue;
      byId.set(task.id, makeRow(task));
    }
    if (openCount > 0) for (const row of byId.values()) if (row.open) row.difficulty = OPEN_QUOTA;
    const excludedRows = [...byId.values()].filter(row => excluded.has(row.id));
    for (const task of Array.isArray(options.excludeTasks) ? options.excludeTasks : []) {
      if (!task || typeof task !== 'object' || !text(task.id)) continue;
      excluded.add(task.id);
      excludedRows.push(byId.get(task.id) || makeRow(task));
    }
    const excludedFamilies = new Set(excludedRows.map(row => row.family));
    const excludedCanonicals = new Set(excludedRows.map(row => row.canonical));
    const seed = typeof options.seed === 'string' ? options.seed : typeof options.seed === 'number' && Number.isFinite(options.seed) ? String(options.seed) : '1430';
    let rows = shuffled([...byId.values()].filter(row => !excluded.has(row.id)
      && (mode !== 'diverse' || !excludedFamilies.has(row.family) && !excludedCanonicals.has(row.canonical))
      && (mode !== 'practice' || !excludedCanonicals.has(row.canonical))
      && (!quotas || quotas.some(quota => quota.count > 0 && quota.difficulty === row.difficulty)))
      .sort((a, b) => compareText(a.id, b.id)), seed);
    let familyId = mode === 'practice' ? text(options.familyId) : '';
    if (mode === 'practice') {
      if (!familyId) {
        const families = new Map();
        for (const row of rows) {
          if (!families.has(row.family)) families.set(row.family, []);
          families.get(row.family).push(row);
        }
        let bestFill = -1, bestCoverage = -1;
        for (const [family, members] of families) {
          const unique = [...new Map(members.map(row => [row.canonical, row])).values()];
          const fill = quotas ? quotas.reduce((sum, quota) => sum + Math.min(quota.count, unique.filter(row => row.difficulty === quota.difficulty).length), 0) : Math.min(target, unique.length);
          const coverage = competencies.filter(id => members.some(row => row.competencies.includes(id))).length;
          if (fill > bestFill || fill === bestFill && coverage > bestCoverage) {
            familyId = family; bestFill = fill; bestCoverage = coverage;
          }
        }
      }
      rows = rows.filter(row => row.family === familyId);
    }
    const selected = [];
    const chosen = new Set();
    const covered = new Set();
    const groupCounts = new Map();
    const usedFamilies = new Set();
    const usedCanonicals = new Set();
    const quotaCounts = new Map();

    const eligible = row => !chosen.has(row.id)
      && (mode === 'balanced' || !usedCanonicals.has(row.canonical))
      && (mode !== 'diverse' || !usedFamilies.has(row.family));
    const quotaRemaining = quota => quota.count - (quotaCounts.get(quota.difficulty) || 0);

    while (selected.length < target && selected.length < rows.length) {
      let best = null;
      let bestCoverage = -1;
      let bestGroupCount = Infinity;
      let bestCompetition = Infinity;
      // Fill the most constrained difficulty first. This avoids consuming a
      // shared family at an easy level when it is the only harder candidate.
      const pending = quotas ? quotas.filter(quota => quotaRemaining(quota) > 0).map(quota => {
        const candidates = rows.filter(row => eligible(row) && row.difficulty === quota.difficulty);
        const available = mode === 'diverse' ? Math.min(new Set(candidates.map(row => row.family)).size, new Set(candidates.map(row => row.canonical)).size) : candidates.length;
        return {...quota, available};
      }) : [];
      const nextQuota = pending.filter(quota => quota.available > 0).sort((a, b) => a.available / quotaRemaining(a) - b.available / quotaRemaining(b))[0];
      if (quotas && !nextQuota) break;
      const familyLevels = new Map(), canonicalLevels = new Map();
      if (mode === 'diverse' && quotas) {
        for (const row of rows) {
          if (!eligible(row)) continue;
          for (const [map, key] of [[familyLevels, row.family], [canonicalLevels, row.canonical]]) {
            if (!map.has(key)) map.set(key, new Set());
            map.get(key).add(row.difficulty);
          }
        }
      }
      // First cover as many still-missing selected skills as possible. Then
      // prefer a new exam number/class topic, using the seed to break ties.
      for (const row of rows) {
        if (!eligible(row) || nextQuota && row.difficulty !== nextQuota.difficulty) continue;
        const coverage = competencies.reduce((total, id) => total + (!covered.has(id) && row.competencies.includes(id) ? 1 : 0), 0);
        const groupCount = groupCounts.get(row.group) || 0;
        const competition = mode === 'diverse' && quotas ? pending.reduce((total, quota) => total + (quota.difficulty !== row.difficulty && (familyLevels.get(row.family)?.has(quota.difficulty) || canonicalLevels.get(row.canonical)?.has(quota.difficulty)) ? quotaRemaining(quota) / Math.max(1, quota.available) : 0), 0) : 0;
        if (competition < bestCompetition || competition === bestCompetition && (coverage > bestCoverage || coverage === bestCoverage && groupCount < bestGroupCount)) {
          best = row;
          bestCoverage = coverage;
          bestGroupCount = groupCount;
          bestCompetition = competition;
        }
      }
      if (!best) break;
      selected.push(best);
      chosen.add(best.id);
      usedFamilies.add(best.family);
      usedCanonicals.add(best.canonical);
      quotaCounts.set(best.difficulty, (quotaCounts.get(best.difficulty) || 0) + 1);
      groupCounts.set(best.group, (groupCounts.get(best.group) || 0) + 1);
      for (const id of best.competencies) covered.add(id);
    }

    // An early choice may block a later quota through both family and canonical
    // identity. Reassign conflicting choices while preserving their difficulty
    // slots before reporting a shortage. The bound keeps unusual author metadata
    // from making a large browser-side selection unresponsive.
    let repairBudget = 30000;
    let searchLimited = false;
    function insertWithReassignment(current, difficulty, locked, depth) {
      if (depth > 12) { searchLimited = true; return null; }
      for (const row of rows) {
        if (--repairBudget < 0) { searchLimited = true; return null; }
        if (difficulty !== null && row.difficulty !== difficulty || current.some(item => item.id === row.id)) continue;
        const conflicts = current.filter(item => item.canonical === row.canonical || mode === 'diverse' && item.family === row.family);
        if (conflicts.some(item => locked.has(item.id))) continue;
        if (!conflicts.length) return [...current, row];
        let next = [...current.filter(item => !conflicts.includes(item)), row];
        const nextLocked = new Set([...locked, row.id]);
        for (const conflict of conflicts) {
          next = insertWithReassignment(next, quotas ? conflict.difficulty : null, nextLocked, depth + 1);
          if (!next) break;
        }
        if (next) return next;
      }
      return null;
    }
    if (mode !== 'balanced') {
      while (selected.length < target && repairBudget > 0) {
        const missing = quotas ? quotas.filter(quota => selected.filter(row => row.difficulty === quota.difficulty).length < quota.count).map(quota => quota.difficulty) : [null];
        let repaired = null;
        for (const difficulty of missing) {
          repaired = insertWithReassignment(selected, difficulty, new Set(), 0);
          if (repaired) break;
        }
        if (!repaired) break;
        selected.splice(0, selected.length, ...repaired);
      }
      usedFamilies.clear(); usedCanonicals.clear(); covered.clear(); quotaCounts.clear();
      for (const row of selected) {
        usedFamilies.add(row.family); usedCanonicals.add(row.canonical);
        quotaCounts.set(row.difficulty, (quotaCounts.get(row.difficulty) || 0) + 1);
        for (const id of row.competencies) covered.add(id);
      }
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
      mode,
      familyId,
      familyCount: usedFamilies.size,
      availableFamilies: new Set(rows.map(row => row.family)).size,
      searchLimited: searchLimited && selected.length < target,
      quotaResults: (quotas || []).map(quota => ({difficulty: quota.difficulty === OPEN_QUOTA ? 'any' : quota.difficulty,
        kind: quota.difficulty === OPEN_QUOTA ? 'open' : openCount > 0 ? 'short' : 'all',
        label: quota.difficulty === OPEN_QUOTA ? 'Рассуждение' : quota.difficulty, requested: quota.count,
        selected: quotaCounts.get(quota.difficulty) || 0,
        shortfall: quota.count - (quotaCounts.get(quota.difficulty) || 0)})),
      coveredCompetencies: competencies.filter(id => covered.has(id)),
      missingCompetencies: competencies.filter(id => !covered.has(id))
    };
  }

  globalThis.MathAutoWork = Object.freeze({select});
})();
