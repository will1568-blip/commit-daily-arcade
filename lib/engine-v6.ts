// Deterministic gameplay shared by the phone and score verifier.
import * as previous from './engine-v5.ts';
import {makeScene,sceneShapes,stageForScore,TOKEN_VALUE,type Scene} from './course-v6.ts';
export {makeScene,movingCentre,sceneShapes,stageForScore,TOKEN_VALUE,laneAt,THEMES} from './course-v6.ts';
export const VERSION = 'slip-6';
export const GAME = 'slip';
export const W=360, H=640, R=6, HZ=120, MAX_TICKS=HZ*600, BARRIER=4;
export type Point={x:number;y:number};
export type Config={version:string;seed:number;hz:number;maxTicks:number};
export type EndReason='collision'|'lift'|'background'|'cancel'|'limit'|'interrupted';
export type Shape=Omit<previous.Shape,'kind'> & {
 id?:string;kind?:'bar'|'polygon'|'circle'|'bolt'|'gate'|'shooter'|'wall'|'token';
 rail?:number;side?:number;warning?:boolean;solid?:boolean;spent?:boolean;vertices?:Point[];edge?:Point[];railStart?:Point;railEnd?:Point;
};
export const {boundaries,pack,unpack,startValid,COLORS}=previous;
export function seedFor(week:string){let h=2166136261;for(const c of week+VERSION)h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0;}
export function configFor(week:string):Config{return {version:VERSION,seed:seedFor(week),hz:HZ,maxTicks:MAX_TICKS};}
function polygonHit(p:Point,vertices:Point[]){
 let inside=false;
 for(let i=0,j=vertices.length-1;i<vertices.length;j=i++){
  const a=vertices[i],b=vertices[j];if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)inside=!inside;
  const dx=b.x-a.x,dy=b.y-a.y,q=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1)));
  if((p.x-a.x-q*dx)**2+(p.y-a.y-q*dy)**2<=R*R)return true;
 }return inside;
}
export function hitsShape(p:Point,s:Shape){
 if(s.solid===false||s.w<=.01)return false;
 if(s.kind==='wall')return p.x>=s.x-R&&p.x<=s.x+s.w+R&&p.y>=s.y-R&&p.y<=s.y+s.h+R&&polygonHit({x:p.x-s.x,y:p.y-s.y},s.vertices!);
 if(s.kind==='bolt'&&!s.round){
  const dx=p.x-s.x-s.w/2,dy=p.y-s.y-s.h/2,a=-(s.angle||0),x=dx*Math.cos(a)-dy*Math.sin(a),y=dx*Math.sin(a)+dy*Math.cos(a),half=(s.w-s.h)/2;
  return (x-Math.max(-half,Math.min(half,x)))**2+y*y<=(R+s.h/2)**2;
 }
 return previous.hitsShape(p,s as previous.Shape);
}
export const SPIKE_HEIGHT=7,SPIKE_PITCH=24;
export const BORDER_SPIKES:Point[][]=[];
for(let y=12;y<H-BARRIER;y+=SPIKE_PITCH){BORDER_SPIKES.push([{x:BARRIER,y:y-5},{x:BARRIER+SPIKE_HEIGHT,y},{x:BARRIER,y:y+5}],[{x:W-BARRIER,y:y-5},{x:W-BARRIER-SPIKE_HEIGHT,y},{x:W-BARRIER,y:y+5}]);}
for(let x=12;x<W-BARRIER;x+=SPIKE_PITCH)BORDER_SPIKES.push([{x:x-5,y:H-BARRIER},{x,y:H-BARRIER-SPIKE_HEIGHT},{x:x+5,y:H-BARRIER}]);
const SPIKE_BOUNDS=BORDER_SPIKES.map(vertices=>({vertices,minX:Math.min(...vertices.map(v=>v.x))-R,maxX:Math.max(...vertices.map(v=>v.x))+R,minY:Math.min(...vertices.map(v=>v.y))-R,maxY:Math.max(...vertices.map(v=>v.y))+R}));
export function hitsBarrier(p:Point){
 if(p.x<=BARRIER+R||p.x>=W-BARRIER-R||p.y>=H-BARRIER-R)return true;
 const reach=BARRIER+SPIKE_HEIGHT+R;if(p.x>reach&&p.x<W-reach&&p.y<H-reach)return false;
 return SPIKE_BOUNDS.some(s=>p.x>=s.minX&&p.x<=s.maxX&&p.y>=s.minY&&p.y<=s.maxY&&polygonHit(p,s.vertices));
}
export function movementValid(a:Point,b:Point){return Number.isFinite(b.x)&&Number.isFinite(b.y)&&b.x>=0&&b.x<=W&&b.y>=R&&b.y<=H&&Math.hypot(b.x-a.x,b.y-a.y)<=36;}

