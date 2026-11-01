"""Independent exact checks and browser export for the methods packet.

Only a small arithmetic AST is accepted: no eval, imports, attributes or code.
The authoring script and the browser's answer parser are never imported here.
"""
from __future__ import annotations

import argparse
import ast
from collections import Counter
from copy import deepcopy
from fractions import Fraction as F
import hashlib
import itertools
import json
import math
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'src' / 'method-bank' / 'bank.json'
KINDS = {'number', 'set', 'interval', 'coordinates', 'expression', 'matching', 'steps', 'examples', 'open'}


def require(condition, message):
    if not condition:
        raise ValueError(message)


def poly(values):
    result = [F(x) for x in values]
    while len(result) > 1 and result[-1] == 0:
        result.pop()
    return result or [F(0)]


def padd(a, b):
    result = [F(0)] * max(len(a), len(b))
    for i, value in enumerate(a): result[i] += value
    for i, value in enumerate(b): result[i] += value
    return poly(result)


def pmul(a, b):
    require(len(a) + len(b) <= 20, 'Polynomial degree exceeds the allowed bound')
    result = [F(0)] * (len(a) + len(b) - 1)
    for i, x in enumerate(a):
        for j, y in enumerate(b): result[i+j] += x*y
    return poly(result)


def pvalue(p, x):
    value = F(0)
    for coefficient in reversed(p): value = value*x + coefficient
    return value


def exact_sqrt(value):
    value = F(value)
    require(value >= 0, 'Negative radicand')
    a, b = math.isqrt(value.numerator), math.isqrt(value.denominator)
    require(a*a == value.numerator and b*b == value.denominator, 'This checker requires an exact rational square root')
    return F(a, b)


def proots(p):
    p = poly(p)
    if len(p) == 1:
        return None if p[0] == 0 else []
    if len(p) == 2:
        return [-p[0]/p[1]]
    require(len(p) == 3, 'Root proof is restricted to degree two')
    c, b, a = p
    d = b*b - 4*a*c
    if d < 0: return []
    s = exact_sqrt(d)
    return sorted(set([(-b-s)/(2*a), (-b+s)/(2*a)]))


class RationalExpression:
    def __init__(self, numerator, denominator=None):
        self.n = poly(numerator)
        self.d = poly(denominator if denominator is not None else [1])
        require(self.d != [0], 'Division by the zero polynomial')

    def __add__(self, other):
        return RationalExpression(padd(pmul(self.n, other.d), pmul(other.n, self.d)), pmul(self.d, other.d))

    def __neg__(self): return RationalExpression([-x for x in self.n], self.d)
    def __sub__(self, other): return self + (-other)
    def __mul__(self, other): return RationalExpression(pmul(self.n, other.n), pmul(self.d, other.d))
    def __truediv__(self, other): return RationalExpression(pmul(self.n, other.d), pmul(self.d, other.n))
    def __pow__(self, exponent):
        require(isinstance(exponent, int) and abs(exponent) <= 8, 'Unbounded exponent')
        base = self if exponent >= 0 else RationalExpression(self.d, self.n)
        result = RationalExpression([1])
        for _ in range(abs(exponent)): result = result*base
        return result

    def scalar(self):
        require(len(self.n) == len(self.d) == 1, 'A constant expression is required')
        return self.n[0]/self.d[0]

    def equals(self, other): return poly(pmul(self.n, other.d)) == poly(pmul(other.n, self.d))


