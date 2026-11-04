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

let state={phase:'idle',video:false,muted:false,cam:false,mic:false,peer:'',peerAv:null,chatId:null,callId:null,startedAt:0,error:'',dur:0,remote:0,remoteVideo:false,localTs:0};
const subs=new Set();
const notify=()=>subs.forEach(f=>f(state));
export const subscribeCall=f=>{subs.add(f);f(state);return()=>subs.delete(f)};
const set=p=>{state={...state,...p};notify()};

let pc=null,local=null,remoteStream=null,remote=null,chat=null,meId=null,priv=null,memFn=null;
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
  pc=null;local=null;remoteStream=null;remote=null;iceBuf=[];pendingOffer=null;
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
  remoteStream=new MediaStream();
  // attach whatever we have; audio AND video m-lines are ALWAYS reserved so a mic/camera
  // can be attached later with replaceTrack — no renegotiation, and the peer's ontrack fires
  if(local){local.getTracks().forEach(t=>pc.addTrack(t,local))}
  if(!local||!local.getAudioTracks().length)pc.addTransceiver('audio',{direction:'sendrecv'});
  pc.addTransceiver('video',{direction:'sendrecv'});
  pc.ontrack=e=>{
    try{remoteStream.addTrack(e.track)}catch{}
    // replaceTrack-added tracks may not carry a stream id — fire on unmute too
    e.track.onunmute=()=>set({remote:Date.now(),remoteVideo:remoteStream.getVideoTracks().some(t=>t.readyState==='live')});
    remote=remoteStream;
    set({remote:Date.now(),remoteVideo:remoteStream.getVideoTracks().some(t=>t.readyState==='live'&&t.muted===false)||state.remoteVideo});
  };
  pc.onicecandidate=e=>{if(e.candidate)send('ice',{candidate:e.candidate.candidate,mid:e.candidate.sdpMid,ml:e.candidate.sdpMLineIndex}).catch(()=>{})};
  pc.onconnectionstatechange=onConnState;
}
// mic/camera may be missing or blocked: never block the call on it — connect receive-only,
// and the user can attach a mic/camera afterwards (speaker always works).
async function getMedia(video){
  try{
    const s=await navigator.mediaDevices.getUserMedia({audio:true,video:video?{width:640,height:480,frameRate:24}:false});
    return {stream:s,mic:s.getAudioTracks().length>0,cam:s.getVideoTracks().length>0};
  }catch{
    if(video){try{const s=await navigator.mediaDevices.getUserMedia({video:true});return {stream:s,mic:false,cam:true}}catch{}}
    return {stream:null,mic:false,cam:false};
  }
}
async function handleSig(chatId,blob){
  if(!priv||!meId)return;
  let p;try{p=await C.decryptMessage({wraps:blob.wraps,iv:blob.iv,ciphertext:blob.ciphertext,chat_id:chatId},meId,priv)}catch{return}
  if(!p)return;
  if(p.t==='offer'){
    if(state.phase!=='idle'){sendTo(chatId,'busy',{callId:p.callId}).catch(()=>{});return}
    pendingOffer={chatId,offer:p.sdp,video:p.video,from:p.from};
    iAmCaller=false;
    set({phase:'ringing-in',video:p.video,peer:p.fromName,peerAv:p.fromAv||null,chatId,callId:p.callId,error:'',remoteVideo:false});
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
  }else if(p.t==='decline'){
    if(iAmCaller)emit({type:'missed',video:state.video,chatId:state.chatId});
    cleanup();
    set({phase:'idle',chatId:null,callId:null,peer:'',dur:0,startedAt:0});
  }else if(p.t==='end'){
    if(iAmCaller)emit(state.phase==='active'?{type:'calllog',video:state.video,dur:state.dur,chatId:state.chatId}:{type:'missed',video:state.video,chatId:state.chatId});
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
// call-end events so the chat can leave a trace ("Missed call" / "Voice call · 1:23").
// Only the CALLER posts, so both sides never duplicate the log.
let iAmCaller=false;
const evSubs=new Set();
export const onCallEvent=f=>{evSubs.add(f);return()=>evSubs.delete(f)};
const emit=e=>evSubs.forEach(f=>f(e));
export async function startCall(chatObj,video,myName,myAv,peerName,peerAv){
  if(state.phase!=='idle')return;
  chat=chatObj;
  iAmCaller=true;
  const callId=crypto.randomUUID();
  // myName/myAv travel in the offer (the callee rings with them); peerName/peerAv is what the caller sees
  set({phase:'ringing-out',video,peer:peerName||'',peerAv:peerAv||null,chatId:chatObj.id,callId,error:'',dur:0,startedAt:0,muted:false,remoteVideo:false});
  try{
    const md=await getMedia(video);
    local=md.stream;
    set({mic:md.mic,cam:md.cam});
    makePC();
    const offer=await pc.createOffer();
    await pc.setLocalDescription(offer);
    await sendTo(chatObj.id,'offer',{sdp:offer.sdp,video,from:meId,fromName:myName,fromAv:myAv||null});
    clearTimeout(ringTimer);ringTimer=setTimeout(()=>{if(state.phase==='ringing-out'){emit({type:'missed',video,chatId:chatObj.id});fail('No answer')}},45000);
  }catch(x){
    cleanup();
    set({phase:'idle',chatId:null,callId:null,peer:'',error:x.message||'Call failed to start'});
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
    const md=await getMedia(o.video);
    local=md.stream;
    set({mic:md.mic,cam:md.cam});
    makePC();
    await pc.setRemoteDescription({type:'offer',sdp:o.offer});
    const ans=await pc.createAnswer();
    await pc.setLocalDescription(ans);
    // the caller's ICE candidates that arrived while we were ringing
    for(const c of iceBuf.splice(0))try{await pc.addIceCandidate(c)}catch{}
    set({muted:false});
    await send('answer',{sdp:ans.sdp});
  }catch(x){
    fail(x.message||'Call failed to connect');
  }
}
export async function declineCall(){
  const c=chat?.id,cid=state.callId;
  cleanup();
  if(c&&cid)sendTo(c,'decline',{callId:cid}).catch(()=>{});
  set({phase:'idle',chatId:null,callId:null,peer:''});
}
export async function endCall(){
  const wasActive=state.phase==='active',c=chat?.id,cid=state.callId;
  if(iAmCaller&&wasActive)emit({type:'calllog',video:state.video,dur:state.dur,chatId:state.chatId});
  else if(iAmCaller&&!wasActive&&state.phase!=='idle')emit({type:'missed',video:state.video,chatId:state.chatId});
  cleanup();
  if(c&&cid)sendTo(c,'end',{callId:cid}).catch(()=>{});
  set({phase:'idle',chatId:null,callId:null,peer:'',dur:0,startedAt:0});
}
export function toggleMute(){const v=!state.muted;local?.getAudioTracks().forEach(t=>t.enabled=!v);set({muted:v})}
// Mic/camera buttons are dual-purpose: add the device if missing (no renegotiation — replaceTrack
// into the reserved sendrecv transceiver), otherwise mute/unmute or turn the camera on/off.
export async function enableMic(){
  if(state.mic){toggleMute();return}
  try{
    const s=await navigator.mediaDevices.getUserMedia({audio:true});
    const t=s.getAudioTracks()[0];if(!t)throw 0;
    if(!local)local=s;else s.getAudioTracks().forEach(x=>{try{local.addTrack(x)}catch{}});
    const sender=pc?.getSenders().find(x=>!x.track||x.track.kind==='audio');
    if(sender)await sender.replaceTrack(t);else pc?.addTrack(t,local);
    t.enabled=!state.muted&&true; // start unmuted
    set({mic:true,muted:false});
  }catch{set({error:'Microphone unavailable'})}
}
export async function enableCam(){
  if(state.cam){const v=!state.cam;local?.getVideoTracks().forEach(t=>t.enabled=v);set({cam:v});return}
  try{
    const s=await navigator.mediaDevices.getUserMedia({video:{width:640,height:480,frameRate:24}});
    const t=s.getVideoTracks()[0];if(!t)throw 0;
    if(!local)local=s;else s.getVideoTracks().forEach(x=>{try{local.addTrack(x)}catch{}});
    const sender=pc?.getSenders().find(x=>(!x.track||x.track.kind==='video'));
    if(sender)await sender.replaceTrack(t);else pc?.addTrack(t,local);
    set({cam:true,localTs:Date.now()});
  }catch{set({error:'Camera unavailable'})}
}
export function clearError(){set({error:''})}
export const getRemote=()=>remote,getLocal=()=>local;
