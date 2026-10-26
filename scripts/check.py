#!/usr/bin/env python3
"""One command for local checks and GitHub Actions; Python and Node only."""
from pathlib import Path
import os
import json
from datetime import datetime, timezone
import shutil
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
node = os.environ.get('NODE_BINARY') or shutil.which('node')
if not node:
    raise SystemExit('Node.js is required. Install Node 22+ or set NODE_BINARY to its executable.')
commands = [
    [sys.executable, '-B', 'scripts/build.py'],
    [sys.executable, '-B', 'scripts/validate_task_sources.py'],
    [sys.executable, '-B', 'scripts/validate_bank.py'],
    [sys.executable, '-B', 'scripts/validate_expansion.py'],
    *[[node, f'scripts/{name}.cjs'] for name in [
        'validate_build', 'validate_runtime', 'validate_geometry', 'validate_lessons',
        'validate_figure_viewer', 'validate_training', 'validate_training_monitor', 'validate_font', 'validate_features',
        'validate_ui_state', 'validate_regressions', 'validate_exams',
        'validate_unified_work', 'validate_competencies', 'validate_auto_work',
        'validate_work_runner', 'validate_sdamgia_ui',
        'export_unified_sample', 'export_expansion_sample', 'export_sdamgia_sample',
    ]],
    [sys.executable, '-B', 'scripts/prepare_pages.py'],
    [node, 'scripts/validate_pages.cjs'],
]
for command in commands:
    print('\nRunning ' + ' '.join(command), flush=True)
    subprocess.run(command, cwd=ROOT, check=True)
reports = {name: json.loads((ROOT/'checks'/f'{name}-results.json').read_text())
           for name in ['build','math','expansion','runtime','geometry','lessons','figure-viewer','training','training-monitor','font','features','ui-state',
                        'regression','exam','unified-work','competency','auto-work',
                        'unified-pdf','expansion-pdf','sdamgia-ui','sdamgia-pdf']}
summary = {'verified_at':datetime.now(timezone.utc).isoformat(),
           'automated_status':'passed','reports':reports,
           'semantic':json.loads((ROOT/'checks/semantic-results.json').read_text())['stats'],
           'pages':{'directory':'_site','relative_asset_and_runtime_check':'passed'},
           'scope':'Automated source, math, state/event and PDF checks; browser visual QA is separate.'}
(ROOT/'checks/verification-results.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n')
print('\nAll project checks passed.', flush=True)
