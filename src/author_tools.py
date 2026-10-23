"""Individually authored, structurally distinct exercises; no random or Cartesian expansion."""
from bank_tools import ORACLES,A,H,G,P,table,graph,figure,line,label,polygon,ellipse
from fractions import Fraction as F

def N(bank,grade,number,subject,title,ref,rows,level=None):
    tid=f'{grade}-{number:03}';tasks=[]
    for i,row in enumerate(rows,1):
        idea,prompt,answer,solution,oracle,difficulty,*extra=row
        options=extra[0] if extra else {}
        value,display=answer if isinstance(answer,tuple) else (answer,'; '.join(map(str,answer)) if isinstance(answer,list) else str(answer))
        if isinstance(value,list) and not value:display='∅'
        q=dict(id=f'{tid}-{i}',semanticKey=idea,prompt=prompt,answer=value,display=display,solution=solution,kind='set' if isinstance(value,list) else 'number',difficulty={'b':'Базовый','m':'Средний','h':'Повышенный','s':'Суперсложный'}[difficulty],authoredIndependent=True)
        q.update(options);tasks.append(q);ORACLES[q['id']]=oracle
    bank.append(dict(id=tid,grade=grade,level=level or ('advanced' if grade>=10 else 'basic'),course='Математика' if grade<=6 else subject,subject=subject,title=title,ref=ref,tasks=tasks))
C='Числа и вычисления';W='Текстовые задачи';V='Наглядная геометрия'

def R(text):
    """Compact storage for individually authored rows, not a parameter generator.
    Fields: idea ¦ tier ¦ literal answer ¦ question ¦ solution ¦ oracle ¦ optional tricky.
    """
    rows=[]
    for raw in text.strip().splitlines():
        if not raw.strip():continue
        cells=[cell.strip() for cell in raw.split('¦')]
        if len(cells) not in (6,7):raise ValueError('Expected six or seven fields: '+raw)
        idea,d,display,prompt,solution,oracle=cells[:6]
        if ';' in display:
            value=[float(F(part.replace(',','.'))) for part in display.split(';')]
        else:
            f=F(display.replace(',','.'));value=f.numerator if f.denominator==1 else float(f)
        rows.append((idea,prompt,(value,display),solution,oracle,d,{'tricky':True} if len(cells)==7 and cells[6]=='t' else {}))
    return rows
