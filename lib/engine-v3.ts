// Deterministic gameplay shared by the phone and score verifier.
import * as previous from './engine-v2.ts';
export const VERSION = 'slip-3';
export const GAME = 'slip';
export const W=360, H=640, R=6, HZ=120, MAX_TICKS=HZ*600, BARRIER=4;
export type Point={x:number;y:number};
export type Config={version:string;seed:number;hz:number;maxTicks:number};
export type EndReason='collision'|'lift'|'background'|'cancel'|'limit'|'interrupted';
export type Shape=Omit<previous.Shape,'kind'> & {
 id?:string;kind?:'bar'|'polygon'|'circle'|'bolt'|'gate'|'shooter';
 rail?:number;side?:number;warning?:boolean;solid?:boolean;
};
export const {boundaries,pack,unpack,startValid,COLORS,distance}=previous;
export function seedFor(week:string){let h=2166136261;for(const c of week+VERSION)h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0;}
export function configFor(week:string):Config{return {version:VERSION,seed:seedFor(week),hz:HZ,maxTicks:MAX_TICKS};}
function rand(seed:number,n:number){let x=(seed^Math.imul(n+1,2654435761))>>>0;x=Math.imul(x^(x>>>16),2246822507);x=Math.imul(x^(x>>>13),3266489909);return ((x^(x>>>16))>>>0)/4294967296;}
const SPACING=330;
export function corridor(t:number,y:number,seed:number){return {centre:180+78*Math.sin((distance(t)-y)*.0044+rand(seed,0)*Math.PI*2),half:62};}
const arrivals=new Map<number,number>();
function arrival(d:number){let t=arrivals.get(d);if(t!==undefined)return t;t=d/210;for(let i=0;i<8;i++)t-=(distance(t)-d)/(155+160*(1-Math.exp(-t/48)));arrivals.set(d,t);return t;}
const smooth=(v:number)=>{v=Math.max(0,Math.min(1,v));return v*v*(3-2*v);};
export function gateState(t:number,row:number){
 const age=Math.max(0,t-arrival(row*SPACING+140)),cycle=age%5.2;
 // Gates physically retract; they never suddenly become solid on the player.
 const extension=cycle<1.6?1:cycle<2.4?1-smooth((cycle-1.6)/.8):cycle<3.8?0:smooth((cycle-3.8)/1.4);
 return {extension,warning:cycle>=3.1&&cycle<3.8};
}
export function obstacles(t:number,seed:number,version=VERSION):Shape[]{
 if(version!==VERSION)return previous.obstacles(t,seed,version);
 const dist=distance(t),out:Shape[]=[];
 const add=(id:string,cx:number,cy:number,w:number,h:number,kind:Shape['kind'],color:string,angle=0,sides=4,row=0):Shape=>{const s:Shape={id,x:cx-w/2,y:cy-h/2,w,h,kind,round:kind==='circle'||kind==='shooter'||kind==='bolt',coral:false,color,angle,sides,row};out.push(s);return s;};
 for(let row=Math.max(0,Math.floor((dist-H-130)/SPACING));row<=Math.floor((dist+10)/SPACING);row++){
  const y=dist-row*SPACING-100,kind=row%5,c=corridor(t,y,seed),side=c.centre>180?-1:1,color=COLORS[row%7];
  if(kind===0||kind===3){
   const g=gateState(t,row);
   for(const sign of [-1,1]){const rail=sign<0?c.centre-c.half-BARRIER:W-BARRIER-c.centre-c.half,width=rail*g.extension;
    const s=add(row+':gate:'+sign,sign<0?BARRIER+width/2:W-BARRIER-width/2,y,width,22,'gate',color,0,4,row);
    s.rail=rail;s.side=sign;s.warning=g.warning;s.solid=width>.01;
   }
  }else if(kind===1){
   const x=c.centre+side*(c.half+37);add(row+':shooter',x,y,58,58,'shooter',color,0,6,row);
  }else if(kind===2){
   const x=c.centre+side*(c.half+85);add(row+':rotor',x,y,160,22,'bar',color,t*.48+rand(seed,row)*Math.PI,4,row);
  }else{
   const x=c.centre+side*(c.half+51);add(row+':gem',x,y,92,92,'polygon',color,-t*.38+rand(seed,row)*6.28,4,row);
  }
 }return out;
}
export function hitsShape(p:Point,s:Shape){return s.solid!==false&&s.w>.01&&previous.hitsShape(p,s as previous.Shape);}
export function hitsBarrier(p:Point){return p.x<=BARRIER+R||p.x>=W-BARRIER-R||p.y>=H-BARRIER-R;}
export function movementValid(a:Point,b:Point){return Number.isFinite(b.x)&&Number.isFinite(b.y)&&b.x>=0&&b.x<=W&&b.y>=R&&b.y<=H&&Math.hypot(b.x-a.x,b.y-a.y)<=36;}

// Match shapes by stable identity and interpolate only near the player's sweep.
// Geometry is generated once per tick, instead of once per collision substep.
function swept(a:Point,b:Point,before:Shape[],after:Shape[]){
 if(hitsBarrier(a)||hitsBarrier(b))return true;
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
export type Shot={row:number;aimTick:number;fireTick:number;x:number;y:number;dx:number;dy:number;target:Point};
export function createSimulation(config:Config){
 let lastTick=0,last=obstacles(0,config.seed,config.version),nextRow=1;
 let nextAim=Math.ceil(arrival(nextRow*SPACING+160)*HZ);
 const shots:Shot[]=[];
 function shapes(t:number):Shape[]{
  const base=obstacles(t,config.seed,config.version);if(config.version!==VERSION)return base;
  for(const shot of shots){const age=t-shot.fireTick/HZ;if(age<0||age>4)continue;
   const x=shot.x+shot.dx*age,y=shot.y+shot.dy*age;if(x<-20||x>W+20||y<-20||y>H+20)continue;
   base.push({id:shot.row+':shot',x:x-10,y:y-10,w:20,h:20,round:true,coral:false,color:'#ec5197',kind:'bolt',angle:Math.atan2(shot.dy,shot.dx),row:shot.row});
  }return base;
 }
 return {
  shots,shapes,
  step(a:Point,b:Point,tick:number){
   if(config.version!==VERSION)return previous.collision(a,b,tick,config.seed,config.version);
   if(tick!==lastTick+1)throw new Error('Simulation ticks must be consecutive.');
   if(tick===nextAim){
    const fireTick=tick+Math.round(.65*HZ),fireTime=fireTick/HZ;
    const turret=obstacles(fireTime,config.seed).find(s=>s.row===nextRow&&s.kind==='shooter')!;
    const x=turret.x+turret.w/2,y=turret.y+turret.h/2,len=Math.hypot(a.x-x,a.y-y)||1;
    shots.push({row:nextRow,aimTick:tick,fireTick,x,y,dx:(a.x-x)/len*215,dy:(a.y-y)/len*215,target:{...a}});
    nextRow+=5;nextAim=Math.ceil(arrival(nextRow*SPACING+160)*HZ);
   }
   while(shots.length&&tick>shots[0].fireTick+4*HZ)shots.shift();
   const next=shapes(tick/HZ),hit=swept(a,b,last,next);last=next;lastTick=tick;return hit;
  },
 };
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
