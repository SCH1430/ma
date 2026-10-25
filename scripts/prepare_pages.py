#!/usr/bin/env python3
"""Stage only the offline app assets, preserving relative paths for project Pages."""
from pathlib import Path
import re
import shutil
import json

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / '_site'


def prepare():
    html = (ROOT / 'index.html').read_text(encoding='utf-8')
    assets = {ref for ref in re.findall(r'<(?:script|link)\b[^>]*\b(?:src|href)="([^"]+)"', html)
              if not ref.startswith('data:')}
    assets.update(['index.html', '.nojekyll', 'data/NOTICE.txt'])
    # Fonts and vendor license notices accompany redistributed libraries.
    assets.update(str(p.relative_to(ROOT)) for p in (ROOT / 'src/vendor').glob('*.txt'))
    for name in assets:
        path = ROOT / name
        if not path.is_file() or path.is_symlink() or not path.resolve().is_relative_to(ROOT):
            raise ValueError(f'Invalid deployment asset: {name}')
    if DEST.exists():
        shutil.rmtree(DEST)
    for name in sorted(assets):
        target = DEST / name
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(ROOT / name, target)
    print(json.dumps({'directory': '_site', 'files': len(assets),
                      'bytes': sum((DEST / name).stat().st_size for name in assets)}))


if __name__ == '__main__':
    prepare()
