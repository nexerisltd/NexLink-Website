'use client';
import {useEffect,useRef,useState} from 'react';
import * as K from '../lib/calls';
import {Av,IC,Ic} from './ui';

// Full-screen call overlay driven by lib/calls.js state (WebRTC, encrypted signaling).
// The remote media element is ALWAYS mounted — a voice call still needs to play audio.
// Missing mic/camera never blocks the call: connect listen-only, add devices afterwards.
export default function CallOverlay(){
  const [st,setSt]=useState({phase:'idle'});
  const localV=useRef(null),remoteV=useRef(null);
  useEffect(()=>K.subscribeCall(s=>setSt({...s})),[]);
  useEffect(()=>{
    if(st.phase==='idle')return;
    const r=K.getRemote(),l=K.getLocal();
    if(remoteV.current&&r&&remoteV.current.srcObject!==r){remoteV.current.srcObject=r;remoteV.current.play?.().catch(()=>{})}
    if(localV.current&&l&&localV.current.srcObject!==l)localV.current.srcObject=l;
  },[st.phase,st.remote,st.localTs]);
  if(st.phase==='idle'&&st.error)return <div className="calerr" role="alert"><span>{st.error}</span><button onClick={()=>K.clearError()}>OK</button></div>;
  if(st.phase==='idle')return null;
  const dur=st.dur?`${Math.floor(st.dur/60)}:${String(st.dur%60).padStart(2,'0')}`:'';
  const active=st.phase==='active';
  const showVid=(st.video||st.remoteVideo)&&active;
  const ringing=st.phase==='ringing-in'||st.phase==='ringing-out';
  return <div className={'callov'+(showVid?' vid':'')+(ringing?' ring':'')}>
    {/* remote stream: visible in video calls, invisible (but playing) in voice calls */}
    <video ref={remoteV} autoPlay playsInline className={showVid?'remvid':'remaudio'}/>
    <div className="calmin">
      <div className="calavaw"><Av n={st.peer} src={st.peerAv}/></div>
      <b>{st.peer}</b>
      <span className="mute">{st.phase==='ringing-out'?'Calling…':st.phase==='ringing-in'?'Incoming call…':st.phase==='connecting'?'Connecting…':dur}</span>
      {st.error&&<span className="err">{st.error}</span>}
      {active&&!st.mic&&<span className="calbadge">🎤 No mic — listen only<button className="caladd" onClick={()=>K.enableMic()}>Add mic</button></span>}
      {active&&!st.cam&&<span className="calbadge">📷 No camera<button className="caladd" onClick={()=>K.enableCam()}>Add camera</button></span>}
    </div>
    {st.cam&&active&&<video ref={localV} autoPlay playsInline muted className="locvid"/>}
    <div className="calbtns">
      {st.phase==='ringing-in'?<>
        <button className="calb decline" aria-label="Decline" onClick={()=>K.declineCall()}><Ic d={IC.phoneOff}/></button>
        <button className="calb accept" aria-label="Accept" onClick={()=>K.acceptCall()}><Ic d={st.video?IC.video:IC.phone}/></button>
      </>:<>
        <button className="calb" aria-label={!st.mic?'Add microphone':st.muted?'Unmute':'Mute'} title={!st.mic?'Add microphone':st.muted?'Unmute':'Mute'} onClick={()=>K.enableMic()}>
          <Ic d={!st.mic||st.muted?IC.micOff:IC.mic}/></button>
        <button className="calb" aria-label={!st.cam?'Add camera':st.cam?'Camera off':'Camera on'} title={!st.cam?'Add camera':st.cam?'Camera off':'Camera on'} onClick={()=>K.enableCam()}>
          <Ic d={!st.cam?IC.video:IC.camOff}/></button>
        <button className="calb decline" aria-label="End call" onClick={()=>K.endCall()}><Ic d={IC.phoneOff}/></button>
      </>}</div>
  </div>;
}
