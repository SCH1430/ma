"""Check readable shared exam conditions, source binding and numerical consistency."""
from decimal import Decimal, ROUND_HALF_UP
import json

from exam_assets import build_exam_bank, context_alternative, read_context_texts, read_manifest


def main():
    bank = build_exam_bank()
    contexts = [example for exam in bank for task in exam['tasks']
                for example in task['examples'] if example['contextImages']]
    assert len(contexts) == 10, 'Both OGE seasons retain five shared-context questions'
    for example in contexts:
        assert '175/70 R12' in example['contextText']
        assert '25,4 мм' in example['contextText']
        assert '195/65 R15' in example['contextText']
        assert all(symbol in example['contextDescription'] for symbol in ['B', 'H', 'd', 'D'])

    # Independent arithmetic from the transcribed source, compared to official keys.
    mm_per_inch = Decimal('25.4')
    original_diameter = 12 * mm_per_inch + 2 * 175 * Decimal('0.70')
    replacement_diameter = 13 * mm_per_inch + 2 * 175 * Decimal('0.65')
    expected = {
        2: 165 * Decimal('0.65'),
        3: original_diameter,
        4: 175 * Decimal('0.65') - 185 * Decimal('0.60'),
        5: ((replacement_diameter / original_diameter - 1) * 100).quantize(
            Decimal('0.1'), rounding=ROUND_HALF_UP),
    }
    for exam in bank:
        if exam['baseExamId'] != 'oge':
            continue
        for task in exam['tasks']:
            if task['number'] in expected:
                assert Decimal(task['answers'][0]) == expected[task['number']]

    records = read_context_texts()
    source = next(e for e in read_manifest(2027)['exams'] if e['id'] == 'oge')
    fragments = source['tasks'][0]['examples'][0]['contextFragments']
    for changed_source, changed_fragments in [
        ({**source, 'sha256': '0' * 64}, fragments),
        (source, [{**fragments[0], 'page': 5}]),
    ]:
        try:
            context_alternative(2027, changed_source, changed_fragments, records)
        except ValueError:
            pass
        else:
            raise AssertionError('A changed original must not reuse a reviewed text alternative')
    assert context_alternative(2027, source, [], records) == {
        'contextText': '', 'contextDescription': ''}
    print(json.dumps({'status': 'passed', 'sharedContextExamples': len(contexts),
                      'independentAnswerChecks': 8, 'changedSourceRejected': True}))


if __name__ == '__main__':
    main()
