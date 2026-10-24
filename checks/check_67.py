from pathlib import Path
import sys, ast, json
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'src'))
from task_bank import load_grade
ns={"__file__":str(ROOT/"scripts/validate_bank.py")}
tree=ast.parse((ROOT/'scripts/validate_bank.py').read_text())
pre=[]
for node in tree.body:
 if isinstance(node,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='bank' for t in node.targets):break
 pre.append(node)
exec(compile(ast.Module(body=pre,type_ignores=[]),'validator-prelude','exec'),ns)
import runpy
for helper in sorted((ROOT/"checks").glob("math_helpers_*.py")):
 ns.update({k:v for k,v in runpy.run_path(str(helper),init_globals=ns).items() if not k.startswith("__")})
expected_topics={f'6-{n}' for n in range(206,243)}|{f'7-{n}' for n in range(201,239)}
bank=[];oracles={}
for grade in (6,7):
 grade_bank,grade_oracles=load_grade(grade)
 bank.extend(t for t in grade_bank if t['id'] in expected_topics)
 oracles.update(grade_oracles)
assert {t['id'] for t in bank}==expected_topics,'Missing topics from the authored 6–7 bank'
bank.sort(key=lambda t:tuple(map(int,t['id'].split('-'))))
errors=[]; count=0; topics=[]
for topic in bank:
    # Open reasoning tasks were added later; this check retains the original
    # independently authored numeric exercises from these topic ranges.
    tasks=sorted((q for q in topic['tasks'] if q.get('authoredIndependent') and q.get('kind')!='open'),key=lambda q:int(q['id'].split('-')[-1]))
    if not tasks:errors.append((topic['id'],'missing authored numeric tasks'))
    levels={q['difficulty'] for q in tasks}
    if len(levels)!=4:errors.append((topic['id'],'missing levels',sorted(levels)))
    topics.append((topic['id'],len(tasks)))
    for q in tasks:
        count+=1
        try:
            actual=eval(oracles[q['id']],ns)
            expected=q['answer']
            ok=(isinstance(actual,list) and len(actual)==len(expected) and all(ns['close'](a,b) for a,b in zip(sorted(actual),sorted(expected)))) if isinstance(expected,list) else ns['close'](actual,expected)
            if not ok:errors.append((q['id'],str(actual),str(expected)))
        except Exception as e:errors.append((q['id'],type(e).__name__,str(e)))
report={'tasks':count,'topics':topics,'errors':errors}
(ROOT/'checks/results_67.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
print(json.dumps(report,ensure_ascii=False,indent=2))
raise SystemExit(bool(errors))
