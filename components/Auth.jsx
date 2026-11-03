'use client';
import {useEffect,useState} from 'react';
import {sb} from '../lib/supabase';
import * as C from '../lib/crypto';
import {LS,nm} from '../lib/client';
import {Av,Brand,GIcon,IC,Ic} from './ui';

const DRIVE_SCOPE='https://www.googleapis.com/auth/drive.appdata';
async function storeRefresh(x){
  try{await fetch('/api/google/store',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+x.access_token},body:JSON.stringify({refresh_token:x.provider_refresh_token})})}catch{}
}
export {storeRefresh,DRIVE_SCOPE};

export function Auth({startUser}){
  const [msg,setMsg]=useState(''),[busy,setBusy]=useState(false),[tp,setTp]=useState(null);
  useEffect(()=>{if(startUser)sb.rpc('get_public_profile',{uname:startUser}).then(({data})=>setTp(data?.[0]||false))},[startUser]);
  const google=async()=>{
    if(!navigator.onLine)return setMsg('You are offline. Connect to the internet to sign in.');
    if(startUser)LS('nl-next','/u/'+startUser);
    const {error}=await sb.auth.signInWithOAuth({provider:'google',options:{redirectTo:window.location.origin+window.location.pathname,scopes:DRIVE_SCOPE,queryParams:{access_type:'offline'}}});
    if(error)setMsg(error.message);
  };
  const guest=async()=>{setBusy(true);const {error}=await sb.auth.signInAnonymously();if(error){setMsg(error.message);setBusy(false)}};
  return <div className="center hero"><img className="pulse" src="/logo.png" width="120" height="120" alt="NexLink.Chat logo"/>
    <h1><Brand/></h1>
    {startUser&&<div className="prowcard">{tp===null?<p className="mute">Loading profile…</p>:tp===false?<p className="mute">This profile doesn’t exist.</p>:<><Av n={tp.display_name} src={tp.avatar}/><div><b>{tp.display_name}</b><span className="mute" style={{display:'block'}}>@{tp.username}</span></div></>}</div>}
    <p className="mute">{startUser&&tp?`Sign in or continue as a guest to chat with ${tp.display_name}.`:'Private chat that only you and your friends can read.'}</p>
    {!startUser&&<div className="perks"><span>🔐 End-to-end encrypted</span><span>⏱ Temp rooms, no sign-up</span><span>🆓 Free</span></div>}
    <div className="card">
      <button className="gbtn" onClick={google}><GIcon/>Continue with Google</button>
      <p className="mute" style={{textAlign:'center'}}>or</p>
      <button className="alt" disabled={busy} onClick={guest}>{startUser?'⏱ Chat as a temporary guest':'⏱ Start a temporary chat'}</button>
      <p className="mute" style={{fontSize:13}}>{startUser?'Guests only need a nickname. Their account is deleted after 2 days.':'Temp rooms last 1 to 5 hours and only need a room code and password.'}</p>
      {msg&&<p className="err" role="alert">{msg}</p>}
    </div></div>;
}

export function GuestLink({startUser,session,onDone}){
  const [nick,setNick]=useState(''),[msg,setMsg]=useState(''),[busy,setBusy]=useState(false),[tp,setTp]=useState(null);
  useEffect(()=>{sb.rpc('get_public_profile',{uname:startUser}).then(({data})=>setTp(data?.[0]||false))},[startUser]);
  async function go(ev){
    ev.preventDefault();setBusy(true);setMsg('');
    try{
      const {error}=await sb.rpc('ensure_profile',{nick});if(error)throw error;
      const id=await C.newIdentity();
      const {error:e2}=await sb.rpc('guest_set_key',{pub:id.pub});if(e2)throw e2;
      const k=await C.loadPriv(id.priv);await C.saveKey(session.user.id,k);
      const {data}=await sb.from('profiles').select('*').eq('id',session.user.id).single();
      onDone(data,k);
    }catch(x){setMsg(x.message||'Something went wrong')}
    setBusy(false);
  }
  return <div className="center"><img className="pulse" src="/logo.png" width="90" height="90" alt=""/>
    <h1>{tp?`Chat with ${tp.display_name}`:'Chat as a guest'}</h1>
    {tp&&<div className="prowcard"><Av n={tp.display_name} src={tp.avatar}/><div><b>{tp.display_name}</b><span className="mute" style={{display:'block'}}>@{tp.username}</span></div></div>}
    <form className="card" onSubmit={go}>
      <input required maxLength={40} placeholder="Your nickname" value={nick} onChange={e=>setNick(e.target.value)}/>
      <p className="mute" style={{fontSize:13}}>Your chat is end-to-end encrypted. This guest account is deleted after 2 days.</p>
      <button disabled={busy}>{busy?'Working…':'Start chatting'}</button>
      {msg&&<p className="err" role="alert">{msg}</p>}
      <a onClick={()=>sb.auth.signOut()}>Cancel</a>
    </form></div>;
}

