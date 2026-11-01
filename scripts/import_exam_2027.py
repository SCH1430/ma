"""Reproduce the reviewed 2027 FIPI project bank from unchanged local PDFs.

Download archives only from the URLs in sources/index.json, extract them without
renaming the originals, then run this script with pdfplumber, Pillow and Poppler.
Ordinary application builds do not need PDF extraction or rendering packages.
All examples separated by the source's centred 'ИЛИ' are retained independently.
"""
from pathlib import Path
import hashlib
import json
import math
import os
import re
import shutil
import subprocess
import tempfile

import pdfplumber
from PIL import Image

from exam_assets import ROOT, image_path

DIRECTORY = ROOT / 'src' / 'exams' / '2027'
LEGACY = ROOT / 'src' / 'exams' / '2026'
SCALE = 3
BOUNDS = ((20.0, 405.0), (440.49, 825.49))
SYMBOLS = str.maketrans({'\uf03d':'=', '\uf02b':'+', '\uf02d':'−', '\uf0a3':'≤',
                        '\uf0b3':'≥', '\uf03c':'<', '\uf03e':'>', '\uf0d7':'×',
                        '\uf0b0':'°', '\uf0d0':'∠', '\uf070':'π', '\uf0a5':'∞', '\uf0d6':'√'})


