// Archived IDs remain stable; new seasons have a year suffix.
globalThis.MathExamSeasons = (() => {
  const baseId=value=>typeof value==='object'&&value?value.baseExamId||String(value.id||'').replace(/-20\d\d$/,''):String(value||'').replace(/-20\d\d$/,'');
  const years=bank=>[...new Set((Array.isArray(bank)?bank:[]).map(e=>e.year).filter(Number.isInteger))].sort((a,b)=>b-a);
  const latestYear=bank=>years(bank)[0]||2027;
  const forYear=(bank,year)=>(Array.isArray(bank)?bank:[]).filter(e=>e.year===Number(year));
  const find=(bank,id,year)=>forYear(bank,year).find(e=>baseId(e)===baseId(id))||null;
  const label=exam=>exam?`${exam.year} · ${exam.status==='project'?'проект':'архив'}`:'';
  const sourceLabel=exam=>exam?`ФИПИ · ${exam.status==='project'?'проект демоверсии':'демоверсия'} ${exam.year}`:'';
  return Object.freeze({baseId,years,latestYear,forYear,find,label,sourceLabel});
})();
