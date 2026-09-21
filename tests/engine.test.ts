import {test} from 'node:test';
import assert from 'node:assert/strict';
import {boundaries,configFor,obstacles,collision,pack,unpack,validateReplay,movementValid,HZ,MAX_TICKS,corridor,hitsShape,distance,createSimulation,gateState,hitsBarrier,BARRIER,R,W,H,SPIKE_HEIGHT,BORDER_SPIKES,stageAt,speed,courseFor,laneAt,type Point} from '../lib/engine-v5.ts';
import * as legacy from '../lib/engine-v1.ts';
import * as v2 from '../lib/engine-v2.ts';
import * as v3 from '../lib/engine-v3.ts';
import * as v4 from '../lib/engine-v4.ts';
import {InputTimeline} from '../lib/input.ts';
test('UTC reset, Monday week, and midnight-crossing assignment',()=>{const b=boundaries(Date.parse('2026-09-20T23:59:59.999Z'));assert.equal(b.day,'2026-09-20');assert.equal(b.week,'2026-09-14');assert.equal(b.resetAt,Date.parse('2026-09-21T00:00:00Z'));assert.equal(boundaries(b.resetAt).week,'2026-09-21');});
test('all daily runs in the same week share one configuration',()=>assert.deepEqual(configFor(boundaries(Date.parse('2026-09-16')).week),configFor(boundaries(Date.parse('2026-09-20')).week)));
test('recording round trip and score flooring',()=>{const p=Array.from({length:242},()=>({x:180,y:540}));assert.deepEqual(unpack(pack(p)),p);assert.equal(validateReplay(configFor('2026-09-14'),p,'lift').score,200);});
test('reject invalid start, teleportation, out-of-bounds, fake collision and fake limit',()=>{const c=configFor('2026-09-14');assert.equal(validateReplay(c,[{x:0,y:0}],'lift').valid,false);assert.equal(validateReplay(c,[{x:180,y:540},{x:340,y:540}],'lift').valid,false);assert.equal(movementValid({x:180,y:540},{x:Infinity,y:540}),false);assert.equal(validateReplay(c,[{x:180,y:540}],'collision').valid,false);assert.equal(validateReplay(c,[{x:180,y:540}],'limit').valid,false);assert.throws(()=>unpack('x'));});
test('actual collision is accepted, recording past it is rejected',()=>{const c=configFor('2026-09-14'),points:Point[]=[{x:180,y:540}];let found=false;for(let tick=1;tick<6000;tick++){const prev=points.at(-1)!;const p={x:Math.max(30,prev.x-2),y:Math.max(130,prev.y-2)};points.push(p);if(collision(prev,p,tick,c.seed)){found=true;break;}}assert.ok(found);const r=validateReplay(c,points,'collision');assert.equal(r.valid,true);assert.equal(r.score,Math.floor((points.length-2)*100/HZ));assert.equal(validateReplay(c,[...points,points.at(-1)!],'lift').valid,false);});
test('large solid obstacles preserve a continuous clear route for the full run',()=>{for(const week of ['2026-09-14','2026-09-21','2026-09-28']){const seed=configFor(week).seed;for(let t=0;t<=600;t+=.25){const shapes=obstacles(t,seed);for(let y=20;y<=620;y+=20){const c=corridor(t,y,seed);for(const x of [c.centre-Math.min(50,c.half-12),c.centre,c.centre+Math.min(50,c.half-12)])assert.ok(!shapes.some(s=>hitsShape({x,y},s)),`blocked corridor at ${t},${y},${x}`);}}}});
test('server validation is bounded by maximum input count',()=>{assert.equal(validateReplay(configFor('2026-09-14'),Array(MAX_TICKS+2).fill({x:180,y:540}),'lift').valid,false);});
test('rotated bars collide with their visible orientation',()=>{const bar={x:15,y:44,w:70,h:12,round:false,coral:false,angle:Math.PI/2,kind:'bar' as const};assert.ok(hitsShape({x:50,y:78},bar));assert.equal(hitsShape({x:78,y:50},bar),false);});
test('polygon hitboxes exclude empty corners',()=>{const tri={x:30,y:30,w:40,h:40,round:false,coral:false,angle:0,sides:3,kind:'polygon' as const};assert.ok(hitsShape({x:50,y:33},tri));assert.equal(hitsShape({x:30,y:30},tri),false);});
test('larger, sparser patterns include gates, tracking shooters and rotating bars',()=>{
 const c=configFor('2026-09-14');let maxVisible=0;const kinds=new Set(),colors=new Set();
 for(let t=0;t<600;t+=.25){const visible=obstacles(t,c.seed).filter(s=>s.y+s.h>=0&&s.y<=H);maxVisible=Math.max(maxVisible,visible.length);visible.forEach(s=>{kinds.add(s.kind);colors.add(s.color);});}
 for(const kind of ['gate','shooter','bar','polygon'])assert.ok(kinds.has(kind));
 assert.ok(maxVisible<=8,'at most eight large base shapes visible');assert.deepEqual([...colors],['#ff334d']);
 assert.ok(courseFor(c.seed).some(scene=>scene.type==='rotor'));
});

