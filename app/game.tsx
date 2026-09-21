"use client";
import {useEffect,useRef,useState} from 'react';
import {ArrowRight,ChevronLeft,Clock3,Fingerprint,ShieldCheck,Trophy} from 'lucide-react';
import {api,ApiError,savePending} from '../lib/client';
import {HZ,MAX_TICKS,W,H,R,VERSION,Point,Config,EndReason,createSimulation,movementValid,startValid,pack,boundaries,configFor} from '../lib/engine';
import {InputTimeline} from '../lib/input';
import {createRenderer} from '../lib/renderer';
type Run={id:string;config:Config;startedAt:number;submitBy:number};
type Result={score:number;bonus?:number;survivalScore?:number;reason:EndReason;state:string;message?:string;daily?:{rank:number};weekly?:{score:number;rank:number}};
export default function Game({onClose,onLeaderboard,resetAt,userId,demo=false}:{onClose:()=>void;onLeaderboard:()=>void;resetAt:number;userId:string;demo?:boolean}){
 const canvas=useRef<HTMLCanvasElement>(null),scoreEl=useRef<HTMLSpanElement>(null),[phase,setPhase]=useState('ready'),[count,setCount]=useState(3),[error,setError]=useState(''),[result,setResult]=useState<Result|null>(null),[now,setNow]=useState(Date.now());
 const bonusEl=useRef<HTMLSpanElement>(null);
 const stageEl=useRef<HTMLSpanElement>(null),nextStageEl=useRef<HTMLElement>(null),stageProgress=useRef<HTMLElement>(null);
 const state=useRef({phase:'ready',pointer:-1,point:{x:180,y:540},points:[] as Point[],run:null as Run|null,start:0,lastFrame:0,holdStart:0,tick:0,key:'',ended:false,authorization:false});
 const renderer=useRef<ReturnType<typeof createRenderer>|null>(null),simulation=useRef<ReturnType<typeof createSimulation>|null>(null),input=useRef(new InputTimeline()),advanceRef=useRef<(ts:number)=>void>(()=>{});
 const finishRef=useRef<(reason:EndReason)=>void>(()=>{}),submitRef=useRef<()=>Promise<void>>(async()=>{});
 const setStage=(s:string)=>{state.current.phase=s;setPhase(s);};
 useEffect(()=>{
  const el=canvas.current!,s=state.current;let frame=0,alive=true,lastHud=0,lastCount=3;const oldOverflow=document.body.style.overflow;document.body.style.overflow='hidden';
  renderer.current=createRenderer(el);
  let pending:{id:string;trace:string;reason:string;userId:string}|null=null,submitting=false;
  async function submit(){if(!pending||submitting)return;submitting=true;try{const r=await api('runs/submit',pending);if(!alive)return;try{localStorage.removeItem('slip-pending:'+pending.id);}catch{}setResult(v=>v?{...v,state:r.status,score:r.score??v.score,message:r.rejection}:v);try{const details=await api('runs/details?id='+pending.id);if(alive)setResult(v=>v?{...v,daily:details.daily,weekly:details.weekly}:v);}catch{/* Score is saved even when ranks cannot load. */}pending=null;}catch(e){if(alive)setResult(v=>v?{...v,state:e instanceof ApiError&&[400,404,409,410].includes(e.status)?'rejected':'pending',message:(e as Error).message}:v);}finally{submitting=false;}}
  submitRef.current=submit;
  function finish(reason:EndReason){if(s.ended||!s.run)return;s.ended=true;s.pointer=-1;setStage('ended');const summary=simulation.current!.status(),score=summary.score;if(demo){setResult({score,bonus:summary.bonus,survivalScore:summary.survivalScore,reason,state:'demo'});return;}pending={id:s.run.id,trace:pack(s.points),reason,userId};try{savePending(pending);}catch{/* Submission still proceeds if this browser disables local storage. */}setResult({score,bonus:summary.bonus,survivalScore:summary.survivalScore,reason,state:'pending'});void submit();}
  finishRef.current=finish;
  async function authorize(){s.authorization=true;setStage('authorizing');try{const run:Run=demo?{id:'demo',config:configFor(boundaries(Date.now()).week),startedAt:Date.now(),submitBy:0}:await api('runs/start',{key:s.key}) as Run;s.run=run;s.points=[{...s.point}];s.tick=0;s.start=performance.now();s.lastFrame=s.start;simulation.current=createSimulation(run.config);input.current.reset(s.point,s.start);if(!alive||s.pointer<0||document.visibilityState!=='visible'){finish('cancel');return;}setStage('running');}catch(e){if(!alive)return;setError((e as Error).message+' If the request reached the server, the attempt may already be used.');s.pointer=-1;setStage('failed');}finally{s.authorization=false;}}
  function advance(ts:number){
   if(s.phase!=='running')return;
   if(ts-s.lastFrame>250){finish('interrupted');return;}
   const target=Math.min(MAX_TICKS,Math.floor((ts-s.start)*HZ/1000));
   while(s.tick<target&&!s.ended){
    const prev=s.points[s.points.length-1],p=input.current.sample(s.start+(s.tick+1)*1000/HZ);
    if(!movementValid(prev,p)){finish('interrupted');break;}
    s.tick++;s.points.push(p);
    if(simulation.current!.step(prev,p,s.tick)){finish('collision');break;}
    if(s.tick===MAX_TICKS){finish('limit');break;}
   }
   s.lastFrame=ts;
  }
  advanceRef.current=advance;
  function draw(t:number){renderer.current?.draw(t,simulation.current?.shapes(t)||[],s.phase==='running'||s.phase==='ended'?s.point:{x:180,y:540},s.phase,simulation.current?.shots||[],s.run?.config.version);}
  function animate(ts:number){if(!alive)return;
   if(s.phase==='holding'){const elapsed=ts-s.holdStart,nextCount=Math.max(1,3-Math.floor(elapsed/1000));if(lastCount!==nextCount){setCount(nextCount);lastCount=nextCount;}if(elapsed>=3000&&s.pointer>=0&&!s.authorization)void authorize();}
   if(s.phase==='running'){
    advance(ts);
    // The score changes at 10 Hz; no layout or React work on every draw.
    if(ts-lastHud>=100&&scoreEl.current){const summary=simulation.current!.status();scoreEl.current.textContent=summary.score.toLocaleString();const stage=summary.stage;if(bonusEl.current){bonusEl.current.textContent='◆ '+summary.bonus.toLocaleString()+' BONUS';bonusEl.current.classList.toggle('picked-up',s.tick/HZ-summary.lastPickupAt<.7);}if(stageEl.current){stageEl.current.textContent=String(stage.level).padStart(2,'0')+' · '+stage.name;stageEl.current.style.color=stage.color;}if(nextStageEl.current)nextStageEl.current.textContent=stage.nextScore.toLocaleString()+' NEXT';if(stageProgress.current){stageProgress.current.style.transform='scaleX('+stage.progress+')';stageProgress.current.style.background=stage.color;}lastHud=ts;}
   }
   draw(s.phase==='running'?Math.max(0,(ts-s.start)/1000):s.tick/HZ);
   frame=requestAnimationFrame(animate);
  }
  draw(0);frame=requestAnimationFrame(animate);
  const stop=()=>{if(s.phase==='running')finish('background');else if(s.phase==='holding'){s.pointer=-1;setStage('ready');}else if(s.phase==='authorizing')s.pointer=-1;};
  const visibility=()=>{if(document.visibilityState==='hidden')stop();};const online=()=>{if(s.ended)void submit();};document.addEventListener('visibilitychange',visibility);window.addEventListener('pagehide',stop);window.addEventListener('blur',stop);window.addEventListener('online',online);
  return()=>{alive=false;cancelAnimationFrame(frame);renderer.current?.dispose();document.body.style.overflow=oldOverflow;document.removeEventListener('visibilitychange',visibility);window.removeEventListener('pagehide',stop);window.removeEventListener('blur',stop);window.removeEventListener('online',online);if(s.phase==='running')finish('background');};
 },[]);
 useEffect(()=>{if(phase!=='ended')return;const id=setInterval(()=>{setNow(Date.now());void submitRef.current();},15000);return()=>clearInterval(id);},[phase]);
 function point(e:{clientX:number;clientY:number}){return renderer.current!.point(e.clientX,e.clientY);}
 function down(e:React.PointerEvent){const s=state.current;if(!e.isPrimary||s.phase!=='ready'||(e.pointerType==='mouse'&&e.button!==0))return;e.preventDefault();const p=point(e);if(!startValid(p))return;s.point={x:Math.round(p.x*4)/4,y:Math.round(p.y*4)/4};s.pointer=e.pointerId;s.key=demo?'demo':crypto.randomUUID();s.holdStart=performance.now();e.currentTarget.setPointerCapture(e.pointerId);setCount(3);setStage('holding');}
 function move(e:React.PointerEvent){
  const s=state.current;if(e.pointerId!==s.pointer)return;e.preventDefault();const p=point(e);
  if(s.phase==='holding'||s.phase==='authorizing'){if(!startValid(p)){s.pointer=-1;if(s.phase==='holding')setStage('ready');}return;}
  if(s.phase==='running'){
   if(s.run?.config.version!==VERSION&&s.run?.config.version!=='slip-3'&&s.run?.config.version!=='slip-4'&&s.run?.config.version!=='slip-5'&&(p.x<R||p.x>W-R||p.y>H-R)){advanceRef.current(performance.now());finishRef.current('lift');return;}
   const samples=e.nativeEvent.getCoalescedEvents?.()||[];
   for(const sample of samples)input.current.push(point(sample),sample.timeStamp);
   input.current.push(p,e.timeStamp);s.point=p;
  }
 }
 function up(e:React.PointerEvent){const s=state.current;if(e.pointerId!==s.pointer)return;
  if(s.phase==='running'){advanceRef.current(performance.now());finishRef.current('lift');}
  else if(s.phase==='holding')setStage('ready');s.pointer=-1;
 }
 const seconds=Math.max(0,Math.floor((resetAt-now)/1000)),resetText=[Math.floor(seconds/3600),Math.floor(seconds/60)%60,seconds%60].map(n=>String(n).padStart(2,'0')).join(':');
 return <div className="game-screen"><div className="game-wrap"><canvas ref={canvas} className="game-canvas" aria-label="SLIP playfield. Hold the starting circle, then drag to dodge. Red side and bottom spikes end the run. Lifting ends the run." onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onLostPointerCapture={up} onContextMenu={e=>e.preventDefault()}/><div className="game-hud"><span className="game-wordmark">╱ SLIP</span><span ref={scoreEl}>0</span><small>{demo ? 'DEMO · PTS' : 'PTS'}</small></div>{(phase==='running'||phase==='ended')&&<div className="game-stage" aria-label="Course progress"><span ref={stageEl}>01 · GATEWAY</span><small ref={nextStageEl}>5,000 NEXT</small><div><i ref={stageProgress}/></div><span ref={bonusEl} className="game-bonus">◆ 0 BONUS</span></div>}{phase==='ready'&&<><button className="game-back" onClick={onClose}><ChevronLeft size={17}/> Back</button><div className="game-intro"><div className="eyebrow">{demo ? 'DEMO · UNRANKED · UNLIMITED RETRIES' : 'ONE TOUCH. ONE DAILY RUN.'}</div><h2>Keep your touch.</h2><p>Hold your mouse button or finger down.<br/>Dodge red shapes and border spikes.<br/>Touch either or release to end your run.</p><div className="game-rule"><Fingerprint size={20}/><span>Hold the circle for 3 seconds.<br/>Release during countdown to cancel.</span></div><small>Dodge red. Gold tokens give +250.<br/>Every 5,000 points brings a faster section.</small></div></>}{phase==='holding'&&<div className="countdown"><strong>{count}</strong><span>Keep holding</span><small>Release now to cancel for free</small></div>}{phase==='authorizing'&&<div className="countdown"><span className="loader"/><span>Authorizing your run…</span><small>Keep your finger on the circle</small></div>}{phase==='failed'&&<div className="game-error"><h2>Couldn’t start this run.</h2><p>{error}</p><button className="play-button" onClick={onClose}>Check attempt status</button></div>}</div>
 {result&&<div className="modal-shade result-shade"><section className="modal result-modal" role="dialog" aria-modal="true" aria-labelledby="result-title"><div className="eyebrow">{demo ? 'DEMO RUN · UNRANKED' : 'YOUR DAILY RUN'}</div><h2 id="result-title">{result.reason==='collision'?'So close.':result.reason==='lift'?'Touch lost.':result.reason==='limit'?'Perfect endurance.':'Run complete.'}</h2><div className="result-score">{result.score.toLocaleString()}<span>POINTS</span></div>{typeof result.bonus==='number'&&<p className="score-breakdown">{result.survivalScore?.toLocaleString()} survival + <span>{result.bonus.toLocaleString()} token bonus</span></p>}<div className={'verification '+result.state}><ShieldCheck size={16}/>{demo?'Practice score · Not submitted':result.state==='verified'?'Score verified':result.state==='rejected'?'Score could not be verified':'Score pending verification'}</div>{result.message&&<p className="result-message">{result.message}</p>}{!demo&&<><div className="result-stats"><div><span>Today’s rank</span><strong>{result.daily?'#'+result.daily.rank:'—'}</strong></div><div><span>Weekly best</span><strong>{result.weekly?.score.toLocaleString()??'—'}</strong></div><div><span>Weekly rank</span><strong>{result.weekly?'#'+result.weekly.rank:'—'}</strong></div></div><p className="used-message">You’ve used today’s attempt.</p><div className="result-reset"><Clock3 size={15}/> Next attempt in <strong>{resetText}</strong></div></>}{demo&&<p className="demo-result-note">No daily attempt used. Try again as often as you like.</p>}{result.state==='pending'&&<button className="text-button" onClick={()=>submitRef.current()}>Retry verification</button>}<button className="play-button" onClick={onLeaderboard}>{demo ? 'Play again' : 'View leaderboard'} {demo ? <ArrowRight size={18}/> : <Trophy size={18}/>}</button><button className="text-button" onClick={onClose}>Return home <ArrowRight size={14}/></button></section></div>}
 </div>;
}
