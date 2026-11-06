"""Embed verified FIPI originals, retaining IDs of archived demonstrations.

The manifest stores page coordinates in the original, unmodified PDFs. PNGs are
rendered once by render_exam_assets.py; ordinary builds need only Python's stdlib.
"""
from pathlib import Path
import base64
import hashlib
import json

ROOT = Path(__file__).resolve().parents[1]
EXAMS = ROOT / 'src' / 'exams' / '2026'
YEARS = (2026, 2027)


def fragment_key(exam_id, fragment):
    coords = '-'.join(f'{float(n):.3f}' for n in fragment['bbox'])
    return f"{exam_id}-{fragment['page']}-{coords}"


def image_path(exam_id, fragment, year=2026):
    key = fragment_key(exam_id, fragment)
    digest = hashlib.sha256(key.encode()).hexdigest()[:20]
    return ROOT / 'src' / 'exams' / str(year) / 'images' / exam_id / f'{digest}.png'


def read_manifest(year=2026):
    directory = ROOT / 'src' / 'exams' / str(year)
    manifest = json.loads((directory / 'manifest.json').read_text(encoding='utf-8'))
    if manifest['year'] != year or year not in YEARS:
        raise ValueError('Unsupported demonstration season')
    expected = {'oge': 25, 'ege-basic': 21, 'ege-profile': 20 if year == 2027 else 19}
    if {e['id'] for e in manifest['exams']} != set(expected):
        raise ValueError('All three official mathematics demonstrations are required')
    for exam in manifest['exams']:
        pdf = (directory / exam['pdfPath']).read_bytes()
        if hashlib.sha256(pdf).hexdigest() != exam['sha256']:
            raise ValueError(f"Original PDF checksum differs: {exam['id']}")
        if [t['number'] for t in exam['tasks']] != list(range(1, expected[exam['id']] + 1)):
            raise ValueError(f"Incomplete task numbering: {exam['id']}")
    return manifest


def read_context_texts():
    """Reviewed alternatives are tied to exact original PDFs and crop bounds."""
    document = json.loads((ROOT / 'src' / 'exams' / 'context-texts.json').read_text(encoding='utf-8'))
    if document.get('version') != 1:
        raise ValueError('Unsupported accessible exam context version')
    records = {}
    for item in document['contexts']:
        if not item.get('text', '').strip() or not item.get('description', '').strip():
            raise ValueError('Accessible exam context needs text and a figure description')
        for source in item['sources']:
            key = (source['year'], source['examId'],
                   tuple(fragment_key(source['examId'], f) for f in source['fragments']))
            if key in records:
                raise ValueError('Duplicate accessible exam context')
            records[key] = {**item, 'sha256': source['sha256']}
    return records


def context_alternative(year, source, fragments, records):
    if not fragments:
        return {'contextText': '', 'contextDescription': ''}
    key = (year, source['id'], tuple(fragment_key(source['id'], f) for f in fragments))
    item = records.get(key)
    if not item or item['sha256'] != source['sha256']:
        raise ValueError(f"Review a text alternative for the original context: {year} {source['id']}")
    return {'contextText': item['text'], 'contextDescription': item['description']}


def build_exam_bank(years=YEARS):
    return [exam for year in years for exam in build_exam_season(year)]


