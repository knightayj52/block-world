"""Single-process classroom game server. SQLite transactions own each edit."""
import hashlib
import hmac
import json
import math
import os
import re
import secrets
import sqlite3
import time
from collections import defaultdict, deque
from pathlib import Path
from aiohttp import web

ROOT = Path(__file__).resolve().parent.parent
rle = json.loads((ROOT / 'docs/terrain.js').read_text().split('=', 1)[1].strip().rstrip(';'))
BASE = bytes(t for t, count in rle for _ in range(count))
biomes=json.loads((ROOT/'docs/biomes.js').read_text().split('=',1)[1].strip().rstrip(';'))
RECIPES=json.loads((ROOT/"docs/recipes.js").read_text().split("=",1)[1].strip().rstrip(";"))
MAPS={'forest':BASE,**{name:bytes(t for t,n in runs for _ in range(n)) for name,runs in biomes.items()}}
START = [0, 0, 8, 4, 0, 0, 0, 8, 8, 6, 4, 3, 0]
SPAWN = [16.5, 9, 17.5, .14, -.17]
db = sqlite3.connect(os.getenv('WORLD_DB', 'world.sqlite3'))
db.row_factory = sqlite3.Row
db.executescript("""
PRAGMA journal_mode=WAL;
CREATE TABLE IF NOT EXISTS users(name TEXT PRIMARY KEY,salt BLOB,pw BLOB,token TEXT,expires INTEGER);
CREATE TABLE IF NOT EXISTS cells(world TEXT,k INTEGER,t INTEGER,PRIMARY KEY(world,k));
CREATE TABLE IF NOT EXISTS players(world TEXT,name TEXT,bag TEXT,pos TEXT,PRIMARY KEY(world,name));
CREATE TABLE IF NOT EXISTS worlds(name TEXT PRIMARY KEY,title TEXT,biome TEXT);
CREATE TABLE IF NOT EXISTS signs(world TEXT,k INTEGER,label TEXT,PRIMARY KEY(world,k));
CREATE TABLE IF NOT EXISTS members(world TEXT,name TEXT,role TEXT,PRIMARY KEY(world,name));
""")
live = {}
attempts = defaultdict(deque)
def require(check, message):
    if not check:
        raise ValueError(message)

def role_of(world, name):
    if world == name:
        return 'owner'
    row = db.execute('SELECT role FROM members WHERE world=? AND name=?', (world,name)).fetchone()
    return row[0] if row else None

def state(world, name):
    db.execute('INSERT OR IGNORE INTO players VALUES (?,?,?,?)',(world,name,json.dumps(START),json.dumps(SPAWN)))
    p = db.execute('SELECT * FROM players WHERE world=? AND name=?',(world,name)).fetchone()
    meta=db.execute("SELECT title,biome FROM worlds WHERE name=?",(world,)).fetchone()
    bag=json.loads(p["bag"]);bag.extend(START[len(bag):])
    return dict(title=meta[0] if meta else world+"의 숲",biome=meta[1] if meta else "forest",signs=dict(db.execute("SELECT k,label FROM signs WHERE world=?",(world,))),edits=dict(db.execute('SELECT k,t FROM cells WHERE world=?',(world,))),pos=json.loads(p['pos']),bag=bag,
                role=role_of(world,name),peers=[dict(name=n,pos=v[1]) for (w,n),v in live.items() if w==world and n!=name and v[0]>time.time()-5])

