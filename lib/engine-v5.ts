// Deterministic gameplay shared by the phone and score verifier.
import * as previous from './engine-v4.ts';
import {courseFor,courseObstacles,distance,speed} from './course-v5.ts';
export {distance,speed,stageAt,THEMES,corridor,gateState,courseFor,laneAt} from './course-v5.ts';
export const VERSION = 'slip-5';
export const GAME = 'slip';
export const W=360, H=640, R=6, HZ=120, MAX_TICKS=HZ*600, BARRIER=4;
export type Point={x:number;y:number};
export type Config={version:string;seed:number;hz:number;maxTicks:number};
export type EndReason='collision'|'lift'|'background'|'cancel'|'limit'|'interrupted';
export type Shape=Omit<previous.Shape,'kind'> & {
 id?:string;kind?:'bar'|'polygon'|'circle'|'bolt'|'gate'|'shooter'|'wall';
 rail?:number;side?:number;warning?:boolean;solid?:boolean;spent?:boolean;vertices?:Point[];edge?:Point[];
};
export const {boundaries,pack,unpack,startValid,COLORS}=previous;
export function seedFor(week:string){let h=2166136261;for(const c of week+VERSION)h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0;}
export function configFor(week:string):Config{return {version:VERSION,seed:seedFor(week),hz:HZ,maxTicks:MAX_TICKS};}
export function obstacles(t:number,seed:number,version=VERSION):Shape[]{return version===VERSION?courseObstacles(t,seed):previous.obstacles(t,seed,version);}
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
function swept(a:Point,b:Point,before:Shape[],after:Shape[]){
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
export type Shot={row:number;aimTick:number;fireTick:number;x:number;y:number;dx:number;dy:number;target:Point;fireDistance?:number;burst?:number};
// Solve against world scrolling so an aimed shot actually approaches its target.
// The direction locks before firing; projectiles never home after launch.
function aim(x:number,y:number,target:Point,fireTime:number){
 const velocity=230,dx=target.x-x,dy=target.y-y,origin=distance(fireTime);
 const f=(t:number)=>dx*dx+(dy-distance(fireTime+t)+origin)**2-(velocity*t)**2;
 let low=0,high=.025;
 for(;high<=2.5&&f(high)>0;high+=.025)low=high;
 if(high<=2.5){for(let i=0;i<18;i++){const mid=(low+high)/2;if(f(mid)>0)low=mid;else high=mid;}
  const flight=(low+high)/2,vy=(dy-distance(fireTime+flight)+origin)/flight;
  if(vy>=60)return {dx:dx/flight,dy:vy};
 }
 const a=Math.max(.4,Math.min(Math.PI-.4,Math.atan2(dy,dx)));return {dx:Math.cos(a)*velocity,dy:Math.sin(a)*velocity};
}
export function createSimulation(config:Config):{shots:Shot[];shapes:(t:number)=>Shape[];step:(a:Point,b:Point,tick:number)=>boolean}{
 if(config.version!==VERSION)return previous.createSimulation(config);
 let lastTick=0,last=obstacles(0,config.seed),next=0;
 const turrets=courseFor(config.seed).filter(s=>s.type==='turret'),shots:Shot[]=[];
 function shapes(t:number):Shape[]{
  const base=obstacles(t,config.seed);
  for(const shot of shots){const age=t-shot.fireTick/HZ;if(age<0||age>2.5)continue;
   const x=shot.x+shot.dx*age,y=shot.y+shot.dy*age+distance(t)-shot.fireDistance!;
   if(x<-30||x>W+30||y<-30||y>H+30)continue;
   base.push({id:shot.row+':shot:'+shot.burst,x:x-11,y:y-4,w:22,h:8,round:false,coral:false,color:'#ff334d',kind:'bolt',angle:Math.atan2(shot.dy+speed(t),shot.dx),row:shot.row});
  }return base;
 }
 return {shots,shapes,step(a:Point,b:Point,tick:number){
  if(tick!==lastTick+1)throw new Error('Simulation ticks must be consecutive.');
  if(next<turrets.length&&tick===turrets[next].aimTick){
   const turret=turrets[next++],c=turret.centre,side=c>180?-1:1,cx=c+side*96;
   const fireTick=tick+78,cy=distance(fireTick/HZ)-turret.start-100;
   // Don't fire a surprise shot upward or at a player already beside the muzzle.
   if(a.y>cy+90){for(let burst=0;burst<2;burst++){
    const when=fireTick+burst*26,time=when/HZ,y=distance(time)-turret.start-100,dir=aim(cx,y,a,time),len=Math.hypot(dir.dx,dir.dy);
    shots.push({row:turret.id,aimTick:tick,fireTick:when,x:cx+dir.dx/len*23,y:y+dir.dy/len*23,dx:dir.dx,dy:dir.dy,target:{...a},fireDistance:distance(time),burst});
   }}
  }
  while(shots.length&&tick>shots[0].fireTick+2.5*HZ)shots.shift();
  const current=shapes(tick/HZ),hit=swept(a,b,last,current);last=current;lastTick=tick;return hit;
 }};
}
// Geometry-only helper. Active runs use a simulation, which reconstructs aim.
export function collision(a:Point,b:Point,tick:number,seed:number,version=VERSION){
 if(version!==VERSION)return previous.collision(a,b,tick,seed,version);
 return swept(a,b,obstacles((tick-1)/HZ,seed),obstacles(tick/HZ,seed));
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
   return {valid:true,score:Math.floor((i-1)*100/HZ),why:''};
  }
 }
 if(reason==='collision'||(reason==='limit'&&points.length!==MAX_TICKS+1))return {valid:false,score:0,why:'Ending does not match the replay.'};
 return {valid:true,score:Math.floor((points.length-1)*100/HZ),why:''};
}
