// Official demo tasks have two distinct short-answer formats. Sequences retain
// their order and leading zeroes; extended responses require a human review.
globalThis.MathExam = (() => {
  function normalizeSequence(raw) {
    return String(raw ?? '').trim().replace(/\s+/g, '');
  }
  function checkAnswer(raw, task, parseNumber) {
    if (task?.answerKind === 'open') return {valid:false, correct:false, requiresReview:true};
    const answers = Array.isArray(task?.answers) ? task.answers : [];
    if (task?.answerKind === 'sequence') {
      const value = normalizeSequence(raw);
      const valid = /^\d+$/.test(value);
      return {valid, correct:valid && answers.some(answer => value === normalizeSequence(answer)), requiresReview:false};
    }
    if (task?.answerKind !== 'number' || typeof parseNumber !== 'function') return {valid:false, correct:false, requiresReview:false};
    const value = parseNumber(raw);
    const valid = value !== null && Number.isFinite(value);
    return {valid, correct:valid && answers.some(answer => {
      const expected = parseNumber(answer);
      return expected !== null && Number.isFinite(expected) && value === expected;
    }), requiresReview:false};
  }
  function answerHint(task) {
    if (task?.answerKind === 'open') return 'Запишите полное решение с обоснованием. Сравните его с официальными критериями ФИПИ; автоматической оценки развёрнутого ответа здесь нет.';
    if (task?.answerKind === 'sequence') return 'Последовательность цифр в порядке из условия. Порядок важен. Пример записи: 2413; пробелы допустимы.';
    return 'Число без единиц. Точка и запятая допустимы; дробь можно записать как 3/4. Учитывайте указания об округлении в условии.';
  }
  return {normalizeSequence, checkAnswer, answerHint};
})();
