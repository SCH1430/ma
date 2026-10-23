#!/usr/bin/env python3
"""Conservative structural counting plus near-duplicate review candidates.
Canonical IDs count placements only. Families and normalized numeric clones form one
independent problem group. Similar wording is flagged, never silently called unique.
"""
from pathlib import Path
from collections import defaultdict,Counter
import json,re,hashlib
ROOT=Path(__file__).resolve().parents[1]
def normalize(text):
    text=str(text).lower().replace('ё','е').replace('−','-').replace('·','*').replace(':','/')
    # Typography must not turn the same formula into a new task.
    supers=str.maketrans('⁰¹²³⁴⁵⁶⁷⁸⁹⁻⁺','0123456789-+')
    text=re.sub(r'[⁻⁺]?[⁰¹²³⁴⁵⁶⁷⁸⁹]+',lambda m:'^('+m[0].translate(supers)+')',text)
    words=['zero','one','two','three','four','five','six','seven','eight','nine']
    text=re.sub(r'\^\s*\(?([+-]?\d+)\)?',lambda m:' pow'+''.join(words[int(c)] if c.isdigit() else ('minus' if c=='-' else 'plus') for c in m[1])+' ',text)
    text=text.replace('ˣ','^x').replace('ⁿ','^n')
    text=re.sub(r'\d+[.,]\d+',' decimal ',text)
    text=re.sub(r'[0-9₀₁₂₃₄₅₆₇₈₉]+',' # ',text)
    text=re.sub(r'\b[xyabcnkt]\b','v',text)
    text=re.sub(r'\b(?:один|одна|одно|двух|два|две|трех|три|четырех|четыре|пять|пяти|шесть|шести|семь|восемь|девять|десять)\b','#',text)
    return ' '.join(re.findall(r'[а-яa-z_]+|#|[+*/=<>≤≥√|^()∩∪-]',text))
