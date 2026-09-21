import {W,H,R,HZ,BARRIER,VERSION,BORDER_SPIKES,type Point,type Shape,type Shot} from './engine';

// Paths are built once. Every draw uses continuous world time and subpixel
// coordinates, with a backing store matched to the displayed canvas size.
export function createRenderer(canvas:HTMLCanvasElement){
 const ctx=canvas.getContext('2d',{alpha:false,desynchronized:true})!;
 const spikes=new Path2D();for(const vertices of BORDER_SPIKES){vertices.forEach((p,i)=>i?spikes.lineTo(p.x,p.y):spikes.moveTo(p.x,p.y));spikes.closePath();}
 const circle=new Path2D();circle.arc(0,0,1,0,Math.PI*2);
 const capsule=new Path2D();capsule.moveTo(-7,-4);capsule.lineTo(7,-4);capsule.arc(7,0,4,-Math.PI/2,Math.PI/2);capsule.lineTo(-7,4);capsule.arc(-7,0,4,Math.PI/2,Math.PI*1.5);capsule.closePath();
 const wallPaths=new WeakMap<object,Path2D>();
 function pathFor(points:{x:number;y:number}[],close=false){let path=wallPaths.get(points);if(!path){path=new Path2D();points.forEach((p,i)=>i?path!.lineTo(p.x,p.y):path!.moveTo(p.x,p.y));if(close)path.closePath();wallPaths.set(points,path);}return path;}
 const polygons=new Map<number,Path2D>();
 for(const sides of [3,4,5,6]){const path=new Path2D();for(let i=0;i<sides;i++){const a=i*Math.PI*2/sides-Math.PI/2;if(i===0)path.moveTo(Math.cos(a),Math.sin(a));else path.lineTo(Math.cos(a),Math.sin(a));}path.closePath();polygons.set(sides,path);}
 let bounds=canvas.getBoundingClientRect();
 function resize(){bounds=canvas.getBoundingClientRect();const dpr=Math.min(window.devicePixelRatio||1,2),width=Math.round(bounds.width*dpr),height=Math.round(bounds.height*dpr);if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}ctx.setTransform(width/W,0,0,height/H,0,0);}
 resize();const observer=new ResizeObserver(resize);observer.observe(canvas);
 function disc(x:number,y:number,r:number,color:string){ctx.fillStyle=color;ctx.setTransform(canvas.width/W,0,0,canvas.height/H,0,0);ctx.translate(x,y);ctx.scale(r,r);ctx.fill(circle);}
 return {
  point(clientX:number,clientY:number):Point{return {x:Math.max(0,Math.min(W,(clientX-bounds.left)*W/bounds.width)),y:Math.max(R,Math.min(H,(clientY-bounds.top)*H/bounds.height))};},
  dispose(){observer.disconnect();},
  draw(t:number,shapes:Shape[],player:Point,phase:string,shots:Shot[],version=VERSION){
   ctx.setTransform(canvas.width/W,0,0,canvas.height/H,0,0);ctx.globalAlpha=1;ctx.fillStyle='#000000';ctx.fillRect(0,0,W,H);
   for(const shape of shapes){
    const x=shape.x+shape.w/2,y=shape.y+shape.h/2,color='#ff334d';
    const extent=Math.hypot(shape.w,shape.h)/2;if(y+extent<0||y-extent>H)continue;
    ctx.setTransform(canvas.width/W,0,0,canvas.height/H,0,0);
    if(shape.kind==='token'){
     ctx.translate(x,y);ctx.fillStyle='#ffd76b';ctx.beginPath();ctx.arc(0,0,10,0,Math.PI*2);ctx.fill();ctx.fillStyle='#171000';ctx.beginPath();ctx.arc(0,0,7,0,Math.PI*2);ctx.fill();ctx.fillStyle='#ffd76b';ctx.fillRect(-4,-1,8,2);ctx.fillRect(-1,-4,2,8);continue;
    }
    if(shape.kind==='wall'){
     ctx.translate(shape.x,shape.y);ctx.fillStyle=color+'28';ctx.fill(pathFor(shape.vertices!,true));ctx.strokeStyle=color;ctx.lineWidth=4;ctx.lineJoin='round';ctx.stroke(pathFor(shape.edge!));continue;
    }
    if(shape.kind==='gate'){
     const start=shape.side===-1?BARRIER:W-BARRIER,tip=start+(shape.side===-1?1:-1)*(shape.rail||0),a=shape.railStart||{x:start,y},b=shape.railEnd||{x:tip,y};
     // Dotted rails are harmless; only the solid sliding bar collides.
     ctx.strokeStyle=shape.warning?'#ff6175':'#65303a';ctx.lineWidth=shape.warning?2:1;ctx.setLineDash([4,6]);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();ctx.setLineDash([]);
    }
    if(shape.kind==='shooter'){
     const rowShots=shots.filter(s=>s.row===shape.row),shot=rowShots.find(s=>t<s.fireTick/HZ)||rowShots.at(-1),charging=shot&&t>=shot.aimTick/HZ&&t<shot.fireTick/HZ;
     const a=shot?(shot.fired===false?Math.atan2(shot.target.y-y,shot.target.x-x):Math.atan2(shot.dy,shot.dx)):Math.atan2(player.y-y,player.x-x);
     if(charging){const length=135;ctx.strokeStyle='#ff334d80';ctx.lineWidth=2;ctx.setLineDash([6,7]);ctx.beginPath();ctx.moveTo(x+Math.cos(a)*28,y+Math.sin(a)*28);ctx.lineTo(x+Math.cos(a)*length,y+Math.sin(a)*length);ctx.stroke();ctx.setLineDash([]);}
     disc(x,y,shape.w/2,shape.spent?color+'a0':color);ctx.setTransform(canvas.width/W,0,0,canvas.height/H,0,0);ctx.translate(x,y);ctx.rotate(a);ctx.fillStyle='#08080a';ctx.fillRect(-5,-5,30,10);ctx.fillStyle=charging?'#ff6175':'#ff334d';ctx.fillRect(-4,-3,28,6);
     if(rowShots.some(s=>t>=s.fireTick/HZ&&t<s.fireTick/HZ+.09)){ctx.fillStyle='#ff334d';ctx.beginPath();ctx.arc(27,0,7,0,Math.PI*2);ctx.fill();}
     continue;
    }
    ctx.translate(x,y);ctx.rotate(shape.angle||0);ctx.fillStyle=color;
    if(shape.kind==='bolt'&&!shape.round){ctx.globalAlpha=.2;ctx.beginPath();ctx.moveTo(-7,-3);ctx.lineTo(-27,0);ctx.lineTo(-7,3);ctx.fill();ctx.globalAlpha=1;ctx.fill(capsule);ctx.fillStyle='#190107';ctx.fillRect(-4,-1,8,2);continue;}
    if(shape.round){ctx.scale(shape.w/2,shape.w/2);ctx.fill(circle);}
    else if(shape.kind==='polygon'){ctx.scale(shape.w/2,shape.w/2);ctx.fill(polygons.get(shape.sides||4)!);}
    else if(shape.w>.01){ctx.fillRect(-shape.w/2,-shape.h/2,shape.w,shape.h);if(shape.kind==='bar'){ctx.fillStyle='#170208';ctx.beginPath();ctx.arc(0,0,4,0,Math.PI*2);ctx.fill();}}
   }
   ctx.setTransform(canvas.width/W,0,0,canvas.height/H,0,0);
   if(version===VERSION||version==='slip-3'||version==='slip-4'||version==='slip-5'){ctx.fillStyle='#ff334d';ctx.fillRect(0,0,BARRIER,H);ctx.fillRect(W-BARRIER,0,BARRIER,H);ctx.fillRect(0,H-BARRIER,W,BARRIER);ctx.fillStyle='#ff334d0e';ctx.fillRect(BARRIER,0,5,H);ctx.fillRect(W-BARRIER-5,0,5,H);ctx.fillRect(0,H-BARRIER-5,W,5);}
   if(version===VERSION||version==='slip-5'){ctx.fillStyle='#ff334d';ctx.fill(spikes);}
   ctx.strokeStyle='#ffffff80';ctx.lineWidth=1.25;ctx.beginPath();ctx.arc(player.x,player.y,24,0,Math.PI*2);ctx.stroke();disc(player.x,player.y,31,'#ffffff09');disc(player.x,player.y,R+1.5,'#000000');disc(player.x,player.y,R,'#ffffff');
   if(phase==='ready'||phase==='holding'){ctx.setTransform(canvas.width/W,0,0,canvas.height/H,0,0);ctx.fillStyle='#eeeeF4';ctx.textAlign='center';ctx.font='bold 12px Arial';ctx.fillText('PRESS & HOLD HERE',180,596);}
  },
 };
}
