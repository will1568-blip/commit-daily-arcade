import type {Point,Shape} from './engine-v5.ts';
const W=360,H=640,BARRIER=4;
export const THEMES=[
 {name:'GATEWAY',color:'#ff334d',colors:['#ff334d']},
 {name:'CONDUIT',color:'#ff334d',colors:['#ff334d']},
 {name:'SWITCHBACK',color:'#ff334d',colors:['#ff334d']},
 {name:'CROSSFIRE',color:'#ff334d',colors:['#ff334d']},
 {name:'OVERDRIVE',color:'#ff334d',colors:['#ff334d']},
] as const;
export function stageAt(t:number){const index=Math.max(0,Math.floor(t/50)),theme=THEMES[index%THEMES.length];return {...theme,index,level:index+1,nextScore:(index+1)*5000,progress:(t-index*50)/50};}
// Smooth acceleration is continuous across every 5,000-point milestone.
export function speed(t:number){return 225+90*(1-Math.exp(-t/45))+240*(1-Math.exp(-t/200));}
export function distance(t:number){return 225*t+90*(t-45*(1-Math.exp(-t/45)))+240*(t-200*(1-Math.exp(-t/200)));}
const arrivals=new Map<number,number>();
export function arrival(d:number){let t=arrivals.get(d);if(t!==undefined)return t;t=d/280;for(let i=0;i<9;i++)t-=(distance(t)-d)/speed(t);arrivals.set(d,t);return t;}
function rand(seed:number,n:number){let x=(seed^Math.imul(n+1,2654435761))>>>0;x=Math.imul(x^(x>>>16),2246822507);x=Math.imul(x^(x>>>13),3266489909);return ((x^(x>>>16))>>>0)/4294967296;}
function smooth(v:number){v=Math.max(0,Math.min(1,v));return v*v*(3-2*v);}
export type Scene={id:number;start:number;depth:number;span:number;type:'gate'|'turret'|'rotor'|'gem'|'tunnel'|'maze';stage:number;color:string;centre:number;knots:number[];halves:number[];walls?:{vertices:Point[];edge:Point[]}[];aimTick:number;phase:number};
const sequences:Scene['type'][][]=[['gate','rotor','gate','turret','gem','gate','rotor'],['tunnel','gate','tunnel','rotor','gate'],['maze','gate','maze','rotor'],['turret','gate','turret','rotor','gate','maze'],['tunnel','rotor','maze','gate','turret']];
const courses=new Map<number,Scene[]>();
export function laneAt(scene:Scene,u:number){
 if(!scene.knots.length)return {centre:scene.centre,half:54};
 const k=Math.max(0,Math.min(scene.knots.length-1,u*(scene.knots.length-1))),i=Math.min(scene.knots.length-2,Math.floor(k)),q=smooth(k-i);
 return {centre:scene.knots[i]+(scene.knots[i+1]-scene.knots[i])*q,half:scene.halves[i]+(scene.halves[i+1]-scene.halves[i])*q};
}
export function courseFor(seed:number){
 const existing=courses.get(seed);if(existing)return existing;
 const scenes:Scene[]=[];let id=0;
 for(let stage=0;stage<12;stage++){
  let cursor=stage===0?0:distance(stage*50)-100;const end=distance((stage+1)*50)-100,seq=sequences[stage%5],palette=THEMES[stage%5].colors;
  for(let n=0;cursor+360<=end;n++){
   let type=seq[n%seq.length],depth=type==='tunnel'?1320:type==='maze'?1560:160,span=type==='turret'?900:depth+200;
   if(cursor+span>end){type='gate';depth=160;span=360;if(cursor+span>end)break;}
   const phase=rand(seed,id+10)*Math.PI*2,centre=180+(n%2===0?-1:1)*(76+6*rand(seed,id+100)),knots=type==='tunnel'?[180,180+65*Math.sin(phase),180-65*Math.sin(phase),180]:type==='maze'?[180,110,250,110,250,180]:[];
   if(type==='maze'&&Math.sin(phase)<0)for(let k=0;k<knots.length;k++)knots[k]=W-knots[k];
   const halves=knots.map((_,i)=>i===0||i===knots.length-1?84:type==='maze'?66:68);
   const scene:Scene={id:id++,start:cursor,depth,span,type,stage,color:palette[n%palette.length],centre,knots,halves,aimTick:Math.ceil(arrival(cursor+160)*120),phase};
   if(knots.length){
    const count=(knots.length-1)*8,edges=[[] as Point[],[] as Point[]];
    for(let j=0;j<=count;j++){const lane=laneAt(scene,j/count),y=depth-j/count*depth;edges[0].push({x:lane.centre-lane.half,y});edges[1].push({x:lane.centre+lane.half,y});}
    scene.walls=edges.map((edge,side)=>({edge,vertices:[{x:side?W-BARRIER:BARRIER,y:depth},...edge,{x:side?W-BARRIER:BARRIER,y:0}]}));
   }
   scenes.push(scene);cursor+=span;
  }
 }
 if(courses.size>=8)courses.delete(courses.keys().next().value!);courses.set(seed,scenes);return scenes;
}
export function visibleScenes(t:number,seed:number){
 const course=courseFor(seed),d=distance(t);let lo=0,hi=course.length;
 while(lo<hi){const mid=(lo+hi)>>>1;if(course[mid].start+course[mid].depth<d-H-140)lo=mid+1;else hi=mid;}
 const result:Scene[]=[];for(let i=lo;i<course.length&&course[i].start<d+40;i++)result.push(course[i]);return result;
}
export function corridor(t:number,y:number,seed:number){
 const world=distance(t)-100-y,scenes=courseFor(seed);
 const scene=scenes.find(s=>world>=s.start-30&&world<=s.start+s.depth+30)||scenes.reduce((best,s)=>Math.abs(s.start-world)<Math.abs(best.start-world)?s:best,scenes[0]);
 return laneAt(scene,(world-scene.start)/scene.depth);
}
export function gateState(t:number,row:number,seed=0){
 const scene=courseFor(seed)[row],age=Math.max(0,t-arrival((scene?.start||0)+140)),hold=scene?.stage===0&&row<3?2.7:1.6,cycle=age%(hold+3.6);
 const extension=cycle<hold?1:cycle<hold+.8?1-smooth((cycle-hold)/.8):cycle<hold+2.2?0:smooth((cycle-hold-2.2)/1.4);
 return {extension,warning:cycle>=hold+1.5&&cycle<hold+2.2};
}
export function courseObstacles(t:number,seed:number):Shape[]{
 const d=distance(t),out:Shape[]=[];
 const add=(id:string,cx:number,cy:number,w:number,h:number,kind:Shape['kind'],scene:Scene,angle=0):Shape=>{const s:Shape={id,x:cx-w/2,y:cy-h/2,w,h,kind,round:kind==='shooter',coral:false,color:scene.color,angle,sides:4,row:scene.id};out.push(s);return s;};
 for(const scene of visibleScenes(t,seed)){
  const front=d-scene.start-100,c=laneAt(scene,0),side=c.centre>180?-1:1;
  if(scene.walls){
   scene.walls.forEach((wall,i)=>{out.push({id:scene.id+':wall:'+i,x:0,y:front-scene.depth,w:W,h:scene.depth,kind:'wall',round:false,coral:false,color:scene.color,row:scene.id,vertices:wall.vertices,edge:wall.edge});});
  }
  if(scene.type==='gate'||scene.walls){
   const state=scene.walls?{extension:1,warning:false}:gateState(t,scene.id,seed);
   for(const sign of [-1,1]){const rail=sign<0?c.centre-c.half-BARRIER:W-BARRIER-c.centre-c.half,w=rail*state.extension;
    const shape=add(scene.id+':gate:'+sign,sign<0?BARRIER+w/2:W-BARRIER-w/2,front,w,30,'gate',scene);
    shape.rail=rail;shape.side=sign;shape.warning=state.warning;shape.solid=w>.01;
   }
  }else if(scene.type==='turret'){
   const shape=add(scene.id+':shooter',c.centre+side*(c.half+42),front,66,66,'shooter',scene);shape.spent=t>(scene.aimTick+104)/120;
  }else if(scene.type==='rotor'){
   add(scene.id+':rotor',c.centre+side*(c.half+101),front,190,28,'bar',scene,t*.48+scene.phase);
  }else add(scene.id+':gem',c.centre+side*(c.half+62),front,112,112,'polygon',scene,-t*.38+scene.phase);
 }
 return out;
}
