#!/usr/bin/env python3
"""Independent calculations from conditions, not checks against the UI's saved answers.
Expressions are trusted, repository-authored test code, never student input.
"""
from pathlib import Path
from builtins import pow
from math import *
from builtins import pow
from statistics import mean,median,pvariance as variance
from fractions import Fraction
F=Fraction
from itertools import permutations,combinations,product
import json,runpy,ast,hashlib
ROOT=Path(__file__).resolve().parents[1]
def isprime(n):return n>=2 and all(n%d for d in range(2,isqrt(n)+1))
def qroots(a,b,c):
    if a==0:return [-c/b] if b else []
    d=b*b-4*a*c
    if d<0:return []
    return sorted(set([(-b-sqrt(d))/(2*a),(-b+sqrt(d))/(2*a)]))
def biquad(a,b,c):return sorted(set(v for t in qroots(a,b,c) if t>=0 for v in [-sqrt(t),sqrt(t)]))
def solve2(a,b,c,d,e,f):return ((e*d-b*f)/(a*d-b*c),(a*f-e*c)/(a*d-b*c))
def expect(xs,ps):return sum(x*p for x,p in zip(xs,ps))
def variance_rv(xs,ps):
    m=expect(xs,ps);return sum((x-m)**2*p for x,p in zip(xs,ps))
def recurrence(x,a,b,n):
    for _ in range(n-1):x=a*x+b
    return x
def derivative_poly(cs,x):return sum(c*(len(cs)-1-i)*x**(len(cs)-2-i) for i,c in enumerate(cs[:-1]))
def second_derivative_poly(cs,x):return sum(c*(len(cs)-1-i)*(len(cs)-2-i)*x**(len(cs)-3-i) for i,c in enumerate(cs[:-2]))
def integral_poly(cs,a,b):return sum(c/(len(cs)-i)*(b**(len(cs)-i)-a**(len(cs)-i)) for i,c in enumerate(cs))
def numerical_derivative(fn,x):
    h=1e-4
    return (-fn(x+2*h)+8*fn(x+h)-8*fn(x-h)+fn(x-2*h))/(12*h)
def correlation(xs,ys):
    mx,my=mean(xs),mean(ys)
    return sum((x-mx)*(y-my) for x,y in zip(xs,ys))/sqrt(sum((x-mx)**2 for x in xs)*sum((y-my)**2 for y in ys))
def regression_slope(xs,ys):
    mx,my=mean(xs),mean(ys)
    return sum((x-mx)*(y-my) for x,y in zip(xs,ys))/sum((x-mx)**2 for x in xs)
def legacy(g,t,n):
    # Recompute every retained 5–6 task from its numerical condition.
    f={
    (5,1):lambda: [21+3*(18-12),22+4*(2**3-2),23+5*(3**2-3)][n-1],
    (5,2):lambda: divmod(7*(n+4)+3,7)[1],
    (5,3):lambda: Fraction(n,8)+Fraction(n+1,8),
    (5,4):lambda: Fraction(f'{n}.25')+Fraction('2.5'),
    (5,5):lambda: 12*(n+1),
    (5,6):lambda: sum([n+4,n+2,n+4,n+2]),
    (5,7):lambda: sum([n+5]*4),
    (5,8):lambda: sum([n+3]*(3*2)),
    (6,1):lambda:gcd(6*(n+1),9*(n+1)),
    (6,2):lambda:Fraction(n,4)+Fraction(1,6),
    (6,3):lambda:Fraction(25,100)*(100+40*n),
    (6,4):lambda:Fraction(30*n,2+3)*2,
    (6,5):lambda:-7*n+3*n-2,
    (6,6):lambda:abs(-2**3)-abs(4) if n==3 else abs(-(n+5))-abs(n+1),
    (6,7):lambda:-(n+2),
    (6,8):lambda:-3*n}
    return f[g,t]()
def close(a,b):return isclose(float(a),float(b),rel_tol=1e-8,abs_tol=1e-8)
bank=json.loads((ROOT/'checks/bank.json').read_text());oracles=json.loads((ROOT/'checks/oracles.json').read_text())
proof_path=ROOT/'checks/property-reviews.json'
proofs=json.loads(proof_path.read_text()) if proof_path.exists() else {}
for path in sorted((ROOT/'checks').glob('property-reviews-*.json')):
    proofs.update(json.loads(path.read_text()))
property_ids=[];property_reviewed=[]
for helper in sorted((ROOT/'checks').glob('math_helpers_*.py')):
    globals().update({k:v for k,v in runpy.run_path(str(helper),init_globals=globals()).items() if not k.startswith('__')})