// Match shapes by stable identity and interpolate only near the player's sweep.
// Geometry is generated once per tick, instead of once per collision substep.
export function sweepCollision(a:Point,b:Point,before:Shape[],after:Shape[]){
 if(hitsBarrier(a)||hitsBarrier(b))return true;
 const reach=BARRIER+SPIKE_HEIGHT+R;
 if(Math.min(a.x,b.x)<=reach||Math.max(a.x,b.x)>=W-reach||Math.max(a.y,b.y)>=H-reach){
  const steps=Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/1.5);for(let i=1;i<steps;i++){const q=i/steps;if(hitsBarrier({x:a.x+(b.x-a.x)*q,y:a.y+(b.y-a.y)*q}))return true;}
 }
 for(let n=0;n<after.length;n++){
  const end=after[n];if(end.solid===false&&end.kind!=='gate')continue;
  const start=before[n]?.id===end.id?before[n]:before.find(s=>s.id===end.id)||end;
  const acx=start.x+start.w/2,acy=start.y+start.h/2,bcx=end.x+end.w/2,bcy=end.y+end.h/2;
  const extent=Math.max(Math.hypot(start.w,start.h),Math.hypot(end.w,end.h))/2+R+1;
  if(Math.max(a.x,b.x)<Math.min(acx,bcx)-extent||Math.min(a.x,b.x)>Math.max(acx,bcx)+extent||Math.max(a.y,b.y)<Math.min(acy,bcy)-extent||Math.min(a.y,b.y)>Math.max(acy,bcy)+extent)continue;
  const travel=Math.hypot(b.x-a.x,b.y-a.y)+Math.hypot(bcx-acx,bcy-acy)+Math.abs((end.angle||0)-(start.angle||0))*extent+Math.abs(end.w-start.w);
  const steps=Math.max(2,Math.ceil(travel/1.5));const s={...end};
  for(let i=0;i<=steps;i++){const q=i/steps;s.x=start.x+(end.x-start.x)*q;s.y=start.y+(end.y-start.y)*q;s.w=start.w+(end.w-start.w)*q;s.h=start.h+(end.h-start.h)*q;s.angle=(start.angle||0)+((end.angle||0)-(start.angle||0))*q;s.solid=s.w>.01;
   if(hitsShape({x:a.x+(b.x-a.x)*q,y:a.y+(b.y-a.y)*q},s))return true;
  }
 }return false;
}
export type Shot={row:number;aimTick:number;fireTick:number;x:number;y:number;dx:number;dy:number;target:Point;fireDistance?:number;burst?:number;fired?:boolean;source?:Scene};
export type RunStatus={score:number;survivalScore:number;bonus:number;tokenCount:number;stage:ReturnType<typeof stageForScore>;scroll:number;speed:number;lastPickupAt:number};
export type Simulation={shots:Shot[];shapes:(t:number)=>Shape[];step:(a:Point,b:Point,tick:number)=>boolean;status:()=>RunStatus};
function touchesToken(a:Point,b:Point,start:Shape,end:Shape){
 const ax=a.x-start.x-start.w/2,ay=a.y-start.y-start.h/2,bx=b.x-end.x-end.w/2,by=b.y-end.y-end.h/2,dx=bx-ax,dy=by-ay,q=Math.max(0,Math.min(1,-(ax*dx+ay*dy)/(dx*dx+dy*dy||1)));
 return (ax+dx*q)**2+(ay+dy*q)**2<=(R+end.w/2)**2;
}
export function createSimulation(config:Config):Simulation{
 if(config.version!==VERSION){const old=previous.createSimulation(config);let safe=0;return {shots:old.shots,shapes:old.shapes,step(a,b,tick){const hit=old.step(a,b,tick);safe=tick-(hit?1:0);return hit;},status(){const score=Math.floor(safe*100/HZ);return {score,survivalScore:score,bonus:0,tokenCount:0,stage:stageForScore(score),scroll:0,speed:225,lastPickupAt:-Infinity};}};}
 let tick=0,safeTicks=0,scroll=0,velocity=225,bonus=0,lastPickupAt=-Infinity,nextStart=0,nextId=0,lastStage=-1,ordinal=0;
 const scenes:Scene[]=[],shots:Shot[]=[],collected=new Set<string>();
 const score=()=>Math.floor(safeTicks*100/HZ)+bonus;
 function spawn(){const stage=Math.floor(score()/5000);if(stage!==lastStage){lastStage=stage;ordinal=0;}while(nextStart<=scroll+160){const scene=makeScene(nextStart,nextId++,stage,ordinal++,config.seed);scenes.push(scene);nextStart+=scene.span;}while(scenes.length&&scroll-scenes[0].start-100>H+scenes[0].depth+180)scenes.shift();}
 function shapes(t:number):Shape[]{
  const renderScroll=scroll+velocity*Math.max(0,Math.min(1/HZ,t-tick/HZ)),out:Shape[]=[];
  for(const scene of scenes)for(const shape of sceneShapes(scene,renderScroll,t)){if(shape.kind!=='token'||!collected.has(shape.id!))out.push(shape);}
  for(const shot of shots){const age=t-shot.fireTick/HZ;if(!shot.fired||age<0||age>2.5)continue;const x=shot.x+shot.dx*age,y=shot.y+shot.dy*age;if(x<-30||x>W+30||y<-30||y>H+30)continue;
   out.push({id:shot.row+':shot:'+shot.burst,x:x-11,y:y-4,w:22,h:8,round:false,coral:false,color:'#ff334d',kind:'bolt',angle:Math.atan2(shot.dy,shot.dx),row:shot.row});
  }return out;
 }
 spawn();let last=shapes(0);
 return {shots,shapes,status(){const survivalScore=Math.floor(safeTicks*100/HZ),total=survivalScore+bonus;return {score:total,survivalScore,bonus,tokenCount:collected.size,stage:stageForScore(total),scroll,speed:velocity,lastPickupAt};},step(a:Point,b:Point,nextTick:number){
  if(nextTick!==tick+1)throw new Error('Simulation ticks must be consecutive.');tick=nextTick;const t=tick/HZ;
  const target=stageForScore(score()).targetSpeed,oldVelocity=velocity;velocity+=Math.max(-48/HZ,Math.min(48/HZ,target-velocity));scroll+=(oldVelocity+velocity)/2/HZ;spawn();
  for(const scene of scenes){const front=scroll-scene.start-100;if(scene.type==='turret'&&front>=-20&&front<Math.max(100,540-velocity*.55)&&t-scene.lastCharge>=1.15&&scene.charges<3){
   const wave=scene.charges++;scene.lastCharge=t;
   for(let n=0;n<2;n++)shots.push({row:scene.id,aimTick:tick,fireTick:tick+66+n*22,x:0,y:0,dx:0,dy:0,target:{...a},burst:wave*2+n,fired:false,source:scene});
  }}
  for(const shot of shots)if(!shot.fired&&tick>=shot.fireTick){
   const source=shot.source!,side=source.centre>180?-1:1,x=source.centre+side*96,y=scroll-source.start-100,dx=shot.target.x-x,dy=shot.target.y-y,length=Math.hypot(dx,dy)||1,ux=length===1&&dx===0&&dy===0?0:dx/length,uy=dx===0&&dy===0?1:dy/length,speed=Math.max(350,velocity+160);
   shot.x=x+ux*24;shot.y=y+uy*24;shot.dx=ux*speed;shot.dy=uy*speed;shot.fired=true;
  }
  while(shots.length&&tick>shots[0].fireTick+2.5*HZ)shots.shift();
  const current=shapes(t),hit=sweepCollision(a,b,last,current);safeTicks=tick-(hit?1:0);
  // A collision takes priority over a pickup on the same physics tick.
  if(!hit)for(const token of current){if(token.kind!=='token'||collected.has(token.id!))continue;const prior=last.find(s=>s.id===token.id)||token;if(touchesToken(a,b,prior,token)){collected.add(token.id!);bonus+=TOKEN_VALUE;lastPickupAt=t;}}
  last=current;return hit;
 }};
}
export function validateReplay(config:Config,points:Point[],reason:EndReason){
 if(config.version!==VERSION)return previous.validateReplay(config,points,reason);
 if(config.hz!==HZ||config.maxTicks!==MAX_TICKS||!points.length||points.length>MAX_TICKS+1||!startValid(points[0]))return {valid:false,score:0,why:'Invalid starting state.'};
 if(!['collision','lift','background','cancel','limit','interrupted'].includes(reason))return {valid:false,score:0,why:'Invalid ending.'};
 const simulation=createSimulation(config);
 for(let i=1;i<points.length;i++){
  if(!movementValid(points[i-1],points[i]))return {valid:false,score:0,why:'Movement exceeded the playfield or speed limit.'};
  if(simulation.step(points[i-1],points[i],i)){
   if(i!==points.length-1||reason!=='collision')return {valid:false,score:0,why:'Run continued after a collision.'};
   return {valid:true,score:simulation.status().score,why:''};
  }
 }
 if(reason==='collision'||(reason==='limit'&&points.length!==MAX_TICKS+1))return {valid:false,score:0,why:'Ending does not match the replay.'};
 return {valid:true,score:simulation.status().score,why:''};
}
