def roman(n):
    if not isinstance(n,int) or not 0<n<4000:raise ValueError('Roman test domain: 1..3999')
    result=''
    for value,symbol in [(1000,'M'),(900,'CM'),(500,'D'),(400,'CD'),(100,'C'),(90,'XC'),(50,'L'),(40,'XL'),(10,'X'),(9,'IX'),(5,'V'),(4,'IV'),(1,'I')]:
        count,n=divmod(n,value);result+=symbol*count
    return result


def jugs_min_steps(a,b,target):
    from collections import deque
    queue=deque([(0,0,0)]);seen={(0,0)}
    while queue:
        x,y,n=queue.popleft()
        if target in (x,y):return n
        ab=min(x,b-y);ba=min(y,a-x)
        for state in [(a,y),(x,b),(0,y),(x,0),(x-ab,y+ab),(x+ba,y-ba)]:
            if state not in seen:seen.add(state);queue.append((*state,n+1))
    return -1
