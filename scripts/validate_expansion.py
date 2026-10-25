#!/usr/bin/env python3
"""Verify doubling, preservation, coverage and reproducibility of the added bank."""
from collections import Counter
import ast
import json
from expand_bank import ROOT, BASE_COUNTS, baseline, digest, generated, program, prompt_key, render

topics = [t for p in sorted((ROOT/'src/tasks').glob('grade_*.json')) for t in json.loads(p.read_text())]
manifest = json.loads((ROOT/'src/task-expansion.json').read_text())
base = baseline(topics)
added = [q for t in topics for q in t['tasks'] if generated(q)]
original = [q for t in base for q in t['tasks']]
counts, additions = Counter(), Counter()
errors = []
for t in topics:
    counts[program(t)] += len(t['tasks'])
    additions[program(t)] += sum(generated(q) for q in t['tasks'])
for key, count in BASE_COUNTS.items():
    if counts[key] != count*2 or additions[key] != count:
        errors.append(f'{key}: expected {count} original + {count} new tasks')
    if digest([t for t in base if program(t)==key]) != manifest['original_content_sha256'][key]:
        errors.append(f'{key}: original content changed')
seen = {prompt_key(q['prompt']) for q in original}
for q in added:
    key = prompt_key(q['prompt'])
    if key in seen:
        errors.append(q['id']+': duplicate condition')
    seen.add(key)
    try:
        ast.literal_eval(ast.parse(q['oracle'], mode='eval'))
        errors.append(q['id']+': literal answer used as an oracle')
    except (ValueError, SyntaxError):
        pass
    if not q.get('solution') or not q.get('family') or q['canonicalId'] != q['id']:
        errors.append(q['id']+': incomplete authored metadata')
expected, overrides, expected_manifest = render(topics)
if expected != topics or expected_manifest != manifest:
    errors.append('Materialized tasks differ from reviewed parameter models')
comp = json.loads((ROOT/'src/competencies/classes.json').read_text())
if any(comp['overrides'].get(k) != v for k,v in overrides.items()):
    errors.append('New-task competencies differ from their mathematical models')
report = {'original':len(original),'added':len(added),'total':sum(counts.values()),
          'by_program':dict(counts),'models':manifest['models'],'families':manifest['families'],
          'original_content_preserved':not any('original content' in s for s in errors),'errors':errors}
(ROOT/'checks/expansion-results.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(report,ensure_ascii=False,indent=2))
raise SystemExit(bool(errors))