test('scroll speed starts faster and accelerates continuously',()=>{assert.ok(distance(1)>155);let previous=0;for(let t=0;t<600;t+=.5){const speed=(distance(t+.01)-distance(t))/.01;assert.ok(speed>=previous&&speed<556);previous=speed;}});
test('older server-issued configurations remain verifiable',()=>{const points=Array.from({length:121},()=>({x:180,y:540}));assert.deepEqual(validateReplay(legacy.configFor('2026-09-14'),points,'lift'),legacy.validateReplay(legacy.configFor('2026-09-14'),points,'lift'));});
test('staying in the centre cannot bypass the new obstacle course',()=>{for(const week of ['2026-09-14','2026-09-21','2026-09-28']){const config=configFor(week),sim=createSimulation(config),p={x:180,y:540};let hit=false;for(let tick=1;tick<30*HZ;tick++){if(sim.step(p,p,tick)){hit=true;break;}}assert.ok(hit,'a stationary player should need to dodge within 30 seconds');}});

test('gates open completely, warn, and close without a sudden solid activation',()=>{
 let open=false,warn=false,closed=false,last=gateState(0,0).extension;
 for(let tick=1;tick<=10*HZ;tick++){
  const g=gateState(tick/HZ,0);open ||= g.extension===0;warn ||= g.warning;closed ||= g.extension===1;
  assert.ok(Math.abs(g.extension-last)<.017);last=g.extension;
  for(const shape of obstacles(tick/HZ,configFor('2026-09-14').seed).filter(s=>s.row===0&&s.kind==='gate')){
   if(shape.solid===false)assert.equal(hitsShape({x:shape.x,y:shape.y+shape.h/2},shape),false);
  }
 }assert.ok(open&&warn&&closed);
});

test('red side and bottom barriers collide exactly at the visible edge, with an open top',()=>{
 assert.equal(hitsBarrier({x:BARRIER+R,y:300}),true);
 assert.equal(hitsBarrier({x:W-BARRIER-R,y:300}),true);
 assert.equal(hitsBarrier({x:180,y:H-BARRIER-R}),true);
 assert.equal(hitsBarrier({x:BARRIER+R+.25,y:312}),false);
 assert.equal(hitsBarrier({x:180,y:R}),false);
 const c=configFor('2026-09-14'),p:Point[]=[{x:180,y:540}];
 while(!hitsBarrier(p.at(-1)!))p.push({x:Math.max(BARRIER+R,p.at(-1)!.x-5),y:540});
 assert.equal(validateReplay(c,p,'collision').valid,true);
 assert.equal(validateReplay(c,p,'lift').valid,false);
});