def process(op,d,token,ip):
    if op in ('register','login'):
        q=attempts[ip]
        while q and q[0]<time.time()-60: q.popleft()
        require(len(q)<90,'잠시 후 다시 시도하세요.')
        q.append(time.time())
        name=d.get('name','')
        pw=d.get('pw','')
        require(re.fullmatch(r'[가-힣a-zA-Z0-9_-]{2,16}',name) and isinstance(pw,str) and 8<=len(pw)<=128,'아이디 2~16자, 비밀번호 8~128자를 입력하세요.')
        require(hmac.compare_digest(str(d.get('room','')).encode(),os.environ['CLASS_CODE'].encode()),'학급 코드가 다릅니다.')
        row=db.execute('SELECT * FROM users WHERE name=?',(name,)).fetchone()
        salt=row['salt'] if row else secrets.token_bytes(16)
        digest=hashlib.scrypt(pw.encode(),salt=salt,n=16384,r=8,p=1)
        if op=='register':
            require(not row,'이미 사용 중인 아이디입니다.')
            biome=d.get('biome','forest')
            title=d.get('title',name+'의 숲')
            require(biome in MAPS and isinstance(title,str) and 1<=len(title.strip())<=24,'월드 이름과 시작 지형을 확인하세요.')
            db.execute('INSERT INTO worlds VALUES (?,?,?)',(name,title.strip(),biome))
            db.execute('INSERT INTO users(name,salt,pw) VALUES (?,?,?)',(name,salt,digest))
        else:
            require(row and hmac.compare_digest(digest,row['pw']),'아이디 또는 비밀번호를 확인하세요.')
        token=secrets.token_urlsafe(32)
        db.execute('UPDATE users SET token=?,expires=? WHERE name=?',(hashlib.sha256(token.encode()).hexdigest(),int(time.time()+43200),name))
        return dict(token=token,name=name)
    row=db.execute('SELECT name FROM users WHERE token=? AND expires>?',(hashlib.sha256(token.encode()).hexdigest(),time.time())).fetchone()
    if not row: raise PermissionError('다시 로그인하세요. 다른 기기에서 접속했거나 이용 시간이 끝났습니다.')
    name=row[0]
    if op=='logout':
        db.execute('UPDATE users SET token=NULL WHERE name=?',(name,))
        for key in list(live):
            if key[1]==name: del live[key]
        return {}
    if op=='list':
        return dict(worlds=[name]+[r[0] for r in db.execute('SELECT world FROM members WHERE name=?',(name,))])
    world=d.get('world',name)
    role=role_of(world,name)
    require(role,'이 월드의 초대가 종료되었습니다.')
    if op=='invite':
        friend=d.get('friend','')
        require(role=='owner' and friend!=name,'내 월드에서 친구를 선택하세요.')
        require(db.execute('SELECT 1 FROM users WHERE name=?',(friend,)).fetchone(),'같은 학급에 가입한 친구 아이디를 입력하세요.')
        mode=d.get('role')
        require(mode in ('view','edit','remove'),'권한을 확인하세요.')
        if mode=='remove':
            db.execute('DELETE FROM members WHERE world=? AND name=?',(world,friend))
            live.pop((world,friend),None)
        else:
            db.execute('INSERT OR REPLACE INTO members VALUES (?,?,?)',(world,friend,mode))
        return {}
    s=state(world,name)
    if op=='sync':
        p=d.get('pos')
        if p is not None:
            require(isinstance(p,list) and len(p)==5 and all(type(v) in (int,float) and math.isfinite(v) for v in p) and 0<=p[0]<32 and 0<=p[2]<32 and 0<=p[1]<30,'위치를 확인하세요.')
            db.execute('UPDATE players SET pos=? WHERE world=? AND name=?',(json.dumps(p),world,name))
            live[(world,name)]=(time.time(),p)
        return s
    require(op=='edit' and role in ('edit','owner'),'구경 권한으로는 블록을 바꿀 수 없습니다.')
    bag=s['bag']
    if d.get('kind')=='craft':
        product=d.get('product',7)
        require(type(product) is int and str(product) in RECIPES,'제작법을 확인하세요.')
        source,cost,count=RECIPES[str(product)]
        require(bag[source]>=cost,'재료가 더 필요합니다.')
        bag[source]-=cost
        bag[product]+=count
    else:
        k=d.get('k')
        require(type(k) is int and 1024<=k<len(BASE),'월드 경계입니다.')
        old=s['edits'].get(k,MAPS[s['biome']][k])
        require(old==d.get('old'),'친구가 먼저 변경한 블록입니다.')
        t=d.get('t')
        if d.get('kind')=='mine':
            require(old and old!=12 and t==0,'캘 블록이 없습니다.')
            bag[old]+=1
        else:
            require(d.get('kind')=='place' and old==0 and type(t) is int and 1<=t<=11 and bag[t]>0,'블록을 놓을 수 없습니다.')
            bag[t]-=1
        if t==11:
            label=d.get('text','우리 집')
            require(isinstance(label,str) and 1<=len(label.strip())<=24,'표지판 문구는 1~24자입니다.')
            db.execute('INSERT OR REPLACE INTO signs VALUES (?,?,?)',(world,k,label.strip()))
        else:
            db.execute('DELETE FROM signs WHERE world=? AND k=?',(world,k))
        db.execute('INSERT OR REPLACE INTO cells VALUES (?,?,?)',(world,k,t))
    db.execute('UPDATE players SET bag=? WHERE world=? AND name=?',(json.dumps(bag),world,name))
    return state(world,name)

@web.middleware
async def cors(request,handler):
    origin=request.headers.get('Origin','')
    allowed=os.getenv('PAGES_ORIGIN','')
    if origin and origin!=allowed and origin!=f'{request.scheme}://{request.host}':
        return web.json_response({'error':'허용되지 않은 게임 주소입니다.'},status=403)
    response=web.Response() if request.method=='OPTIONS' else await handler(request)
    if origin:
        response.headers.update({'Access-Control-Allow-Origin':origin,'Vary':'Origin','Access-Control-Allow-Headers':'Content-Type, Authorization','Access-Control-Allow-Methods':'POST, OPTIONS'})
    return response

async def api(request):
    try:
        data=await request.json()
        require(isinstance(data,dict),'잘못된 요청입니다.')
        with db:
            result=process(request.match_info['op'],data,request.headers.get('Authorization','').removeprefix('Bearer '),request.remote)
        return web.json_response(result,headers={'Cache-Control':'no-store'})
    except (ValueError,TypeError,PermissionError) as err:
        return web.json_response({'error':str(err)},status=401 if isinstance(err,PermissionError) else 400)

if __name__=='__main__':
    if not os.getenv('CLASS_CODE'): raise SystemExit('CLASS_CODE 환경변수를 설정하세요.')
    app=web.Application(middlewares=[cors],client_max_size=8192)
    app.router.add_post('/api/{op}',api)
    app.router.add_options('/api/{op}',api)
    app.router.add_get('/',lambda req:web.FileResponse(ROOT/'docs/index.html'))
    app.router.add_static('/',ROOT/'docs')
    web.run_app(app,port=int(os.getenv('PORT','8080')))
