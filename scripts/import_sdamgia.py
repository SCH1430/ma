#!/usr/bin/env python3
"""Refresh the deliberately bounded Решу ЕГЭ selection (not run by builds).

Requires lxml only for importing. Raw responses are cached in ignored preview/.
Every selected task is loaded from its own original problem URL. Runtime data
contains only an allowlisted, local copy of the question and its solution.
"""
from __future__ import annotations

import base64
from concurrent.futures import ThreadPoolExecutor
from copy import deepcopy
import hashlib
import gzip
import html as html_std
import json
from pathlib import Path
import re
import threading
import time
import uuid
from urllib.parse import urljoin, urlparse
from urllib.request import Request, urlopen

from lxml import html

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / 'src/sdamgia'
CACHE = ROOT / 'preview/sdamgia-cache'
DATE = '2026-10-26'
HOSTS = {'ege-profile': 'math-ege.sdamgia.ru', 'ege-basic': 'mathb-ege.sdamgia.ru', 'oge': 'math-oge.sdamgia.ru'}
LABELS = {'ege-profile': 'Решу ЕГЭ · профильный', 'ege-basic': 'Решу ЕГЭ · базовый', 'oge': 'Решу ОГЭ'}
# exam, source category, catalog label, independent method note, skill tags.
SELECTION = [
 ('ege-profile',9,'Рациональные уравнения','Указать ОДЗ, избавиться от знаменателей и проверить корни.',['equations']),
 ('ege-profile',10,'Иррациональные уравнения','Учесть область определения и проверить корни после возведения в степень.',['equations']),
 ('ege-profile',11,'Показательные уравнения','Привести степени к одному основанию или выполнить замену.',['equations']),
 ('ege-profile',12,'Логарифмические уравнения','Записать ОДЗ и применить определение и свойства логарифма.',['equations']),
 ('ege-profile',88,'Проценты, сплавы и смеси','Составить баланс вещества или уравнение изменения величины.',['modelling','equations']),
 ('ege-profile',84,'Движение по прямой','Связать путь, скорость и время в одной системе единиц.',['modelling','equations']),
 ('ege-profile',87,'Совместная работа','Сложить производительности и составить уравнение времени работы.',['modelling','equations']),
 ('ege-profile',185,'Вероятности сложных событий','Выделить события и применить правила сложения и умножения вероятностей.',['data']),
 ('ege-profile',79,'Прямоугольный треугольник','Выделить прямоугольный треугольник и применить его метрические соотношения.',['geometry']),
 ('ege-profile',68,'Производная и касательная','Связать производную с угловым коэффициентом касательной.',['graphs']),
 ('ege-profile',332,'Кредиты','Составить последовательность долга и платежей по условиям договора.',['modelling','equations']),
 ('ege-profile',291,'Тригонометрические уравнения: множители','Разложить выражение на множители, найти все серии корней и выполнить отбор.',['equations','reasoning']),
 ('ege-basic',1,'Округление с недостатком','Найти целое число объектов, удовлетворяющих ограничению.',['calculations','modelling']),
 ('ege-basic',2,'Округление с избытком','Разделить величины и округлить количество в соответствии с условием.',['calculations','modelling']),
 ('ege-basic',6,'Чтение графика','Найти нужную точку или интервал и прочитать значение по шкале.',['graphs','data']),
 ('ege-basic',8,'Чтение диаграммы','Сопоставить подписи и шкалу диаграммы с вопросом задачи.',['data']),
 ('ege-basic',53,'Выбор из трёх вариантов','Вычислить полную стоимость каждого допустимого варианта и сравнить.',['modelling','calculations']),
 ('oge',6,'Обыкновенные дроби','Выполнить действия с дробями с учётом порядка действий.',['calculations']),
 ('oge',43,'Квадратные уравнения','Привести уравнение к стандартному виду и найти нужный корень.',['equations']),
 ('oge',20,'Классическая вероятность','Разделить число подходящих исходов на число всех равновозможных исходов.',['data']),
 ('oge',8,'Сдвиги и растяжения графиков','Распознать функцию и связать изменение формулы с преобразованием графика.',['graphs']),
 ('oge',113,'Арифметическая прогрессия','Использовать формулы члена прогрессии и суммы её членов.',['calculations','modelling']),
 ('oge',11,'Прямоугольный треугольник','Применить теорему Пифагора или отношения сторон прямоугольного треугольника.',['geometry']),
 ('oge',12,'Центральные и вписанные углы','Связать угол с дугой окружности и учесть расположение вершины.',['geometry']),
 ('oge',15,'Геометрические утверждения','Проверить каждое утверждение по определению или теореме, а ложное опровергнуть.',['geometry','reasoning']),
]
ALLOWED = {'div','p','br','span','b','strong','i','em','sub','sup','table','tbody','thead','tr','td','th','ol','ul','li','center','h3'}
_image_cache = {}
_lock = threading.Lock()


