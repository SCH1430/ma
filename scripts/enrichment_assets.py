"""Validate authored reasoning tasks and prepare their offline browser asset.

This supplemental bank does not alter the established class-bank baseline.
Topic attributes are resolved from the canonical bank so its labels cannot drift.
"""
from __future__ import annotations

from collections import Counter
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'src' / 'enrichment' / 'bank.json'
FORMATS = {
    'error': 'Найди ошибку',
    'methods': 'Сравни способы',
    'counterexample': 'Приведи контрпример',
    'insufficient': 'Достаточно ли данных?',
}
COMPETENCIES = {'calculations', 'equations', 'graphs', 'modelling', 'geometry', 'data', 'reasoning'}
DIFFICULTIES = {'Базовый', 'Средний', 'Повышенный', 'Суперсложный'}


def build_enrichment_bank(bank=None):
    """Return fresh, validated task data, ready for the normal textual renderer."""
    if bank is None:
        bank = []
        for grade in range(5, 12):
            bank.extend(json.loads((ROOT / 'src' / 'tasks' / f'grade_{grade:02}.json').read_text(encoding='utf-8')))
    topics = {topic['id']: topic for topic in bank}
    existing_ids = {task['id'] for topic in bank for task in topic['tasks']}
    source = json.loads(SOURCE.read_text(encoding='utf-8'))
    if source.get('version') != 1 or not isinstance(source.get('tasks'), list):
        raise ValueError('Invalid authored-reasoning bank version or task list')
    tasks = []
    seen = set()
    coverage = Counter()
    for row in source['tasks']:
        q = dict(row)
        topic = topics.get(q.get('topicId'))
        if topic is None:
            raise ValueError(f"Unknown reasoning-task topic: {q.get('topicId')}")
        qid = q.get('id')
        expected_id = f"thinking-{topic['grade']}-{topic['level']}-{q.get('format')}"
        if qid != expected_id or qid in seen or qid in existing_ids:
            raise ValueError(f'Invalid or duplicate authored reasoning ID: {qid}')
        seen.add(qid)
        if q.get('format') not in FORMATS or q.get('difficulty') not in DIFFICULTIES:
            raise ValueError(f'Invalid reasoning format or difficulty: {qid}')
        for key in ('prompt', 'display', 'solution'):
            if not isinstance(q.get(key), str) or len(q[key].strip()) < (3 if key == 'display' else 20):
                raise ValueError(f'Missing authored {key}: {qid}')
            if re.search(r'<(?:script|iframe|img)\b|\bon\w+\s*=', q[key], re.I):
                raise ValueError(f'Unexpected markup in authored task: {qid}')
        rubric = q.get('rubric')
        if not isinstance(rubric, list) or not 2 <= len(rubric) <= 4 or any(not isinstance(item, str) or len(item.strip()) < 15 for item in rubric):
            raise ValueError(f'Missing meaningful reasoning criteria: {qid}')
        tags = q.get('competencies')
        if not isinstance(tags, list) or not tags or 'reasoning' not in tags or len(set(tags)) != len(tags) or not set(tags) <= COMPETENCIES:
            raise ValueError(f'Invalid competencies: {qid}')
        skills = q.get('skills')
        if not isinstance(skills, list) or not skills or any(not isinstance(skill, str) or not re.fullmatch(r'[a-z]+(?:-[a-z]+)*', skill) for skill in skills) or len(set(skills)) != len(skills):
            raise ValueError(f'Invalid authored skills: {qid}')
        q.update({
            'source': 'enrichment',
            'sourceLabel': f"Задания на понимание · {topic['grade']} класс" + (
                ' · ' + ('углублённый' if topic['level'] == 'advanced' else 'базовый')
                if topic['grade'] >= 10 else ''
            ),
            'kind': 'open',
            'answer': None,
            'canonicalId': qid,
            'family': 'thinking:' + qid,
            'formatLabel': FORMATS[q['format']],
            'topic': topic['title'],
            'grade': topic['grade'],
            'level': topic['level'],
            'subject': topic['subject'],
        })
        coverage[(q['grade'], q['level'], q['format'])] += 1
        tasks.append(q)
    expected = {
        (grade, level, form)
        for grade in range(5, 12)
        for level in (['basic'] if grade < 10 else ['basic', 'advanced'])
        for form in FORMATS
    }
    if set(coverage) != expected or any(n != 1 for n in coverage.values()):
        raise ValueError('Expected one task of each of four formats for every class/programme (36 tasks)')
    return {'version': 1, 'title': 'Задания на понимание', 'formats': FORMATS, 'tasks': tasks}


def write_enrichment_assets(bank=None):
    """Optional standalone build; the main build can use its own constant writer."""
    data = build_enrichment_bank(bank)
    (ROOT / 'data' / 'enrichment.js').write_text(
        'const THINKING_BANK=' + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ';\n',
        encoding='utf-8',
    )
    return data


if __name__ == '__main__':
    result = write_enrichment_assets()
    print(f"Authored reasoning tasks: {len(result['tasks'])}")
