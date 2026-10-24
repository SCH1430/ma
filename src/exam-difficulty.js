// The official specification assigns a difficulty level to each exam position.
globalThis.MathExamDifficulty = (() => {
  const data=typeof EXAM_DIFFICULTY_DATA!=='undefined'?EXAM_DIFFICULTY_DATA:{};
  function forTask(task){
    if(!task||typeof task!=='object'||data.year!==2026)return null;
    const exam=Object.prototype.hasOwnProperty.call(data.exams||{},task.examId)?data.exams[task.examId]:null;
    if(!exam||!Number.isInteger(Number(task.number))||Number(task.number)<1)return null;
    const code=Object.prototype.hasOwnProperty.call(exam.byNumber||{},task.number)?exam.byNumber[task.number]:null;
    return code&&Object.prototype.hasOwnProperty.call(data.levels||{},code)?data.levels[code]:null;
  }
  return Object.freeze({forTask});
})();