test('shooters use recorded aim, warn, then fire a two-shot burst that inherits world scrolling',()=>{
 const c=configFor('2026-09-14'),left=createSimulation(c),right=createSimulation(c),lp={x:70,y:540},rp={x:290,y:540};
 let tick=0;while(!left.shots.length){tick++;left.step(lp,lp,tick);right.step(rp,rp,tick);}
 const l={...left.shots[0]},r=right.shots[0];assert.deepEqual(l.target,lp);assert.deepEqual(r.target,rp);assert.notEqual(l.dx,r.dx);
 assert.equal(l.fireTick-l.aimTick,78);assert.equal(left.shapes((l.fireTick-1)/HZ).some(s=>s.kind==='bolt'),false);
 for(;tick<l.fireTick;){tick++;left.step(lp,lp,tick);}
 const b=left.shapes(l.fireTick/HZ+.25).find(s=>s.kind==='bolt')!;
 assert.ok(b);assert.ok(Math.abs(b.x+b.w/2-(l.x+l.dx*.25))<.00001);
 assert.ok(Math.abs(b.y+b.h/2-(l.y+l.dy*.25+distance(l.fireTick/HZ+.25)-l.fireDistance!))<.00001);
 assert.equal(left.shots.length,2);assert.equal(left.shots[1].fireTick-left.shots[0].fireTick,26);assert.ok(l.dy>=60);assert.equal(b.round,false);assert.equal(b.w,22);assert.equal(b.h,8);
 assert.ok(l.dx<0);assert.ok(r.dx>l.dx);
});

test('live simulation and server replay agree, including targeted shots',()=>{
 const c=configFor('2026-09-14'),sim=createSimulation(c),points:Point[]=[{x:180,y:540}];let hit=false;
 for(let tick=1;tick<40*HZ;tick++){
  const a=points.at(-1)!,target=corridor(tick/HZ,540,c.seed).centre,b={x:Math.round((a.x+Math.max(-1,Math.min(1,target-a.x)))*4)/4,y:540};
  points.push(b);if(sim.step(a,b,tick)){hit=true;break;}
 }
 const reason=hit?'collision':'lift',replay=validateReplay(c,unpack(pack(points)),reason);
 assert.equal(replay.valid,true);assert.equal(replay.score,Math.floor((points.length-1-(hit?1:0))*100/HZ));
 if(hit)assert.equal(validateReplay(c,[...points,points.at(-1)!],'lift').valid,false);
});

test('version 2 recordings remain verifiable after the new shooter physics',()=>{
 const points=Array.from({length:242},()=>({x:180,y:540}));
 assert.deepEqual(validateReplay(v2.configFor('2026-09-14'),points,'lift'),v2.validateReplay(v2.configFor('2026-09-14'),points,'lift'));
});

test('timestamped coalesced inputs fill intermediate physics ticks without snapping',()=>{
 const input=new InputTimeline();input.reset({x:180,y:540},0);input.push({x:192,y:528},16);input.push({x:204,y:516},32);
 assert.deepEqual(input.sample(8),{x:186,y:534});assert.deepEqual(input.sample(16),{x:192,y:528});assert.deepEqual(input.sample(24),{x:198,y:522});
 assert.deepEqual(input.sample(40),{x:204,y:516});input.reset({x:180,y:540},100);assert.deepEqual(input.sample(101),{x:180,y:540});
});

test('themes advance at exactly 5,000-point milestones without a speed jump',()=>{
 assert.equal(stageAt(0).name,'GATEWAY');assert.equal(stageAt(49.99).index,0);assert.equal(stageAt(50).name,'CONDUIT');assert.equal(stageAt(100).name,'SWITCHBACK');assert.equal(stageAt(150).name,'CROSSFIRE');assert.equal(stageAt(200).name,'OVERDRIVE');
 for(let t=50;t<600;t+=50){assert.equal(stageAt(t).progress,0);assert.ok(speed(t+.001)-speed(t-.001)<.01);assert.ok(speed(t)>speed(t-50));}
 assert.ok(speed(150)>speed(0)*1.9);assert.ok(speed(500)>450);
});

