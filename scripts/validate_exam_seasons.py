"""Validate season isolation, immutable originals and the 2027 source evidence.

The default checks need Python's standard library only. --sources independently
re-extracts answers, difficulty levels and all task text from the original PDFs.
"""
from pathlib import Path
import argparse
import hashlib
import json
import math
import struct

from exam_assets import ROOT, build_exam_bank, image_path, read_manifest


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--sources', action='store_true')
    args = parser.parse_args()
    bank = build_exam_bank()
    ids, task_ids = set(), set()
    checks = 0

    def require(condition, message):
        nonlocal checks
        checks += 1
        if not condition:
            raise AssertionError(message)

    require(len(bank)==6, 'Three exam types in each of two seasons')
    for exam in bank:
        require(exam['id'] not in ids, 'Unique season exam ID')
        ids.add(exam['id'])
        require(exam['status']==('project' if exam['year']==2027 else 'archive'), 'Visible publication status')
        for task in exam['tasks']:
            for index, example in enumerate(task['examples'],1):
                expected=f"exam-{exam['year']}-{exam['baseExamId']}-{task['number']}-{index}"
                require(example['id']==expected and example['id'] not in task_ids, 'Permanent, non-colliding task IDs')
                task_ids.add(example['id'])
    require({'oge','ege-basic','ege-profile'}<=ids, 'Legacy saved-work exam IDs remain available')
    require(next(e for e in bank if e['id']=='ege-profile-2027')['tasks'][-1]['number']==20, '2027 profile has 20 positions')
    require(next(e for e in bank if e['id']=='ege-profile')['tasks'][-1]['number']==19, 'Archive remains unchanged')
    manifest=read_manifest(2027)
    directory=ROOT/'src/exams/2027'
    evidence=json.loads((directory/'source-verification.json').read_text(encoding='utf-8'))
    verification={e['exam']:e for e in evidence['exams']}
    source_index=json.loads((directory/'sources/index.json').read_text(encoding='utf-8'))
    for archive in source_index['archives']:
        file=directory/'sources'/archive['path']
        require(hashlib.sha256(file.read_bytes()).hexdigest()==archive['sha256'], 'Downloaded official ZIP checksum')
        require(archive['url'].startswith('https://doc.fipi.ru/'), 'Official archive origin')
    for source in manifest['exams']:
        example_count=sum(len(t['examples']) for t in source['tasks'])
        require(example_count==verification[source['id']]['examples'], 'Every official example retained')
        fragments=list(source['answerFragments'])
        for task in source['tasks']:
            for example in task['examples']:
                for key in ('fragments','contextFragments','solutionFragments'):
                    fragments.extend(example.get(key,[]))
        for f in fragments:
            data=image_path(source['id'],f,2027).read_bytes()
            require(data[:8]==b'\x89PNG\r\n\x1a\n','Local original PNG exists')
            width,height=struct.unpack('>II',data[16:24])
            x0,y0,x1,y1=f['bbox']
            require((width,height)==(math.ceil(x1*3)-math.floor(x0*3),math.ceil(y1*3)-math.floor(y0*3)), 'Crop dimensions match source coordinates')
    if args.sources:
        import pdfplumber
        from import_exam_2027 import answer_table, answer_values, crop_text, specification_levels
        difficulties=json.loads((directory/'difficulty.json').read_text(encoding='utf-8'))
        for source in manifest['exams']:
            with pdfplumber.open(directory/source['pdfPath']) as pdf:
                key=source['answerFragments'][0]
                rows=answer_table(pdf,key['page'])
                for task in source['tasks']:
                    for index,example in enumerate(task['examples']):
                        text='\n'.join(crop_text(pdf,f) for f in example['fragments']).strip()
                        require(text==example['text'], 'Accessible task text matches original 2027 crop')
                        if example['answerKind']!='open':
                            require(example['answers']==answer_values(rows[task['number']][index]), 'Accepted answers match actual official PDF table cells')
                        else:
                            require(bool(example.get('solutionFragments')), 'Extended response retains original criteria')
                            solution='\n'.join(crop_text(pdf,f) for f in example['solutionFragments'])
                            require('Максимальный балл' in solution, 'Original extended-response crop includes the complete assessment table')
            specification=difficulties['exams'][source['id']]
            by_number,pages=specification_levels(directory/specification['pdfPath'],source['taskCount'])
            require(specification['byNumber']==by_number and specification['pages']==pages, 'Difficulty extracted from the actual 2027 specification')
    print(json.dumps({'status':'passed','checks':checks,'seasons':[2026,2027],'exams':len(bank),
                      'examples2027':sum(len(t['examples']) for e in bank if e['year']==2027 for t in e['tasks']),
                      'sourcePdfChecks':args.sources}))


if __name__=='__main__':
    main()
