// 1:1 voice/video calls over WebRTC (DTLS-encrypted media = end-to-end by design).
// Signaling rides the per-chat Realtime broadcast channel (chat:<uuid>, unguessable) and every
// payload is encrypted with the chat's E2EE key wrapping (same as message bodies), so SDP/IP
// metadata never reaches the server or an eavesdropper in plaintext.
// ICE: Google STUN + free OpenRelay TURN fallback (strict NATs), or bring your own via
// NEXT_PUBLIC_TURN_URL / NEXT_PUBLIC_TURN_USER / NEXT_PUBLIC_TURN_CRED.
import * as P from './presence';
import * as C from './crypto';

const ICE_SERVERS=[{urls:['stun:stun.l.google.com:19302','stun:stun1.l.google.com:19302']}];
const TURN_URL=process.env.NEXT_PUBLIC_TURN_URL;
if(TURN_URL){
  ICE_SERVERS.push({urls:TURN_URL,username:process.env.NEXT_PUBLIC_TURN_USER,credential:process.env.NEXT_PUBLIC_TURN_CRED});
}else{
  // free community TURN relay (OpenRelay Project) so calls work across mobile data / strict NATs
  ICE_SERVERS.push(
    {urls:'turn:openrelay.metered.ca:80',username:'openrelayproject',credential:'openrelayproject'},
    {urls:'turn:openrelay.metered.ca:443',username:'openrelayproject',credential:'openrelayproject'},
    {urls:'turn:openrelay.metered.ca:443?transport=tcp',username:'openrelayproject',credential:'openrelayproject'});
}

let state={phase:'idle',video:false,muted:false,cam:false,peer:'',chatId:null,callId:null,startedAt:0,error:'',dur:0,remote:0};
const subs=new Set();
const notify=()=>subs.forEach(f=>f(state));
export const subscribeCall=f=>{subs.add(f);f(state);return()=>subs.delete(f)};
const set=p=>{state={...state,...p};notify()};

let pc=null,local=null,remote=null,chat=null,meId=null,priv=null,memFn=null;
let iceBuf=[];        // remote candidates that arrive before they can be applied (both sides)
let pendingOffer=null;
let connWatch=null;   // 'disconnected' grace timer
let durIv=null,ringTimer=null;

function wire(){
  if(wire.done)return;wire.done=true;
  P.onChatEventAny((chatId,payload)=>{handleSig(chatId,payload).catch(()=>{})});
}
function stopTimers(){
  if(connWatch){clearTimeout(connWatch);connWatch=null}
  if(durIv){clearInterval(durIv);durIv=null}
  if(ringTimer){clearTimeout(ringTimer);ringTimer=null}
}
function cleanup(){
  try{pc&&pc.close()}catch{}
  try{local?.getTracks().forEach(t=>t.stop())}catch{}
  stopTimers();
  pc=null;local=null;remote=null;iceBuf=[];pendingOffer=null;
}
async function sendTo(chatId,kind,extra){
  const members=memFn?.(chatId)||[];
  const blob=await C.encryptMessage({t:kind,callId:state.callId,...extra},members,chatId);
  P.sendChatEvent(chatId,'call',blob);
}
const send=(kind,extra)=>sendTo(chat.id,kind,extra);

