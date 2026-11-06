"""Check every derived source caption and the independently repaired worked solution."""
from fractions import Fraction as F
from html.parser import HTMLParser
import hashlib
import json
import re

from sdamgia_assets import ROOT, build_sdamgia_bank, normalize_formula_alt


class Images(HTMLParser):
    def __init__(self):
        super().__init__();self.images=[]

    def handle_starttag(self,tag,attrs):
        if tag=='img':self.images.append(dict(attrs))


def images(markup):
    parser=Images();parser.feed(markup);return parser.images


def main():
    source_path=ROOT/'src/sdamgia/bank.json'
    before=source_path.read_bytes();source=json.loads(before)
    derived=build_sdamgia_bank()
    assert source_path.read_bytes()==before, 'Reviewed source cache remains byte-for-byte unchanged'
    assert len(derived['tasks'])==len(source['tasks'])==200
    changed_fields=0;changed_alts=0;checked_alts=0;corrections=0
    for raw,q in zip(source['tasks'],derived['tasks']):
        assert raw['id']==q['id']
        assert raw['answer']==q['answer'] and raw['display']==q['display']
        assert raw['printImages']==q['printImages'] and raw['answerImages']==q['answerImages']
        assert raw['renderedHtmlSha256']==q['renderedHtmlSha256']
        for field in ('promptHtml','solutionHtml','answerHtml'):
            current=images(q[field]);original=images(raw[field])
            if q.get('solutionEditorialNote') and field=='solutionHtml':
                assert not current and not q['solutionImages']
                assert q['id']=='sdamgia-ege-profile-26594'
                corrections+=1
                continue
            assert len(current)==len(original)
            changed_fields+=raw[field]!=q[field]
            for old,new in zip(original,current):
                assert {k:v for k,v in old.items() if k!='alt'}=={k:v for k,v in new.items() if k!='alt'}, 'Formula graphics and layout remain unchanged'
                assert not re.search(r'\\[A-Za-z%]',new.get('alt','')), q['id']
                assert re.findall(r'\d',old['alt'])==re.findall(r'\d',new['alt']), 'Numerical digits remain unchanged'
                checked_alts+=1;changed_alts+=old['alt']!=new['alt']
        assert not re.search(r'\\[A-Za-z%]',q['prompt']+' '+q['solution']), q['id']+' searchable prose is readable'
        if not q.get('solutionEditorialNote'):assert raw['solutionImages']==q['solutionImages']
    assert corrections==1
    for value in ('12345','0,001','минус 12,5','2x плюс 18','40 000','3/7','x_0 = 25'):
        assert normalize_formula_alt(value)==value
    assert normalize_formula_alt(r'40 \thinspace 000')=='40 000'
    assert normalize_formula_alt(r'0,7k\geqslant0,819')=='0,7k больше или равно 0,819'
    try:normalize_formula_alt(r'\unknown123')
    except ValueError:pass
    else:raise AssertionError('Unknown commands must require review')

    q=next(q for q in derived['tasks'] if q['id']=='sdamgia-ege-profile-26594')
    assert q['display']=='25'
    assert '2v² − 31v − 475 = 0' in q['solution'] and 'v > 3' in q['solution']
    assert r'\uspilon' not in q['solutionHtml'] and '<img' not in q['solutionHtml']
    discriminant=31**2+4*2*475
    assert discriminant==69**2
    candidates=[F(31+69,4),F(31-69,4)]
    valid=[v for v in candidates if v>3 and F(475,v)+6==F(550,v-3)]
    assert valid==[F(q['display'])]
    report={'status':'passed','tasks':200,'htmlFields':600,'checkedImageAlternatives':checked_alts,
            'changedFields':changed_fields,'changedAlternatives':changed_alts,'editorialSolutions':corrections,
            'sourceSha256':hashlib.sha256(before).hexdigest(),
            'scope':'All derived captions, unchanged graphics/answers/source bytes, and independent rational check of the corrected solution.'}
    (ROOT/'checks/sdamgia-accessibility-results.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(report,ensure_ascii=False))


if __name__=='__main__':main()