def parse(expression, x=None):
    require(isinstance(expression, str) and 0 < len(expression) < 600, 'Invalid arithmetic expression')
    tree = ast.parse(expression.replace('^', '**').replace('−', '-'), mode='eval')
    require(sum(1 for _ in ast.walk(tree)) <= 140, 'Arithmetic AST is too large')
    excluded = set()

    def visit(node):
        if isinstance(node, ast.Constant) and type(node.value) in (int, float):
            require(math.isfinite(node.value), 'Nonfinite arithmetic constant')
            return RationalExpression([F(str(node.value))])
        if isinstance(node, ast.Name) and node.id == 'x':
            return RationalExpression([F(x)]) if x is not None else RationalExpression([0, 1])
        if isinstance(node, ast.UnaryOp) and isinstance(node.op, (ast.UAdd, ast.USub)):
            value = visit(node.operand)
            return value if isinstance(node.op, ast.UAdd) else -value
        if isinstance(node, ast.BinOp):
            a, b = visit(node.left), visit(node.right)
            if isinstance(node.op, ast.Add): return a+b
            if isinstance(node.op, ast.Sub): return a-b
            if isinstance(node.op, ast.Mult): return a*b
            if isinstance(node.op, ast.Div):
                if x is None:
                    roots = proots(b.n)
                    require(roots is not None, 'Identically zero divisor')
                    excluded.update(roots)
                return a/b
            if isinstance(node.op, ast.Pow):
                exponent = b.scalar()
                require(exponent.denominator == 1, 'Exponent must be an integer')
                if exponent < 0 and x is None:
                    roots = proots(a.n)
                    require(roots is not None, 'Negative power of zero')
                    excluded.update(roots)
                return a**int(exponent)
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Name) and node.func.id == 'sqrt' and len(node.args) == 1 and not node.keywords:
            return RationalExpression([exact_sqrt(visit(node.args[0]).scalar())])
        raise ValueError('Unsupported arithmetic AST node: '+type(node).__name__)

    return visit(tree.body), sorted(excluded)


def value(expression, x=None): return parse(str(expression), x)[0].scalar()


def equation(left, right='0'):
    a, da = parse(left)
    b, db = parse(right)
    difference = a-b
    roots = proots(difference.n)
    require(roots is not None, 'Equation has infinitely many solutions; use a dedicated proof')
    excluded = set(da+db)
    return [x for x in roots if x not in excluded and pvalue(difference.d, x) != 0]


def holds(left, relation, right):
    a, b = parse(left)[0], parse(right)[0]
    if relation == '=': return a.equals(b)
    av, bv = a.scalar(), b.scalar()
    return {'!=':av != bv, '<':av < bv, '<=':av <= bv, '>':av > bv, '>=':av >= bv}[relation]


def linear_interval(left, op, right='0'):
    difference = parse(left)[0]-parse(right)[0]
    require(len(difference.d) == 1 and len(difference.n) <= 2, 'Linear inequality proof expected')
    b = difference.n[0]/difference.d[0]
    a = difference.n[1]/difference.d[0] if len(difference.n) == 2 else F(0)
    if a == 0:
        valid = {'<':b < 0, '<=':b <= 0, '>':b > 0, '>=':b >= 0}[op]
        return [(None, None, False, False)] if valid else []
    bound = -b/a
    if a < 0: op = {'<':'>', '<=':'>=', '>':'<', '>=':'<='}[op]
    return [(None, bound, False, op == '<=')] if op in ('<', '<=') else [(bound, None, op == '>=', False)]


def interval_key(answer):
    require(isinstance(answer, list), 'Intervals must be a list')
    out = []
    for item in answer:
        require(set(item) == {'lo', 'hi', 'loClosed', 'hiClosed'}, 'Unknown interval fields')
        lo = F(str(item['lo'])) if item['lo'] is not None else None
        hi = F(str(item['hi'])) if item['hi'] is not None else None
        lc, hc = item['loClosed'], item['hiClosed']
        require(type(lc) is type(hc) is bool, 'Interval endpoints need boolean closure')
        require((lo is not None or not lc) and (hi is not None or not hc), 'Infinity is not a closed endpoint')
        require(lo is None or hi is None or lo < hi or lo == hi and lc and hc, 'Empty or reversed interval')
        out.append((lo, hi, lc, hc))
    return out


