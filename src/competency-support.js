// Pedagogical task metadata is separate from the original class and FIPI banks.
globalThis.MathCompetencies = (() => {
  const data=typeof COMPETENCY_DATA!=='undefined'?COMPETENCY_DATA:{};
  const definitions=Array.isArray(data.competencies)?data.competencies:[];
  const known=new Set(definitions.map(item=>item.id));
  const own=(object,key)=>object&&Object.prototype.hasOwnProperty.call(object,key)?object[key]:undefined;
  function normalize(ids){
    const selected=new Set(Array.isArray(ids)?ids.filter(id=>typeof id==='string'&&known.has(id)):[]);
    return definitions.filter(item=>selected.has(item.id)).map(item=>item.id);
  }
  function forTask(task){
    if(!task||typeof task!=='object')return [];
    const explicit=Array.isArray(task.competencies)?task.competencies:undefined;
    return normalize(explicit??own(data.overrides,task.id)??own(data.tasks,task.id)??own(data.topics,task.topicId)??[]);
  }
  function matches(task,ids){
    if(!Array.isArray(ids))return false;
    if(!ids.length)return true;
    const selected=normalize(ids);
    return selected.length>0&&forTask(task).some(id=>selected.includes(id));
  }
  return {definitions,normalize,forTask,matches};
})();
