"""Embed the verified FIPI 2026 originals in the offline application.

The manifest stores page coordinates in the original, unmodified PDFs. PNGs are
rendered once by render_exam_assets.py; ordinary builds need only Python's stdlib.
"""
from pathlib import Path
import base64
import hashlib
import json

ROOT = Path(__file__).resolve().parents[1]
EXAMS = ROOT / 'src' / 'exams' / '2026'


def fragment_key(exam_id, fragment):
    coords = '-'.join(f'{float(n):.3f}' for n in fragment['bbox'])
    return f"{exam_id}-{fragment['page']}-{coords}"


def image_path(exam_id, fragment):
    key = fragment_key(exam_id, fragment)
    digest = hashlib.sha256(key.encode()).hexdigest()[:20]
    return EXAMS / 'images' / exam_id / f'{digest}.png'


def read_manifest():
    manifest = json.loads((EXAMS / 'manifest.json').read_text())
    if manifest['year'] != 2026:
        raise ValueError('Only the verified 2026 demonstration is supported')
    expected = {'oge': 25, 'ege-basic': 21, 'ege-profile': 19}
    if {e['id'] for e in manifest['exams']} != set(expected):
        raise ValueError('All three official mathematics demonstrations are required')
    for exam in manifest['exams']:
        pdf = (EXAMS / exam['pdfPath']).read_bytes()
        if hashlib.sha256(pdf).hexdigest() != exam['sha256']:
            raise ValueError(f"Original PDF checksum differs: {exam['id']}")
        if [t['number'] for t in exam['tasks']] != list(range(1, expected[exam['id']] + 1)):
            raise ValueError(f"Incomplete task numbering: {exam['id']}")
    return manifest


def build_exam_bank():
    manifest = read_manifest()
    assets = {}

    def original_image(exam_id, fragment):
        path = image_path(exam_id, fragment)
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
                    'id': f"exam-2026-{exam_id}-{task['number']}-{index + 1}",
                    'number': task['number'],
                    'text': example['text'],
                    'images': [original_image(exam_id, f) for f in fragments],
                    'contextImages': [original_image(exam_id, f) for f in context],
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
                     'text': f.get('text', 'Официальные ответы и критерии ФИПИ, 2026 год.')}
                    for f in source.get(field, [])]
        bank.append({
            'id': exam_id, 'year': 2026, 'title': source['title'],
            'subtitle': {'oge': 'Математика · 9 класс', 'ege-basic': 'Математика · базовый уровень',
                         'ege-profile': 'Математика · профильный уровень'}[exam_id],
            'duration': 180 if exam_id == 'ege-basic' else 235,
            'sourceUrl': source['archiveUrl'],
            'sourcePageUrl': source['sourcePageUrl'],
            'sourceTitle': 'ФИПИ · официальная демоверсия 2026',
            'archiveUrl': source['archiveUrl'], 'sha256': source['sha256'],
            'pdfData': 'data:application/pdf;base64,' + base64.b64encode((EXAMS / source['pdfPath']).read_bytes()).decode(),
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
    destination.write_text(json.dumps(bank, ensure_ascii=False, separators=(',', ':')))
    print(json.dumps({'exams': len(bank), 'positions': sum(len(e['tasks']) for e in bank),
                      'examples': sum(len(t['examples']) for e in bank for t in e['tasks'])}))
