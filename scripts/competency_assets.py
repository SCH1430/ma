"""Validate the reviewed competency map without changing the source tasks."""
from pathlib import Path
import json

DIRECTORY=Path(__file__).resolve().parents[1]/'src'/'competencies'


def build_competency_data(bank,exams):
    read=lambda name: json.loads((DIRECTORY/name).read_text())
    definitions=read('definitions.json')
    classes=read('classes.json')
    exam_map=read('exams.json')['tasks']
    known={item['id'] for item in definitions}
    if len(known)!=len(definitions) or not known:
        raise ValueError('Invalid competency definitions')
    topic_ids={topic['id'] for topic in bank}
    class_ids={task['id'] for topic in bank for task in topic['tasks']}
    exam_ids={example['id'] for exam in exams for task in exam['tasks'] for example in task.get('examples',[task])}
    if set(classes['topics'])!=topic_ids:
        raise ValueError('Competency topics must match every class topic')
    if not set(classes['overrides'])<=class_ids:
        raise ValueError('Unknown task in competency overrides')
    if set(exam_map)!=exam_ids:
        raise ValueError('Every official exam example needs its own competency map')
    for mapping in [classes['topics'],classes['overrides'],exam_map]:
        for key,tags in mapping.items():
            if not isinstance(tags,list) or not tags or any(not isinstance(t,str) or t not in known for t in tags) or len(set(tags))!=len(tags):
                raise ValueError(f'Invalid competency tags: {key}')
    return {'competencies':definitions,'topics':classes['topics'],'overrides':classes['overrides'],'tasks':exam_map}