errors=[];ids=set();numeric_ids=set();open_ids=[];prompts={};bygrade={};figs=0;canonical_data={}
for t in bank:
    assert t['tasks'] and t['subject'] and t['ref']
    if set(q['difficulty'] for q in t['tasks'])!={'Базовый','Средний','Повышенный','Суперсложный'}:errors.append(t['id']+': missing difficulty tier')
    if t['grade']<=9 and t['level']!='basic':errors.append(t['id']+': wrong school level')
    for q in t['tasks']:
        id=q['id'];g,topic,n=map(int,id.split('-'))
        if id in ids:errors.append(f'{id}: duplicate id')
        ids.add(id)
        # One condition can be placed in several programmes with another valid
        # explanation. Identity belongs to the mathematical givens and answer.
        signature={k:q.get(k) for k in ['prompt','answer','figure','legacyFigure']}
        canon=q.get('canonicalId',id)
        if canon in canonical_data and canonical_data[canon]!=signature:errors.append(id+': shared canonical content diverges')
        canonical_data[canon]=signature
        if q['prompt'] in prompts and prompts[q['prompt']]!=q.get('canonicalId',id):errors.append(f'{id}: duplicate prompt without shared identity')
        prompts[q['prompt']]=q.get('canonicalId',id)
        for field in ['prompt','solution','display']:
            if not q[field] or any(s in q[field] for s in ['TODO','заглушка','Проверим условие','? По таблице']):errors.append(f'{id}: incomplete {field}')
        if q.get('kind')=='open':
            open_ids.append(id)
            if q.get('answer') is not None:errors.append(id+': open task must not have a numeric answer')
            rubric=q.get('rubric')
            if not isinstance(rubric,list) or not 3<=len(rubric)<=4 or any(not isinstance(v,str) or not v.strip() for v in rubric):errors.append(id+': open task requires 3–4 self-check criteria')
            hints=q.get('hints')
            if not isinstance(hints,list) or len(hints)!=2 or any(not isinstance(v,str) or not v.strip() for v in hints):errors.append(id+': open task requires two staged hints')
            if id in oracles:errors.append(id+': open task must not use a numeric oracle')
        else:
            numeric_ids.add(id)
            expr=oracles.get(id)
            if expr:
                try:
                    tree=ast.parse(expr,mode='eval')
                    try:ast.literal_eval(tree);is_property=True
                    except (ValueError,SyntaxError):
                        is_property=id in proofs or any(
                            (isinstance(node,ast.comprehension) and isinstance(node.iter,(ast.List,ast.Tuple)) and not node.iter.elts)
                            or (isinstance(node,ast.Call) and isinstance(node.func,ast.Name) and node.func.id=='len' and node.args and isinstance(node.args[0],(ast.List,ast.Tuple)) and not node.args[0].elts)
                            for node in ast.walk(tree))
                    if is_property:
                        property_ids.append(id)
                        digest=hashlib.sha256(json.dumps([q['prompt'],q['solution'],expr],ensure_ascii=False).encode()).hexdigest()
                        review=proofs.get(id,{})
                        if review.get('hash')==digest and review.get('reason'):property_reviewed.append(id)
                        else:errors.append(id+': property/proof requires current review')
                except SyntaxError:pass
            try:actual=eval(expr,globals()) if expr else legacy(g,topic,n)
            except Exception as exc:
                errors.append(f'{id}: oracle {type(exc).__name__}: {exc}')
                actual=nan
            expected=q['answer']
            for v in expected if isinstance(expected,list) else [expected]:
                if not isfinite(float(v)):errors.append(id+': nonfinite answer')
                if abs(float(v))>9007199254740991:errors.append(id+': answer exceeds JS exact integer bound')
            if isinstance(expected,list):
                ok=isinstance(actual,list) and len(actual)==len(expected) and all(close(a,b) for a,b in zip(sorted(actual),sorted(expected)))
            else:ok=close(actual,expected)
            if not ok:errors.append(f'{id}: condition gives {actual}, bank has {expected}')
        if q.get('precision') and q['precision']!=3:errors.append(f'{id}: precision')
        f=q.get('figure')
        if f:
            figs+=1
            if not f['alt'] or not f['elements']:errors.append(f'{id}: empty figure')
            for el in f['elements']:
                for key,val in el.items():
                    if isinstance(val,(int,float)) and not isfinite(val):errors.append(f'{id}: nonfinite {key}')
                coords=[]
                if el['type']=='line':coords=[(el['x1'],el['y1']),(el['x2'],el['y2'])]
                if el['type']=='polygon':coords=el['points']
                if el['type']=='text':coords=[(el['x'],el['y'])]
                if el['type']=='ellipse':coords=[(el['x']-el['rx'],el['y']-el['ry']),(el['x']+el['rx'],el['y']+el['ry'])]
                if any(x<0 or y<0 or x>f['width'] or y>f['height'] for x,y in coords):errors.append(f'{id}: figure coordinates out of bounds')
        bygrade[g]=bygrade.get(g,0)+1
if set(oracles)-numeric_ids:errors.append('numeric oracles contain unknown or open task IDs')
if len(oracles)!=len(numeric_ids)-48:errors.append('numeric oracle coverage differs from the 48 reviewed legacy tasks')
report={'tasks':len(ids),'topics':len(bank),'numeric_expression_checks':len(numeric_ids)-len(property_ids),'open_task_checks':len(open_ids),'open_ids':open_ids,'property_or_direct_value_checks':len(property_ids),'property_reviews_current':len(property_reviewed),'property_ids':property_ids,'by_grade':bygrade,'explicit_figures':figs,'errors':errors}
(ROOT/'checks/math-results.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
print(json.dumps(report,ensure_ascii=False,indent=2))
raise SystemExit(bool(errors))