def constructive(validator, raw):
    if not isinstance(raw, str) or not re.fullmatch(r'\s*[+-]?\d+\s*;\s*[+-]?\d+\s*', raw): return False
    a, b = (int(part.strip()) for part in raw.split(';'))
    if abs(a) > 10**6 or abs(b) > 10**6: return False
    p, name = validator.get('params', {}), validator.get('name')
    if name == 'fraction-equivalent':
        return a > 0 and b > 0 and p['minDenominator'] <= b <= p['maxDenominator'] and a*p['denominator'] == b*p['numerator']
    if name == 'rectangle-area':
        return p['minSide'] <= a <= p['maxSide'] and p['minSide'] <= b <= p['maxSide'] and a > 0 and b > 0 and a*b == p['area'] and (not p.get('requireDistinct') or a != b)
    if name == 'linear-root':
        return p['minCoefficient'] <= abs(a) <= p['maxCoefficient'] and a != 0 and a*F(str(p['root']))+b == 0
    if name == 'probability-fraction':
        return p['minTotal'] <= b <= p['maxTotal'] and 0 <= a <= b and a*p['valueDenominator'] == b*p['valueNumerator']
    raise ValueError('Unknown constructive validator')


def assert_scalar(q, expected):
    require(q['kind'] == 'number' and type(q['answer']) in (int, float), 'Numeric answer expected')
    require(abs(F(str(q['answer']))-expected) <= F(1, 10**10), 'Numeric answer differs from exact proof')
    require(value(q['display'].replace(',', '.')) == expected, 'Displayed answer is not exact')


def assert_roots(q, expected):
    if q['kind'] == 'number':
        require(len(expected) == 1, 'A unique numeric root is required')
        assert_scalar(q, expected[0])
    else:
        require(q['kind'] == 'set' and sorted(F(str(x)) for x in q['answer']) == expected, 'Incomplete or incorrect root set')


def assert_point(q, expected):
    require(q['kind'] == 'coordinates' and len(q['answer']) == 2, 'A coordinate pair is required')
    require([F(str(x)) for x in q['answer']] == expected, 'Incorrect coordinate pair')


