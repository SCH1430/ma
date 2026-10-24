from pathlib import Path
import sys,math,json
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'src'))
from task_bank import load_grade
src=Path(__file__).resolve().parents[1]
env={}
code=(src/'scripts/validate_bank.py').read_text().split('bank=json.loads')[0]
env['__file__']=str(src/'scripts/validate_bank.py')
exec(code,env)
# These topic ranges retain the original numeric author-bank check coverage;
# open reasoning tasks in the same topics are checked by validate_bank.py.
expected_topics={f'8-{n}' for n in [*range(201,210),*range(220,225),*range(230,235)]}|{f'9-{n}' for n in [*range(201,206),*range(220,225),*range(230,235)]}
bank=[];oracles={}
for grade in (8,9):
    grade_bank,grade_oracles=load_grade(grade)
    bank.extend(dict(t,tasks=sorted((q for q in t['tasks'] if q.get('authoredIndependent') and q.get('kind')!='open'),key=lambda q:int(q['id'].split('-')[-1]))) for t in grade_bank if t['id'] in expected_topics)
    oracles.update(grade_oracles)
assert {t['id'] for t in bank}==expected_topics,'Missing topics from the authored 8–9 bank'
bank.sort(key=lambda t:tuple(map(int,t['id'].split('-'))))
errors=[]
for t in bank:
    if not t['tasks']:errors.append((t['id'],'missing authored numeric tasks'))
    levels={q['difficulty'] for q in t['tasks']}
    if len(levels)!=4:errors.append((t['id'],'difficulty',levels))
    for q in t['tasks']:
        try:a=eval(oracles[q['id']],dict(env,**vars(math)))
        except Exception as e:errors.append((q['id'],'oracle exception',str(e)));continue
        b=q['answer']
        for field in ['prompt','solution','display']:
            if not q[field]:errors.append((q['id'],'empty '+field))
        f=q.get('figure')
        if f:
            for el in f['elements']:
                coords=[]
                if el['type']=='line':coords=[(el['x1'],el['y1']),(el['x2'],el['y2'])]
                elif el['type']=='polygon':coords=el['points']
                elif el['type']=='text':coords=[(el['x'],el['y'])]
                elif el['type']=='ellipse':coords=[(el['x']-el['rx'],el['y']-el['ry']),(el['x']+el['rx'],el['y']+el['ry'])]
                if any(x<0 or y<0 or x>f['width'] or y>f['height'] for x,y in coords):errors.append((q['id'],'figure bounds',coords))
        good=(len(a)==len(b) and all(math.isclose(float(x),float(y),abs_tol=1e-8) for x,y in zip(sorted(a),sorted(b)))) if isinstance(b,list) else math.isclose(float(a),float(b),rel_tol=1e-8,abs_tol=1e-8)
        if not good:errors.append((q['id'],a,b))
report={'topics':len(bank),'tasks':sum(len(t['tasks']) for t in bank),'figures':sum(bool(q.get('figure')) for t in bank for q in t['tasks']),'tricky':sum(bool(q.get('tricky')) for t in bank for q in t['tasks']),'errors':errors}
(src/'checks/verification_author89.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
print(json.dumps(report,ensure_ascii=False))
raise SystemExit(bool(errors))
