// 1:1 voice/video calls over WebRTC (DTLS-encrypted media = end-to-end by design).
// Signaling rides the per-chat Realtime broadcast channel (chat:<uuid>, unguessable) and every
// payload is encrypted with the chat's E2EE key wrapping (same as message bodies), so SDP/IP
// metadata never reaches the server or an eavesdropper in plaintext.
// STUN only: strict NATs may fail; add TURN servers via NEXT_PUBLIC_TURN_URL/USER/CRED envs.
import * as P from './presence';
import * as C from './crypto';

const ICE=({iceServers:[
  {urls:['stun:stun.l.google.com:19302','stun:stun1.l.google.com:19302']},
  ...(process.env.NEXT_PUBLIC_TURN_URL?[{urls:process.env.NEXT_PUBLIC_TURN_URL,username:process.env.NEXT_PUBLIC_TURN_USER,credential:process.env.NEXT_PUBLIC_TURN_CRED}]:[]),
]});

let state={phase:'idle',video:false,muted:false,cam:false,peer:'',chatId:null,callId:null,startedAt:0,error:'',dur:0};
const subs=new Set();
const notify=()=>subs.forEach(f=>f(state));
export const subscribeCall=f=>{subs.add(f);f(state);return()=>subs.delete(f)};
const set=p=>{state={...state,...p};notify()};

let pc=null,local=null,remote=null,chat=null,meId=null,priv=null,memFn=null,iceBuf=[],pendingOffer=null,unsub=null,iv=null;

function wire(){
  // listen for encrypted 'call' broadcasts on every joined chat channel
  if(unsub)unsub();
  unsub=P.onChatEventAny((chatId,payload)=>{
    handleSig(chatId,payload).catch(()=>{});
  });
}
function cleanup(){
  try{pc&&pc.close()}catch{}
  try{local?.getTracks().forEach(t=>t.stop())}catch{}
  try{remote?.getTracks().forEach(t=>t.stop())}catch{}
  if(iv){clearInterval(iv);iv=null}
  pc=null;local=null;remote=null;iceBuf=[];pendingOffer=null;
}
async function send(kind,extra){
  const members=memFn?.(chat.id)||[];
  const blob=await C.encryptMessage({t:kind,callId:state.callId,...extra},members,chat.id);
  P.sendChatEvent(chat.id,'call',blob);
}
async function handleSig(chatId,blob){
  if(!priv||!meId)return;
  let p;try{p=await C.decryptMessage({wraps:blob.wraps,iv:blob.iv,ciphertext:blob.ciphertext,chat_id:chatId},meId,priv)}catch{return}
  if(!p)return;
  if(state.callId&&p.callId!==state.callId)return; // some other call's traffic
  if(p.t==='offer'){
    if(state.phase!=='idle'){await send('busy',{callId:p.callId});return}
    pendingOffer={chatId,offer:p.sdp,video:p.video,from:p.from};
    set({phase:'ringing-in',video:p.video,peer:p.fromName,chatId,callId:p.callId,error:''});
  }else if(p.t==='answer'&&pc){
    await pc.setRemoteDescription({type:'answer',sdp:p.sdp});
    for(const c of iceBuf)try{await pc.addIceCandidate(c)}catch{}
    iceBuf=[];
    set({phase:'connecting'});
  }else if(p.t==='ice'&&pc){
    const c={candidate:p.candidate,sdpMid:p.mid,sdpMLineIndex:p.ml};
    if(pc.remoteDescription)try{await pc.addIceCandidate(c)}catch{}
    else iceBuf.push(c);
  }else if(p.t==='end'||p.t==='busy'||p.t==='decline'){
    cleanup();
    set({phase:'idle',chatId:null,callId:null,peer:'',error:p.t==='busy'?'Busy':''});
  }
}

