"""Validate and read the source-backed bank without making network requests."""
from __future__ import annotations

import base64
from collections import Counter
import hashlib
import html
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import struct
import math

ROOT = Path(__file__).resolve().parents[1]
VALID_COMPETENCIES = {'calculations','equations','graphs','modelling','geometry','data','reasoning'}
HOSTS = {'ege-profile':'math-ege.sdamgia.ru','ege-basic':'mathb-ege.sdamgia.ru','oge':'math-oge.sdamgia.ru'}
TAGS = {'div','p','br','span','b','strong','i','em','sub','sup','table','tbody','thead','tr','td','th','ol','ul','li','center','h3','img'}


def _image(value, png=False):
    match=re.fullmatch(r'data:(image/(?:png|jpeg|gif|svg\+xml));base64,([A-Za-z0-9+/=\r\n]+)',value)
    if not match:
        raise ValueError('Source image must be embedded locally')
    data=base64.b64decode(match.group(2),validate=True)
    if png:
        if match.group(1)!='image/png' or not data.startswith(b'\x89PNG\r\n\x1a\n'):
            raise ValueError('PDF source image must be PNG')
        width,height=struct.unpack('>II',data[16:24])
        if not (100<=width<=1600 and 1<=height<=1400):
            raise ValueError('Unreadable PDF tile dimensions')
    elif match.group(1)=='image/svg+xml':
        if re.search(rb'<script|<foreignObject|<style|<!DOCTYPE|<!ENTITY|@import|\bon\w+\s*=|(?:href|src)\s*=\s*[\"\'](?!#)|url\s*\(\s*(?![\"\']?#)',data,re.I):
            raise ValueError('Unsafe source SVG')


class SafeHTML(HTMLParser):
    def handle_starttag(self,tag,attrs):
        if tag not in TAGS:
            raise ValueError('Forbidden source HTML tag: '+tag)
        attrs=dict(attrs)
        if any(name not in {'class','src','alt','style','colspan','rowspan'} for name in attrs):
            raise ValueError('Forbidden source HTML attribute')
        if 'src' in attrs:
            if tag!='img':raise ValueError('Unexpected image source')
            _image(attrs['src'])
        if 'style' in attrs and re.search(r'url\s*\(|expression|@import|javascript|[<>]',attrs['style'],re.I):
            raise ValueError('Unsafe source style')

    def handle_startendtag(self,tag,attrs):
        self.handle_starttag(tag,attrs)


def normalize_formula_alt(value):
    """Translate only standard notation; ambiguous source formulae need review."""
    result=value.replace('в степени левая круглая скобка \\circ правая круглая скобка', 'градусов')
    result=re.sub(r'\\underset\s*([^\\]*?)\s*(?:\\mathop\s*)?равносильно',
                  lambda m:'при условии '+m[1].strip()+', равносильно',result)
    result=re.sub(r'\\log\s*}?\s*_\s*([245])}?(?!\d)',r'логарифм по основанию \1 ',result)
    result=result.replace('логарифм по основанию левая круглая скобка 5 правая круглая скобка }',
                          'логарифм по основанию 5')
    for original,replacement in {
        r'\thinspace':' ',r'\Rightarrow':' следовательно ',r'\mathop':'',
        r'\operatorname':'',r'\textrm':'',r'\omega':'омега',r'\angle':'угол ',
        r'\geqslant':' больше или равно ',r'\pm':'плюс-минус ',r'\over':' делить на ',
        r'\colon':' разделить на ',r'\ldots':'и так далее',r'\circ':'градусов',r'\%':' процентов ',
    }.items():
        result=result.replace(original,replacement)
    if re.search(r'\\[A-Za-z%]',result):
        raise ValueError('Review an unsupported source formula alternative: '+result[:180])
    return re.sub(r'\s+',' ',result).strip() if result!=value else value


def accessible_bank(bank):
    """Derive readable alternatives after checking the untouched source assets.

    Source HTML hashes still identify the original rasterization. Alternatives
    change only alt attributes; the single reviewed solution correction is
    explicitly labelled and uses native PDF text instead of its broken image.
    """
    data=json.loads((ROOT/'src/sdamgia/accessibility.json').read_text(encoding='utf-8'))
    if data.get('version')!=1:raise ValueError('Unsupported source accessibility version')
    alternatives={(r['taskId'],r['field'],r['originalAlt']):r for r in data['formulaAlternatives']}
    solutions={r['taskId']:r for r in data['solutions']}
    if len(alternatives)!=len(data['formulaAlternatives']) or len(solutions)!=len(data['solutions']):
        raise ValueError('Duplicate source accessibility review')
    used=set();used_solutions=set()
    for q in bank['tasks']:
        correction=solutions.get(q['id'])
        if correction:
            if correction['sourceHtmlSha256']!=q['renderedHtmlSha256']:
                raise ValueError('Source solution changed since editorial correction: '+q['id'])
            SafeHTML().feed(correction['solutionHtml'])
            q['solution']=correction['solution'];q['solutionHtml']=correction['solutionHtml']
            q['solutionEditorialNote']=correction['note'];q['solutionImages']=[]
            used_solutions.add(q['id'])
        for field in ('promptHtml','solutionHtml','answerHtml'):
            def image(match):
                tag=match[0]
                alt=re.search(r'\balt=("|\')(.*?)\1',tag,re.S)
                if not alt:return tag
                before=html.unescape(alt[2]);key=(q['id'],field,before)
                reviewed=alternatives.get(key)
                if reviewed:
                    src=re.search(r'\bsrc=("|\')(.*?)\1',tag,re.S)
                    if not src or hashlib.sha256(html.unescape(src[2]).encode()).hexdigest()!=reviewed['imageSha256']:
                        raise ValueError('Source image changed since alternative review: '+q['id'])
                    after=reviewed['text'];used.add(key)
                else:after=normalize_formula_alt(before)
                if after==before:return tag
                if re.findall(r'\d',after)!=re.findall(r'\d',before):
                    raise ValueError('Formula alternative changed numerical values: '+q['id'])
                plain={'promptHtml':'prompt','solutionHtml':'solution'}.get(field)
                if plain:q[plain]=q[plain].replace(before,after)
                return tag[:alt.start()]+'alt="'+html.escape(after,quote=True)+'"'+tag[alt.end():]
            q[field]=re.sub(r'<img\b[^>]*>',image,q[field],flags=re.I)
    if used!=set(alternatives) or used_solutions!=set(solutions):
        raise ValueError('Reviewed source accessibility alternative no longer matches its original')
    return bank