def write(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def fragment(page, half, top=50, bottom=550):
    x0, x1 = BOUNDS[half]
    return {'page': page, 'bbox': [x0, round(top, 2), x1, round(bottom, 2)]}


def crop_text(pdf, f):
    return (pdf.pages[f['page']-1].crop(tuple(f['bbox'])).extract_text() or '').translate(SYMBOLS)


def markers(page, half):
    offset = 0 if half == 0 else 420.49
    found = []
    words = page.extract_words()
    for word in words:
        if not 45 < word['top'] < 540:
            continue
        if word['text'].isdigit() and 25 + offset < word['x0'] < 40 + offset:
            # Task badges have a 26-point horizontal border just above the label.
            badge = any(24 < r['width'] < 28 and r['height'] < 1
                        and abs(r['top'] - word['top'] + 2.7) < 1.3
                        and abs(r['x0'] - (21.87 + offset)) < 2
                        for r in page.rects)
            if badge:
                found.append({'kind':'number', 'number':int(word['text']), **word})
        elif word['text'] == 'ИЛИ' and 190 + offset < word['x0'] < 225 + offset:
            found.append({'kind':'alternative', **word})
        elif word['text'] == 'ИЛ' and 190 + offset < word['x0'] < 225 + offset:
            tail = next((w for w in words if w['text']=='И' and abs(w['top']-word['top'])<2
                         and -1 <= w['x0']-word['x1'] < 8), None)
            if tail:
                found.append({'kind':'alternative', **word, 'text':'ИЛИ', 'x1':tail['x1']})
    return sorted(found, key=lambda w:w['top'])


def split_examples(pdf, start, end, expected, first_number=1, trim=True):
    tasks, current, number = [], None, first_number-1
    for page_number in range(start[0], end[0] + 1):
        for half in (0, 1):
            if (page_number, half) < start or (page_number, half) > end:
                continue
            points = markers(pdf.pages[page_number-1], half)
            valid = []
            for item in points:
                if item['kind'] == 'number':
                    if item['number'] != number + 1:
                        raise ValueError(f'Unexpected task badge: page {page_number}, {item}')
                    number += 1
                valid.append(item)
            position = 50.0
            for index, item in enumerate(valid):
                boundary = max(50.0, item['top'] - 12)
                if current is not None and boundary - position > 10:
                    current['fragments'].append(fragment(page_number, half, position, boundary))
                if item['kind'] == 'number':
                    current = {'fragments': []}
                    tasks.append({'number':item['number'], 'examples':[current]})
                    position = boundary
                else:
                    if current is None:
                        raise ValueError('Alternative without an example')
                    current = {'fragments': []}
                    tasks[-1]['examples'].append(current)
                    position = item['bottom'] + 8
            if current is not None and 550 - position > 10:
                current['fragments'].append(fragment(page_number, half, position))
    if [t['number'] for t in tasks] != list(range(first_number, expected+1)):
        raise ValueError('Incomplete task sequence')
    for task in tasks:
        for example in task['examples']:
            trimmed = []
            for f in example['fragments'] if trim else []:
                page = pdf.pages[f['page']-1].crop(tuple(f['bbox']))
                words = page.extract_words()
                answers = [w for w in words if w['text']=='Ответ:']
                instructions = [w for i,w in enumerate(words)
                                if w['text'].startswith('Проверьте') or w['text']=='Часть' and i+1<len(words) and words[i+1]['text']=='2'
                                or w['text']=='Не' and i+1<len(words) and words[i+1]['text']=='забудьте']
                stop = bool(answers or instructions)
                bottom = min([f['bbox'][3]] + [w['bottom']+20 for w in answers] + [w['top']-8 for w in instructions])
                if bottom > f['bbox'][1]+12:
                    trimmed.append({**f,'bbox':[*f['bbox'][:3],round(bottom,2)]})
                if stop:
                    break
            if trim:
                example['fragments'] = trimmed
            example['text'] = '\n'.join(crop_text(pdf, f) for f in example['fragments']).strip()
            if not example['text'] or len(example['text']) < 15:
                raise ValueError('Empty or incomplete example')
    return tasks


def answer_table(pdf, page_number, half=0):
    tables = pdf.pages[page_number-1].crop((BOUNDS[half][0], 45, BOUNDS[half][1], 550)).extract_tables()
    table = next((table for table in tables if any(row[0] == '1' for row in table)), None)
    if not table:
        raise ValueError('Official answer table is missing')
    result = {}
    for row in table:
        if not row[0] or not row[0].isdigit():
            continue
        result[int(row[0])] = [cell for cell in row[1:] if cell and cell.strip()]
    return result


def answer_values(cell):
    return [re.sub(r'\s+', '', s).replace(',', '.').replace('–', '-').replace('−', '-')
            for s in re.split(r'<\s*или\s*>', cell, flags=re.I)]


def specification_levels(path, expected):
    by_number, pages = {}, set()
    with pdfplumber.open(path) as pdf:
        for number, page in enumerate(pdf.pages, 1):
            for table in page.extract_tables():
                for row in table:
                    if len(row) > 4 and (row[0] or '').strip().isdigit() and (row[4] or '').strip() in ('Б','П','В'):
                        by_number[row[0].strip()] = row[4].strip()
                        pages.add(number)
    if set(by_number) != {str(n) for n in range(1, expected+1)}:
        raise ValueError('Incomplete original specification difficulty table')
    return by_number, sorted(pages)


def render(exams, executable):
    count = 0
    temporary_root = ROOT/'output'/'tmp'
    temporary_root.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='baza-2027-', dir=temporary_root) as temp:
        for exam in exams:
            all_fragments = list(exam.get('answerFragments', [])) + list(exam.get('solutionFragments', []))
            for task in exam['tasks']:
                for example in task['examples']:
                    for key in ('fragments', 'contextFragments', 'solutionFragments'):
                        all_fragments.extend(example.get(key, []))
            pages = {}
            for f in all_fragments:
                destination = image_path(exam['id'], f, 2027)
                if destination.exists():
                    continue
                if f['page'] not in pages:
                    prefix = Path(temp)/f"{exam['id']}-{f['page']}"
                    subprocess.run([executable, '-f', str(f['page']), '-l', str(f['page']), '-r', '216',
                                    '-png', '-singlefile', str(DIRECTORY/exam['pdfPath']), str(prefix)], check=True,
                                   stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
                    pages[f['page']] = Image.open(str(prefix)+'.png').convert('RGB')
                source = pages[f['page']]
                x0, y0, x1, y1 = f['bbox']
                box = (math.floor(x0*SCALE), math.floor(y0*SCALE), math.ceil(x1*SCALE), math.ceil(y1*SCALE))
                if box[2] > source.width or box[3] > source.height or box[0] < 0 or box[1] < 0:
                    raise ValueError('Fragment outside original page')
                destination.parent.mkdir(parents=True, exist_ok=True)
                source.crop(box).save(destination, optimize=True)
                count += 1
            for source in pages.values():
                source.close()
    return count


def main():
    definitions = [
        ('oge', 'ОГЭ по математике', 'oge', 'ma_9_2027', '*ДЕМО*', (5,0), (7,1), 25, 19, (8,0)),
        ('ege-basic', 'ЕГЭ по математике', 'ege', 'ma_11_2027', '*ДЕМО_базовый.pdf', (4,1), (16,1), 21, 21, (17,0)),
        ('ege-profile', 'ЕГЭ по математике', 'ege', 'ma_11_2027', '*ДЕМО_профильный.pdf', (2,1), (8,1), 20, 13, (9,0)),
    ]
    legacy_competencies = json.loads((ROOT/'src/competencies/exams.json').read_text(encoding='utf-8'))['tasks']
    legacy_difficulty = json.loads((LEGACY/'difficulty.json').read_text(encoding='utf-8'))
    exams, competencies, difficulty, verification = [], {}, {}, []
    for exam_id, title, exam_type, folder, pattern, start, end, expected, short_count, key_page in definitions:
        pdf_path = next((DIRECTORY/'sources'/folder).glob(pattern))
        source_url = f'https://doc.fipi.ru/{exam_type}/demoversii-specifikacii-kodifikatory/2027/{folder}.zip'
        with pdfplumber.open(pdf_path) as pdf:
            tasks = split_examples(pdf, start, end, expected)
            answers = answer_table(pdf, *key_page)
            solutions = {t['number']:t['examples'] for t in split_examples(pdf,(9,1),(18,0),20,14,trim=False)} if exam_id=='ege-profile' else {}
            if set(answers) != set(range(1, short_count+1)):
                raise ValueError('Incomplete official short-answer table')
            for task in tasks:
                if task['number'] <= short_count and len(answers[task['number']]) != len(task['examples']):
                    raise ValueError(f"Example/key mismatch: {exam_id} {task['number']}")
                for index, example in enumerate(task['examples'], 1):
                    n = task['number']
                    sequence = exam_id == 'ege-basic' and (n in (2,7,8,18) or n == 6 and index == 2) or exam_id == 'oge' and n in (11,19)
                    example['answerKind'] = 'open' if n > short_count else 'sequence' if sequence else 'number'
                    cell = answers[n][index-1] if n <= short_count else ''
                    example['answers'] = answer_values(cell) if cell else []
                    example['answerText'] = cell.replace('\n', ' ') if cell else ''
                    if exam_id == 'oge' and n <= 5:
                        example['contextFragments'] = [fragment(4,1,154,550)]
                    if n > short_count:
                        # Original solution pages retain complete criteria and all alternatives.
                        # The UI labels a full key as revealed across the relevant exam.
                        if exam_id == 'oge':
                            solutions = [(8,1),(9,0),(9,1),(10,0),(10,1),(11,0)]
                            page, half = solutions[n-20]
                            example['solutionFragments'] = [fragment(page,half)]
                        else:
                            if len(solutions[n]) != len(task['examples']):
                                raise ValueError(f'Solution/example count mismatch: {n}')
                            example['solutionFragments'] = solutions[n][index-1]['fragments']
                    if exam_id == 'ege-profile':
                        tags = {1:['geometry'],2:['calculations','geometry'],3:['geometry'],4:['data'],5:['data'],
                                6:['calculations','data'],7:['equations'],8:['calculations'],9:['calculations','modelling'],
                                10:['calculations','equations','modelling'],11:['graphs'],12:['calculations','graphs'],
                                13:['calculations','equations','modelling'],14:['equations'],15:['geometry','reasoning'],
                                16:['equations'],17:['calculations','graphs','modelling'],18:['geometry','reasoning'],
                                19:['equations','graphs','reasoning'],20:['calculations','reasoning']}[n]
                    else:
                        matching = f'exam-2026-{exam_id}-{n}-{index}'
                        tags = legacy_competencies.get(matching)
                        if tags is None:
                            # Extra examples were reviewed by the same position's actual method.
                            tags = {2:['modelling'],3:['data'],4:['calculations','modelling'],5:['data'],
                                    6:['calculations','modelling','data'],7:['graphs'],8:['reasoning'],
                                    9:['modelling','geometry'],11:['geometry'],12:['calculations','geometry'],13:['calculations','geometry'],
                                    14:['calculations'],15:['calculations','modelling'],16:['calculations'],17:['equations'],
                                    18:['reasoning'],19:['calculations','reasoning'],20:['equations','modelling'],21:['reasoning']}[n]
                    competencies[f'exam-2027-{exam_id}-{n}-{index}'] = tags
            source = {'id':exam_id,'title':title,'sourcePageUrl':f'https://fipi.ru/{exam_type}/demoversii-specifikacii-kodifikatory',
                      'archiveUrl':source_url,'pdfPath':pdf_path.relative_to(DIRECTORY).as_posix(), 'sha256':sha(pdf_path),
                      'pdfBytes':pdf_path.stat().st_size, 'taskCount':expected, 'tasks':tasks,
                      'answerFragments':[fragment(*key_page)], 'solutionFragments':[]}
            exams.append(source)
            verification.append({'exam':exam_id,'pages':len(pdf.pages),'positions':expected,
                                 'examples':sum(len(t['examples']) for t in tasks),'shortAnswerRows':len(answers),
                                 'pdfSha256':sha(pdf_path),'answerTable':answers})
        specification = next((DIRECTORY/'sources'/folder).glob('*СПЕЦ*'+ ('базовый.pdf' if exam_id=='ege-basic' else 'профильный.pdf' if exam_id=='ege-profile' else '.pdf')))
        by_number, specification_pages = specification_levels(specification, expected)
        difficulty[exam_id] = {'title':'ФИПИ · проект спецификации КИМ 2027','pdfPath':specification.relative_to(DIRECTORY).as_posix(),
                               'sha256':sha(specification),'sourceUrl':source_url,'positions':expected,'byNumber':by_number,
                               'pages':specification_pages}
    write(DIRECTORY/'manifest.json', {'year':2027,'source':'ФИПИ','status':'project','verifiedOn':'2026-11-01',
                                    'coordinateSystem':'pdf-points-top-left','exams':exams})
    write(DIRECTORY/'competencies.json', {'year':2027,'review':'Broad competencies reviewed against the 2027 source conditions; no 2026 position renumbering assumed for profile.', 'tasks':competencies})
    write(DIRECTORY/'difficulty.json', {'year':2027,'levels':legacy_difficulty['levels'],'exams':difficulty})
    write(DIRECTORY/'source-verification.json', {'year':2027,'status':'project','verifiedOn':'2026-11-01','exams':verification})
    write(DIRECTORY/'sources/index.json', {'year':2027,'verifiedOn':'2026-11-01','archives':[
        {'url':f'https://doc.fipi.ru/{kind}/demoversii-specifikacii-kodifikatory/2027/{name}.zip',
         'path':f'{name}.zip','sha256':sha(DIRECTORY/'sources'/f'{name}.zip')}
        for kind,name in [('oge','ma_9_2027'),('ege','ma_11_2027')]]})
    executable = os.environ.get('PDFTOPPM') or shutil.which('pdftoppm')
    if not executable:
        raise RuntimeError('Set PDFTOPPM to the Poppler pdftoppm executable')
    print(json.dumps({'exams':verification,'rendered':render(exams,executable)}, ensure_ascii=True))


if __name__ == '__main__':
    main()