def validate_task(q):
    """Mathematical evidence from independent operations, never the UI parser."""
    m = q['mathCheck']
    rule = m['type']
    checks = 1
    if rule == 'evaluate': assert_scalar(q, value(m['expression']))
    elif rule in ('equation', 'root-count'):
        roots = equation(m['left'], m.get('right', '0'))
        if rule == 'root-count': assert_scalar(q, F(len(roots)))
        else: assert_roots(q, roots)
    elif rule == 'point': assert_point(q, [value(m['x']), value(m['y'])])
    elif rule == 'point-from-value':
        roots = equation(m['expression'], m['value'])
        require(len(roots) == 1, 'Inverse point must be unique')
        assert_point(q, [roots[0], value(m['value'])])
    elif rule == 'vertex':
        a, b, c = [F(x) for x in m['coefficients']]
        require(a != 0, 'Vertex requires a nondegenerate quadratic')
        x = -b/(2*a)
        assert_point(q, [x, a*x*x+b*x+c])
    elif rule == 'midpoint': assert_point(q, [(F(a)+F(b))/2 for a, b in zip(m['a'], m['b'])])
    elif rule == 'expression':
        source, excluded = parse(m['expression'])
        answer, _ = parse(q['answer']['expression'])
        require(source.equals(answer), 'Expression is not identically equivalent')
        require(q['domainPolicy'] == 'preserve' and q['answer']['variables'] == ['x'], 'Explicit domain preservation required')
        require(sorted(F(str(x)) for x in q['answer']['domain']['excluded']) == excluded, 'Original denominator exclusions lost or fabricated')
    elif rule in ('inequality', 'reciprocal-inequality', 'quadratic-inequality', 'log-domain'):
        if rule == 'inequality': expected = linear_interval(m['left'], m['op'], m.get('right', '0'))
        elif rule == 'log-domain':
            require(value(m['base']) > 0 and value(m['base']) != 1, 'Invalid logarithm base')
            expected = linear_interval(m['argument'], '>', '0')
        elif rule == 'reciprocal-inequality':
            require(value(m['numerator']) > 0 and m['op'] in ('<', '<=', '>', '>='), 'Unsupported reciprocal proof')
            bound = value(m['shift'])
            expected = [(None, bound, False, False)] if m['op'] in ('<', '<=') else [(bound, None, False, False)]
        else:
            a, b, c = [F(x) for x in m['coefficients']]
            require(a > 0 and b*b-4*a*c == 0 and m['op'] == '<=', 'This packet uses the double-root nonpositive boundary case')
            expected = [(-b/(2*a), -b/(2*a), True, True)]
        require(q['kind'] == 'interval' and interval_key(q['answer']) == expected, 'Wrong interval or endpoint inclusion')
    elif rule in ('matching-values', 'matching-evaluation', 'matching-series'):
        require(q['kind'] == 'matching', 'Matching format expected')
        cases = m.get('cases', m.get('values'))
        require(set(q['answer']) == set(cases), 'Missing matching item')
        require(set(item['id'] for item in q['matchingItems']) == set(cases), 'Visible matching items differ from proof')
        require(set(item['id'] for item in q['matchingOptions']) == set(m['options']), 'Visible matching options differ from proof')
        for key, data in cases.items():
            selected = m['options'][q['answer'][key]]
            if rule == 'matching-values': require(value(data) == value(selected), 'Wrong value correspondence')
            elif rule == 'matching-evaluation':
                try: actual = value(m['expression'], value(data))
                except (ZeroDivisionError, ValueError): actual = 'undefined'
                expected = selected if selected == 'undefined' else value(selected)
                require(actual == expected, 'Wrong domain/value correspondence')
            else:
                actual = [value(selected, value(t)) for t in m['times']]
                require(actual == [value(x) for x in data], 'A model does not reproduce its matched table')
            checks += 1
    elif rule == 'finite-probability':
        require(len(set(m['outcomes'])) == len(m['outcomes']) and len(set(m['favorable'])) == len(m['favorable']), 'Duplicate finite outcome')
        require(set(m['favorable']) <= set(m['outcomes']) and m['outcomes'], 'Favorable outcomes must be in the experiment')
        assert_scalar(q, F(len(m['favorable']), len(m['outcomes'])))
    elif rule == 'coin-probability':
        require(1 <= m['tosses'] <= 12, 'Unbounded finite experiment')
        outcomes = list(itertools.product((0, 1), repeat=m['tosses']))
        count = sum(m['minHeads'] <= sum(outcome) <= m['maxHeads'] for outcome in outcomes)
        assert_scalar(q, F(count, len(outcomes)))
    elif rule in ('steps', 'open'):
        if rule == 'steps':
            require(q['kind'] == 'steps' and q['responseMode'] == 'order', 'Ordered solution format required')
            ids = [item['id'] for item in q['stepOptions']]
            require(len(ids) == len(set(ids)) and set(ids) == set(q['answer']) and len(q['answer']) == len(ids), 'A step is missing or repeated')
            positions = {sid:i for i, sid in enumerate(q['answer'])}
            for a, b in m['dependencies']:
                require(positions[a] < positions[b], 'A mathematical dependency is reversed')
                checks += 1
        else:
            require(q['kind'] == 'open' and q['answer'] is None and len(q.get('rubric', [])) in (3, 4), 'Open answers need explicit human criteria')
        for field in ('claims', 'witnesses'):
            for assertion in m.get(field, []):
                require(holds(assertion['left'], assertion.get('relation', '='), assertion['right']), 'False declared mathematical assertion')
                checks += 1
        equations = [equation(item['left'], item.get('right', '0')) for item in m.get('equations', [])]
        require(not equations or all(item == equations[0] for item in equations), 'A solution step changed the root set')
        inequalities = [linear_interval(item['left'], item['op'], item.get('right', '0')) for item in m.get('inequalities', [])]
        require(not inequalities or all(item == inequalities[0] for item in inequalities), 'A solution step changed the inequality set')
        if 'dice' in m:
            d = m['dice']
            actual = sum(a+b == d['sum'] for a in range(1, d['sides']+1) for b in range(1, d['sides']+1))
            require(actual == d['count'] and d['total'] == d['sides']**2, 'Dice enumeration disagrees with the solution')
            checks += 1
    elif rule == 'examples':
        require(q['kind'] == 'examples' and q['answer'] is None, 'Constructive validator format required')
        require(len(set(q.get('acceptedExamples', []))) >= 2 and q.get('answerExplanation'), 'Several explicitly nonexclusive accepted examples required')
        for raw in q['acceptedExamples'] + m['valid']:
            require(constructive(q['validator'], raw), 'A displayed accepted example violates the mathematical constraints')
            checks += 1
        for raw in m['invalid']:
            require(not constructive(q['validator'], raw), 'An invalid example was accepted')
            checks += 1
        require(constructive(q['validator'], q['display']), 'Displayed construction is not valid')
    else: raise ValueError('Unknown independent proof rule: '+rule)
    return checks