def audit(bank,write=True):
    canonical_by_id={q['id']:q.get('canonicalId',q['id']) for t in bank for q in t['tasks']}
    tasks={q.get('canonicalId',q['id']):q for t in bank for q in t['tasks']}
    ids=list(tasks);parent={k:k for k in ids}
    def find(k):
        while parent[k]!=k:parent[k]=parent[parent[k]];k=parent[k]
        return k
    def union(a,b):
        a=canonical_by_id.get(a,a);b=canonical_by_id.get(b,b)
        if a in parent and b in parent:parent[find(b)]=find(a)
    family={};normal={};ideas={}
    for id,q in tasks.items():
        if q.get('family'):
            f=q['family']
            if f in family:union(family[f],id)
            else:family[f]=id
        idea=q.get('semanticKey')
        if idea:
            if idea in ideas:union(ideas[idea],id)
            else:ideas[idea]=id
        key=normalize(q['prompt'])
        if key in normal:union(normal[key],id)
        else:normal[key]=id
    # Earlier numeric variants are acknowledged, not counted as new problem ideas.
    for grade in [5,6]:
        for topic in range(1,9):
            base=f'{grade}-{topic:02}'
            if (grade,topic)==(5,1):union(base+'-2',base+'-3')
            elif (grade,topic)==(6,6):union(base+'-1',base+'-2')
            else:
                union(base+'-1',base+'-2');union(base+'-1',base+'-3')
    known=[
      ['7-01-2','7-01-5','7-01-6','7-01-7','7-01-8'],
      ['8-02-1','8-02-5','8-02-6','8-02-7','8-02-8'],
      ['8-05-2','8-05-5','8-05-6','8-05-7','8-05-8'],
      ['9-08-1','10-15-1','9-08-5','9-08-6','9-08-7','9-08-8'],
      ['10-02-2','10-02-5','10-02-6','10-02-7','10-02-8'],
      ['10-06-1','10-06-5','10-06-6','10-06-7','10-06-8'],
      ['7-01-3','5-205-5'],
      ['9-12-1','9-12-2','10-16-1'],
      ['11-06-2','11-06-5','11-06-6','11-06-7','11-06-8'],
      ['10-10-1','10-10-5','10-10-6','10-10-7','10-10-8'],
      ['11-01-2','11-01-5','11-01-6','11-01-7','11-01-8'],
      ['7-05-2','10-07-2'],
      ['10-03-2','10-03-5'],
      ['5-08-5','5-215-1'],
      ['6-02-7','5-212-10'],
      ['5-205-7','5-209-3']
    ]
    for group in known:
        for id in group[1:]:union(group[0],id)
    manual_groups=[];group_errors=[]
    for path in sorted((ROOT/'checks').glob('semantic-groups-*.json')):
        for group in json.loads(path.read_text())['groups']:
            members=group['ids']
            if not group.get('reason') or len(members)<2 or any(id not in canonical_by_id for id in members):
                group_errors.append({'file':path.name,'group':group});continue
            for id in members[1:]:union(members[0],id)
            manual_groups.append(group)
    review_path=ROOT/'checks/semantic-reviews.json'
    reviews=json.loads(review_path.read_text()) if review_path.exists() else {}
    def decision(a,b):
        decision=reviews.get('|'.join(sorted([a,b])))
        return decision if decision and decision['hashA']==hashlib.sha256(tasks[a]['prompt'].encode()).hexdigest() and decision['hashB']==hashlib.sha256(tasks[b]['prompt'].encode()).hexdigest() else None
    for key in reviews:
        a,b=key.split('|')
        if a in tasks and b in tasks:
            d=decision(a,b)
            if d and d['decision']=='variant':union(a,b)
    groups=defaultdict(list)
    for id in ids:groups[find(id)].append(id)
    # Word bigrams expose paraphrases even after numbers are removed. Review is explicit.
    gramsets={id:set(zip((w:=normalize(q['prompt']).split()),w[1:])) for id,q in tasks.items()}
    inverted=defaultdict(list)
    for id,grams in gramsets.items():
        for gram in grams:inverted[gram].append(id)
    intersections=Counter()
    for matches in inverted.values():
        if len(matches)>150:continue
        for i,a in enumerate(matches):
            for b in matches[i+1:]:
                if find(a)!=find(b):intersections[tuple(sorted([a,b]))]+=1
    near=[]
    for (a,b),overlap in intersections.items():
        ca=Counter(zip((wa:=normalize(tasks[a]['prompt']).split()),wa[1:]));cb=Counter(zip((wb:=normalize(tasks[b]['prompt']).split()),wb[1:]));total=sum((ca|cb).values());score=sum((ca&cb).values())/total if total else 0
        if score>=.72 and not decision(a,b):near.append({'a':a,'b':b,'similarity':round(score,3),'promptA':tasks[a]['prompt'],'promptB':tasks[b]['prompt']})
    near.sort(key=lambda q:-q['similarity'])
    variants=sum(len(v)-1 for v in groups.values())
    stats={'catalog_entries':sum(len(t['tasks']) for t in bank),'canonical_conditions':len(tasks),'independent_groups':len(groups),'numeric_or_template_variants':variants,'cross_catalog_reuses':sum(len(t['tasks']) for t in bank)-len(tasks),'new_parameter_families':len(family),'materialized_family_members':sum(bool(q.get('family')) for q in tasks.values()),'manual_family_groups':len(manual_groups),'near_duplicate_pairs_for_review':len(near),'group_errors':len(group_errors),'target_independent':3100,'target_reached':len(groups)>=3100 and not near and not group_errors}
    if write:
        (ROOT/'checks/semantic-results.json').write_text(json.dumps({'stats':stats,'groups':list(groups.values()),'near':near,'manual_family_groups':manual_groups,'errors':group_errors},ensure_ascii=False,indent=2))
    return stats
if __name__=='__main__':print(json.dumps(audit(json.loads((ROOT/'checks/bank.json').read_text())),ensure_ascii=False,indent=2))