export function Keys({mode,session,me,done}){
  const [u,setU]=useState(''),[d,setD]=useState(session.user.user_metadata?.full_name||''),[pw,setPw]=useState(''),[msg,setMsg]=useState(''),[busy,setBusy]=useState(false);
  async function go(ev){
    ev.preventDefault();setBusy(true);setMsg('');
    try{
      if(mode==='setup'){
        const id=await C.newIdentity();
        const {data,error}=await sb.from('profiles').insert({id:session.user.id,username:u.toLowerCase(),display_name:d,public_key:id.pub}).select().single();
        if(error)throw new Error(error.code==='23505'?'That username is taken':error.message);
        const {error:e2}=await sb.from('key_backups').upsert({user_id:data.id,data:await C.sealBackup(id.priv,pw)});
        if(e2)throw e2;
        const k=await C.loadPriv(id.priv);await C.saveKey(data.id,k);done(data,k);
      }else{
        const {data,error}=await sb.from('key_backups').select('data').eq('user_id',me.id).single();
        if(error)throw error;
        let j;try{j=await C.openBackup(data.data,pw)}catch{throw new Error('Wrong passphrase')}
        const k=await C.loadPriv(j);await C.saveKey(me.id,k);done(null,k);
      }
    }catch(x){setMsg(x.message||'Something went wrong')}
    setBusy(false);
  }
  return <div className="center"><img src="/logo.png" width="90" height="90" alt=""/>
    <h1>{mode==='setup'?'Set up your keys':'Unlock this device'}</h1>
    <form className="card" onSubmit={go}>
      {mode==='setup'&&<>
        <input required placeholder="Username (a-z, 0-9, _)" pattern="[A-Za-z0-9_]{3,20}" value={u} onChange={x=>setU(x.target.value)}/>
        <input required maxLength={40} placeholder="Display name" value={d} onChange={x=>setD(x.target.value)}/></>}
      <input type="password" required minLength={8} placeholder="Key passphrase" value={pw} onChange={x=>setPw(x.target.value)}/>
      <p className="mute">{mode==='setup'?'This passphrase protects the backup of your private key so you can read your chats on a new device. If you forget it, old messages cannot be recovered.':'Enter your key passphrase to read your chats on this device.'}</p>
      <button disabled={busy}>{busy?'Working…':mode==='setup'?'Create keys':'Unlock'}</button>
      {msg&&<p className="err">{msg}</p>}
      <a onClick={()=>sb.auth.signOut()}>Sign out</a>
    </form></div>;
}

export function TempForm({needNick,onDone,onCancel}){
  const [m,setM]=useState('join'),[nick,setNick]=useState(''),[code,setCode]=useState(''),[pw,setPw]=useState(''),[h,setH]=useState(2),[t,setT]=useState(''),[msg,setMsg]=useState(''),[busy,setBusy]=useState(false);
  async function go(ev){
    ev.preventDefault();setBusy(true);setMsg('');
    try{
      const c=(m==='new'?C.roomCode():code).toUpperCase().replace(/[^A-Z0-9]/g,'');
      if(c.length<6)throw new Error('Enter the room code');
      const k=await C.tempKeys(c,pw);
      const args=m==='new'?{c,v:k.verifier,h,t:t||'Temp room',nick:nick||null}:{c,v:k.verifier,nick:nick||null};
      const {data,error}=await sb.rpc(m==='new'?'create_temp':'join_temp',args);
      if(error)throw new Error(error.message);
      if(!data)throw new Error('Wrong room code or password');
      await C.setTempKey(data,k.raw);onDone(data);
    }catch(x){setMsg(x.message||'Failed')}
    setBusy(false);
  }
  return <form className="card" onSubmit={go}>
    <div className="tabs"><button type="button" className={m==='join'?'':'alt'} onClick={()=>setM('join')}>Join room</button><button type="button" className={m==='new'?'':'alt'} onClick={()=>setM('new')}>Create room</button></div>
    {needNick&&<input required maxLength={40} placeholder="Your nickname" value={nick} onChange={e=>setNick(e.target.value)}/>}
    {m==='join'?<input required placeholder="Room code" value={code} onChange={e=>setCode(e.target.value)} autoCapitalize="characters"/>:<>
      <input maxLength={40} placeholder="Room name (optional)" value={t} onChange={e=>setT(e.target.value)}/>
      <select value={h} onChange={e=>setH(+e.target.value)} style={{width:'100%'}}>{[1,2,3,4,5].map(x=><option key={x} value={x}>Lasts {x} hour{x>1?'s':''}</option>)}</select></>}
    <input type="password" required minLength={6} placeholder="Room password" value={pw} onChange={e=>setPw(e.target.value)}/>
    <p className="mute">{m==='new'?'A room code is generated for you. Share the code and password; friends do not need accounts.':'Ask the room creator for the code and password.'}</p>
    <button disabled={busy}>{busy?'Working…':m==='new'?'Create room':'Join room'}</button>
    {msg&&<p className="err">{msg}</p>}
    {onCancel&&<a onClick={onCancel}>Cancel</a>}
  </form>;
}