async function applyIce(p){
  const cand={candidate:p.candidate,sdpMid:p.mid,sdpMLineIndex:p.ml};
  if(!pc||!pc.remoteDescription){iceBuf.push(cand);return} // early candidates: apply after remote description
  try{await pc.addIceCandidate(cand)}catch{}
}
function fail(msg){
  const c=chat?.id,cid=state.callId;
  cleanup();
  set({phase:'idle',chatId:null,callId:null,peer:'',dur:0,startedAt:0,error:msg});
  if(c&&cid)sendTo(c,'end',{callId:cid}).catch(()=>{});
}
function onConnState(){
  const s=pc?.connectionState;
  if(s==='connected'){
    if(connWatch){clearTimeout(connWatch);connWatch=null}
    if(state.phase!=='active'){
      set({phase:'active',startedAt:Date.now()});
      durIv=setInterval(()=>set({dur:Math.floor((Date.now()-state.startedAt)/1000)}),1000);
    }
  }else if(s==='disconnected'){
    // brief hiccups recover on their own; only give up if it stays broken
    if(!connWatch)connWatch=setTimeout(()=>{if(pc?.connectionState==='disconnected')fail('Connection lost')},6000);
  }else if(s==='failed'){fail('Call failed')}
}
function makePC(){
  pc=new RTCPeerConnection({iceServers:ICE_SERVERS});
  local.getTracks().forEach(t=>pc.addTrack(t,local));
  pc.ontrack=e=>{remote=e.streams[0];set({remote:Date.now()})};
  pc.onicecandidate=e=>{if(e.candidate)send('ice',{candidate:e.candidate.candidate,mid:e.candidate.sdpMid,ml:e.candidate.sdpMLineIndex}).catch(()=>{})};
  pc.onconnectionstatechange=onConnState;
}
async function handleSig(chatId,blob){
  if(!priv||!meId)return;
  let p;try{p=await C.decryptMessage({wraps:blob.wraps,iv:blob.iv,ciphertext:blob.ciphertext,chat_id:chatId},meId,priv)}catch{return}
  if(!p)return;
  if(p.t==='offer'){
    if(state.phase!=='idle'){sendTo(chatId,'busy',{callId:p.callId}).catch(()=>{});return}
    pendingOffer={chatId,offer:p.sdp,video:p.video,from:p.from};
    set({phase:'ringing-in',video:p.video,peer:p.fromName,chatId,callId:p.callId,error:''});
    clearTimeout(ringTimer);ringTimer=setTimeout(()=>{if(state.phase==='ringing-in')declineCall()},45000);
    return;
  }
  // every other event must belong to the call we are part of
  if(state.callId&&p.callId!==state.callId)return;
  if(p.t==='answer'&&pc&&pc.signalingState!=='stable'){
    await pc.setRemoteDescription({type:'answer',sdp:p.sdp});
    for(const c of iceBuf.splice(0))try{await pc.addIceCandidate(c)}catch{}
    set({phase:'connecting'});
  }else if(p.t==='ice'){
    await applyIce(p);
  }else if(p.t==='end'||p.t==='decline'){
    cleanup();
    set({phase:'idle',chatId:null,callId:null,peer:'',dur:0,startedAt:0});
  }else if(p.t==='busy'){
    cleanup();
    set({phase:'idle',chatId:null,callId:null,peer:'',dur:0,startedAt:0,error:'Busy'});
  }
}

export function initCall(me,privKey,membersFn){
  meId=me.id;priv=privKey;memFn=membersFn;wire();
}
export async function startCall(chatObj,video,peerName){
  if(state.phase!=='idle')return;
  chat=chatObj;
  const callId=crypto.randomUUID();
  set({phase:'ringing-out',video,peer:peerName,chatId:chatObj.id,callId,error:'',dur:0,startedAt:0});
  try{
    local=await navigator.mediaDevices.getUserMedia({audio:true,video:video?{width:640,height:480,frameRate:24}:false});
    makePC();
    const offer=await pc.createOffer();
    await pc.setLocalDescription(offer);
    set({muted:false,cam:video});
    await sendTo(chatObj.id,'offer',{sdp:offer.sdp,video,from:meId,fromName:peerName});
    clearTimeout(ringTimer);ringTimer=setTimeout(()=>{if(state.phase==='ringing-out')fail('No answer')},45000);
  }catch(x){
    cleanup();
    set({phase:'idle',chatId:null,callId:null,peer:'',error:x.message||'Microphone/camera unavailable'});
  }
}
export async function acceptCall(){
  const o=pendingOffer;
  if(!o||state.phase!=='ringing-in')return;
  clearTimeout(ringTimer);
  pendingOffer=null;
  chat={id:o.chatId};
  set({phase:'connecting',video:o.video});
  try{
    local=await navigator.mediaDevices.getUserMedia({audio:true,video:o.video?{width:640,height:480,frameRate:24}:false});
    makePC();
    await pc.setRemoteDescription({type:'offer',sdp:o.offer});
    const ans=await pc.createAnswer();
    await pc.setLocalDescription(ans);
    // the caller's ICE candidates that arrived while we were ringing
    for(const c of iceBuf.splice(0))try{await pc.addIceCandidate(c)}catch{}
    set({muted:false,cam:o.video});
    await send('answer',{sdp:ans.sdp});
  }catch(x){
    fail(x.message||'Microphone/camera unavailable');
  }
}
export async function declineCall(){
  const c=chat?.id,cid=state.callId;
  cleanup();
  if(c&&cid)sendTo(c,'decline',{callId:cid}).catch(()=>{});
  set({phase:'idle',chatId:null,callId:null,peer:''});
}
export async function endCall(){
  const c=chat?.id,cid=state.callId;
  cleanup();
  if(c&&cid)sendTo(c,'end',{callId:cid}).catch(()=>{});
  set({phase:'idle',chatId:null,callId:null,peer:'',dur:0,startedAt:0});
}
export function toggleMute(){const v=!state.muted;local?.getAudioTracks().forEach(t=>t.enabled=!v);set({muted:v})}
export function toggleCam(){const v=!state.cam;local?.getVideoTracks().forEach(t=>t.enabled=v);set({cam:v})}
export function clearError(){set({error:''})}
export const getRemote=()=>remote,getLocal=()=>local;
