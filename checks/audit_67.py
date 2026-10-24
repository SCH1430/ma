from pathlib import Path
import sys,runpy,json,collections,re
root=Path(__file__).resolve().parents[1];sys.path.insert(0,str(root/'src'))
from task_bank import load_bank
bank,_=load_bank()
# Preserve the original author-bank scope, excluding later open tasks.
expected_topics={f'6-{n}' for n in range(206,243)}|{f'7-{n}' for n in range(201,239)}
topics=sorted((t for t in bank if t['id'] in expected_topics),key=lambda t:tuple(map(int,t['id'].split('-'))))
assert {t['id'] for t in topics}==expected_topics,'Missing topics from the authored 6–7 bank'
normalize=runpy.run_path(str(root/'scripts/semantic_audit.py'))['normalize']
own={q['id']:q for t in topics for q in sorted(t['tasks'],key=lambda q:int(q['id'].split('-')[-1])) if q.get('authoredIndependent') and q.get('kind')!='open'}
assert own,'Missing authored numeric tasks from the 6–7 bank'
other={q['id']:q for t in bank for q in t['tasks'] if q['id'] not in own}
allq=dict(other,**own);normal=collections.defaultdict(list)
for id,q in allq.items():normal[normalize(q['prompt'])].append(id)
groups=[v for v in normal.values() if len(v)>1 and any(i in own for i in v)]
gramsets={k:set(zip((w:=normalize(v['prompt']).split()),w[1:])) for k,v in allq.items()}
gramcounts={k:collections.Counter(zip((w:=normalize(v['prompt']).split()),w[1:])) for k,v in allq.items()}
pairs=[]
for a in own:
 for b in allq:
  if b==a or (b in own and b<a):continue
  ga,gb=gramsets[a],gramsets[b]
  if len(ga&gb)/max(1,min(len(ga),len(gb)))<.72:continue
  ca,cb=gramcounts[a],gramcounts[b];total=sum((ca|cb).values());score=sum((ca&cb).values())/total if total else 0
  if score>=.72 and normalize(allq[a]['prompt'])!=normalize(allq[b]['prompt']):pairs.append([a,b,round(score,3),allq[a]['prompt'],allq[b]['prompt']])
report={'own_tasks':len(own),'normalized_clone_groups':groups,'near':sorted(pairs,key=lambda p:-p[2])}
(root/'checks/semantic_67.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
print(json.dumps(report,ensure_ascii=False,indent=2))
