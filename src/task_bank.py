"""Load the canonical task bank from one JSON file per school grade."""
import json
from pathlib import Path

TASKS_DIR = Path(__file__).resolve().parent / 'tasks'
GRADES = range(5, 12)


def load_grade(grade, *, tasks_dir=None):
    """Return fresh topic data and independent check expressions for a grade.

    The optional ``oracle`` field is authoring data. Remove it from the task
    objects before they are embedded in the standalone page.
    """
    if type(grade) is not int or grade not in GRADES:
        raise ValueError(f'Unsupported school grade: {grade!r}')
    path = Path(tasks_dir or TASKS_DIR) / f'grade_{grade:02}.json'
    bank = json.loads(path.read_text(encoding='utf-8'))
    if not isinstance(bank, list) or not bank:
        raise ValueError(f'{path.name}: expected a non-empty list of topics')

    topic_ids = set()
    task_ids = set()
    oracles = {}
    for topic in bank:
        if not isinstance(topic, dict):
            raise ValueError(f'{path.name}: expected a topic object')
        tid = topic.get('id')
        if (type(topic.get('grade')) is not int or topic['grade'] != grade
                or not isinstance(tid, str) or not tid.startswith(f'{grade}-')):
            raise ValueError(f'{path.name}: topic {tid!r} belongs to another grade')
        if tid in topic_ids:
            raise ValueError(f'{path.name}: duplicate topic ID {tid}')
        topic_ids.add(tid)
        tasks = topic.get('tasks')
        if not isinstance(tasks, list) or not tasks:
            raise ValueError(f'{path.name}: topic {tid} has no tasks')
        for task in tasks:
            if not isinstance(task, dict):
                raise ValueError(f'{path.name}: expected a task object in {tid}')
            qid = task.get('id')
            if not isinstance(qid, str) or not qid.startswith(f'{tid}-'):
                raise ValueError(f'{path.name}: task {qid!r} does not belong to {tid}')
            if qid in task_ids:
                raise ValueError(f'{path.name}: duplicate task ID {qid}')
            task_ids.add(qid)
            if 'oracle' in task:
                oracle = task.pop('oracle')
                if not isinstance(oracle, str) or not oracle.strip():
                    raise ValueError(f'{path.name}: empty check expression for {qid}')
                if task.get('kind') == 'open':
                    raise ValueError(f'{path.name}: open task {qid} has a numeric oracle')
                oracles[qid] = oracle
    return bank, oracles


def load_bank(*, tasks_dir=None):
    """Load all seven grade files in school order, without shared mutable state."""
    bank = []
    oracles = {}
    for grade in GRADES:
        topics, checks = load_grade(grade, tasks_dir=tasks_dir)
        bank.extend(topics)
        oracles.update(checks)
    return bank, oracles