def build_sdamgia_bank():
    bank=json.loads((ROOT/'src/sdamgia/bank.json').read_text(encoding='utf8'))
    if bank.get('version')!=1 or len(bank.get('tasks',[]))!=200 or len(bank.get('subtypes',[]))!=25:
        raise ValueError('Expected the reviewed selection of 200 tasks in 25 subtypes')
    subtypes={s['id']:s for s in bank['subtypes']}
    if len(subtypes)!=25:raise ValueError('Duplicate source subtype')
    for s in subtypes.values():
        if s['exam'] not in HOSTS or not set(s['competencies'])<=VALID_COMPETENCIES:
            raise ValueError('Invalid source subtype metadata')
        if s['sourceUrl']!='https://'+HOSTS[s['exam']]+'/test?filter=all&category_id='+str(s['categoryId']):
            raise ValueError('Invalid source category URL')
    seen=set();counts=Counter()
    for q in bank['tasks']:
        sid=q['sourceId'];exam=q['exam'];subtype=subtypes[q['subtypeId']]
        if exam not in HOSTS or not re.fullmatch(r'\d+',sid):raise ValueError('Invalid original ID')
        if q['id']!=f'sdamgia-{exam}-{sid}' or q['id'] in seen:raise ValueError('Duplicate task ID')
        seen.add(q['id']);counts[subtype['id']]+=1
        if q['sourceUrl']!='https://'+HOSTS[exam]+'/problem?id='+sid:
            raise ValueError('Original source URL does not match task ID')
        if subtype['exam']!=exam or q.get('examId') or q['source']!='sdamgia':
            raise ValueError('Source task misclassified as a FIPI demo')
        if exam=='oge' and subtype['categoryId'] in {8,15} and q['kind']!='sequence':
            raise ValueError('Matching/statement task requires an ordered digit response')
        if exam=='oge' and subtype['categoryId']==113 and q['kind']!='number':
            raise ValueError('Progression task asks for a number, not a digit sequence')
        if not set(q['competencies'])<=VALID_COMPETENCIES:raise ValueError('Invalid source competency')
        if q['provenance']['sourceAnswer']!=q['display'] or not re.fullmatch('[0-9a-f]{64}',q['provenance']['pageSha256']):
            raise ValueError('Unverified source answer')
        prose_words=q['provenance'].get('sourceProseWords')
        if not isinstance(prose_words,int) or not 1<=prose_words<=190:
            raise ValueError('Unexpected source prose length')
        if q['kind']=='number':
            if isinstance(q['answer'],bool) or not isinstance(q['answer'],(int,float)) or not math.isfinite(q['answer']) or float(q['display'].replace('−','-').replace(',','.'))!=q['answer']:
                raise ValueError('Numeric answer differs from source')
        elif q['kind']=='sequence':
            if not q['display'].isdigit() or q['answer']!=q['display']:raise ValueError('Invalid sequence answer')
        elif q['kind']=='open':
            if q['answer'] is not None or len(q['rubric'])<3:raise ValueError('Missing open response criteria')
        else:raise ValueError('Unknown source answer format')
        if re.search(r'задание ещ[её] не решено|решение прототипа',q['solution'],re.I):
            raise ValueError('Prototype-placeholder solution is not a solution of this task')
        for field in ['prompt','solution']:
            if len(q[field])<10:raise ValueError('Missing source content')
            SafeHTML().feed(q[field+'Html'])
        SafeHTML().feed(q['answerHtml'])
        signature=hashlib.sha256('\n'.join(q[field] for field in ['promptHtml','solutionHtml','answerHtml']).encode()).hexdigest()
        if q.get('renderedHtmlSha256')!=signature:
            raise ValueError('Stale source rasterization: '+q['id'])
        for field in ['printImages','solutionImages','answerImages']:
            if not q.get(field):raise ValueError('Missing faithful offline PDF rendering: '+q['id'])
            for image in q[field]:_image(image,png=True)
    if set(counts.values())!={8}:raise ValueError('Each reviewed subtype must contain eight tasks')
    return accessible_bank(bank)


if __name__=='__main__':
    bank=build_sdamgia_bank()
    print(json.dumps({'tasks':len(bank['tasks']),'subtypes':len(bank['subtypes']),
                      'byExam':dict(Counter(q['exam'] for q in bank['tasks'])),
                      'kinds':dict(Counter(q['kind'] for q in bank['tasks'])),
                      'sha256':hashlib.sha256((ROOT/'src/sdamgia/bank.json').read_bytes()).hexdigest()},ensure_ascii=False))
