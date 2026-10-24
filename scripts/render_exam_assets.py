#!/usr/bin/env python3
"""Reproduce exact page crops from the verified, unchanged FIPI source PDFs.

Needs Pillow and Poppler only for regenerating PNGs, never for ordinary builds.
Coordinates and answers remain reviewable in src/exams/2026/manifest.json.
"""
from pathlib import Path
import math
import subprocess
import tempfile
from PIL import Image
from exam_assets import EXAMS, image_path, read_manifest

SCALE = 3


def main():
    manifest = read_manifest()
    total = 0
    with tempfile.TemporaryDirectory(prefix='matbaza-fipi-') as temporary:
        for exam in manifest['exams']:
            fragments = list(exam.get('answerFragments', [])) + list(exam.get('solutionFragments', []))
            for task in exam['tasks']:
                for example in task['examples']:
                    for key in ['fragments', 'contextFragments', 'solutionFragments']:
                        fragments.extend(example.get(key, []))
            page_images = {}
            for fragment in fragments:
                destination = image_path(exam['id'], fragment)
                if destination.exists():
                    continue
                page = fragment['page']
                if page not in page_images:
                    prefix = str(Path(temporary) / f"{exam['id']}-{page}")
                    subprocess.run(['pdftoppm', '-f', str(page), '-l', str(page), '-r', str(72 * SCALE),
                                    '-png', '-singlefile', str(EXAMS / exam['pdfPath']), prefix], check=True,
                                   stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
                    page_images[page] = Image.open(prefix + '.png').convert('RGB')
                x0, top, x1, bottom = fragment['bbox']
                if x0 < 0 or top < 0 or x1 <= x0 or bottom <= top:
                    raise ValueError(f'Invalid crop coordinates: {fragment}')
                image = page_images[page]
                box = (math.floor(x0 * SCALE), math.floor(top * SCALE), math.ceil(x1 * SCALE), math.ceil(bottom * SCALE))
                if box[2] > image.width or box[3] > image.height:
                    raise ValueError(f'Crop extends outside source: {fragment}')
                cropped = image.crop(box)
                destination.parent.mkdir(parents=True, exist_ok=True)
                cropped.save(destination, optimize=True)
                total += 1
            for image in page_images.values():
                image.close()
    print(f'Rendered {total} exact source fragments.')


if __name__ == '__main__':
    main()
