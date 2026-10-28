"""Revision and review workflow. No command runs implicitly during a build."""
import argparse
from datetime import datetime, timezone
import json
from quality_assets import DIRECTORY, STATES, check_math, digest, read

def write(name,value):
    target=DIRECTORY/name;target.parent.mkdir(parents=True,exist_ok=True)
    target.write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')

def sync(source,ledger,reviewer,note):
    changed=[]
    for q in source['tasks']:
        old=ledger['tasks'].get(q['id'])
        if old and old['sha256']==digest(q):continue
        # A content edit retains its stable task ID but advances the revision.
        q['revision']=old['revision']+1 if old else 1
        name='revisions/'+source['batch']+'.json' if old is None else 'revisions/'+q['id']+'.'+str(q['revision'])+'.json'
        history=old['history'][:] if old else []
        event=dict(revision=q['revision'],sha256=digest(q),status='draft',snapshot=name,reviewer=reviewer,note=note,at=datetime.now(timezone.utc).isoformat())
        ledger['tasks'][q['id']]={k:event[k] for k in ('revision','sha256','status')};ledger['tasks'][q['id']]['history']=history+[event]
        changed.append((q,name))
    snapshots={}
    for q,name in changed:snapshots.setdefault(name,{})[q['id']]=q
    for name,snapshot in snapshots.items():
        if (DIRECTORY/name).exists():raise ValueError('Refusing to overwrite immutable revision '+name)
        write(name,snapshot)
    return len(changed)

def advance(q,entry,target,reviewer,note):
    assert digest(q)==entry['sha256'] and q['revision']==entry['revision'],'Run --sync for changed content'
    if entry['status']==target:return False
    assert STATES.index(target)==STATES.index(entry['status'])+1,'Review stages cannot be skipped'
    check_math(q)
    event={**entry['history'][-1],'status':target,'reviewer':reviewer,'note':note,'at':datetime.now(timezone.utc).isoformat()}
    entry['status']=target;entry['history'].append(event);return True

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    action=parser.add_mutually_exclusive_group(required=True);action.add_argument('--sync',action='store_true');action.add_argument('--stage',choices=STATES[1:])
    parser.add_argument('--ids',nargs='+',default=['all']);parser.add_argument('--reviewer',required=True);parser.add_argument('--note',required=True)
    args=parser.parse_args();assert len(args.note.strip())>=20 and args.reviewer.strip()
    source=read('bank.json');ledger=read('editorial.json') if (DIRECTORY/'editorial.json').exists() else {'version':1,'tasks':{}}
    if args.sync:
        count=sync(source,ledger,args.reviewer,args.note);write('bank.json',source)
    else:
        assert args.ids==['all'] or set(args.ids)<=set(ledger['tasks']), 'Unknown task ID'
        count=sum(advance(q,ledger['tasks'][q['id']],args.stage,args.reviewer,args.note) for q in source['tasks'] if args.ids==['all'] or q['id'] in args.ids)
    write('editorial.json',ledger);print(f'Updated {count} tasks')

if __name__=='__main__':main()
