#!/usr/bin/env python3
"""Materialize the reviewed 2026 expansion. Build reads JSON, never generates tasks.

Run --write to apply, or --check (default) to verify reproducibility.
Existing tasks are preserved. Original content digests live in the manifest.
"""
from collections import Counter
from pathlib import Path
import argparse
import hashlib
import json
import re
import expansion_models as models

ROOT = Path(__file__).resolve().parents[1]
BATCH = '2026-10-double'
BASE_COUNTS = {'5:basic':308,'6:basic':552,'7:basic':526,'8:basic':520,
               '9:basic':520,'10:basic':323,'10:advanced':359,
               '11:basic':323,'11:advanced':313}
# Topic assignments are explicit: generated exercises never drift between grades.
ASSIGNMENTS = {
 '5:basic': '5-01:arithmetic 5-02:division 5-03:fractions 5-04:decimals 5-05:motion 5-205:shopping 5-06:perimeter 5-07:rectangle 5-08:box 5-219:angles 5-222:table_data',
 '6:basic': '6-01:gcd_lcm 6-02:fractions 6-03:percent 6-04:ratio 6-05:signed 6-06:absolute 6-07:coordinates 6-210:scale 6-224:work_rate 6-218:perimeter 6-219:rectangle 6-220:box 6-223:motion',
 '7:basic': '7-01:linear 7-02:powers 7-03:polynomial 7-04:linear_function 7-05:systems 7-06:angles 7-07:triangle 7-08:statistics 7-09:frequency 7-228:graph_edges 7-10:percent',
 '8:basic': '8-01:radicals 8-02:quadratic 8-03:rational 8-04:inequalities 8-10:inverse_function 8-05:pythagoras 8-06:trapezoid 8-07:similarity 8-11:inscribed_angle 8-08:probability 8-09:variance_data 8-12:conditional',
 '9:basic': '9-01:arithmetic_sequence 9-02:geometric_sequence 9-03:parabola 9-04:biquadratic 9-10:quadratic_inequality 9-05:vectors2 9-06:sector 9-07:cosine_rule 9-08:combinations 9-09:binomial 9-12:random_variable',
 '10:basic': '10-101:nth_root 10-102:irrational_equation 10-103:trig_value 10-104:trig_equation 10-105:composition 10-106:geometric_sequence 10-107:spatial_distance 10-108:solid_volume 10-109:statistics 10-110:total_probability 10-111:combinations 10-112:binomial',
 '10:advanced': '10-01:nth_root 10-02:logarithms 10-03:exponential 10-04:trig_value 10-05:trig_equation 10-06:polynomial_remainder 10-07:matrix_determinant 10-08:composition 10-09:arithmetic_sequence 10-10:derivative 10-11:spatial_distance 10-12:solid_volume 10-13:vectors3 10-14:total_probability 10-15:combinations 10-16:random_variable',
 '11:basic': '11-101:logarithms 11-102:exponential 11-103:logarithmic_inequality 11-104:derivative 11-105:optimization 11-106:integral 11-107:trig_equation 11-108:cylinder 11-109:sphere 11-110:vectors3 11-111:random_variable 11-112:uniform',
 '11:advanced': '11-01:complex_numbers 11-02:number_theory 11-03:logarithmic_inequality 11-04:parameter 11-05:optimization 11-06:advanced_integral 11-07:trig_inequality 11-08:frustum 11-09:sphere_section 11-10:volume_scale 11-11:chebyshev 11-12:uniform 11-13:poisson 11-14:regression',
}


def program(topic):
    return f"{topic['grade']}:{topic.get('level', 'basic')}"


def generated(q):
    return q.get('generation', {}).get('batch') == BATCH


def digest(value):
    return hashlib.sha256(json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':')).encode()).hexdigest()


def baseline(topics):
    return [{**t, 'tasks':[q for q in t['tasks'] if not generated(q)]} for t in topics]


def prompt_key(text):
    return ' '.join(text.split()).replace('ё','е').replace('−','-')


