"""Exact independent checks and publication gates for the authored expansion.

Expressions are a small AST language, never Python eval. The authoring generator
is not imported here. Polynomial derivatives/integrals and finite experiments
are recomputed from coefficients or enumerated outcomes.
"""
from __future__ import annotations
import ast
from collections import Counter
from fractions import Fraction as F
import hashlib
import json
import math
import operator
from pathlib import Path
import re

ROOT=Path(__file__).resolve().parents[1]
DIRECTORY=ROOT/'src'/'quality-bank'
FORMATS={'error':'Найди ошибку','methods':'Сравни способы','counterexample':'Приведи контрпример','insufficient':'Достаточно ли данных?'}
CATEGORIES={'single':'Отдельный приём','combined':'Сочетание приёмов','applied':'Практическая задача','reasoning':'Рассуждение'}
STATES=('draft','math_checked','method_checked','ready')

def read(name): return json.loads((DIRECTORY/name).read_text(encoding='utf-8'))
def digest(value): return hashlib.sha256(json.dumps(value,ensure_ascii=False,sort_keys=True,separators=(',',':')).encode()).hexdigest()
def integer(value):
    assert not isinstance(value,bool) and int(value)==value and abs(value)<=10000, 'Unbounded/noninteger enumeration'
    return int(value)
