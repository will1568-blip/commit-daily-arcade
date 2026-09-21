import type {Point,Shape} from './engine-v6.ts';
export const THEMES=['GATEWAY','CONDUIT','SWITCHBACK','CROSSFIRE','OVERDRIVE'];
export const TOKEN_VALUE=250;
export function stageForScore(score:number){const index=Math.floor(Math.max(0,score)/5000);return {index,level:index+1,name:THEMES[index%5],color:'#ff334d',progress:(score%5000)/5000,nextScore:(index+1)*5000,targetSpeed:225+60*index};}
export type Scene={id:number;start:number;depth:number;span:number;stage:number;type:'gate'|'turret'|'rotor'|'gem'|'tunnel'|'maze'|'sliders'|'orbit'|'pendulum'|'pinwheel';centre:number;phase:number;angle:number;knots:number[];halves:number[];walls?:{vertices:Point[];edge:Point[]}[];token:boolean;lastCharge:number;charges:number};
const patterns:Scene['type'][][]=[['gate','turret','sliders','orbit','gate','pendulum','pinwheel','gem'],['tunnel','sliders','gate','orbit','turret'],['maze','pendulum','gate','pinwheel','sliders'],['turret','gate','orbit','turret','sliders','maze'],['tunnel','pinwheel','maze','pendulum','turret','sliders']];
function random(seed:number,n:number){let x=(seed^Math.imul(n+1,2654435761))>>>0;x=Math.imul(x^(x>>>16),2246822507);x=Math.imul(x^(x>>>13),3266489909);return ((x^(x>>>16))>>>0)/4294967296;}
const smooth=(v:number)=>v*v*(3-2*v);
export function laneAt(scene:Scene,u:number){if(!scene.knots.length)return {centre:scene.centre,half:60};const k=Math.max(0,Math.min(scene.knots.length-1,u*(scene.knots.length-1))),i=Math.min(scene.knots.length-2,Math.floor(k)),q=smooth(k-i);return {centre:scene.knots[i]+(scene.knots[i+1]-scene.knots[i])*q,half:scene.halves[i]+(scene.halves[i+1]-scene.halves[i])*q};}
export function movingCentre(scene:Scene,t:number){return scene.type==='sliders'?180+48*Math.sin(t*.9+scene.phase):scene.centre+(scene.id===0?0:14*Math.sin(t*.7+scene.phase));}
export function makeScene(start:number,id:number,stage:number,ordinal:number,seed:number):Scene{
 const seq=patterns[stage%5],type=seq[ordinal%seq.length],phase=random(seed,id+10)*Math.PI*2,centre=180+(ordinal%2===0?-1:1)*(72+8*random(seed,id+100));
 const depth=type==='tunnel'?1320:type==='maze'?1560:180,span=type==='turret'?960:depth+260;
 const knots=type==='tunnel'?[180,180+65*Math.sin(phase),180-65*Math.sin(phase),180]:type==='maze'?[180,110,250,110,250,180]:[],halves=knots.map((_,i)=>i===0||i===knots.length-1?84:68);
 const scene:Scene={id,start,depth,span,stage,type,centre,phase,angle:[-.36,.24,-.2,.4,0][id%5],knots,halves,token:ordinal%3===0&&!knots.length,lastCharge:-Infinity,charges:0};
 if(knots.length){const count=(knots.length-1)*8,edges=[[] as Point[],[] as Point[]];for(let j=0;j<=count;j++){const lane=laneAt(scene,j/count),y=depth-j/count*depth;edges[0].push({x:lane.centre-lane.half,y});edges[1].push({x:lane.centre+lane.half,y});}scene.walls=edges.map((edge,i)=>({edge,vertices:[{x:i?356:4,y:depth},...edge,{x:i?356:4,y:0}]}));}return scene;
}
export function sceneShapes(scene:Scene,scroll:number,t:number):Shape[]{
 const shapes:Shape[]=[],front=scroll-scene.start-100,c=scene.walls?180:movingCentre(scene,t),half=scene.walls?84:60,side=scene.centre>180?-1:1;
 const add=(suffix:string,x:number,y:number,w:number,h:number,kind:Shape['kind'],angle=0,sides=4)=>{const s:Shape={id:scene.id+':'+suffix,x:x-w/2,y:y-h/2,w,h,kind,round:kind==='circle'||kind==='shooter',coral:false,color:'#ff334d',angle,sides,row:scene.id};shapes.push(s);return s;};
 if(scene.walls)scene.walls.forEach((wall,i)=>shapes.push({id:scene.id+':wall:'+i,x:0,y:front-scene.depth,w:360,h:scene.depth,kind:'wall',round:false,coral:false,color:'#ff334d',row:scene.id,vertices:wall.vertices,edge:wall.edge}));
 if(scene.type==='gate'||scene.walls){
  const angle=scene.walls?0:scene.angle+(scene.id===0?0:.09*Math.sin(t*.65+scene.phase)),cos=Math.cos(angle),tan=Math.tan(angle);
  const cycle=(t+scene.phase)%5.4,extension=scene.walls||scene.id===0||cycle<2.8?1:cycle<3.5?1-smooth((cycle-2.8)/.7):cycle<4.3?0:smooth((cycle-4.3)/1.1);
  for(const sign of [-1,1]){const edge=sign<0?4:356,inner=c+sign*half,rail=Math.abs(inner-edge),length=rail*extension,mid=edge-sign*length/2;
   const s=add('gate:'+sign,mid,front+(mid-c)*tan,length/cos,26,'gate',angle);s.solid=length>.01;s.side=sign;s.rail=rail;s.warning=cycle>=3.9&&cycle<4.3;
   s.railStart={x:edge,y:front+(edge-c)*tan};s.railEnd={x:inner,y:front+(inner-c)*tan};
  }
 }else if(scene.type==='turret'){add('shooter',scene.centre+side*96,front,66,66,'shooter');}
 else if(scene.type==='sliders'){for(const sign of [-1,1])add('slider:'+sign,c+sign*(half+56+15*Math.sin(t*1.3+scene.phase)),front+sign*38,84,26,'bar',.14*Math.sin(t));}
 else if(scene.type==='orbit'){const x=c+side*(half+88);add('hub',x,front,34,34,'polygon',t*.6,6);for(let n=0;n<3;n++){const a=t*1.25+scene.phase+n*Math.PI*2/3;add('orb:'+n,x+Math.cos(a)*43,front+Math.sin(a)*43,36,36,'circle');}}
 else if(scene.type==='pinwheel'){const x=c+side*(half+78),a=t*.95+scene.phase;add('cross:0',x,front,120,20,'bar',a);add('cross:1',x,front,120,20,'bar',a+Math.PI/2);}
 else if(scene.type==='pendulum')add('swing',c+side*(half+100),front,176,26,'bar',Math.sin(t*1.25+scene.phase)*1.1);
 else if(scene.type==='rotor')add('rotor',c+side*(half+104),front,190,28,'bar',t*.7+scene.phase);
 else add('gem',c+side*(half+83)+20*Math.sin(t*1.1),front+16*Math.cos(t*.8),94,94,'polygon',-t*.65+scene.phase,scene.id%2?3:4);
 if(scene.token){const sign=scene.centre<180?1:-1,token=add('token',c+sign*44,front-75,20,20,'token');token.solid=false;token.round=true;token.color='#ffd76b';}
 return shapes;
}
