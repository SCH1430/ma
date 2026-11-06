// One presentation contract for every bank source. Keep original mathematical
// notation and diagrams: PDF-extracted text is an alternative, not a replacement.
globalThis.MathTaskView = (() => {
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const kind = task => task.kind || task.answerKind || 'number';
  const formats = {number:'Числовой ответ',set:'Множество ответов',sequence:'Последовательность',open:'Развёрнутое решение',interval:'Промежутки',coordinates:'Координаты',expression:'Выражение',matching:'Соответствие',steps:'Порядок шагов',examples:'Конструктивный пример'};
  const imageSource = value => typeof value === 'string' && /^data:image\/(?:png|jpeg|webp|gif);base64,/i.test(value);
  function images(values, label, options = {}) {
    const sources = (Array.isArray(values) ? values : []).filter(imageSource);
    if (!sources.length) return '';
    return `<div class="task-images exam-images">${sources.map((src, index) => `<div class="task-image-frame"><img class="exam-task-image" src="${escape(src)}" alt="${escape(label)}${sources.length > 1 ? `, фрагмент ${index + 1} из ${sources.length}` : ''}" decoding="async"${options.lazy ? ' loading="lazy"' : ''}><button type="button" class="figure-enlarge task-image-enlarge" data-task-image-open aria-label="Увеличить изображение: ${escape(label)}${sources.length > 1 ? `, фрагмент ${index + 1} из ${sources.length}` : ''}">Увеличить изображение</button></div>`).join('')}</div>`;
  }
  function context(task, options = {}) {
    const text = task.contextText || task.context || '';
    const description = task.contextDescription || '';
    const original = images(task.contextImages, 'Оригинал общего условия', options);
    if (!text && !original) return '';
    return `<details class="task-context exam-context"${options.compact ? '' : ' open'}><summary>Общее условие</summary>${text ? `<div class="task-prose task-context-text">${String(text).split(/\n\s*\n/).map(paragraph => `<p>${escape(paragraph)}</p>`).join('')}${description ? `<p class="task-figure-description">${escape(description)}</p>` : ''}</div>` : ''}${text && original ? `<details class="task-context-original"><summary>Рисунок и оригинал общего условия</summary>${original}</details>` : original}</details>`;
  }
  function content(task, options = {}) {
    const math = options.mathHTML || escape;
    const original = task.source === 'exam' || task.answerKind && task.images?.length;
    let statement;
    if (original && task.images?.length) {
      statement = images(task.images, 'Условие задания ' + (task.number || task.id), options)
        + `<div class="sr-only">${escape(task.prompt || task.text || '')}</div>`;
    } else if (task.promptHtml) {
      statement = `<div class="task-prose sourced-content work-run-source-html">${task.promptHtml}</div>`;
    } else {
      statement = `<p class="task-prompt">${math(task.prompt || task.text || '')}</p>`
        + images(task.images, 'Рисунок к заданию', options);
    }
    const figure = !original && !task.promptHtml && typeof options.figureSVG === 'function' ? options.figureSVG(task.id, !!options.compact, options.figureOptions) : '';
    const representations = globalThis.MathBankMethods?.representations?.(task, {mathHTML: math, esc: escape}) || '';
    const choices = globalThis.MathAnswerFormats?.supports(kind(task)) ? MathAnswerFormats.renderPrompt(task, {mathHTML: math, esc: escape}) : '';
    return `<div class="task-content${options.compact ? ' task-content-compact' : ''}" data-task-content="${escape(task.id)}">${context(task, options)}<div class="task-statement">${statement}</div>${figure}${representations}${choices}</div>`;
  }
  function answer(task, options = {}) {
    const math = options.mathHTML || escape;
    const value = task.display || task.answerText || '';
    const answer = task.answerHtml ? `<div class="task-prose sourced-content">${task.answerHtml}</div>` : value ? `<p><strong>${kind(task) === 'open' ? 'Образец ответа' : 'Ответ'}:</strong> ${math(value)}</p>` : '';
    const solution = task.solutionHtml ? `<div class="task-prose sourced-content">${task.solutionHtml}</div>` : task.solution ? `<p>${math(task.solution)}</p>` : '';
    const explanation = task.answerExplanation ? `<p>${math(task.answerExplanation)}</p>` : '';
    const examples = task.acceptedExamples?.length ? `<p><strong>Допустимые образцы:</strong> ${task.acceptedExamples.map(math).join(' · ')}</p>` : '';
    const editorial = task.solutionEditorialNote ? `<p class="task-editorial-note">${escape(task.solutionEditorialNote)}</p>` : '';
    return `<div class="task-answer-content">${editorial}${answer}${solution}${explanation}${examples}${!answer && !solution && task.source === 'exam' ? '<p>Развёрнутое решение проверяется по официальным критериям ниже.</p>' : ''}</div>`;
  }
  function references(task, options = {}) {
    const pages = [...(task.solutionPages || []), ...(task.answerPages || [])];
    const seen = new Set();
    return pages.filter(page => page?.image && !seen.has(page.image) && seen.add(page.image)).map(page => `<figure class="exam-reference-page"><figcaption>Страница ${escape(page.page)} оригинала · ответы и критерии</figcaption>${images([page.image], 'Ответы и критерии, страница ' + page.page, options)}</figure>`).join('');
  }
  function hasWorkedSolution(task) {
    return !!(task && task.source !== 'exam' && task.source !== 'sdamgia' && typeof task.solution === 'string' && task.solution.trim());
  }
  function workedExample(task, options = {}) {
    return content(task, {...options, compact: true}) + answer(task, options);
  }
  return Object.freeze({content, context, answer, references, images, kind, formats, hasWorkedSolution, workedExample, format: task => formats[kind(task)] || 'Ответ по условию'});
})();