def validate_source(source):
    require(source.get('version') == 1 and len(source.get('tasks', [])) == 80, 'Expected eighty authored tasks')
    require(len(source.get('topics', [])) == 10 and len(source.get('methods', [])) == 32, 'Expected ten topics and thirty-two method definitions')
    topic_map = {t['id']:t for t in source['topics']}
    method_map = {m['id']:m for m in source['methods']}
    task_map = {q['id']:q for q in source['tasks']}
    require(len(task_map) == 80 and len(topic_map) == 10 and len(method_map) == 32, 'Duplicate task, topic or method ID')
    require(set(method_map) == {mid for q in source['tasks'] for mid in q['methodIds']}, 'Unused method or missing method definition')
    require(all(all(isinstance(item.get(field), str) and item[field].strip() for field in ('id', 'title', 'when', 'limitations')) for item in source['methods']), 'Method definition lacks selection guidance or limits')
    skill_source = (ROOT/'src/bank-pedagogy.js').read_text(encoding='utf-8')
    skill_ids = set(re.findall(r"^\s*\['([a-z-]+)','", skill_source, re.M))
    checks = 0
    for topic in source['topics']:
        group = [q for q in source['tasks'] if q['topicId'] == topic['id']]
        require(len(group) == 8, 'Each topic must have eight tasks')
        require(Counter(q['category'] for q in group) == {'contrast':4, 'steps':2, 'representation':1, 'boundary':1}, 'Topic composition differs from its explicit plan')
        pairs = Counter(q['contrastPairId'] for q in group if q['category'] == 'contrast')
        require(len(pairs) == 2 and set(pairs.values()) == {2}, 'Every topic needs two complete contrast pairs')
    for q in source['tasks']:
        label = q['id']
        try:
            topic = topic_map[q['topicId']]
            require(q['grade'] == topic['grade'] and q['level'] == topic['level'] and 5 <= q['grade'] <= 11, 'Programme metadata differs from its topic')
            require(q['level'] in ('basic', 'advanced') and (q['grade'] >= 10 or q['level'] == 'basic'), 'Invalid programme level')
            require(q['kind'] in KINDS and type(q['revision']) is int and q['revision'] >= 1 and q['editorialStatus'] == 'teacher_pending', 'Invalid format, revision or invented teacher status')
            require(q['skills'] and set(q['skills']) <= skill_ids and len(set(q['skills'])) == len(q['skills']), 'Unknown or repeated concrete skill')
            require(q['competencies'] and set(q['competencies']) <= {'calculations', 'equations', 'graphs', 'modelling', 'geometry', 'data', 'reasoning'}, 'Invalid major competency')
            require(q['methodIds'] and set(q['methodIds']) <= set(topic['methodIds']) <= set(method_map), 'Unknown method definition')
            for field in ('prompt', 'display', 'methodChoice', 'rationale', 'domain', 'check', 'solution', 'hint', 'family'):
                require(isinstance(q.get(field), str) and q[field].strip(), 'Missing authored field '+field)
                require(not re.search(r'<(?:script|iframe|img)\b|\bon\w+\s*=', q[field], re.I), 'Unexpected executable markup')
            require(len(q.get('solutionSteps', [])) >= 3 and all(set(s) == {'statement', 'reason'} and len(s['statement']) >= 3 and len(s['reason']) >= 10 for s in q['solutionSteps']), 'Reasoned solution steps are incomplete')
            if q['category'] == 'contrast':
                require(len(q['relatedIds']) == 1, 'Contrast partner missing')
                partner = task_map[q['relatedIds'][0]]
                require(partner['contrastPairId'] == q['contrastPairId'] and q['id'] in partner['relatedIds'], 'Contrast relation is not reciprocal')
            if q['category'] == 'representation': require(q['representations'] and q.get('representationLinks'), 'Representation transition has no inspectable data')
            for representation in q['representations']:
                require(representation['type'] in ('text', 'table', 'graph'), 'Unsupported representation')
                if representation['type'] == 'table': require(all(len(row) == len(representation['headers']) for row in representation['rows']), 'Ragged table')
                if representation['type'] == 'graph':
                    require(representation['xMin'] < representation['xMax'] and representation['yMin'] < representation['yMax'], 'Invalid graph range')
                    require(all(len(point) == 2 and all(type(v) in (int, float) and math.isfinite(v) for v in point) for point in representation['points']), 'Invalid graph point')
            checks += validate_task(q) + 1
        except (KeyError, TypeError, IndexError, ZeroDivisionError, ValueError) as error:
            raise ValueError(label+': '+str(error)) from error
    require({q['kind'] for q in source['tasks']} == KINDS, 'Not every promised answer format is represented')
    return checks


