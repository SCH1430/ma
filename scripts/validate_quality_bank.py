"""Publication invariants, independent counterchecks and revision regression tests."""
from copy import deepcopy
from collections import Counter
import json
from unittest.mock import patch
import quality_assets as qa
from review_quality_bank import advance

checks=0
def test(condition,label):
    global checks
    checks+=1
    assert condition,label
def rejects(fn,label):
    try:fn()
    except (AssertionError,ValueError,TypeError,KeyError,ZeroDivisionError):test(True,label);return
    test(False,label)

source,topics=qa.load_source();data=qa.build_quality_bank();ledger=qa.validate_editorial(source)
test(len(data['tasks'])==600,'All initial packets are ready')
test(Counter(q['kind'] for q in data['tasks'])=={'number':480,'open':120},'Four reasoning tasks in every packet')
test(len({q['family'] for q in data['tasks']})==360,'Variants remain grouped into authored families')
test(len(data['legacySkills'])==30,'First review batch of original metadata is present')
for q in source['tasks']:
    if q['kind']=='number':
        for delta in (-1,1):
            changed=deepcopy(q);value=qa.F(q['display'])+delta;changed['answer']=float(value);changed['display']=str(value)
            rejects(lambda:qa.check_math(changed),q['id']+' rejects neighbouring wrong answer')
    else:
        changed=deepcopy(q);changed['verification']['claims'][0]='1==2'
        rejects(lambda:qa.check_math(changed),q['id']+' rejects false reasoning witness')
test(qa.evaluate('poly_derivative_value([3,2,1],-2)==-2') is True,'Derivative checked at a negative argument')
test(qa.evaluate('poly_integral([0,1],-2,2)==0') is True,'Signed integral across zero')
test(qa.evaluate('nonnegative_pair_count(2,3,0)==1') is True,'Integer enumeration includes boundary zero')
test(qa.evaluate('ordered_red_probability(1,2)==0') is True,'Impossible draw has zero probability')
test(qa.evaluate('covariance([1,1],[2,4])==0') is True,'Constant-variable boundary')
for expr in ('__import__("os")','x.__class__','[x for x in [1]]','2**100000'):
    rejects(lambda:qa.evaluate(expr,qa.F(1)),'Unsupported executable or unbounded syntax')
changed=deepcopy(source);changed['tasks'][0]['solution']+=' Changed.'
rejects(lambda:qa.validate_editorial(changed),'Unreviewed text edits invalidate publication')
modified=deepcopy(ledger);modified['tasks'][source['tasks'][0]['id']]['history'].pop(1)
original_read=qa.read
with patch.object(qa,'read',side_effect=lambda name:modified if name=='editorial.json' else original_read(name)):
    rejects(lambda:qa.validate_editorial(source),'Skipped mathematical review rejected')
q=source['tasks'][0];entry=deepcopy(ledger['tasks'][q['id']]);entry['status']='draft';entry['history']=entry['history'][:1]
rejects(lambda:advance(q,entry,'ready','test','Attempt to skip required review stages.'),'Ready cannot skip review')
test(advance(q,entry,'math_checked','test','Exact mathematical checks passed again.'),'Draft advances to mathematical check')
test(advance(q,entry,'method_checked','test','Method and statement reviewed for this revision.'),'Methodological review is a separate stage')
test(advance(q,entry,'ready','test','Publication follows both required reviews.'),'Both gates allow ready')
test(not advance(q,entry,'ready','test','Already published revision remains unchanged.'),'Repeated status is idempotent')
pending=deepcopy(ledger);pending['tasks'][q['id']].update(status='draft');pending['tasks'][q['id']]['history']=pending['tasks'][q['id']]['history'][:1]
with patch.object(qa,'read',side_effect=lambda name:pending if name=='editorial.json' else original_read(name)):
    hidden=qa.build_quality_bank();test(len(hidden['tasks'])==599 and q['id'] not in {t['id'] for t in hidden['tasks']},'Draft excluded from the user catalogue')
report={'checks':checks,'tasks':600,'numeric':480,'reasoning':120,'packets':30,'families':360,'reviewedLegacy':30,'status':'passed','reviewScope':'Exact constraints and assistant editorial review; no claim of human expert certification.'}
(qa.ROOT/'checks/quality-bank-results.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps(report,ensure_ascii=False))
