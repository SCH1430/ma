#!/usr/bin/env python3
"""Check the grade-file boundary and reject common task-authoring mistakes."""
import json
from pathlib import Path
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'src'))
from task_bank import GRADES, load_bank, load_grade


class TaskSourcesTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.directory = Path(self.temp.name)

    def write_grade(self, grade=5, *, topic_grade=None, tasks=None):
        topic = {
            'id': f'{grade}-01',
            'grade': grade if topic_grade is None else topic_grade,
            'tasks': tasks if tasks is not None else [
                {'id': f'{grade}-01-1', 'kind': 'number', 'answer': 4, 'oracle': '2 + 2'}
            ],
        }
        path = self.directory / f'grade_{grade:02}.json'
        path.write_text(json.dumps([topic]), encoding='utf-8')

    def test_shipped_bank_loads_without_exposing_check_expressions(self):
        bank, oracles = load_bank()
        self.assertEqual({topic['grade'] for topic in bank}, set(GRADES))
        tasks = {task['id']: task for topic in bank for task in topic['tasks']}
        self.assertTrue(oracles)
        self.assertLessEqual(oracles.keys(), tasks.keys())
        self.assertTrue(all('oracle' not in task for task in tasks.values()))
        self.assertTrue(all(tasks[qid]['kind'] != 'open' for qid in oracles))

    def test_repeated_loads_do_not_share_mutable_data_or_consume_oracles(self):
        self.write_grade()
        first, checks = load_grade(5, tasks_dir=self.directory)
        first[0]['tasks'][0]['answer'] = 999
        checks.clear()
        second, checks = load_grade(5, tasks_dir=self.directory)
        self.assertEqual(second[0]['tasks'][0]['answer'], 4)
        self.assertEqual(checks, {'5-01-1': '2 + 2'})

    def test_all_grade_files_are_required(self):
        for grade in GRADES:
            if grade != 9:
                self.write_grade(grade)
        with self.assertRaises(FileNotFoundError):
            load_bank(tasks_dir=self.directory)

    def test_misfiled_topic_is_rejected(self):
        self.write_grade(topic_grade=6)
        with self.assertRaisesRegex(ValueError, 'another grade'):
            load_grade(5, tasks_dir=self.directory)

    def test_duplicate_ids_are_rejected(self):
        self.write_grade(tasks=[{'id': '5-01-1'}, {'id': '5-01-1'}])
        with self.assertRaisesRegex(ValueError, 'duplicate task ID'):
            load_grade(5, tasks_dir=self.directory)

    def test_task_in_wrong_topic_is_rejected(self):
        self.write_grade(tasks=[{'id': '5-02-1'}])
        with self.assertRaisesRegex(ValueError, 'does not belong'):
            load_grade(5, tasks_dir=self.directory)

    def test_open_task_cannot_have_a_numeric_oracle(self):
        self.write_grade(tasks=[{'id': '5-01-1', 'kind': 'open', 'oracle': '4'}])
        with self.assertRaisesRegex(ValueError, 'numeric oracle'):
            load_grade(5, tasks_dir=self.directory)


if __name__ == '__main__':
    unittest.main()