export function initCall(me,privKey,membersFn){
  meId=me.id;priv=privKey;memFn=membersFn;wire();
}
export async function startCall(chatObj,video,fromName){
  if(state.phase!=='idle')return set({error:'Already in a call'});
  chat=chatObj;pendingOffer=null;
  const callId=crypto.randomUUID();
  set({phase:'ringing-out',video,peer:fromName,chatId:chatObj.id,callId,error:''});
  try{
    local=await navigator.mediaDevices.getUserMedia({audio:true,video:video?{width:640,height:480,frameRate:24}:false});
    pc=new RTCPeerConnection(ICE);
    local.getTracks().forEach(t=>pc.addTrack(t,local));
    pc.ontrack=e=>{remote=e.streams[0];set({remote:Date.now()})};
    pc.onicecandidate=e=>{if(e.candidate)send('ice',{candidate:e.candidate.candidate,mid:e.candidate.sdpMid,ml:e.candidate.sdpMLineIndex}).catch(()=>{})};
    pc.onconnectionstatechange=()=>{
      if(pc?.connectionState==='connected'){set({phase:'active',startedAt:Date.now(),cam:video});iv=setInterval(()=>set({dur:Math.floor((Date.now()-state.startedAt)/1000)}),1000)}
      else if(['failed','disconnected','closed'].includes(pc?.connectionState)){endCall(true)}
    };
    const offer=await pc.createOffer();
    await pc.setLocalDescription(offer);
    set({muted:false,cam:video});
    await send('offer',{sdp:offer.sdp,video,from:meId,fromName});
  }catch(x){
    cleanup();set({phase:'idle',chatId:null,callId:null,error:x.message||'Camera/microphone unavailable'});
  }
}
export async function acceptCall(){
  if(!pendingOffer||state.phase!=='ringing-in')return;
  const o=pendingOffer;pendingOffer=null;
  chat={id:o.chatId};set({phase:'connecting',video:o.video});
  try{
    local=await navigator.mediaDevices.getUserMedia({audio:true,video:o.video?{width:640,height:480,frameRate:24}:false});
    pc=new RTCPeerConnection(ICE);
    local.getTracks().forEach(t=>pc.addTrack(t,local));
    pc.ontrack=e=>{remote=e.streams[0];set({remote:Date.now()})};
    pc.onicecandidate=e=>{if(e.candidate)send('ice',{candidate:e.candidate.candidate,mid:e.candidate.sdpMid,ml:e.candidate.sdpMLineIndex}).catch(()=>{})};
    pc.onconnectionstatechange=()=>{
      if(pc?.connectionState==='connected'){set({phase:'active',startedAt:Date.now(),cam:o.video});iv=setInterval(()=>set({dur:Math.floor((Date.now()-state.startedAt)/1000)}),1000)}
      else if(['failed','disconnected','closed'].includes(pc?.connectionState)){endCall(true)}
    };
    await pc.setRemoteDescription({type:'offer',sdp:o.offer});
    const ans=await pc.createAnswer();
    await pc.setLocalDescription(ans);
    set({muted:false,cam:o.video});
    await send('answer',{sdp:ans.sdp});
  }catch(x){
    await send('end').catch(()=>{});cleanup();
    set({phase:'idle',chatId:null,callId:null,peer:'',error:x.message||'Camera/microphone unavailable'});
  }
}
export async function declineCall(){await send('decline').catch(()=>{});cleanup();set({phase:'idle',chatId:null,callId:null,peer:''})}
export async function endCall(silent){
  if(state.phase!=='idle')await send('end').catch(()=>{});
  cleanup();
  set({phase:'idle',chatId:null,callId:null,peer:'',dur:0,error:silent?'Call failed':'',startedAt:0});
}
export function toggleMute(){const v=!state.muted;local?.getAudioTracks().forEach(t=>t.enabled=!v);set({muted:v})}
export function toggleCam(){const v=!state.cam;local?.getVideoTracks().forEach(t=>t.enabled=v);set({cam:v})}
export const getRemote=()=>remote,getLocal=()=>local;