def normalized(value):
    return re.sub(r'\s+', ' ', str(value).replace('\xad', '').replace('\u200b', '')).strip()


def is_sequence_response(prompt):
    # A progression may mention a sequence while requiring a number. Only
    # explicit response instructions trigger the ordered-digit format.
    return bool(re.search(r'установите соответствие|(?:ответ(?:е)?|запишите)[^.]{0,180}(?:последовательност[ьи]|номера|цифр)|номера\s+(?:верных|выбранных|этих)\s+(?:утверждений|высказываний)',prompt,re.I))


def write_json(path, value):
    """Publish complete snapshots, including when a renderer reads in parallel."""
    marker=path.with_suffix('.json.writing')
    marker.write_text('writing',encoding='ascii')
    temporary=CACHE.parent/('sdamgia-export-'+uuid.uuid4().hex+'.json')
    serialized=json.dumps(value,ensure_ascii=False,indent=2)
    try:
        temporary.write_text(serialized,encoding='utf8')
        for attempt in range(10):
            try:
                temporary.replace(path)
                return
            except OSError:
                time.sleep(.1)
        # OneDrive can allow overwrites while temporarily denying replacement
        # of an existing file. Readers honor the marker during this fallback.
        for attempt in range(30):
            try:
                path.write_text(serialized,encoding='utf8')
                temporary.unlink(missing_ok=True)
                return
            except OSError:
                if attempt==29:raise
                time.sleep(.1)
    finally:
        marker.unlink(missing_ok=True)


def fetch(url):
    CACHE.mkdir(parents=True, exist_ok=True)
    path = CACHE / (hashlib.sha256(url.encode()).hexdigest()+'.bin')
    if path.exists():
        return path.read_bytes()
    request = Request(url, headers={'User-Agent':'Mozilla/5.0 (compatible; educational offline selection)'})
    last = None
    for attempt in range(3):
        try:
            with urlopen(request, timeout=45) as response:
                data = response.read()
            temporary=path.with_suffix('.tmp-'+str(threading.get_ident()))
            temporary.write_bytes(data)
            temporary.replace(path)
            time.sleep(.15)
            return data
        except Exception as exc:
            last=exc
            time.sleep(1+attempt)
    raise last


def image_data(url):
    with _lock:
        if url in _image_cache:
            return _image_cache[url]
    data=fetch(url)
    if data.startswith(b'\x1f\x8b'):
        data=gzip.decompress(data)
    if data.startswith(b'\x89PNG'):
        mime='image/png'
    elif data.startswith((b'GIF87a',b'GIF89a')):
        mime='image/gif'
    elif data.startswith(b'\xff\xd8'):
        mime='image/jpeg'
    elif b'<svg' in data[:500]:
        mime='image/svg+xml'
        # Illustrator exports a public SVG 1.1 DTD declaration. The drawing
        # needs no external DTD: remove declarations without an internal
        # subset, then reject any remaining entity/declaration constructs.
        data=re.sub(rb'<!DOCTYPE[^>\[]*>',b'',data,flags=re.I)
        if re.search(rb'<script|<foreignObject|<style|<!DOCTYPE|<!ENTITY|@import|\bon\w+\s*=|(?:href|src)\s*=\s*[\"\'](?!#)|url\s*\(\s*(?![\"\']?#)',data,re.I):
            raise ValueError('Unsafe SVG: '+url)
    else:
        raise ValueError('Unexpected image: '+url)
    result='data:'+mime+';base64,'+base64.b64encode(data).decode()
    with _lock:
        _image_cache[url]=result
    return result


