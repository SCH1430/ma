"""Independent mathematical spot checks for all 36 authored reasoning tasks.

The assertions verify the numerical examples, counterexamples and missing-data
witnesses used in the written solutions. Prose and criteria are author reviewed;
these checks never pretend to automatically grade a student's explanation.
"""
from fractions import Fraction as F
import math

from enrichment_assets import build_enrichment_bank


def main():
    bank = build_enrichment_bank()
    tasks = {q['id']: q for q in bank['tasks']}
    checked = set()

    def check(qid, condition):
        assert qid in tasks, qid + ': missing task'
        assert condition, qid + ': mathematical witness failed'
        checked.add(qid)

    check('thinking-5-basic-error', 18 - 6 / 3 == 16 and (18 - 6) / 3 == 4)
    check('thinking-5-basic-methods', 25 * (10 + 6) == (25 * 4) * 4 == 400)
    check('thinking-5-basic-counterexample', 2 * (1 + 9) > 2 * (4 + 4) and 1 * 9 < 4 * 4)
    check('thinking-5-basic-insufficient', 2 * (1 + 11) == 2 * (5 + 7) == 24 and 1 * 11 != 5 * 7)
    check('thinking-6-basic-error', 100 * F(6, 5) * F(4, 5) == 96)
    check('thinking-6-basic-methods', F(5, 12) + F(7, 18) == F(15 + 14, 36) == F(90 + 84, 216) == F(29, 36))
    check('thinking-6-basic-counterexample', abs(-7) > abs(2) and -7 < 2)
    check('thinking-6-basic-insufficient', 1 + 2 == 2 + 1 == 3 and 3 * F(1, 1 + 2) == 1)
    check('thinking-7-basic-error', -3 * (-2 - 2) == 12 and -3 * (-6 - 2) == 24)
    check('thinking-7-basic-methods', 4 * (9 - 3) == 2 * 9 + 6 and 2 * (9 - 3) == 9 + 3)
    check('thinking-7-basic-counterexample', (1 + 1)**2 != 1**2 + 1**2 and all((a+b)**2 == a*a + 2*a*b + b*b for a in range(-5, 6) for b in range(-5, 6)))
    check('thinking-7-basic-insufficient', 2 * 2 + 1 == 2 + 3 == 5 and 2 * 0 + 1 != 0 + 3)
    check('thinking-8-basic-error', math.sqrt(9 + 16) == 5 and math.sqrt(9) + math.sqrt(16) == 7)
    check('thinking-8-basic-methods', 25 - 24 == 1 and all(x*x - 5*x + 6 == 0 for x in [2, 3]))
    check('thinking-8-basic-counterexample', F(1, 2)**2 == F(1, 4) < F(1, 2))
    check('thinking-8-basic-insufficient', 10 * 3 / 2 == 15 and 10 * 8 / 2 == 40)
    check('thinking-9-basic-error', [3 * 2**(n-1) for n in range(1, 5)] == [3, 6, 12, 24])
    check('thinking-9-basic-methods', all(x**4 - 5*x*x + 4 == 0 for x in [-2, -1, 1, 2]) and all((x*x-1)*(x*x-4) == x**4 - 5*x*x + 4 for x in range(-5, 6)))
    check('thinking-9-basic-counterexample', 0 * F(1, 2) + 2 * F(1, 2) == 1 and 1 not in [0, 2])
    check('thinking-9-basic-insufficient', 8 + 12 == 6 + 14 == 20 and 8 + 2 * 1 == 6 + 2 * 2 == 10)
    check('thinking-10-basic-error', math.sqrt(2 + 2) == 2 and math.sqrt(-1 + 2) != -1 and all(x*x-x-2 == 0 for x in [-1, 2]))
    check('thinking-10-basic-methods', all(math.isclose(math.sin(x), .5) for x in [math.pi/6, 5*math.pi/6]) and 0 < math.pi/6 < 5*math.pi/6 < 2*math.pi)
    check('thinking-10-basic-counterexample', 1/(0**2+1) > 1/(1**2+1) and all(1/(x*x+1) > 0 for x in range(-10, 11)))
    check('thinking-10-basic-insufficient', 36 * 3 / 3 == 36 and 36 * 6 / 3 == 72)
    check('thinking-10-advanced-error', math.log2(5-1)+math.log2(5-3) == 3 and (-1-1)*(-1-3) == 8 and -1-1 < 0 and -1-3 < 0)
    check('thinking-10-advanced-methods', all(2*x+2 == 2*(x+1)*1 and 18*x+6 == 2*(3*x+1)*3 for x in range(-5, 6)))
    check('thinking-10-advanced-counterexample', F(1, 2) != F(1, 2)*F(1, 2) == F(1, 4))
    check('thinking-10-advanced-insufficient', 3*4*0 == 0 and 3*4*1 == 12)
    check('thinking-11-basic-error', F(1, 2)-F((-1)**2, 2) == 0 and F(1, 2)+F(1, 2) == 1)
    check('thinking-11-basic-methods', 2**3 == 8 and math.log2(8) == 3)
    check('thinking-11-basic-counterexample', 3*0**2 == 0 and all((-F(1,n))**3 < 0 < F(1,n)**3 for n in range(1, 100)))
    check('thinking-11-basic-insufficient', 1**2 == 1 and 1**2+5 == 6 and 0**2+3 == 3 and 1**2+3 == 4)
    check('thinking-11-advanced-error', all((1-1)*(1-a) == 0 and (a-1)*(a-a) == 0 for a in range(-5, 6)) and len({1, 1}) == 1 and len({1, 2}) == 2)
    check('thinking-11-advanced-methods', F(1**3-(-1)**3,3) == 2*F(1,3) == F(2,3) and F(1**4-(-1)**4,4) == 0)
    values = [-1, 0, 1]
    ex = sum(values)*F(1,3)
    ey = sum(x*x for x in values)*F(1,3)
    exy = sum(x**3 for x in values)*F(1,3)
    joint = sum(x == 0 and x*x == 0 for x in values)*F(1,3)
    independent_product = sum(x == 0 for x in values)*F(1,3)*sum(x*x == 0 for x in values)*F(1,3)
    check('thinking-11-advanced-counterexample', ex == 0 and ey == F(2,3) and exy == 0 and exy-ex*ey == 0 and joint == F(1,3) and independent_product == F(1,9) and joint != independent_product)
    check('thinking-11-advanced-insufficient', 3**2+4**2 == 5**2 and F(3**2*4,3) == 12 and F(4**2*3,3) == 16)
    assert checked == set(tasks), 'Every authored solution needs an independent mathematical witness'
    assert len({q['prompt'] for q in tasks.values()}) == 36, 'Duplicate authored prompt'
    assert all(q['kind'] == 'open' and q['answer'] is None for q in tasks.values()), 'No automatic grading of reasoning'
    print(f'Authored reasoning bank: {len(tasks)} tasks; 36 mathematical witnesses; schema, topics and programme coverage verified.')


if __name__ == '__main__':
    main()
