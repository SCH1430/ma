"""Load each season's verified specification, independently of demo tasks."""
from pathlib import Path
import hashlib
import json

DIRECTORY=Path(__file__).resolve().parents[1]/'src'/'exams'


def build_exam_difficulty_data(exams):
    levels={'Б':'Базовый','П':'Повышенный','В':'Высокий'}
    seasons={}
    output={}
    for year in sorted({e['year'] for e in exams}):
        data=json.loads((DIRECTORY/str(year)/'difficulty.json').read_text(encoding='utf-8'))
        if data.get('year')!=year or data.get('levels')!=levels:
            raise ValueError('Invalid official exam difficulty definitions')
        expected={e.get('baseExamId',e['id']) for e in exams if e['year']==year}
        if set(data['exams'])!=expected:
            raise ValueError('Missing exam difficulty specification')
        seasons[year]=data
    for exam in exams:
        data=seasons[exam['year']]
        source=data['exams'][exam.get('baseExamId',exam['id'])]
        pdf=(DIRECTORY/str(exam['year'])/source['pdfPath']).read_bytes()
        if hashlib.sha256(pdf).hexdigest()!=source['sha256']:
            raise ValueError('Specification PDF checksum differs: '+exam['id'])
        if set(source['byNumber'])!={str(t['number']) for t in exam['tasks']}:
            raise ValueError('Incomplete difficulty positions: '+exam['id'])
        if any(code not in data['levels'] for code in source['byNumber'].values()):
            raise ValueError('Unknown official difficulty level: '+exam['id'])
        output[exam['id']]={**source,'year':exam['year']}
    return {'year':2026,'years':sorted(seasons),'levels':levels,'exams':output}