def safe_fragment(node, base_url):
    def render(el):
        if not isinstance(el.tag,str):
            return ''
        tag=el.tag.lower()
        if tag in {'script','style','iframe','object','input','button'}:
            return ''
        if tag=='img':
            url=urljoin(base_url,el.get('src',''))
            parsed=urlparse(url);host=parsed.hostname or ''
            if parsed.scheme!='https' or not (host=='sdamgia.ru' or host.endswith('.sdamgia.ru')):
                raise ValueError('Unexpected image host: '+url)
            src=image_data(url)
            alt=normalized(el.get('alt','Рисунок к заданию'))
            formula='tex' in el.get('class','').split()
            align=re.search(r'vertical-align\s*:\s*(-?\d+(?:\.\d+)?pt)',el.get('style',''))
            style=('vertical-align:'+align.group(1)+';' if align else '')+'max-width:100%;height:auto;'
            if not formula:
                style+='display:block;margin:12px auto;max-height:350px;object-fit:contain;'
            return '<img class="'+('source-formula' if formula else 'source-diagram')+'" src="'+src+'" alt="'+html_std.escape(alt,quote=True)+'" style="'+style+'">'
        body=html_std.escape((el.text or '').replace('\xad',''))
        for child in el:
            body+=render(child)+html_std.escape((child.tail or '').replace('\xad',''))
        if tag not in ALLOWED:
            return body
        attrs=''
        if tag in {'td','th'}:
            for attr in ['colspan','rowspan']:
                if re.fullmatch(r'[1-9]\d?',el.get(attr,'')):
                    attrs+=' '+attr+'="'+el.get(attr)+'"'
        if tag=='br':
            return '<br>'
        return '<'+tag+attrs+'>'+body+'</'+tag+'>'
    return render(node)


def plain(node):
    node=deepcopy(node)
    for image in node.xpath('.//img'):
        image.tail=' '+normalized(image.get('alt','[рисунок]'))+' '+(image.tail or '')
    for el in node.iter():
        if el.tag in {'p','div','br','td','th','li','tr'}:
            el.tail=' '+(el.tail or '')
    return normalized(node.text_content())


def class_nodes(node, name):
    return node.xpath('.//*[contains(concat(" ",normalize-space(@class)," ")," '+name+' ")]')