test('tunnels and switchback mazes begin at their theme boundary and connect to their entrance gates',()=>{
 const seed=configFor('2026-09-14').seed,course=courseFor(seed);
 assert.equal(course.find(s=>s.stage===1)!.type,'tunnel');assert.equal(course.find(s=>s.stage===2)!.type,'maze');
 for(const scene of course.filter(s=>s.walls)){
  assert.equal(scene.walls!.length,2);const entry=laneAt(scene,0);
  assert.equal(scene.walls![0].edge[0].x,entry.centre-entry.half);assert.equal(scene.walls![1].edge[0].x,entry.centre+entry.half);
  for(let j=0;j<=100;j++){const lane=laneAt(scene,j/100);assert.ok(lane.half*2>=132);assert.ok(lane.centre-lane.half>BARRIER+R);assert.ok(lane.centre+lane.half<W-BARRIER-R);}
 }
});

test('tunnel walls collide in filled regions but allow passage down the white route',()=>{
 const seed=configFor('2026-09-14').seed,shapes=obstacles(53,seed),wall=shapes.find(s=>s.kind==='wall')!;
 assert.ok(wall);const local=wall.edge![Math.floor(wall.edge!.length/2)],inside={x:local.x-15,y:wall.y+local.y},path={x:local.x+25,y:wall.y+local.y};
 assert.equal(hitsShape(inside,wall),true);assert.equal(hitsShape(path,wall),false);
 const bolt={x:89,y:96,w:22,h:8,round:false,coral:false,kind:'bolt' as const,angle:Math.PI/2};
 assert.equal(hitsShape({x:100,y:111},bolt),true);assert.equal(hitsShape({x:117,y:100},bolt),false);
});

test('version 3 targeted shot recordings still validate using their original simulation',()=>{
 const config=v3.configFor('2026-09-14'),sim=v3.createSimulation(config),p={x:180,y:540},points=[p];let reason:'collision'|'lift'='lift';
 for(let tick=1;tick<20*HZ;tick++){points.push({...p});if(sim.step(p,p,tick)){reason='collision';break;}}
 assert.deepEqual(validateReplay(config,points,reason),v3.validateReplay(config,points,reason));
});

test('opening is faster, contains larger hazards, and demands movement within three seconds',()=>{
 assert.equal(speed(0),225);assert.ok(speed(0)/v4.speed(0)>1.45);
 for(const week of ['2026-09-14','2026-09-21','2026-09-28']){
  const c=configFor(week),sim=createSimulation(c),p={x:180,y:540};let hit=0;
  for(let tick=1;tick<3*HZ;tick++){if(sim.step(p,p,tick)){hit=tick;break;}}assert.ok(hit>0&&hit<3*HZ);
  const gates=courseFor(c.seed).filter(s=>s.stage===0&&s.type==='gate').slice(0,4);
  assert.ok(Math.max(...gates.map(s=>s.centre))-Math.min(...gates.map(s=>s.centre))>150);
 }
 const seed=configFor('2026-09-14').seed;let large=false;for(let t=0;t<12;t+=.25)large ||= obstacles(t,seed).some(s=>s.kind==='bar'&&s.w===190&&s.h===28);assert.ok(large);
});

test('spike tips have precise collision geometry and cannot be swept through',()=>{
 assert.ok(BORDER_SPIKES.length>50);
 assert.equal(hitsBarrier({x:BARRIER+SPIKE_HEIGHT+R,y:300}),true);
 assert.equal(hitsBarrier({x:BARRIER+SPIKE_HEIGHT+R+.25,y:300}),false);
 assert.equal(hitsBarrier({x:W-BARRIER-SPIKE_HEIGHT-R,y:300}),true);
 assert.equal(hitsBarrier({x:180,y:H-BARRIER-SPIKE_HEIGHT-R}),true);
 const a={x:15,y:291},b={x:15,y:309};assert.equal(hitsBarrier(a),false);assert.equal(hitsBarrier(b),false);
 assert.equal(collision(a,b,1,configFor('2026-09-14').seed),true);
});

test('version 4 courses and recordings keep their original speed and geometry',()=>{
 assert.equal(v4.speed(0),155);assert.notDeepEqual(v4.courseFor(123)[0],courseFor(123)[0]);
 const config=v4.configFor('2026-09-14'),points=Array.from({length:242},()=>({x:180,y:540}));
 assert.deepEqual(validateReplay(config,points,'lift'),v4.validateReplay(config,points,'lift'));
});
