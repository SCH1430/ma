"""Load verified 2026 specification levels independently of original demo tasks."""
from pathlib import Path
import hashlib
import json

DIRECTORY=Path(__file__).resolve().parents[1]/'src'/'exams'/'2026'


def build_exam_difficulty_data(exams):
    data=json.loads((DIRECTORY/'difficulty.json').read_text())
    if data.get('year')!=2026 or data.get('levels')!={'Б':'Базовый','П':'Повышенный','В':'Высокий'}:
        raise ValueError('Invalid official exam difficulty definitions')
    if set(data['exams'])!={e['id'] for e in exams}:
        raise ValueError('Missing exam difficulty specification')
    for exam in exams:
        source=data['exams'][exam['id']]
        pdf=(DIRECTORY/source['pdfPath']).read_bytes()
        if hashlib.sha256(pdf).hexdigest()!=source['sha256']:
            raise ValueError('Specification PDF checksum differs: '+exam['id'])
        if set(source['byNumber'])!={str(t['number']) for t in exam['tasks']}:
            raise ValueError('Incomplete difficulty positions: '+exam['id'])
        if any(code not in data['levels'] for code in source['byNumber'].values()):
            raise ValueError('Unknown official difficulty level: '+exam['id'])
    return data