def digest(content):
    return hashlib.sha256(json.dumps(content, ensure_ascii=False, sort_keys=True, separators=(',', ':')).encode('utf-8')).hexdigest()


def editorial_records():
    """Read immutable reviewed snapshots; ordinary builds never add approvals."""
    directory = SOURCE.parent
    ledger = json.loads((directory/'editorial.json').read_text(encoding='utf-8'))
    require(ledger.get('version') == 1 and isinstance(ledger.get('records'), list), 'Invalid editorial ledger')
    records, snapshots = {}, {}
    for record in ledger['records']:
        require(isinstance(record, dict) and isinstance(record.get('id'), str), 'Invalid editorial record')
        revision = record.get('revision')
        require(type(revision) is int and revision >= 1, 'Invalid reviewed revision')
        key = (record['id'], revision)
        require(key not in records, 'A reviewed revision must not be overwritten or duplicated')
        snapshot = record.get('snapshot')
        require(isinstance(snapshot, str) and snapshot.startswith('revisions/') and snapshot.endswith('.json'), 'Reviewed snapshot must be a local revisions JSON file')
        path = (directory/snapshot).resolve()
        require(path.is_relative_to(directory.resolve()), 'Reviewed snapshot leaves the source folder')
        if path not in snapshots:
            snapshots[path] = json.loads(path.read_text(encoding='utf-8'))
        stored = snapshots[path].get('questions', {}).get(record['id'])
        require(isinstance(stored, dict) and stored.get('revision') == revision, 'Reviewed snapshot lacks the declared revision')
        require(digest(stored) == record.get('contentHash'), 'Reviewed snapshot or ledger hash was changed')
        review = record.get('assistant', {})
        require(review.get('status') == 'assistant_checked' and review.get('checkedBy') == 'assistant' and isinstance(review.get('note'), str) and review['note'].strip(), 'An explicit assistant review is required')
        require(record.get('teacherStatus') == 'teacher_pending', 'The source ledger must not invent a teacher review')
        records[key] = record
    return records


def build_method_bank(source=None):
    source = json.loads(SOURCE.read_text(encoding='utf-8')) if source is None else source
    validate_source(source)
    records = editorial_records()
    browser = {key:deepcopy(value) for key, value in source.items() if key != 'tasks'}
    browser['tasks'] = []
    for original in source['tasks']:
        q = {key:deepcopy(value) for key, value in original.items() if key not in ('mathCheck', 'contentHash', 'mathEvidence', 'assistantEvidence')}
        proof_checks = validate_task(original)
        payload = {key:value for key, value in q.items() if key != 'editorialStatus'}
        q['contentHash'] = digest(payload)
        key = (q['id'], q['revision'])
        record = records.get(key)
        previous = [revision for qid, revision in records if qid == q['id']]
        require(not previous or q['revision'] >= max(previous), q['id']+': source revision rolls back reviewed history')
        require(record is None or record['contentHash'] == q['contentHash'], q['id']+': reviewed content changed without a revision bump')
        q['mathEvidence'] = {'status':'passed', 'contentHash':q['contentHash'], 'revision':q['revision'], 'checks':proof_checks, 'checkedBy':'independent-source-checker', 'scope':'Exact declared mathematical claims, root sets, domains, finite outcomes and constructive examples; prose completeness remains subject to teacher review.'}
        if record is not None:
            q['assistantEvidence'] = {**deepcopy(record['assistant']), 'contentHash':q['contentHash'], 'revision':q['revision']}
        browser['tasks'].append(q)
    return browser


