"""Pure independent graph and finite-state calculations for authored 6–7 tasks."""
def g67_adj(vertices, edges, directed=False):
    out={v:[] for v in vertices}
    for e in edges:
        a,b=e[:2]; w=e[2] if len(e)>2 else 1
        out.setdefault(a,[]).append((b,w));out.setdefault(b,[])
        if not directed:out[b].append((a,w))
    return out

def g67_components(vertices,edges):
    adj=g67_adj(vertices,edges);left=set(adj); result=[]
    while left:
        seed=next(iter(left)); seen={seed}; todo=[seed]
        while todo:
            v=todo.pop()
            for w,_ in adj[v]:
                if w not in seen:seen.add(w);todo.append(w)
        result.append(seen);left-=seen
    return result

def g67_reachable(vertices,edges,start,directed=False):
    adj=g67_adj(vertices,edges,directed); seen={start}; todo=[start]
    while todo:
        v=todo.pop()
        for w,_ in adj[v]:
            if w not in seen:seen.add(w);todo.append(w)
    return seen

def g67_shortest(vertices,edges,start,end,directed=False):
    adj=g67_adj(vertices,edges,directed);dist={v:float('inf') for v in adj};dist[start]=0;left=set(adj)
    while left:
        v=min(left,key=lambda v:dist[v]);left.remove(v)
        if v==end:return dist[v]
        for w,d in adj[v]:dist[w]=min(dist[w],dist[v]+d)
    return dist[end]

def g67_paths(vertices,edges,start,end,directed=False):
    adj=g67_adj(vertices,edges,directed)
    def walk(v,seen):
        if v==end:return [seen]
        return [p for w,_ in adj[v] if w not in seen for p in walk(w,seen+[w])]
    return walk(start,[start])

def g67_degrees(vertices,edges):
    return {v:len(ns) for v,ns in g67_adj(vertices,edges).items()}

def g67_euler(vertices,edges,closed=False):
    degrees=g67_degrees(vertices,edges);active={v for v,d in degrees.items() if d}
    connected=not active or active<=g67_reachable(vertices,edges,next(iter(active)))
    odd=sum(d%2 for d in degrees.values())
    return int(connected and (odd==0 if closed else odd in [0,2]))

def g67_switch_states(n,toggles):
    seen={0}; todo=[0]
    while todo:
        state=todo.pop()
        for toggle in toggles:
            target=state
            for pos in toggle:target^=1<<pos
            if target not in seen:seen.add(target);todo.append(target)
    return seen

def g67_last_degrees(prefix):
    n=len(prefix)+1; vertices=range(n); pairs=[(a,b) for a in vertices for b in range(a+1,n)]; possible=set()
    for mask in range(1<<len(pairs)):
        degrees=[0]*n
        for i,(a,b) in enumerate(pairs):
            if mask>>i&1:degrees[a]+=1;degrees[b]+=1
        if degrees[:-1]==list(prefix):possible.add(degrees[-1])
    return sorted(possible)

def g67_euler_count(vertices,edges,start):
    edges=list(edges)
    def walk(v,unused):
        if not unused:return 1
        total=0
        for i in unused:
            a,b=edges[i]
            if v==a:total+=walk(b,unused-{i})
            elif v==b:total+=walk(a,unused-{i})
        return total
    return walk(start,set(range(len(edges))))
