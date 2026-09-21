"use client";
import {useState} from 'react';
import {useRouter} from 'next/navigation';
import Game from '../game';

export default function DemoPage(){
 const [round,setRound]=useState(0);
 const router=useRouter();
 return <Game key={round} demo userId="" resetAt={0} onClose={()=>router.push('/')} onLeaderboard={()=>setRound(r=>r+1)}/>;
}