def render(topics):
    topics = baseline(topics)
    by_id = {t['id']:t for t in topics}
    counts = Counter()
    for t in topics:
        counts[program(t)] += len(t['tasks'])
    if dict(counts) != BASE_COUNTS:
        raise ValueError(f'Original counts changed: {dict(counts)}')
    originals = {key:digest([t for t in topics if program(t)==key]) for key in BASE_COUNTS}
    seen = {prompt_key(q['prompt']) for t in topics for q in t['tasks']}
    used_ids = {q['id'] for t in topics for q in t['tasks']}
    parameters = Counter()
    serials = Counter()
    overrides = {}
    added = []
    for key, count in BASE_COUNTS.items():
        assignments = [item.split(':') for item in ASSIGNMENTS[key].split()]
        for i in range(count):
            tid, name = assignments[i % len(assignments)]
            topic = by_id[tid]
            assert program(topic) == key, (tid, key)
            form = (i // len(assignments)) % 2
            # Conditional probability is a separate advanced topic; basic grade 10
            # gets only the direct total-probability form, with new numerical givens.
            if key == '10:basic' and name == 'total_probability':
                form = 0
            for attempt in range(1000):
                parameters[(name, form)] += 1
                n = parameters[(name, form)]
                task = getattr(models, name)(n, form)
                for field in ('prompt','solution'):
                    task[field] = re.sub(r'\+\s*[-−]\s*(\d+)', r'− \1', task[field])
                    task[field] = re.sub(r'log_(\d+)', lambda m:'log'+m[1].translate(str.maketrans('0123456789','₀₁₂₃₄₅₆₇₈₉')), task[field])
                if prompt_key(task['prompt']) not in seen:
                    break
            else:
                raise ValueError(f'Exhausted distinct prompts: {name}/{form}')
            seen.add(prompt_key(task['prompt']))
            while True:
                serials[tid] += 1
                qid = f'{tid}-{8000+serials[tid]}'
                if qid not in used_ids:
                    break
            used_ids.add(qid)
            overrides[qid] = task.pop('competencies')
            task.update(id=qid, canonicalId=qid, family=f'{BATCH}:{name}:{form}',
                        applicability=[{'grade':topic['grade'],'level':topic.get('level','basic'),'topic':tid}],
                        generation={'batch':BATCH,'model':name,'form':form,'parameter':n})
            topic['tasks'].append(task)
            added.append(task)
    manifest = {'version':1,'batch':BATCH,'original_counts':BASE_COUNTS,
                'original_content_sha256':originals,'added_count':len(added),
                'result_count':sum(BASE_COUNTS.values())+len(added),
                'models':len({q['generation']['model'] for q in added}),
                'families':len({q['family'] for q in added}),
                'expanded_topics':len({q['id'].rsplit('-',1)[0] for q in added}),
                'note':'Numeric variants share a family; counts describe catalog entries, not independent methods.'}
    return topics, overrides, manifest


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--write', action='store_true')
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    files = sorted((ROOT/'src/tasks').glob('grade_*.json'))
    original = {p:json.loads(p.read_text()) for p in files}
    topics, overrides, manifest = render([t for items in original.values() for t in items])
    path = ROOT/'src/task-expansion.json'
    if path.exists():
        previous = json.loads(path.read_text())
        if previous['original_content_sha256'] != manifest['original_content_sha256']:
            raise SystemExit('Original tasks changed. Review the baseline before regeneration.')
    comp_path = ROOT/'src/competencies/classes.json'
    comp = json.loads(comp_path.read_text())
    current_generated = {q['id'] for items in original.values() for t in items for q in t['tasks'] if generated(q)}
    comp['overrides'] = {k:v for k,v in comp['overrides'].items() if k not in current_generated}
    comp['overrides'].update(overrides)
    outputs = {p:[t for t in topics if t['grade']==int(p.stem[-2:])] for p in files}
    outputs.update({path:manifest, comp_path:comp})
    changed = [p for p,value in outputs.items() if not p.exists() or json.loads(p.read_text()) != value]
    if args.write:
        for p in changed:
            p.write_text(json.dumps(outputs[p],ensure_ascii=False,indent=2)+'\n')
    elif changed:
        raise SystemExit('Expansion differs from reviewed models: '+', '.join(str(p.relative_to(ROOT)) for p in changed))
    print(json.dumps(manifest, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
