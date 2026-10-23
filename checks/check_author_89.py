from pathlib import Path
import sys,math,json
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'src'))
from bank_tools import ORACLES
src=Path(__file__).resolve().parents[1]
env={}
code=(src/'scripts/validate_bank.py').read_text().split('bank=json.loads')[0]
env['__file__']=str(src/'scripts/validate_bank.py')
exec(code,env)
ns={'bank':[]}
for p in sorted((src/'src/author_banks').glob('0[89]_*.py')):exec(p.read_text(),ns)
errors=[]
for t in ns['bank']:
    levels={q['difficulty'] for q in t['tasks']}
    if len(levels)!=4:errors.append((t['id'],'difficulty',levels))
    for q in t['tasks']:
        try:a=eval(ORACLES[q['id']],dict(env,**vars(math)))
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
report={'topics':len(ns['bank']),'tasks':sum(len(t['tasks']) for t in ns['bank']),'figures':sum(bool(q.get('figure')) for t in ns['bank'] for q in t['tasks']),'tricky':sum(bool(q.get('tricky')) for t in ns['bank'] for q in t['tasks']),'errors':errors}
(src/'checks/verification_author89.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
print(json.dumps(report,ensure_ascii=False))
raise SystemExit(bool(errors))
