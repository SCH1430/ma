"""Authoring helpers. Answers are authored constants; verification expressions are separate oracles."""
from fractions import Fraction as F
import math
BANK=[]
ORACLES={}
A='Алгебра'; G='Геометрия'; P='Вероятность и статистика'; H='Алгебра и начала математического анализа'

def T(grade, number, subject, title, ref, tasks):
    tid=f'{grade}-{number:02}'
    out=[]
    for i,row in enumerate(tasks,1):
        prompt,answer,solution,oracle,*extra=row
        options=extra[0] if extra else {}
        if isinstance(answer,tuple):
            value,display=answer
        else:
            value=answer
            display='; '.join(map(str,value)) if isinstance(value,list) else str(value)
        q=dict(id=f'{tid}-{i}',prompt=prompt,answer=value,display=display,solution=solution,
               difficulty=options.get('difficulty',['Старт','Практика','Практика','Сложнее'][i-1]),
               kind='set' if isinstance(value,list) else 'number')
        q.update(options)
        out.append(q); ORACLES[q['id']]=oracle
    BANK.append(dict(id=tid,grade=grade,course=subject,subject=subject,title=title,ref=ref,tasks=out))

def line(x1,y1,x2,y2,dash=False): return dict(type='line',x1=x1,y1=y1,x2=x2,y2=y2,dash=dash)
def label(text,x,y,anchor='middle',size=15): return dict(type='text',text=str(text),x=x,y=y,anchor=anchor,size=size)
def polygon(points): return dict(type='polygon',points=points,fill=False)
def ellipse(x,y,rx,ry=None,fill=False): return dict(type='ellipse',x=x,y=y,rx=rx,ry=rx if ry is None else ry,fill=fill)
def figure(alt,elements,caption='Схема, не в масштабе',height=190): return dict(width=360,height=height,alt=alt,caption=caption,elements=elements)
def table(headers,rows,alt):
    cols=len(headers); w=320/cols;h=34; rows=[headers]+rows;els=[]
    for r in range(len(rows)+1):els.append(line(20,12+r*h,340,12+r*h))
    for c in range(cols+1):els.append(line(20+c*w,12,20+c*w,12+len(rows)*h))
    for r,row in enumerate(rows):
        for c,v in enumerate(row):els.append(label(v,20+(c+.5)*w,34+r*h,size=14))
    return figure(alt,els,'Таблица данных',12+len(rows)*h+10)
def graph(fn,xmin,xmax,ymin,ymax,step=1,marked=(),alt='График функции',xtitle='x',ytitle='y'):
    # An affine map shared by grid, samples and labelled points. No hand-positioned curve.
    X=lambda x:45+(x-xmin)/(xmax-xmin)*270
    Y=lambda y:158-(y-ymin)/(ymax-ymin)*132
    els=[]
    for k in range(math.ceil(xmin/step),math.floor(xmax/step)+1):
        x=k*step; els.append(line(X(x),26,X(x),158,True))
        els.append(label(x,X(x),180,size=12))
    for k in range(math.ceil(ymin/step),math.floor(ymax/step)+1):
        y=k*step;els.append(line(45,Y(y),315,Y(y),True));els.append(label(y,35,Y(y)+4,'end',12))
    els.extend([line(45,Y(0) if ymin<=0<=ymax else 158,327,Y(0) if ymin<=0<=ymax else 158),line(X(0) if xmin<=0<=xmax else 45,168,X(0) if xmin<=0<=xmax else 45,16),label(xtitle,338,180,size=13),label(ytitle,26,16,size=13)])
    prev=None
    for i in range(241):
        x=xmin+(xmax-xmin)*i/240;y=fn(x)
        if not math.isfinite(y) or y<ymin or y>ymax:prev=None;continue
        if prev:els.append(line(*prev,X(x),Y(y)))
        prev=(X(x),Y(y))
    for x,y,name in marked:els.extend([ellipse(X(x),Y(y),2.8,fill=True),label(name,X(x)+8,Y(y)-9,'start',13)])
    return figure(alt,els,'Масштаб указан на осях')
def tri(a='A',b='B',c='C',labels=(),right=False):
    els=[polygon([[80,150],[280,150],[80 if right else 170,25]]),label(a,66,165),label(b,294,165),label(c,68 if right else 170,17)]
    if right:els +=[line(80,140,90,140),line(90,140,90,150)]
    els += [label(*x) for x in labels]
    return figure('Треугольник '+a+b+c+'. Данные и искомое указаны в условии.',els)
