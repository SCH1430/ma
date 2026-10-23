"""Независимые общие вычисления для авторских условий 10–11 классов."""
from math import gcd
from functools import reduce

def fib_1011(n):
    a,b=0,1
    for _ in range(n):a,b=b,a+b
    return a

def planes_line_points_1011(a,b,points):
    u=tuple(y-x for x,y in zip(a,b));planes=set()
    for p in points:
        v=tuple(y-x for x,y in zip(a,p))
        n=(u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0])
        g=reduce(gcd,n)
        if not g:continue
        n=tuple(x//g for x in n)
        if next(x for x in n if x)!=abs(next(x for x in n if x)):n=tuple(-x for x in n)
        planes.add(n)
    return len(planes)