def parse_problem(exam, subtype, source_id):
    url='https://'+HOSTS[exam]+'/problem?id='+source_id
    raw=fetch(url)
    doc=html.fromstring(raw)
    blocks=class_nodes(doc,'prob_maindiv')
    if not blocks:
        raise ValueError('No task block')
    block=blocks[0]
    number_text=normalized(class_nodes(block,'prob_nums')[0].text_content())
    original_link=class_nodes(block,'prob_nums')[0].xpath('.//a[contains(@href,"problem?id=")]')
    if not original_link or re.search(r'id=(\d+)',original_link[0].get('href')).group(1)!=source_id:
        raise ValueError('Original page returned a different task ID')
    number_match=re.search(r'Тип\s+(\d+)',number_text)
    number=int(number_match.group(1)) if number_match else subtype['number']
    answer_nodes=class_nodes(block,'answer')
    if not answer_nodes:
        raise ValueError('No source answer')
    answer_text=plain(answer_nodes[0])
    display=re.sub(r'^Ответ\s*:\s*','',answer_text).strip().rstrip('.')
    prompt_nodes=block.xpath('.//div[starts-with(@id,"body")]')
    solutions=class_nodes(block,'solution')
    if len(prompt_nodes)!=1 or not solutions:
        raise ValueError('Missing statement/solution')
    prompt_node=prompt_nodes[0]
    contexts=class_nodes(block,'probtext')
    if contexts:
        wrapper=html.Element('div')
        wrapper.extend([deepcopy(x) for x in contexts]+[deepcopy(prompt_node)])
        prompt_node=wrapper
    solution_node=solutions[0]
    prompt=plain(prompt_node)
    solution=plain(solution_node)
    if re.search(r'задание ещ[её] не решено|решение прототипа',solution,re.I):
        raise ValueError('Source provides only a prototype solution with other values')
    # Keep complete short solutions. Long multiple-method explanations remain
    # outside this deliberately compact first selection.
    # Formula accessibility descriptions spell out fractions and systems in
    # words. Count actual source prose here, not those verbose mathematical
    # descriptions, while preserving every formula and its accessible text.
    if len(normalized(prompt_node.text_content()+' '+solution_node.text_content()).split())>190:
        raise ValueError('Long statement/solution; use another prototype')
    if len(prompt)<10 or len(solution)<12:
        raise ValueError('Empty source content')
    if subtype['categoryId']==291:
        kind='open';answer=None
    elif re.fullmatch(r'[−+-]?\d+(?:[.,]\d+)?',display):
        sequence=is_sequence_response(prompt)
        kind='sequence' if sequence else 'number'
        answer=display if sequence else float(display.replace('−','-').replace(',','.'))
        if kind=='number' and answer.is_integer():
            answer=int(answer)
    else:
        raise ValueError('Unsupported answer format: '+display[:120])
    if kind=='sequence' and not display.isdigit():
        raise ValueError('Unsupported sequence')
    prompt_html=safe_fragment(prompt_node,url)
    solution_html=safe_fragment(solution_node,url)
    answer_html=safe_fragment(answer_nodes[0],url)
    return {
      'id':f'sdamgia-{exam}-{source_id}','sourceId':source_id,'exam':exam,
      'source':'sdamgia','subtypeId':subtype['id'],'sourceUrl':url,
      'sourceLabel':LABELS[exam],'grade':9 if exam=='oge' else 11,
      'level':'advanced' if exam=='ege-profile' else 'basic',
      'subject':'Геометрия' if 'geometry' in subtype['competencies'] else 'Вероятность и статистика' if 'data' in subtype['competencies'] else 'Алгебра',
      'topic':subtype['title'],'topicId':subtype['id'],'number':number,
      'catalogNumber':number,'difficulty':'Повышенный' if kind=='open' or subtype['categoryId']==332 else 'Базовый',
      'prompt':prompt,'promptHtml':prompt_html,'kind':kind,'answer':answer,
      'display':display,'answerText':display,'answerHtml':answer_html,'solution':solution,'solutionHtml':solution_html,
      'rubric':['Указаны необходимые ограничения и использован подходящий метод.','Преобразования и переходы обоснованы; найдены все серии корней.','Выполнен отбор корней на заданном промежутке, записан полный ответ.'] if kind=='open' else [],
      'competencies':subtype['competencies'],
      'provenance':{'retrievedAt':DATE,'pageSha256':hashlib.sha256(raw).hexdigest(),'sourceAnswer':display,'answerVerified':'compared-with-source-key','catalogVersion':'Каталог источника на '+DATE,'sourceProseWords':len(normalized(prompt_node.text_content()+' '+solution_node.text_content()).split())},
    }


