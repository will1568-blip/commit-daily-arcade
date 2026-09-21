// This module is the versioned source of truth for both rendering and verification.
// Keep old engines available if a future game version is introduced.
import * as legacy from './engine-v1.ts';
export const VERSION = 'slip-2';
export const GAME = 'slip';
export const W = 360, H = 640, R = 6, HZ = 120, MAX_TICKS = HZ * 600;
export type Point = { x:number; y:number };
export type Shape = { x:number; y:number; w:number; h:number; round:boolean; coral:boolean; angle?:number; sides?:number; color?:string; kind?:'bar'|'polygon'|'circle'|'bolt'; row?:number };
export type Config = { version:string; seed:number; hz:number; maxTicks:number };
export type EndReason = 'collision'|'lift'|'background'|'cancel'|'limit'|'interrupted';
export function boundaries(now:number) { const d=new Date(now); const day=d.toISOString().slice(0,10); const midnight=Date.parse(day+'T00:00:00Z'); const monday=midnight-((d.getUTCDay()+6)%7)*86400000; return {day,week:new Date(monday).toISOString().slice(0,10),resetAt:midnight+86400000,weekResetAt:monday+7*86400000}; }
export function seedFor(week:string) { let h=2166136261; for(const c of week+VERSION) h=Math.imul(h^c.charCodeAt(0),16777619); return h>>>0; }
export function configFor(week:string):Config {return {version:VERSION,seed:seedFor(week),hz:HZ,maxTicks:MAX_TICKS};}
function rand(seed:number,n:number) { let x=(seed^Math.imul(n+1,2654435761))>>>0; x=Math.imul(x^(x>>>16),2246822507); x=Math.imul(x^(x>>>13),3266489909); return ((x^(x>>>16))>>>0)/4294967296; }
export const COLORS=['#ff655b','#7960e9','#13b5ba','#ffb62d','#ec5197','#3676ed','#79bb3b'];
// 155 px/s immediately, rising continuously toward 315 px/s.
export function distance(t:number) {return 155*t+160*(t-48*(1-Math.exp(-t/48)));}
export function corridor(t:number,y:number,seed:number){return {centre:180+110*Math.sin((distance(t)-y)/300*.85+rand(seed,0)*Math.PI*2),half:76-20*(1-Math.exp(-t/65))};}
const arrivalCache=new Map<number,number>();
function arrival(d:number){const cached=arrivalCache.get(d);if(cached!==undefined)return cached;let t=d/210;for(let i=0;i<8;i++)t-=(distance(t)-d)/(155+160*(1-Math.exp(-t/48)));arrivalCache.set(d,t);return t;}
export function obstacles(t:number,seed:number,version=VERSION):Shape[]{
 if(version==='slip-1')return legacy.obstacles(t,seed);
 const dist=distance(t),shapes:Shape[]=[];
 const add=(cx:number,cy:number,w:number,h:number,kind:Shape['kind'],color:string,angle=0,sides=4,row=0)=>{shapes.push({x:cx-w/2,y:cy-h/2,w,h,kind,round:kind==='circle'||kind==='bolt',coral:false,color,angle,sides,row});};
 // Each shape's entire rotation envelope stays outside a continuous clear ribbon.
 // Projectiles also obey this ribbon, including when they overtake another row.
 const lane=(y:number,side:number,radius:number,phase:number)=>{const c=corridor(t,y,seed);return c.centre+side*(c.half+radius+15+9*(1+Math.sin(phase)));};
 for(let i=Math.max(0,Math.floor((dist-H-140)/250));i<=Math.floor((dist+100)/250);i++){
  const y=dist-i*250-100,kind=i%5,phase=rand(seed,i+3)*Math.PI*2;
  for(const side of [-1,1]){
   const color=COLORS[(i*2+(side===1?3:0))%COLORS.length],angle=t*(side*.75)+phase;
   if(kind===0){ // Slow windmills, with accurate rotating rectangular hitboxes.
    const cx=lane(y,side,37,phase+t*.8);
    add(cx,y,70,12,'bar',color,angle,4,i);add(cx,y,70,12,'bar',COLORS[(i+4)%7],angle+Math.PI/2,4,i);
    add(cx,y,13,13,'circle','#183f8d',0,4,i);
   }else if(kind===1){ // A staggered stream of tumbling triangles and diamonds.
    for(let n=0;n<2;n++){const cy=y+n*64-32,radius=n?19:25;add(lane(cy,side,radius,t*.9+phase+n),cy,radius*2,radius*2,'polygon',COLORS[(i+n+(side===1?3:0))%7],angle+n*.6,n?4:3,i);}
   }else if(kind===2){ // Visible launchers fire two falling, laterally moving bolts.
    const cx=lane(y,side,23,phase);add(cx,y,46,46,'polygon',color,angle*.45,6,i);
    const firstShot=arrival(i*250+170);
    for(let n=0;n<2;n++){const age=t-firstShot-n*.9;if(age<0||age>4.5)continue;const cy=y+age*120;if(cy>H+30)continue;
     const fireT=firstShot+n*.9,fireY=distance(fireT)-i*250-100,fireC=corridor(fireT,fireY,seed);
     const startX=fireC.centre+side*(fireC.half+23+15+9*(1+Math.sin(phase)));
     const c=corridor(t,cy,seed),raw=startX-side*Math.sin(age*2.4)*50;
     const x=side<0?Math.min(raw,c.centre-c.half-24):Math.max(raw,c.centre+c.half+24);
     add(x,cy,15,15,'bolt',COLORS[(i+n+4)%7],0,4,i);
    }
   }else if(kind===3){ // Orbiting satellites around a rotating pentagon.
    const cx=lane(y,side,45,phase);add(cx,y,38,38,'polygon',color,-angle,5,i);
    for(let n=0;n<2;n++){const a=angle+n*Math.PI;add(cx+Math.cos(a)*31,y+Math.sin(a)*31,16,16,'circle',COLORS[(i+n+1)%7],0,4,i);}
   }else { // Long sweeping paddles with offset diamonds.
    const cx=lane(y,side,42,phase+t);add(cx,y,80,15,'bar',color,Math.sin(t*.9+phase)*.65,4,i);
    const cy=y+58;add(lane(cy,side,18,phase),cy,36,36,'polygon',COLORS[(i+2)%7],-angle,4,i);
   }
  }
 }return shapes;
}
export function hitsShape(p:Point,s:Shape){
 const dx=p.x-s.x-s.w/2,dy=p.y-s.y-s.h/2,radius=s.round?s.w/2:Math.hypot(s.w,s.h)/2;
 if(dx*dx+dy*dy>(radius+R)**2)return false;
 if(s.round)return dx*dx+dy*dy<=(R+s.w/2)**2;
 const a=-(s.angle||0),x=dx*Math.cos(a)-dy*Math.sin(a),y=dx*Math.sin(a)+dy*Math.cos(a);
 if(s.kind==='polygon'){
  const sides=s.sides||4,r=s.w/2;let inside=false;
  for(let i=0,j=sides-1;i<sides;j=i++){
   const ai=i*Math.PI*2/sides-Math.PI/2,aj=j*Math.PI*2/sides-Math.PI/2;
   const ax=Math.cos(ai)*r,ay=Math.sin(ai)*r,bx=Math.cos(aj)*r,by=Math.sin(aj)*r;
   if((ay>y)!==(by>y)&&x<(bx-ax)*(y-ay)/(by-ay)+ax)inside=!inside;
   const vx=bx-ax,vy=by-ay,q=Math.max(0,Math.min(1,((x-ax)*vx+(y-ay)*vy)/(vx*vx+vy*vy)));
   if((x-ax-q*vx)**2+(y-ay-q*vy)**2<=R*R)return true;
  }return inside;
 }
 const cx=Math.max(-s.w/2,Math.min(x,s.w/2)),cy=Math.max(-s.h/2,Math.min(y,s.h/2));return (x-cx)**2+(y-cy)**2<=R*R;
}
// Include rotation/projectile speed in the sweep bound, not just player speed.
export function collision(a:Point,b:Point,tick:number,seed:number,version=VERSION){if(version==='slip-1')return legacy.collision(a,b,tick,seed);const steps=Math.max(4,Math.ceil((Math.hypot(b.x-a.x,b.y-a.y)+8)/2));for(let i=0;i<=steps;i++){const q=i/steps,p={x:a.x+(b.x-a.x)*q,y:a.y+(b.y-a.y)*q};if(obstacles((tick-1+q)/HZ,seed).some(s=>hitsShape(p,s)))return true;}return false;}
export function movementValid(a:Point,b:Point){return Number.isFinite(b.x)&&Number.isFinite(b.y)&&b.x>=R&&b.x<=W-R&&b.y>=R&&b.y<=H-R&&Math.hypot(b.x-a.x,b.y-a.y)<=36;}
export function startValid(p:Point){return Math.hypot(p.x-180,p.y-540)<=28;}
export function pack(points:Point[]){const bytes=new Uint8Array(points.length*4);const view=new DataView(bytes.buffer);points.forEach((p,i)=>{view.setUint16(i*4,Math.round(p.x*4),true);view.setUint16(i*4+2,Math.round(p.y*4),true);});let str='';for(let i=0;i<bytes.length;i+=8192)str+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(str);}
export function unpack(value:string):Point[]{if(typeof value!=='string'||value.length>(MAX_TICKS+1)*4*4/3+8)throw new Error('Invalid input recording.');const bin=atob(value);if(bin.length%4||bin.length<4)throw new Error('Invalid input recording.');const bytes=Uint8Array.from(bin,c=>c.charCodeAt(0)),v=new DataView(bytes.buffer),out:Point[]=[];for(let i=0;i<bytes.length;i+=4)out.push({x:v.getUint16(i,true)/4,y:v.getUint16(i+2,true)/4});return out;}
export function validateReplay(config:Config,points:Point[],reason:EndReason){
 if(config.version==='slip-1')return legacy.validateReplay(config,points,reason);
 if(config.version!==VERSION||!points.length||points.length>MAX_TICKS+1||!startValid(points[0]))return {valid:false,score:0,why:'Invalid starting state.'};
 if(!['collision','lift','background','cancel','limit','interrupted'].includes(reason))return {valid:false,score:0,why:'Invalid ending.'};
 for(let i=1;i<points.length;i++){if(!movementValid(points[i-1],points[i]))return {valid:false,score:0,why:'Movement exceeded the playfield or speed limit.'};if(collision(points[i-1],points[i],i,config.seed)){if(i!==points.length-1||reason!=='collision')return {valid:false,score:0,why:'Run continued after a collision.'};return {valid:true,score:Math.floor((i-1)*100/HZ),why:''};}}
 if(reason==='collision'||(reason==='limit'&&points.length!==MAX_TICKS+1))return {valid:false,score:0,why:'Ending does not match the replay.'};
 return {valid:true,score:Math.floor((points.length-1)*100/HZ),why:''};
}
