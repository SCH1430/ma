#!/usr/bin/env python3
"""Build a small offline entry page with separate data and application files."""
from pathlib import Path
import base64
import json
import re
import runpy
import sys

from exam_assets import build_exam_bank, exam_bank_script
from competency_assets import build_competency_data
from exam_difficulty_assets import build_exam_difficulty_data
from sdamgia_assets import build_sdamgia_bank
from enrichment_assets import build_enrichment_bank
from quality_assets import build_quality_bank


ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / 'src'
DATA = ROOT / 'data'
sys.path.insert(0, str(SRC))
from task_bank import load_bank


def encode(value):
    return json.dumps(value, ensure_ascii=False, separators=(',', ':'))


def write_utf8(path, value):
    path.write_text(value, encoding='utf-8', newline='\n')


def write_constant(filename, name, value):
    write_utf8(DATA / filename, f'const {name} = {encode(value)};\n')


def script_tag(path, script_id=None):
    identity = f' id="{script_id}"' if script_id else ''
    return f'  <script{identity} defer src="{path}"></script>'


bank, oracles = load_bank()
subject_order = {name: i for i, name in enumerate([
    'Числа и вычисления', 'Текстовые задачи', 'Наглядная геометрия',
    'Алгебра', 'Алгебра и начала математического анализа', 'Геометрия',
    'Вероятность и статистика',
])}
bank.sort(key=lambda t: (
    t['grade'], t['level'] != 'basic', subject_order.get(t['subject'], 99),
    int(t['id'].split('-')[1]),
))
for topic in bank:
    for task in topic['tasks']:
        for field in ['prompt', 'solution']:
            task[field] = re.sub(
                r'(?<=[0-9])(?=[А-Яа-яЁё])|(?<=[А-Яа-яЁё])(?=[0-9])',
                ' ', task[field],
            )
    topic['tasks'].sort(key=lambda q: [
        'Базовый', 'Средний', 'Повышенный', 'Суперсложный',
    ].index(q['difficulty']))

write_utf8((ROOT / 'checks' / 'bank.json'), json.dumps(bank, ensure_ascii=False, indent=2))
write_utf8((ROOT / 'checks' / 'oracles.json'), json.dumps(oracles, ensure_ascii=False, indent=2))
semantic = runpy.run_path(str(ROOT / 'scripts' / 'semantic_audit.py'))['audit'](bank)
exams = build_exam_bank()
write_utf8((ROOT / 'checks' / 'exam-bank.json'), encode(exams))
competencies = build_competency_data(bank, exams)
write_utf8((ROOT / 'checks' / 'competencies.json'), json.dumps(competencies, ensure_ascii=False, indent=2))
exam_difficulty = build_exam_difficulty_data(exams)
sdamgia = build_sdamgia_bank()
enrichment = build_enrichment_bank(bank)
quality = build_quality_bank(bank)
write_utf8((ROOT / 'checks' / 'exam-difficulty.json'), json.dumps(exam_difficulty, ensure_ascii=False, indent=2))

for directory in [DATA, DATA / 'tasks', DATA / 'exams']:
    directory.mkdir(parents=True, exist_ok=True)

# Classic scripts work when index.html is opened directly with file://. Each
# grade is a separate runtime file, so the HTML never contains the task bank.
write_utf8((DATA / 'bank.js'), 'const BANK = [];\nconst EXAM_BANK = [];\n')
grade_scripts = []
for grade in range(5, 12):
    filename = f'grade_{grade:02d}.js'
    topics = [topic for topic in bank if topic['grade'] == grade]
    write_utf8((DATA / 'tasks' / filename), f'BANK.push(...{encode(topics)});\n')
    grade_scripts.append(f'data/tasks/{filename}')

exam_scripts = []
for exam in exams:
    filename = f"{exam['id']}.js"
    write_utf8((DATA / 'exams' / filename), exam_bank_script([exam], append=True))
    exam_scripts.append(f'data/exams/{filename}')