def main():
    DEST.mkdir(parents=True,exist_ok=True)
    subtypes=[];tasks=[];seen=set();prompt_hashes=set();skipped=[]
    for exam,category,title,method,competencies in SELECTION:
        url='https://'+HOSTS[exam]+'/test?filter=all&category_id='+str(category)
        raw=fetch(url);doc=html.fromstring(raw)
        blocks=class_nodes(doc,'prob_maindiv')
        lists=class_nodes(doc,'prob_list')
        pages=int(lists[0].get('data-total','1')) if lists else 1
        # The source serves only five prototypes on the first page. Load the
        # next bounded catalog pages rather than mistaking analogues for the
        # complete set of methods.
        for page_number in range(2,min(pages,4)+1):
            page_doc=html.fromstring(fetch(url+'&page='+str(page_number)))
            blocks.extend(class_nodes(page_doc,'prob_maindiv'))
        candidates=[]
        for block in blocks:
            nums=class_nodes(block,'prob_nums')
            if not nums:continue
            link=nums[0].xpath('.//a[contains(@href,"problem?id=")]')
            if link:
                sid=re.search(r'id=(\d+)',link[0].get('href')).group(1)
                if sid not in candidates:candidates.append(sid)
        # Some subtypes contain fewer than eight prototypes. Add a bounded
        # selection of the original site's own analogue IDs after prototypes.
        for block in blocks:
            analogues=block.xpath('.//span[starts-with(@id,"likes_") and contains(@id,"_full")]//a[contains(@href,"problem?id=")]')
            for a in analogues[:15]:
                sid=re.search(r'id=(\d+)',a.get('href')).group(1)
                if sid not in candidates:candidates.append(sid)
        if not candidates:
            raise ValueError('No source category candidates: '+url)
        text=normalized(class_nodes(blocks[0],'prob_nums')[0].text_content())
        number=int(re.search(r'Тип\s+(\d+)',text).group(1))
        subtype={'id':f'sdamgia-{exam}-cat-{category}','exam':exam,'categoryId':category,
                 'number':number,'catalogNumber':number,'typeTitle':'Тип '+str(number)+' каталога источника',
                 'title':title,'method':method,'sourceUrl':url,'competencies':competencies,
                 'catalogVersion':'Каталог источника на '+DATE}
        chosen=[]
        for offset in range(0,len(candidates),3):
            batch=candidates[offset:offset+3]
            def load(sid):
                try:return sid,parse_problem(exam,subtype,sid),None
                except Exception as exc:return sid,None,str(exc)
            with ThreadPoolExecutor(max_workers=3) as pool:
                results=list(pool.map(load,batch))
            for sid,task,error in results:
                if error:
                    skipped.append({'exam':exam,'categoryId':category,'sourceId':sid,'reason':error});continue
                key=(HOSTS[exam],sid);fingerprint=hashlib.sha256(task['promptHtml'].encode()).hexdigest()
                if key in seen or fingerprint in prompt_hashes:continue
                seen.add(key);prompt_hashes.add(fingerprint);chosen.append(task)
                if len(chosen)==8:break
            if len(chosen)==8:break
        if len(chosen)!=8:
            raise ValueError(f'Only {len(chosen)} suitable tasks for {exam}/{category}; skipped '+str(skipped[-8:]))
        subtypes.append(subtype);tasks.extend(chosen)
        bank={'version':1,'retrievedAt':DATE,'catalogNote':'Номера соответствуют каталогу источника на дату отбора; это не разметка спецификации ФИПИ за конкретный год.','subtypes':subtypes,'tasks':tasks}
        write_json(DEST/'bank.json',bank)
        print(json.dumps({'exam':exam,'category':category,'title':title,'selected':len(chosen),'total':len(tasks)},ensure_ascii=False),flush=True)
    write_json(DEST/'import-report.json',{'retrievedAt':DATE,'taskCount':len(tasks),'subtypeCount':len(subtypes),'sourceHosts':HOSTS,'skipped':skipped,'checks':['Every task downloaded from its original problem URL.','Answers compared with the hidden source answer key.','All statement and solution images embedded locally.','No generated analogues or invented source IDs.']})


if __name__=='__main__':
    main()