def mutation_checks(source):
    checks = 0
    for original in source['tasks']:
        q = deepcopy(original)
        kind = q['kind']
        if kind == 'number': q['answer'] += 1
        elif kind == 'set': q['answer'] = q['answer']+[123456]
        elif kind == 'coordinates': q['answer'][0] = str(F(str(q['answer'][0]))+1)
        elif kind == 'interval': q['answer'] = [] if q['answer'] else [{'lo':None, 'hi':None, 'loClosed':False, 'hiClosed':False}]
        elif kind == 'expression': q['answer']['expression'] += '+1'
        elif kind == 'matching':
            key = next(iter(q['answer']))
            q['answer'][key] = next(option for option in q['mathCheck']['options'] if option != q['answer'][key])
        elif kind == 'steps': q['answer'].reverse()
        elif kind == 'examples': q['acceptedExamples'][0] = '0;0'
        elif kind == 'open': q['mathCheck']['claims'][0]['right'] = '('+q['mathCheck']['claims'][0]['right']+')+1'
        try: validate_task(q)
        except (ValueError, KeyError, ZeroDivisionError): checks += 1
        else: raise ValueError('Tampered answer or evidence was accepted: '+q['id'])
    for malicious in ["__import__('os')", 'x.__class__', '[x for x in range(9)]', '2**9999999']:
        try: parse(malicious)
        except (ValueError, SyntaxError): checks += 1
        else: raise ValueError('Unsafe AST accepted')
    changed = deepcopy(source)
    changed['tasks'][0]['relatedIds'] = ['absent-task']
    try: validate_source(changed)
    except ValueError: checks += 1
    else: raise ValueError('Orphan contrast reference accepted')
    return checks


def editorial_mutation_checks(source):
    ledger_path = SOURCE.parent/'editorial.json'
    before = ledger_path.read_bytes()
    changed = deepcopy(source)
    changed['tasks'][0]['prompt'] += ' Дополнительно объясните выбор операции.'
    try: build_method_bank(changed)
    except ValueError as error:
        require('revision bump' in str(error), 'Same-revision edit failed for an unrelated reason')
    else: raise ValueError('Edited prose reused its old assistant review')
    changed['tasks'][0]['revision'] += 1
    newer = build_method_bank(changed)['tasks'][0]
    require(newer['mathEvidence']['status'] == 'passed' and 'assistantEvidence' not in newer and newer['editorialStatus'] == 'teacher_pending', 'New revision fabricated assistant or teacher approval')
    again = build_method_bank(changed)['tasks'][0]
    require('assistantEvidence' not in again and ledger_path.read_bytes() == before, 'Repeated build manufactured approval or overwrote editorial history')
    return 3


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--write', action='store_true', help='Write browser data after all checks')
    args = parser.parse_args()
    source = json.loads(SOURCE.read_text(encoding='utf-8'))
    checks = validate_source(source)
    mutations = mutation_checks(source)
    editorial_mutations = editorial_mutation_checks(source)
    browser = build_method_bank()
    require('mathCheck' not in json.dumps(browser), 'Source-only oracle leaked to the browser')
    report = {'status':'passed', 'tasks':len(browser['tasks']), 'topics':len(browser['topics']), 'methods':len(browser['methods']), 'checks':checks, 'rejectedMutations':mutations, 'editorialMutationChecks':editorial_mutations, 'kinds':dict(Counter(q['kind'] for q in source['tasks'])), 'reviewStatus':'teacher_pending', 'scope':'Exact independent arithmetic, polynomial identities, complete rational root sets, interval boundaries, finite experiments, constructive validators and explicit source metadata. Teacher review is not asserted.'}
    (ROOT/'checks/method-bank-results.json').write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
    if args.write:
        (ROOT/'data/method-bank.js').write_text('Object.assign(METHOD_BANK,'+json.dumps(browser, ensure_ascii=False, separators=(',', ':'))+');\n', encoding='utf-8')
    print(json.dumps(report, ensure_ascii=False))


if __name__ == '__main__': main()
