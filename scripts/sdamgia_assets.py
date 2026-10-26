"""Validate and read the source-backed bank without making network requests."""
from __future__ import annotations

import base64
from collections import Counter
import hashlib
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
    return bank


if __name__=='__main__':
    bank=build_sdamgia_bank()
    print(json.dumps({'tasks':len(bank['tasks']),'subtypes':len(bank['subtypes']),
                      'byExam':dict(Counter(q['exam'] for q in bank['tasks'])),
                      'kinds':dict(Counter(q['kind'] for q in bank['tasks'])),
                      'sha256':hashlib.sha256((ROOT/'src/sdamgia/bank.json').read_bytes()).hexdigest()},ensure_ascii=False))