def divisors(n): return [i for i in range(1,integer(n)+1) if n%i==0]
def multiples(lo,hi,*ds): return [i for i in range(integer(lo),integer(hi)+1) if all(i%d==0 for d in ds)]
def weighted_mean(values,counts): return sum(v*c for v,c in zip(values,counts))/sum(counts)
def median_value(values):
    a=sorted(values);n=len(a);return a[n//2] if n%2 else (a[n//2-1]+a[n//2])/2
def poly_value(cs,x): return sum(c*x**i for i,c in enumerate(cs))
def poly_derivative_value(cs,x): return sum(i*c*x**(i-1) for i,c in enumerate(cs) if i)
def poly_integral(cs,a,b): return sum(c*F(1,i+1)*(b**(i+1)-a**(i+1)) for i,c in enumerate(cs))
def poly_product(a,b):
    out=[F(0)]*(len(a)+len(b)-1)
    for i,x in enumerate(a):
        for j,y in enumerate(b):out[i+j]+=x*y
    return out
def covariance(xs,ys):
    assert len(xs)==len(ys)>0
    mx=sum(xs)/len(xs);my=sum(ys)/len(ys)
    return sum((x-mx)*(y-my) for x,y in zip(xs,ys))/len(xs)
def ordered_red_probability(r,b):
    r,b=integer(r),integer(b);pairs=[(i,j) for i in range(r+b) for j in range(r+b) if i!=j]
    return F(sum(i<r and j<r for i,j in pairs),len(pairs))
FUNCTIONS={
    'F':F,'abs':abs,'sum':sum,'min':min,'max':max,
    'count_divisors':lambda n:len(divisors(n)),
    'min_digit':lambda prefix,last,d:min(k for k in range(10) if (100*prefix+10*k+last)%d==0),
    'count_multiples':lambda lo,hi,*ds:len(multiples(lo,hi,*ds)),
    'first_multiple':lambda lo,hi,*ds:min(multiples(lo,hi,*ds)),
    'positive_remainder_add':lambda n,d:next(k for k in range(1,integer(d)+1) if (n+k)%d==0),
    'gcd_enum':lambda a,b:max(set(divisors(a))&set(divisors(b))),
    'lcm_enum':lambda a,b:next(k for k in range(1,integer(a*b)+1) if k%a==k%b==0),
    'common_divisor_count':lambda a,b:len(set(divisors(a))&set(divisors(b))),
    'integer_count':lambda lo,hi,include:sum(lo<=i<=hi if include else lo<i<hi for i in range(integer(lo)-1,integer(hi)+2)),
    'abs_integer_count':lambda c,r,include:sum(abs(i-c)<=r if include else abs(i-c)<r for i in range(integer(c-r)-1,integer(c+r)+2)),
    'weighted_mean':weighted_mean,'median_value':median_value,
    'count_positive_below_root':lambda n:sum(i*i<n for i in range(1,integer(n)+1)),
    'excluded_integer_count':lambda lo,hi,ex:sum(i not in ex for i in range(integer(lo),integer(hi)+1)),
    'irrational_square_root':lambda n:math.isqrt(integer(n))**2!=n,
    'ap_sum':lambda a,d,n:sum(a+i*d for i in range(integer(n))),
    'poly_value':poly_value,'poly_derivative_value':poly_derivative_value,'poly_integral':poly_integral,'poly_product':poly_product,
    'ordered_red_probability':ordered_red_probability,'covariance':covariance,
    'linear_integer_count':lambda a,n:sum(a*k<=n for k in range(integer(n)+1)),
    'first_linear_solution':lambda a,b,n:next(k for k in range(integer(b)) if (n-a*k)%b==0),
    'nonnegative_pair_count':lambda a,b,n:sum(a*i+b*j==n for i in range(integer(n)+1) for j in range(integer(n)+1)),
}
BIN={ast.Add:operator.add,ast.Sub:operator.sub,ast.Mult:operator.mul,ast.Div:operator.truediv,ast.FloorDiv:operator.floordiv,ast.Mod:operator.mod,ast.Pow:operator.pow}
CMP={ast.Eq:operator.eq,ast.NotEq:operator.ne,ast.Lt:operator.lt,ast.LtE:operator.le,ast.Gt:operator.gt,ast.GtE:operator.ge}
def evaluate(expression,x=None):
    tree=ast.parse(expression,mode='eval');assert len(list(ast.walk(tree)))<=300,'Oversized check'
    def visit(n):
        if isinstance(n,ast.Expression):return visit(n.body)
        if isinstance(n,ast.Constant) and isinstance(n.value,(bool,int,float)):
            return n.value if isinstance(n.value,bool) else F(str(n.value))
        if isinstance(n,ast.Name) and n.id=='x' and x is not None:return x
        if isinstance(n,(ast.List,ast.Tuple)):return [visit(v) for v in n.elts]
        if isinstance(n,ast.UnaryOp) and isinstance(n.op,(ast.UAdd,ast.USub,ast.Not)):
            value=visit(n.operand);return not value if isinstance(n.op,ast.Not) else -value if isinstance(n.op,ast.USub) else value
        if isinstance(n,ast.BinOp) and type(n.op) in BIN:
            a,b=visit(n.left),visit(n.right)
            if isinstance(n.op,ast.Pow):assert int(b)==b and abs(b)<=15,'Unbounded exponent';b=int(b)
            value=BIN[type(n.op)](a,b);assert abs(value)<=10**15,'Unbounded arithmetic';return value
        if isinstance(n,ast.Compare):
            a=visit(n.left)
            for op,node in zip(n.ops,n.comparators):
                b=visit(node)
                if type(op) not in CMP:raise ValueError('Unsupported comparison')
                if not CMP[type(op)](a,b):return False
                a=b
            return True
        if isinstance(n,ast.BoolOp):
            return all(visit(v) for v in n.values) if isinstance(n.op,ast.And) else any(visit(v) for v in n.values)
        if isinstance(n,ast.Call) and isinstance(n.func,ast.Name) and n.func.id in FUNCTIONS and not n.keywords:
            return FUNCTIONS[n.func.id](*[visit(a) for a in n.args])
        raise ValueError('Unsupported verification syntax: '+ast.dump(n))
    return visit(tree)

def check_math(q):
    spec=q['verification']
    if q['kind']=='number':
        assert spec['type']=='numeric' and re.search(r'\bx\b',spec['expression']), 'Answer must enter check'
        exact=F(q['display'].replace(',','.'))
        assert math.isfinite(q['answer']) and abs(float(exact)-q['answer'])<1e-10,'Display/answer mismatch'
        assert evaluate(spec['expression'],exact) is True,'Numeric condition failed'
    else:
        assert spec['type']=='reasoning' and q['answer'] is None and len(spec['claims'])>=1
        for claim in spec['claims']:assert evaluate(claim) is True,'Reasoning witness failed: '+claim

def load_source():
    source=read('bank.json');topics={t['id']:t for file in (ROOT/'src/tasks').glob('grade_*.json') for t in json.loads(file.read_text(encoding='utf-8'))}
    known=set(re.findall(r"^    \['([a-z-]+)'",(ROOT/'src/bank-pedagogy.js').read_text(encoding='utf-8'),re.M))
    assert source['version']==1 and len(source['packets'])==30 and len(source['tasks'])==600
    packets={p['topicId']:p for p in source['packets']};assert len(packets)==30
    seen=set();prompts=set();coverage=Counter();family_counts=Counter()
    for q in source['tasks']:
        try:
            assert q['topicId'] in packets and q['topicId'] in topics
            assert len(topics[q['topicId']]['tasks'])<=10,'Packet is not in the selected sparse-topic group'
            assert q['id'] not in seen and q['prompt'] not in prompts,'Duplicate ID or statement'
            seen.add(q['id']);prompts.add(q['prompt'])
            assert q['id'].startswith('quality-'+q['topicId']+'-') and q['canonicalId']==q['id']
            assert q['family'] in packets[q['topicId']]['families']
            assert isinstance(q['revision'],int) and q['revision']>=1
            for key in ('prompt','solution','hint','method'):
                assert isinstance(q[key],str) and len(q[key].strip())>=(10 if key=='prompt' else 15), 'Missing meaningful '+key
                assert not re.search(r'<(?:script|iframe|img)\b|\bon\w+\s*=',q[key],re.I)
            assert q['skills'] and set(q['skills'])<=known and set(q['prerequisites'])<=known,'Unknown/missing skill'
            assert len(q['skills'])==len(set(q['skills']))
            assert q['difficulty'] in ('Базовый','Средний','Повышенный')
            if q['kind']=='open':assert q['format'] in FORMATS and len(q['rubric'])==3 and all(len(s)>15 for s in q['rubric'])
            if q.get('figure'):
                f=q['figure'];assert f['alt'] and f['caption'] and f['elements']
                for e in f['elements']:
                    for k in ('x','x1','x2'):
                        if k in e:assert 0<=e[k]<=f['width']
                    for k in ('y','y1','y2'):
                        if k in e:assert 0<=e[k]<=f['height']
                # These authored diagrams show coordinates, not inferred geometry.
                # Check the plotted points against statement labels and one common
                # positive scale measured from the intersection of the two axes.
                horizontal,vertical=f['elements'][:2];scales=[]
                for i,e in enumerate(f['elements']):
                    if e['type']!='text':continue
                    match=re.fullmatch(r'([A-Z])\((-?\d+); (-?\d+)\)',e['text'])
                    assert match and e['text'] in q['prompt'].replace('−','-'),'Diagram label absent from statement'
                    point=f['elements'][i-1];assert point['type']=='ellipse'
                    for coordinate,pixel,origin,sign in ((int(match[2]),point['x'],vertical['x1'],1),(int(match[3]),point['y'],horizontal['y1'],-1)):
                        if coordinate:scales.append(sign*(pixel-origin)/coordinate)
                        else:assert math.isclose(pixel,origin,abs_tol=1e-8)
                assert scales and scales[0]>0 and all(math.isclose(s,scales[0],abs_tol=1e-8) for s in scales),'Unequal coordinate scales'
            check_math(q);coverage[q['topicId'],q['category']]+=1;family_counts[q['family']]+=1
        except Exception as exc:raise ValueError(q.get('id','?')+': '+str(exc)) from exc
    for tid in packets:
        assert {c:coverage[tid,c] for c in CATEGORIES}=={'single':6,'combined':6,'applied':4,'reasoning':4}
        assert len(packets[tid]['families'])==12
    assert Counter(family_counts.values())=={2:240,1:120}
    return source,topics

def validate_editorial(source):
    ledger=read('editorial.json');assert ledger['version']==1
    snapshots={}
    for q in source['tasks']:
        e=ledger['tasks'][q['id']];assert e['revision']==q['revision'] and e['sha256']==digest(q),q['id']+': unreviewed content change; sync a new revision'
        assert e['status'] in STATES and e['history']
        last=None
        for event in e['history']:
            name=event['snapshot'];assert re.fullmatch(r'revisions/[a-zA-Z0-9_.-]+\.json',name)
            if name not in snapshots:snapshots[name]=read(name)
            saved=snapshots[name][q['id']]
            assert digest(saved)==event['sha256'] and saved['revision']==event['revision'],'Changed immutable snapshot'
            assert event['reviewer'] and event['note'] and event['status'] in STATES
            if last and event['revision']==last['revision']:assert STATES.index(event['status'])==STATES.index(last['status'])+1
            else:assert event['status']=='draft' and (last is None or event['revision']==last['revision']+1)
            last=event
        assert all(e[k]==last[k] for k in ('revision','sha256','status'))
    return ledger

def build_quality_bank(bank=None):
    source,topics=load_source();ledger=validate_editorial(source);tasks=[]
    competency={'mean':'data','median':'data','probability':'data','conditional-probability':'data','covariance':'data','symmetry':'geometry','coordinates':'geometry','area':'geometry','volume':'geometry','angles':'geometry','integer-equation':'equations','parameters':'equations','linear-equation':'equations','systems':'equations','root-selection':'equations','logarithms':'equations'}
    for row in source['tasks']:
        entry=ledger['tasks'][row['id']]
        if entry['status']!='ready':continue
        q={k:v for k,v in row.items() if k!='verification'};t=topics[q['topicId']]
        q.update(source='quality',sourceLabel=f"Тематические пакеты · {t['grade']} класс"+(' · '+('углублённый' if t['level']=='advanced' else 'базовый') if t['grade']>=10 else ''),topic=t['title'],grade=t['grade'],level=t['level'],subject=t['subject'],editorialStatus=entry['status'],contentHash=entry['sha256'],categoryLabel=CATEGORIES[q['category']],competencies=sorted({competency.get(s,'calculations') for s in q['skills'] if s not in ('counterexample','justification','error-analysis','method-comparison')}|({'reasoning'} if q['kind']=='open' else set())|({'modelling'} if q['category']=='applied' else set())))
        if q.get('format'):q['formatLabel']=FORMATS[q['format']]
        if q.get('alternativeSolution'):q['solution']+=' Другой способ: '+q['alternativeSolution']
        tasks.append(q)
    legacy=read('legacy-skills.json');originals={q['id']:q for t in topics.values() for q in t['tasks']}
    known=set(re.findall(r"^    \['([a-z-]+)'",(ROOT/'src/bank-pedagogy.js').read_text(encoding='utf-8'),re.M))
    for qid,entry in legacy.items():
        assert digest(originals[qid])==entry['sha256'],'Re-review changed original task '+qid
        assert entry['skills'] and set(entry['skills'])<=known and set(entry['prerequisites'])<=known
    return {'version':1,'title':'Тематические пакеты','tasks':tasks,'legacySkills':legacy,'editorialCounts':dict(Counter(e['status'] for e in ledger['tasks'].values())),'packets':[{'topicId':p['topicId'],'title':topics[p['topicId']]['title'],'previousCount':len(topics[p['topicId']]['tasks'])} for p in source['packets']]}

if __name__=='__main__':
    data=build_quality_bank();print(json.dumps({'published':len(data['tasks']),'states':data['editorialCounts']},ensure_ascii=False))
