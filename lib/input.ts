import type {Point} from './engine.ts';
type Sample=Point&{time:number};
// Timestamped input avoids frame-rate-dependent jumps when a frame contains
// multiple physics ticks. Rendering still uses the latest finger position.
export class InputTimeline {
 private samples:Sample[]=[];
 reset(point:Point,time:number){this.samples=[{...point,time}];}
 push(point:Point,time:number){const last=this.samples.at(-1);if(!last||time>=last.time)this.samples.push({...point,time});}
 sample(time:number):Point{
  while(this.samples.length>1&&this.samples[1].time<=time)this.samples.shift();
  const a=this.samples[0],b=this.samples[1];if(!a)return {x:180,y:540};
  const q=b?Math.max(0,Math.min(1,(time-a.time)/(b.time-a.time||1))):0;
  return {x:Math.round((a.x+(b?b.x-a.x:0)*q)*4)/4,y:Math.round((a.y+(b?b.y-a.y:0)*q)*4)/4};
 }
}
