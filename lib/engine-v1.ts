// This module is the versioned source of truth for both rendering and verification.
// Keep old engines available if a future game version is introduced.
export const VERSION = 'slip-1';
export const GAME = 'slip';
export const W = 360, H = 640, R = 6, HZ = 120, MAX_TICKS = HZ * 600;
export type Point = { x:number; y:number };
export type Shape = { x:number; y:number; w:number; h:number; round:boolean; coral:boolean };
export type Config = { version:string; seed:number; hz:number; maxTicks:number };
export type EndReason = 'collision'|'lift'|'background'|'cancel'|'limit'|'interrupted';
export function boundaries(now:number) { const d=new Date(now); const day=d.toISOString().slice(0,10); const midnight=Date.parse(day+'T00:00:00Z'); const monday=midnight-((d.getUTCDay()+6)%7)*86400000; return {day,week:new Date(monday).toISOString().slice(0,10),resetAt:midnight+86400000,weekResetAt:monday+7*86400000}; }
export function seedFor(week:string) { let h=2166136261; for(const c of week+VERSION) h=Math.imul(h^c.charCodeAt(0),16777619); return h>>>0; }
export function configFor(week:string):Config {return {version:VERSION,seed:seedFor(week),hz:HZ,maxTicks:MAX_TICKS};}
function rand(seed:number,n:number) { let x=(seed^Math.imul(n+1,2654435761))>>>0; x=Math.imul(x^(x>>>16),2246822507); x=Math.imul(x^(x>>>13),3266489909); return ((x^(x>>>16))>>>0)/4294967296; }
export function distance(t:number) {return 92*t+128*(t-65*(1-Math.exp(-t/65)));}
export function obstacles(t:number,seed:number):Shape[]{
 const dist=distance(t), shapes:Shape[]=[];const first=Math.max(0,Math.floor((dist-H-100)/230));const last=Math.floor((dist+70)/230);
 for(let i=first;i<=last;i++){
  const y=dist-i*230-75; const difficulty=Math.min(1,i/45);const gap=184-66*difficulty;
  // Centres vary smoothly, and row spacing always leaves enough turning room.
  const centre=180+58*Math.sin(i*.71+rand(seed,0)*6.28)+(i>4?12*Math.sin(t*.65+i):0);
  const left=centre-gap/2,right=centre+gap/2,kind=Math.floor(rand(seed,i+2)*3);
  if(kind===0){shapes.push({x:-8,y,w:left+8,h:24,round:false,coral:false},{x:right,y,w:W-right+8,h:24,round:false,coral:true});}
  else if(kind===1){for(let x=18;x<=left-19;x+=43)shapes.push({x:x-18,y:y-18,w:36,h:36,round:true,coral:false});for(let x=right+19;x<W;x+=43)shapes.push({x:x-18,y:y-18,w:36,h:36,round:true,coral:true});}
  else {shapes.push({x:0,y,w:left,h:32,round:false,coral:true},{x:right,y,w:W-right,h:32,round:false,coral:false});}
 }return shapes;
}
function circleRect(p:Point,s:Shape){if(s.round){const dx=p.x-s.x-s.w/2,dy=p.y-s.y-s.h/2;return dx*dx+dy*dy<=(R+s.w/2)**2;}const x=Math.max(s.x,Math.min(p.x,s.x+s.w)),y=Math.max(s.y,Math.min(p.y,s.y+s.h));return (p.x-x)**2+(p.y-y)**2<=R*R;}
// Swept movement samples never exceed 2 logical pixels, preventing tunnelling.
export function collision(a:Point,b:Point,tick:number,seed:number){const steps=Math.max(2,Math.ceil((Math.hypot(b.x-a.x,b.y-a.y)+2)/2));for(let i=0;i<=steps;i++){const q=i/steps,p={x:a.x+(b.x-a.x)*q,y:a.y+(b.y-a.y)*q};if(obstacles((tick-1+q)/HZ,seed).some(s=>circleRect(p,s)))return true;}return false;}
export function movementValid(a:Point,b:Point){return Number.isFinite(b.x)&&Number.isFinite(b.y)&&b.x>=R&&b.x<=W-R&&b.y>=R&&b.y<=H-R&&Math.hypot(b.x-a.x,b.y-a.y)<=36;}
export function startValid(p:Point){return Math.hypot(p.x-180,p.y-540)<=28;}
export function pack(points:Point[]){const bytes=new Uint8Array(points.length*4);const view=new DataView(bytes.buffer);points.forEach((p,i)=>{view.setUint16(i*4,Math.round(p.x*4),true);view.setUint16(i*4+2,Math.round(p.y*4),true);});let str='';for(let i=0;i<bytes.length;i+=8192)str+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(str);}
export function unpack(value:string):Point[]{if(typeof value!=='string'||value.length>(MAX_TICKS+1)*4*4/3+8)throw new Error('Invalid input recording.');const bin=atob(value);if(bin.length%4||bin.length<4)throw new Error('Invalid input recording.');const bytes=Uint8Array.from(bin,c=>c.charCodeAt(0)),v=new DataView(bytes.buffer),out:Point[]=[];for(let i=0;i<bytes.length;i+=4)out.push({x:v.getUint16(i,true)/4,y:v.getUint16(i+2,true)/4});return out;}
export function validateReplay(config:Config,points:Point[],reason:EndReason){
 if(config.version!==VERSION||!points.length||points.length>MAX_TICKS+1||!startValid(points[0]))return {valid:false,score:0,why:'Invalid starting state.'};
 if(!['collision','lift','background','cancel','limit','interrupted'].includes(reason))return {valid:false,score:0,why:'Invalid ending.'};
 for(let i=1;i<points.length;i++){if(!movementValid(points[i-1],points[i]))return {valid:false,score:0,why:'Movement exceeded the playfield or speed limit.'};if(collision(points[i-1],points[i],i,config.seed)){if(i!==points.length-1||reason!=='collision')return {valid:false,score:0,why:'Run continued after a collision.'};return {valid:true,score:Math.floor((i-1)*100/HZ),why:''};}}
 if(reason==='collision'||(reason==='limit'&&points.length!==MAX_TICKS+1))return {valid:false,score:0,why:'Ending does not match the replay.'};
 return {valid:true,score:Math.floor((points.length-1)*100/HZ),why:''};
}
