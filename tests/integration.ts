// Integration fixtures are inserted ONLY into the local Wrangler database.
// No test authentication route or bypass exists in the application.
import {DatabaseSync} from 'node:sqlite';
import {createHash,randomBytes,randomUUID} from 'node:crypto';
import {readdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {boundaries,configFor,pack,GAME} from '../lib/engine.ts';
const dir='.wrangler/state/v3/d1/miniflare-D1DatabaseObject';
const file=readdirSync(dir).find(f=>f.endsWith('.sqlite')&&f!=='metadata.sqlite');assert.ok(file);
const d=new DatabaseSync(dir+'/'+file);d.exec('PRAGMA busy_timeout=5000');
const id='qa-'+randomUUID(),other='qa-'+randomUUID(),token=randomBytes(32).toString('hex'),hash=createHash('sha256').update(token).digest('hex'),now=Date.now(),b=boundaries(now);
d.prepare('INSERT INTO players(id,phone_key,name,created_at) VALUES(?,?,?,?)').run(id,id,'QA Player',now);
d.prepare('INSERT INTO players(id,phone_key,name,created_at) VALUES(?,?,?,?)').run(other,other,'QA Other',now);
d.prepare('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)').run(hash,id,now+3600000);
const root='http://localhost:5173';
async function call(path:string,body?:unknown,auth=true){const r=await fetch(root+'/api/'+path,{method:body===undefined?'GET':'POST',headers:{...(auth?{Cookie:'slip_session='+token}:{}),...(body===undefined?{}:{'Content-Type':'application/json',Origin:root})},body:body===undefined?undefined:JSON.stringify(body)});return {status:r.status,data:await r.json() as any};}
const reports:string[]=[];
try{
 assert.equal((await call('runs/start',{key:randomUUID()},false)).status,401);reports.push('unauthenticated starts rejected');
 const key=randomUUID(),starts=await Promise.all(Array.from({length:8},()=>call('runs/start',{key})));
 assert.ok(starts.every(s=>s.status===200));assert.equal(new Set(starts.map(s=>s.data.id)).size,1);const run=starts[0].data;reports.push('eight concurrent retries create exactly one run');
 const second=await call('runs/start',{key:randomUUID()});assert.equal(second.status,409);reports.push('second daily attempt rejected');
 const points=Array.from({length:121},()=>({x:180,y:540}));d.prepare('UPDATE runs SET started_at=? WHERE id=?').run(now-3000,run.id);
 const payload={id:run.id,trace:pack(points),reason:'lift',score:99999999};const submits=await Promise.all(Array.from({length:5},()=>call('runs/submit',payload)));assert.ok(submits.every(s=>s.status===200&&s.data.score===100&&s.data.status==='verified'));reports.push('parallel submissions are idempotent; client-supplied score ignored');
 assert.equal((await call('runs/submit',{...payload,reason:'collision'})).status,409);reports.push('completed score is immutable');
 const insert=d.prepare('INSERT INTO runs(id,user_id,game,day,week,request_key,started_at,submit_by,config,status,score,display_name) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)');
 const previous=new Date(Date.parse(b.day)-86400000).toISOString().slice(0,10);
 insert.run(randomUUID(),id,GAME,previous,b.week,randomUUID(),now-86400000,now+86400000,JSON.stringify(configFor(b.week)),'verified',250,'QA Player');
 insert.run(randomUUID(),other,GAME,b.day,b.week,randomUUID(),now-3000,now+86400000,JSON.stringify(configFor(b.week)),'verified',100,'QA Other');
 const today=await call('leaderboard?period=today');assert.equal(today.data.me.rank,1);assert.equal(today.data.rows.filter((r:any)=>r.score===100&&r.rank===1).length,2);reports.push('tied daily scores share the same rank');
 const week=await call('leaderboard?period=week');assert.equal(week.data.me.score,250);reports.push('weekly best is MAX, never sum');
 const details=await call('runs/details?id='+run.id);assert.equal(details.data.run.score,100);assert.equal(details.data.weekly.score,250);reports.push('saved results survive a new request');
 const history=await call('runs/history');assert.equal(history.data.runs.length,2);reports.push('attempt history retained');
 // Old periods are finalized into immutable rank snapshots after retry expiry.
 const old='2025-01-06',period='today:'+old,oldRun=randomUUID();
 d.prepare('INSERT OR IGNORE INTO periods(id,kind,period_key,ends_at,finalize_after) VALUES(?,?,?,?,?)').run(period,'today',old,now-5000,now-1000);
 insert.run(oldRun,id,GAME,old,old,randomUUID(),now-9999999,now-1000,JSON.stringify(configFor(old)),'verified',77,'Historic QA');
 await call('status');assert.equal(d.prepare('SELECT score FROM standings WHERE period_id=? AND user_id=?').get(period,id)?.score,77);assert.ok(d.prepare('SELECT finalized_at FROM periods WHERE id=?').get(period)?.finalized_at);reports.push('closed standings finalized and retained');
 console.log(reports.map(x=>'PASS '+x).join('\n'));
}finally{
 d.prepare('DELETE FROM standings WHERE user_id IN (?,?)').run(id,other);d.prepare('DELETE FROM runs WHERE user_id IN (?,?)').run(id,other);d.prepare('DELETE FROM sessions WHERE user_id IN (?,?)').run(id,other);d.prepare('DELETE FROM players WHERE id IN (?,?)').run(id,other);d.prepare('DELETE FROM rate_limits WHERE key LIKE ?').run('%'+id+'%');d.prepare('DELETE FROM periods WHERE id=?').run('today:2025-01-06');d.close();
}
