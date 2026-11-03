// Typing indicators + presence. Broadcast events ride Supabase Realtime channels
// (no DB writes, no postgres_changes quota). Channel names are the unguessable chat UUID,
// and payloads carry ids only — no content.
import {sb} from './supabase';

const chans=new Map(); // chatId -> {ch, users:Set<number>}
const anyCbs=new Set(); // listeners for arbitrary broadcast events (e.g. call signaling)
let myUid=null;

function chanFor(chatId){
  let c=chans.get(chatId);
  if(!c){const ch=sb.channel('chat:'+chatId,{config:{broadcast:{self:false}}})
    .on('broadcast',{event:'typing'},({payload})=>{
      const u=chans.get(chatId);if(!u)return;
      if(payload.stop)u.users.delete(payload.uid);else{u.users.add(payload.uid);u.touched=Date.now()}
      u.notify?.();
    })
    .on('broadcast',{event:'call'},({payload})=>{anyCbs.forEach(f=>f(chatId,payload))})
    .subscribe(status=>{if(status==='CHANNEL_ERROR'||status==='TIMED_OUT'){/* retried by supabase-js */}});
    c={ch,users:new Set(),notify:null,touched:0};chans.set(chatId,c)}
  return c;
}
// generic broadcast plumbing (used by calls): returns an unsubscribe function
export function onChatEventAny(cb){anyCbs.add(cb);return()=>anyCbs.delete(cb)}
export function sendChatEvent(chatId,event,payload){chanFor(chatId).ch.send({type:'broadcast',event,payload}).catch(()=>{})}
export function watchTyping(chatId,cb){
  const c=chanFor(chatId);c.notify=cb;cb();
  return()=>{if(chans.get(chatId)===c)c.notify=null};
}
export function leaveTyping(chatId){
  const c=chans.get(chatId);if(!c)return;
  sb.removeChannel(c.ch);chans.delete(chatId);
}
let lastSent=0;
export function sendTyping(chatId,uid){
  myUid=uid;const now=Date.now();if(now-lastSent<2000)return;lastSent=now;
  chanFor(chatId).ch.send({type:'broadcast',event:'typing',payload:{uid}}).catch(()=>{});
}
export function stopTyping(chatId,uid){
  const c=chans.get(chatId);if(!c)return;
  c.ch.send({type:'broadcast',event:'typing',payload:{uid,stop:true}}).catch(()=>{});
}
export function typingUsers(chatId){const c=chans.get(chatId);return c?c.users:new Set()}
// stale entries self-clean: only entries touched in the last 4s count as "typing"
export function typingNow(chatId){
  const c=chans.get(chatId);if(!c||!c.touched||Date.now()-c.touched>4000)return false;
  return c.users.size>0;
}

// ---- last seen (server metadata; respects the user's show_online setting) ----
let lastTouch=0;
export function touchPresence(){
  const now=Date.now();if(now-lastTouch<55000)return;lastTouch=now;
  sb.rpc('touch_presence').catch(()=>{});
}
export function seenLabel(p,now=Date.now()){
  if(!p||p.show_online==='nobody')return null;
  if(!p.last_seen)return null;
  const d=now-new Date(p.last_seen).getTime();
  if(d<65000)return 'online';
  if(d<3600000)return 'last seen '+Math.max(1,Math.round(d/60000))+'m ago';
  if(d<86400000)return 'last seen '+Math.max(1,Math.round(d/3600000))+'h ago';
  return 'last seen a while ago';
}
export function isOnline(p,now=Date.now()){
  return p&&p.show_online!=='nobody'&&p.last_seen&&now-new Date(p.last_seen).getTime()<65000;
}
