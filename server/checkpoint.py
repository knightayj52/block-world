"""Teacher-operated backup/restore of one student's world."""
import argparse
import json
from pathlib import Path
from app import db

cli=argparse.ArgumentParser()
cli.add_argument('action',choices=['save','restore'])
cli.add_argument('world')
cli.add_argument('path',type=Path)
a=cli.parse_args()
with db:
    if not db.execute('SELECT 1 FROM users WHERE name=?',(a.world,)).fetchone():
        raise SystemExit('월드를 찾을 수 없습니다.')
    if a.action=='save':
        data={'world':a.world,'cells':[list(r) for r in db.execute('SELECT k,t FROM cells WHERE world=?',(a.world,))],
              'players':[list(r) for r in db.execute('SELECT name,bag,pos FROM players WHERE world=?',(a.world,))]}
        data['meta']=[list(r) for r in db.execute('SELECT title,biome FROM worlds WHERE name=?',(a.world,))]
        data['signs']=[list(r) for r in db.execute('SELECT k,label FROM signs WHERE world=?',(a.world,))]
        with a.path.open('x') as out: json.dump(data,out)
    else:
        data=json.loads(a.path.read_text())
        if data['world']!=a.world: raise SystemExit('월드 이름이 다릅니다.')
        db.execute('DELETE FROM worlds WHERE name=?',(a.world,))
        db.execute('DELETE FROM signs WHERE world=?',(a.world,))
        db.executemany('INSERT INTO worlds VALUES (?,?,?)',[(a.world,*r) for r in data.get('meta',[])])
        db.executemany('INSERT INTO signs VALUES (?,?,?)',[(a.world,*r) for r in data.get('signs',[])])
        db.execute('DELETE FROM cells WHERE world=?',(a.world,))
        db.execute('DELETE FROM players WHERE world=?',(a.world,))
        db.executemany('INSERT INTO cells VALUES (?,?,?)',[(a.world,*r) for r in data['cells']])
        db.executemany('INSERT INTO players VALUES (?,?,?,?)',[(a.world,*r) for r in data['players']])