write_constant('bank-stats.js', 'BANK_STATS', semantic)
write_constant('competencies.js', 'COMPETENCY_DATA', competencies)
write_constant('exam-difficulty.js', 'EXAM_DIFFICULTY_DATA', exam_difficulty)
write_constant('sdamgia.js', 'SDAMGIA_BANK', sdamgia)
write_constant('enrichment.js', 'THINKING_BANK', enrichment)
write_constant('quality-bank.js', 'QUALITY_BANK', quality)
vendor = SRC / 'vendor'
font = base64.b64encode((vendor / 'DejaVuSans.ttf').read_bytes()).decode()
write_constant('font.js', 'FONT_BASE64', font)

license_text = (
    'pdf-lib (MIT)\n' + (vendor / 'pdf-lib-LICENSE.txt').read_text()
    + '\n@pdf-lib/fontkit 1.1.1 (MIT), Andrew Dillon; fork of foliojs/fontkit.\n'
    + 'https://github.com/Hopding/fontkit\n'
    + (vendor / 'fontkit-README.txt').read_text().split('## License')[-1]
    + '\nDejaVu Sans font:\n' + (vendor / 'dejavu-copyright.txt').read_text()
    + '\n' + (vendor / 'dejavu-license.txt').read_text()
    + '\n\nЗадания Решу ЕГЭ / Решу ОГЭ: портал СДАМ ГИА, https://sdamgia.ru/.\n'
    + 'Исходные номера и прямые ссылки сохранены у каждого задания отдельного банка.\n'
    + 'Они не объявляются авторскими материалами школы 1430.\n'
)
write_utf8((DATA / 'NOTICE.txt'), license_text)

shell = (SRC / 'shell.html').read_text()
style = re.search(r'  <style>(.*?)  </style>', shell, flags=re.S)
if style is None:
    raise ValueError('The source shell must contain its page styles')
write_utf8((DATA / 'shell.css'), style.group(1))
shell = shell[:style.start()] + (
    '  <link rel="stylesheet" href="data/shell.css">\n'
    '  <link rel="stylesheet" href="src/app.css">\n'
    '  <link rel="stylesheet" href="src/figure-viewer.css">\n'
    '  <link rel="stylesheet" href="src/work-runner.css">'
) + shell[style.end():]
shell = re.sub(
    r'      <section class="role-view".*?</section>',
    '      <section id="app" class="app-shell" hidden aria-label="Математическое пространство"></section>',
    shell, flags=re.S,
)
shell = shell.replace(
    '<noscript>', '<div class="toast" id="notice" role="status" hidden></div>\n  <noscript>',
)

scripts = [
    '  <!-- Third-party licenses: data/NOTICE.txt -->',
    script_tag('src/vendor/pdf-lib.min.js', 'vendor-pdf-lib'),
    script_tag('src/vendor/fontkit.umd.min.js', 'vendor-fontkit'),
]
data_scripts = [
    'data/bank-stats.js', 'data/bank.js', *grade_scripts, *exam_scripts,
    'data/competencies.js', 'data/exam-difficulty.js', 'data/sdamgia.js', 'data/enrichment.js', 'data/quality-bank.js', 'data/font.js',
]
scripts.extend(script_tag(path) for path in data_scripts)
application_scripts = [
    'geometry-core.js', 'geometry-planar.js', 'geometry-spatial.js',
    'figure-guidance.js', 'math-figures.js', 'learning-support.js',
    'lesson-support.js', 'figure-viewer.js', 'exam-support.js',
    'competency-support.js', 'exam-difficulty.js', 'bank-pedagogy.js', 'bank-workspace.js', 'auto-work.js', 'work-runner.js', 'training-monitor.js', 'pdf.js', 'app.js',
]
scripts.extend(script_tag(f'src/{name}', 'app-code' if name == 'app.js' else None)
               for name in application_scripts)
shell, replacements = re.subn(
    r'  <script>.*?</script>', lambda match: '\n'.join(scripts), shell, flags=re.S,
)
if replacements != 1:
    raise ValueError('The source shell must contain exactly one application script')
write_utf8((ROOT / 'index.html'), shell)
print(json.dumps({
    'topics': len(bank), 'tasks': sum(len(topic['tasks']) for topic in bank),
    'classes': {grade: {
        'topics': sum(topic['grade'] == grade for topic in bank),
        'tasks': sum(len(topic['tasks']) for topic in bank if topic['grade'] == grade),
    } for grade in range(5, 12)},
    'bytes': len(shell.encode()), 'gradeFiles': grade_scripts, 'examFiles': exam_scripts,
}, ensure_ascii=False))
