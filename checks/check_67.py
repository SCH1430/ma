from pathlib import Path
import sys, ast, json
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'src'))
import author_tools
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
errors=[]; count=0; topics=[]
for path in sorted((ROOT/'src/author_banks').glob('*.py')):
 if not(path.name.startswith('06_') and path.name!='06_a.py' or path.name.startswith('07_')):continue
 bank=[];exec(compile(path.read_text(),str(path),'exec'),{'bank':bank})
 for topic in bank:
  levels={q['difficulty'] for q in topic['tasks']}
  if len(levels)!=4:errors.append((topic['id'],'missing levels',sorted(levels)))
  topics.append((topic['id'],len(topic['tasks'])))
  for q in topic['tasks']:
   count+=1
   try:
    actual=eval(author_tools.ORACLES[q['id']],ns)
    expected=q['answer']
    ok=(isinstance(actual,list) and len(actual)==len(expected) and all(ns['close'](a,b) for a,b in zip(sorted(actual),sorted(expected)))) if isinstance(expected,list) else ns['close'](actual,expected)
    if not ok:errors.append((q['id'],str(actual),str(expected)))
   except Exception as e:errors.append((q['id'],type(e).__name__,str(e)))
report={'tasks':count,'topics':topics,'errors':errors}
(ROOT/'checks/results_67.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
print(json.dumps(report,ensure_ascii=False,indent=2))
raise SystemExit(bool(errors))