def build_exam_season(year):
    manifest = read_manifest(year)
    context_texts = read_context_texts()
    directory = ROOT / 'src' / 'exams' / str(year)
    assets = {}

    def original_image(exam_id, fragment):
        path = image_path(exam_id, fragment, year)
        key = str(path)
        if key not in assets:
            if not path.exists():
                raise FileNotFoundError(f'Render the exam assets first: {path}')
            assets[key] = 'data:image/png;base64,' + base64.b64encode(path.read_bytes()).decode()
        return assets[key]

    bank = []
    for source in manifest['exams']:
        exam_id = source['id']
        tasks = []
        for task in source['tasks']:
            examples = []
            for index, example in enumerate(task['examples']):
                context = example.get('contextFragments', [])
                fragments = example['fragments']
                examples.append({
                    'id': f"exam-{year}-{exam_id}-{task['number']}-{index + 1}",
                    'number': task['number'],
                    'text': example['text'],
                    'images': [original_image(exam_id, f) for f in fragments],
                    'contextImages': [original_image(exam_id, f) for f in context],
                    **context_alternative(year, source, context, context_texts),
                    'answerKind': example['answerKind'],
                    'answers': example['answers'],
                    'answerText': example['answerText'],
                    'solutionPages': [
                        {'image': original_image(exam_id, f), 'page': f['page'],
                         'text': f"Официальное решение и критерии ФИПИ: задание {task['number']}, пример {index + 1}."}
                        for f in example.get('solutionFragments', [])
                    ],
                })
            tasks.append({**examples[0], 'examples': examples})
        def pages(field):
            return [{'image': original_image(exam_id, f), 'page': f['page'],
                     'text': f.get('text', f'Официальные ответы и критерии ФИПИ, {year} год.')}
                    for f in source.get(field, [])]
        bank.append({
            'id': exam_id if year == 2026 else f'{exam_id}-{year}',
            'baseExamId': exam_id, 'year': year, 'title': source['title'],
            'status': 'project' if year == 2027 else 'archive',
            'statusLabel': 'Проект' if year == 2027 else 'Архив',
            'seasonLabel': f'{year} · ' + ('проект' if year == 2027 else 'архив'),
            'subtitle': {'oge': 'Математика · 9 класс', 'ege-basic': 'Математика · базовый уровень',
                         'ege-profile': 'Математика · профильный уровень'}[exam_id],
            'duration': 180 if exam_id == 'ege-basic' else 235,
            'sourceUrl': source['archiveUrl'],
            'sourcePageUrl': source['sourcePageUrl'],
            'sourceTitle': f'ФИПИ · ' + ('проект демоверсии' if year == 2027 else 'демоверсия') + f' {year}',
            'archiveUrl': source['archiveUrl'], 'sha256': source['sha256'],
            'pdfData': 'data:application/pdf;base64,' + base64.b64encode((directory / source['pdfPath']).read_bytes()).decode(),
            'tasks': tasks, 'answerPages': pages('answerFragments'),
            'solutionPages': pages('solutionFragments'),
        })
    return bank


def exam_bank_script(bank, *, append=False):
    """Store shared originals once in an offline JavaScript data file."""
    media, indices = [], {}

    def pack(value):
        if isinstance(value, str) and value.startswith(('data:image/', 'data:application/pdf;')):
            if value not in indices:
                indices[value] = len(media)
                media.append(value)
            return {'$examAsset': indices[value]}
        if isinstance(value, list):
            return [pack(item) for item in value]
        if isinstance(value, dict):
            return {key: pack(item) for key, item in value.items()}
        return value

    packed = pack(bank)
    encode = lambda value: json.dumps(value, ensure_ascii=False, separators=(',', ':'))
    prefix = 'EXAM_BANK.push(...' if append else 'const EXAM_BANK = '
    suffix = ');\n' if append else ';\n'
    return (prefix + '(() => { const media = ' + encode(media) + '; const data = ' + encode(packed) + ';\n'
            'const unpack = value => Array.isArray(value) ? value.map(unpack) : '
            'value && typeof value === "object" ? Object.prototype.hasOwnProperty.call(value, "$examAsset") '
            '? media[value.$examAsset] : Object.fromEntries(Object.entries(value).map(([key, item]) => [key, unpack(item)])) '
            ': value; return unpack(data); })()' + suffix)


if __name__ == '__main__':
    bank = build_exam_bank()
    destination = ROOT / 'checks' / 'exam-bank.json'
    destination.write_text(json.dumps(bank, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    print(json.dumps({'exams': len(bank), 'positions': sum(len(e['tasks']) for e in bank),
                      'examples': sum(len(t['examples']) for e in bank for t in e['tasks'])}))
