#!/usr/bin/env python3
"""Build the standalone page using Python's standard library only."""
from pathlib import Path
import base64, json, re, runpy, sys
ROOT=Path(__file__).resolve().parents[1]
SRC=ROOT/'src';sys.path.insert(0,str(SRC))
base=runpy.run_path(str(SRC/'base_bank.py'))['bank']
import bank_tools as bt
runpy.run_path(str(SRC/'bank_7_9.py'))
runpy.run_path(str(SRC/'bank_10_11.py'))
bank=[t for t in base if t['grade']<=6]+bt.BANK
for t in bank:
    for q in t['tasks']:
        q.setdefault('kind','number');q.setdefault('difficulty','Старт')
runpy.run_path(str(SRC/'extra_figures.py'),init_globals={'bank':bank})
expanded=runpy.run_path(str(SRC/'expand_bank.py'),init_globals={'bank':bank})
runpy.run_path(str(SRC/'challenge_bank.py'),init_globals={'add':expanded['add']})
for t in bank:
    for i,q in enumerate(t['tasks']):
        if not q.get('challenge'):
            q['difficulty']='Базовый' if i<3 and t['grade']<=6 or i==0 else 'Повышенный' if (i==5 and t['grade']<=6 or i==3 and t['grade']>=7) else 'Средний'
for author_file in sorted((SRC/'author_banks').glob('*.py')):
    runpy.run_path(str(author_file),init_globals={'bank':bank})
runpy.run_path(str(SRC/'basic_bank.py'),init_globals={'bank':bank})
subject_order={name:i for i,name in enumerate(['Числа и вычисления','Текстовые задачи','Наглядная геометрия','Алгебра','Алгебра и начала математического анализа','Геометрия','Вероятность и статистика'])}
bank.sort(key=lambda t:(t['grade'],t['level']!='basic',subject_order.get(t['subject'],99),int(t['id'].split('-')[1])))
for t in bank:
    for q in t['tasks']:
        for field in ['prompt','solution']:
            q[field]=re.sub(r'(?<=[0-9])(?=[А-Яа-яЁё])|(?<=[А-Яа-яЁё])(?=[0-9])',' ',q[field])
for t in bank:t['tasks'].sort(key=lambda q:['Базовый','Средний','Повышенный','Суперсложный'].index(q['difficulty']))
(ROOT/'checks'/'bank.json').write_text(json.dumps(bank,ensure_ascii=False,indent=2))
(ROOT/'checks'/'oracles.json').write_text(json.dumps(bt.ORACLES,ensure_ascii=False,indent=2))
s=(SRC/'shell.html').read_text()
s=s.replace('</style>',(SRC/'app.css').read_text()+'\n  </style>')
s=re.sub(r'      <section class="role-view".*?</section>','      <section id="app" class="app-shell" hidden aria-label="Математическое пространство"></section>',s,flags=re.S)
s=s.replace('<noscript>','<div class="toast" id="notice" role="status" hidden></div>\n  <noscript>')
vendor=SRC/'vendor'
license_text='pdf-lib (MIT)\n'+(vendor/'pdf-lib-LICENSE.txt').read_text()+'\n@pdf-lib/fontkit 1.1.1 (MIT), Andrew Dillon; fork of foliojs/fontkit.\nhttps://github.com/Hopding/fontkit\n'+(vendor/'fontkit-README.txt').read_text().split('## License')[-1]+'\nDejaVu Sans font:\n'+(vendor/'dejavu-copyright.txt').read_text()+'\n'+(vendor/'dejavu-license.txt').read_text()
libs=[]
for name,file in [('pdf-lib','pdf-lib.min.js'),('fontkit','fontkit.umd.min.js')]:
    js=(vendor/file).read_text();js=re.sub(r'//# sourceMappingURL=.*','',js).replace('</script','<\\/script')
    libs.append(f'<script id="vendor-{name}">{js}</script>')
font=base64.b64encode((vendor/'DejaVuSans.ttf').read_bytes()).decode()
semantic=runpy.run_path(str(ROOT/'scripts/semantic_audit.py'))['audit'](bank)
app='const BANK_STATS = '+json.dumps(semantic,ensure_ascii=False)+';\nconst BANK = '+json.dumps(bank,ensure_ascii=False,separators=(',',':'))+';\n'+f'const FONT_BASE64 = "{font}";\n'+'\n'.join((SRC/f).read_text() for f in ['math-figures.js','pdf.js','app.js'])
scripts='<!-- Embedded open-source notices\n'+license_text.replace('--','—')+'\n-->\n'+'\n'.join(libs)+'\n<script id="app-code">\n'+app+'\n</script>'
s=re.sub(r'  <script>.*?</script>',lambda m:scripts,s,flags=re.S)
(ROOT/'index.html').write_text(s)
print(json.dumps({'topics':len(bank),'tasks':sum(len(t['tasks']) for t in bank),'classes':{g:{'topics':sum(t['grade']==g for t in bank),'tasks':sum(len(t['tasks']) for t in bank if t['grade']==g)} for g in range(5,12)},'bytes':len(s.encode())},ensure_ascii=False))
