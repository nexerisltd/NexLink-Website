'use client';
import {useEffect,useRef,useState,useCallback} from 'react';
import {sb} from '../lib/supabase';
import * as C from '../lib/crypto';

const nm=p=>p?.display_name||'?';
const hue=n=>[...(n||'?')].reduce((a,c)=>a+c.charCodeAt(0),0)*47%360;
const Av=({n})=><div className="av" style={{background:`linear-gradient(135deg,hsl(${hue(n)} 80% 55%),hsl(${(hue(n)+50)%360} 75% 40%))`}}>{(n||'?')[0].toUpperCase()}</div>;
const Brand=()=><span className="brand">NexLink<em>.Chat</em></span>;
const GIcon=()=><svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.2C12.4 13.6 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.6 5.9c4.4-4.1 7-10.1 7-17.6z"/><path fill="#FBBC05" d="M10.5 28.6c-.5-1.5-.8-3-.8-4.6s.3-3.1.8-4.6l-7.9-6.2C.9 16.4 0 20.1 0 24s.9 7.6 2.6 10.8l7.9-6.2z"/><path fill="#34A853" d="M24 48c6.5 0 12-2.1 16-5.8l-7.6-5.9c-2.1 1.4-4.9 2.3-8.4 2.3-6.3 0-11.600-4.100-13.500-9.800l-7.900 6.200C6.500 42.600 14.600 48 24 48z"/></svg>;
function toggleTheme(){const el=document.documentElement;const dark=(el.dataset.theme||(matchMedia('(prefers-color-scheme: light)').matches?'light':'dark'))==='dark';const n=dark?'light':'dark';el.dataset.theme=n;try{localStorage.setItem('nl-theme',n)}catch{}}
const Splash=({t})=><div className="center"><img className="pulse" src="/logo.png" width="96" height="96" alt=""/><p className="mute">{t||'Loading…'}</p></div>;

export default function App(){
  const [s,setS]=useState(undefined);
  useEffect(()=>{try{const t=localStorage.getItem('nl-theme');if(t)document.documentElement.dataset.theme=t}catch{}},[]);
  useEffect(()=>{
    sb.auth.getSession().then(({data})=>setS(data.session));
    const {data}=sb.auth.onAuthStateChange((_e,x)=>setS(x));
    if('serviceWorker' in navigator)navigator.serviceWorker.register('/sw.js').catch(()=>{});
    return()=>data.subscription.unsubscribe();
  },[]);
  if(s===undefined)return <Splash/>;
  return s?<Gate session={s}/>:<Auth/>;
}

function Auth(){
  const [msg,setMsg]=useState(''),[busy,setBusy]=useState(false);
  const google=async()=>{const {error}=await sb.auth.signInWithOAuth({provider:'google',options:{redirectTo:window.location.origin}});if(error)setMsg(error.message)};
  const guest=async()=>{setBusy(true);const {error}=await sb.auth.signInAnonymously();if(error){setMsg(error.message);setBusy(false)}};
  return <div className="center hero"><img className="pulse" src="/logo.png" width="120" height="120" alt="NexLink.Chat logo"/>
    <h1><Brand/></h1><p className="mute">Private chat that only you and your friends can read.</p>
    <div className="perks"><span>🔐 End-to-end encrypted</span><span>⏱ Temp rooms, no sign-up</span><span>🆓 Free</span></div>
    <div className="card">
      <button className="gbtn" onClick={google}><GIcon/>Continue with Google</button>
      <p className="mute" style={{textAlign:'center'}}>or</p>
      <button className="alt" disabled={busy} onClick={guest}>⏱ Start a temporary chat</button>
      <p className="mute" style={{fontSize:13}}>Temp rooms last 1 to 5 hours and only need a room code and password.</p>
      {msg&&<p className="err" role="alert">{msg}</p>}
    </div></div>;
}

function Gate({session}){
  const anon=session.user.is_anonymous;
  const [st,setSt]=useState('load'),[me,setMe]=useState(null),[priv,setPriv]=useState(null),[first,setFirst]=useState(null);
  useEffect(()=>{(async()=>{
    const {data:pr}=await sb.from('profiles').select('*').eq('id',session.user.id).maybeSingle();
    if(!pr)return setSt(anon?'guest':'setup');
    setMe(pr);
    if(pr.is_guest)return setSt('ready');
    const k=await C.getKey(pr.id);
    if(k){setPriv(k);setSt('ready')}else setSt('restore');
  })()},[session.user.id,anon]);
  if(st==='load')return <Splash/>;
  if(st==='guest')return <div className="center"><img src="/logo.png" width="90" height="90" alt=""/><h1>Temporary chat</h1>
    <TempForm needNick onCancel={()=>sb.auth.signOut()} onDone={async id=>{const {data}=await sb.from('profiles').select('*').eq('id',session.user.id).single();setMe(data);setFirst(id);setSt('ready')}}/></div>;
  if(st==='ready')return <Chat me={me} priv={priv} first={first}/>;
  return <Keys mode={st} session={session} me={me} done={(m,k)=>{if(m)setMe(m);setPriv(k);setSt('ready')}}/>;
}

function Keys({mode,session,me,done}){
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

function TempForm({needNick,onDone,onCancel}){
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

function Chat({me,priv,first}){
  const [chats,setChats]=useState([]),[mem,setMem]=useState({}),[msgs,setMsgs]=useState({}),[aid,setAid]=useState(null),[unread,setUn]=useState({});
  const [q,setQ]=useState(''),[hits,setHits]=useState([]),[txt,setTxt]=useState(''),[modal,setModal]=useState(null),[side,setSide]=useState(true),[live,setLive]=useState(true);
  const plain=useRef(new Map()),aidR=useRef(null),endR=useRef(null);
  aidR.current=aid;
  const [ver,setVer]=useState(0),[now,setNow]=useState(Date.now()),[unlock,setUnlock]=useState(''),[keyed,setKeyed]=useState(true);
  const [tab,setTab]=useState('all'),[toast,setToast]=useState(''),taR=useRef(null);
  const flash=m=>{setToast(m);setTimeout(()=>setToast(''),3500)};
  useEffect(()=>{const n=Object.values(unread).reduce((a,b)=>a+b,0);document.title=(n?`(${n}) `:'')+'NexLink.Chat'},[unread]);
  useEffect(()=>{const f=e=>e.key==='Escape'&&setModal(null);window.addEventListener('keydown',f);return()=>window.removeEventListener('keydown',f)},[]);
  useEffect(()=>{if(!txt&&taR.current)taR.current.style.height='auto'},[txt]);
  useEffect(()=>{const t=setInterval(()=>setNow(Date.now()),30000);return()=>clearInterval(t)},[]);
  useEffect(()=>{if(first){setAid(first);setSide(false)}},[first]);
  useEffect(()=>{if(aid)C.getTempKey(aid).then(k=>setKeyed(!!k))},[aid,ver]);
  const vis=chats.filter(c=>(!c.expires_at||new Date(c.expires_at)>now)&&(tab==='all'||c.kind===tab));
  const left=c=>{const m=Math.max(0,Math.round((new Date(c.expires_at)-now)/60000));return `${Math.floor(m/60)}h ${m%60}m left`};
  const cur=chats.find(c=>c.id===aid&&(!c.expires_at||new Date(c.expires_at)>Date.now()));
  const other=c=>(mem[c.id]||[]).find(p=>p.id!==me.id);
  const title=c=>c.kind==='dm'?nm(other(c)):c.title;

  const dec=useCallback(async m=>{
    if(!plain.current.has(m.id)){let p=null;try{if(m.wraps?.t){const k=await C.getTempKey(m.chat_id);if(!k)return{...m,p:null};p=await C.decryptTemp(m,k)}else p=await C.decryptMessage(m,me.id,priv)}catch{}plain.current.set(m.id,p)}
    return{...m,p:plain.current.get(m.id)};
  },[me.id,priv]);

  const load=useCallback(async()=>{
    const {data}=await sb.from('chat_members').select('chat_id,chats(id,kind,title,ttl_hours,code,expires_at),profiles(id,username,display_name,public_key)');
    const by={},cs={};
    (data||[]).forEach(r=>{(by[r.chat_id]??=[]).push(r.profiles);cs[r.chat_id]=r.chats});
    setMem(by);setChats(Object.values(cs).filter(Boolean));
  },[]);

  // Close the realtime connection after 2 minutes in the background: saves your free concurrent-connection quota.
  useEffect(()=>{
    let t;const f=()=>{clearTimeout(t);if(document.hidden)t=setTimeout(()=>setLive(false),120000);else setLive(true)};
    document.addEventListener('visibilitychange',f);return()=>{document.removeEventListener('visibilitychange',f);clearTimeout(t)};
  },[]);

  useEffect(()=>{
    load();if(!live)return;
    const ch=sb.channel('cc')
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'messages'},async({new:m})=>{
        const x=await dec(m);
        setMsgs(o=>o[m.chat_id]?{...o,[m.chat_id]:[...o[m.chat_id].filter(y=>y.id!==m.id),x]}:o);
        if(m.sender_id!==me.id&&(m.chat_id!==aidR.current||document.hidden)){
          setUn(u=>({...u,[m.chat_id]:(u[m.chat_id]||0)+1}));
          if(document.hidden&&'Notification' in window&&Notification.permission==='granted')new Notification('NexLink.Chat',{body:'New encrypted message',icon:'/icon-192.png'});
        }
      })
      .on('postgres_changes',{event:'*',schema:'public',table:'chat_members'},()=>load())
      .subscribe();
    return()=>{sb.removeChannel(ch)};
  },[load,dec,me.id,live]);

  useEffect(()=>{
    if(!aid||!live)return;let off=false;
    (async()=>{
      const {data}=await sb.from('messages').select('*').eq('chat_id',aid).order('created_at',{ascending:false}).limit(80);
      const x=await Promise.all((data||[]).reverse().map(dec));
      if(!off)setMsgs(o=>({...o,[aid]:x}));
    })();
    return()=>{off=true};
  },[aid,live,dec,ver]);
  useEffect(()=>{endR.current?.scrollIntoView({block:'end'})},[msgs,aid]);

  useEffect(()=>{
    const s=q.trim().toLowerCase().replace(/[^a-z0-9_]/g,'');
    if(s.length<2){setHits([]);return}
    const t=setTimeout(async()=>{
      const {data}=await sb.from('profiles').select('id,username,display_name').ilike('username',s+'%').eq('is_guest',false).neq('id',me.id).limit(8);
      setHits(data||[]);
    },300);
    return()=>clearTimeout(t);
  },[q,me.id]);

  const open=id=>{setAid(id);setSide(false);setUn(u=>({...u,[id]:0}))};
  async function dm(u){
    const {data,error}=await sb.rpc('create_dm',{other:u.id});
    if(error)return flash(error.message);
    setQ('');await load();open(data);
  }
  async function group(ev){
    ev.preventDefault();const f=new FormData(ev.target);
    const names=String(f.get('u')).split(/[\s,]+/).map(x=>x.replace('@','').toLowerCase()).filter(Boolean);
    const {data:ps}=await sb.from('profiles').select('id').in('username',names);
    if(!ps?.length)return flash('No matching usernames found');
    const {data,error}=await sb.rpc('create_group',{t:String(f.get('t')),members:ps.map(p=>p.id),ttl:+f.get('ttl')});
    if(error)return flash(error.message);
    setModal(null);await load();open(data);
  }
  async function send(ev){
    ev.preventDefault();const t=txt.trim();if(!t||!cur)return;setTxt('');
    if('Notification' in window&&Notification.permission==='default')Notification.requestPermission();
    try{
      let e;if(cur.kind==='temp'){const k=await C.getTempKey(cur.id);if(!k)throw new Error('Enter the room password first');e=await C.encryptTemp({text:t},k,cur.id)}else e=await C.encryptMessage({text:t},mem[cur.id],cur.id);
      const {error}=await sb.from('messages').insert({chat_id:cur.id,sender_id:me.id,...e});
      if(error)throw error;
    }catch(x){setTxt(t);flash(x.message)}
  }
  async function verify(){const o=other(cur);setModal({sn:await C.safety(me.public_key,o.public_key),n:nm(o)})}
  async function unlockRoom(ev){
    ev.preventDefault();const k=await C.tempKeys(cur.code,unlock);
    const {data,error}=await sb.rpc('join_temp',{c:cur.code,v:k.verifier});
    if(error)return flash(error.message);if(!data)return flash('Wrong password');
    await C.setTempKey(cur.id,k.raw);plain.current.clear();setUnlock('');setVer(v=>v+1);
  }
  async function leave(){if(!confirm('Leave this group?'))return;await sb.rpc('leave_chat',{c:cur.id});setAid(null);setSide(true);load()}

  const shown=cur?(msgs[cur.id]||[]).filter(m=>new Date(m.expires_at)>Date.now()):[];
  return <div className={'app'+(side?' open':'')}>
    <aside>
      <header><img src="/logo.png" width="36" height="36" alt=""/><div className="grow"><Brand/></div><span className={'dot'+(live?' on':'')} title={live?'Live':'Paused to save free quota'}/>
        {!me.is_guest&&<button className="ic" title="New group" onClick={()=>setModal('g')}>＋</button>}
        <button className="ic" aria-label="Toggle theme" title="Theme" onClick={toggleTheme}>◐</button>
        <button className="ic" aria-label="Temporary room" title="Temporary room" onClick={()=>setModal('t')}>⏱</button>
        <button className="ic" title="Sign out" onClick={()=>(!me.is_guest||confirm('Guest accounts cannot sign back in. Leave anyway?'))&&sb.auth.signOut()}>⎋</button></header>
      <div className="who">{nm(me)} · @{me.username}</div>
      {!me.is_guest&&<input className="search" placeholder="Find people by username" value={q} onChange={e=>setQ(e.target.value)}/>}
      <div className="chips">{[['all','All'],['dm','People'],['group','Groups'],['temp','Temp']].map(([k,l])=><button key={k} className={'chip'+(tab===k?' on':'')} onClick={()=>setTab(k)}>{l}</button>)}</div>
      {hits.map(h=><div key={h.id} className="row" onClick={()=>dm(h)}><Av n={h.display_name}/><div><b>{h.display_name}</b><span>@{h.username}</span></div></div>)}
      <div className="list">
        {vis.map(c=><div key={c.id} className={'row'+(c.id===aid?' on':'')} onClick={()=>open(c.id)}>
          <Av n={title(c)}/><div className="grow"><b>{title(c)}</b><span>{c.kind==='group'?'Group, ':''}{c.kind==='temp'?`Temp room · ${left(c)}`:c.ttl_hours?`disappears after ${c.ttl_hours}h`:'end-to-end encrypted'}</span></div>
          {unread[c.id]>0&&<i className="badge">{unread[c.id]}</i>}</div>)}
        {!vis.length&&<p className="mute pad">Nothing here yet. Search a username or start a temp room.</p>}
      </div>
    </aside>
    <main>{cur?<>
      <header><button className="ic back" onClick={()=>setSide(true)}>←</button>
        <div className="grow"><b>{title(cur)}</b><span className={'mute'+(cur.kind==='temp'&&new Date(cur.expires_at)-now<600000?' warn':'')}>{cur.kind==='temp'?`Code ${cur.code.slice(0,4)}-${cur.code.slice(4)} · ${left(cur)} · ${(mem[cur.id]||[]).length} people`:`${(mem[cur.id]||[]).length} members`}</span></div>
        {cur.kind!=='temp'&&<select value={cur.ttl_hours} title="Disappearing messages" onChange={e=>sb.rpc('set_ttl',{c:cur.id,h:+e.target.value}).then(load)}>
          <option value="0">Keep 60 days</option><option value="1">1 hour</option><option value="24">1 day</option><option value="168">7 days</option></select>}
        {cur.kind==='temp'&&<button className="ic" aria-label="Copy invite" title="Copy invite" onClick={()=>{navigator.clipboard?.writeText(`Join my NexLink.Chat temp room\nCode: ${cur.code.slice(0,4)}-${cur.code.slice(4)}\n${location.origin}\n(Ask me for the password)`);flash('Invite copied')}}>📋</button>}
        {cur.kind==='dm'?<button className="ic" title="Verify safety number" onClick={verify}>🔒</button>:<button className="ic" title="Leave group" onClick={leave}>⎋</button>}
      </header>
      <div className="msgs">
        {!shown.length&&<p className="mute" style={{margin:'auto'}}>No messages yet. Say hello.</p>}
        {shown.map((m,i)=>{const pv=shown[i-1],d=new Date(m.created_at),head=!pv||pv.sender_id!==m.sender_id||d-new Date(pv.created_at)>300000,newDay=!pv||new Date(pv.created_at).toDateString()!==d.toDateString(),mine=m.sender_id===me.id;
          return <div key={m.id} style={{display:'contents'}}>
            {newDay&&<div className="day">{d.toLocaleDateString([],{weekday:'short',day:'numeric',month:'short'})}</div>}
            <div className={'b'+(mine?' me':'')+(head?' first':'')}>
              {cur.kind!=='dm'&&!mine&&head&&<i style={{color:`hsl(${hue(m.sender_id)} 85% 70%)`}}>{nm((mem[cur.id]||[]).find(p=>p.id===m.sender_id))}</i>}
              {m.p?m.p.text:<em>Can’t decrypt on this device</em>}
              <time>{d.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</time></div></div>})}
        <div ref={endR}/>
      </div>
      {cur.kind==='temp'&&!keyed?<form className="send" onSubmit={unlockRoom}><input type="password" required value={unlock} onChange={e=>setUnlock(e.target.value)} placeholder="Room password to unlock"/><button>Unlock</button></form>:<form className="send" onSubmit={send}><textarea ref={taR} rows={1} value={txt} aria-label="Message" placeholder="Write a message" maxLength={4000} onChange={e=>setTxt(e.target.value)} onInput={e=>{e.target.style.height='auto';e.target.style.height=Math.min(e.target.scrollHeight,140)+'px'}} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();send(e)}}}/><button aria-label="Send" disabled={!txt.trim()}>➤</button></form>}
    </>:<div className="center"><img className="pulse" src="/logo.png" width="120" height="120" alt=""/><h2><Brand/></h2><p className="mute">Pick a chat, or start something new.</p>{!me.is_guest&&<button className="wide" onClick={()=>setModal('g')}>＋ New group</button>}<button className="wide alt" onClick={()=>setModal('t')}>⏱ Temporary room</button></div>}</main>
    {modal==='t'&&<div className="modal" onClick={()=>setModal(null)}><div style={{width:'min(380px,100%)'}} onClick={e=>e.stopPropagation()}><TempForm onCancel={()=>setModal(null)} onDone={async id=>{setModal(null);await load();open(id)}}/></div></div>}
    {modal==='g'&&<div className="modal" onClick={()=>setModal(null)}><form className="card" onClick={e=>e.stopPropagation()} onSubmit={group}>
      <b>New group</b><input name="t" required maxLength={60} placeholder="Group name"/><input name="u" required placeholder="Usernames, separated by commas"/>
      <select name="ttl" style={{width:'100%'}}><option value="0">Keep messages 60 days</option><option value="24">Disappear after 1 day</option><option value="168">Disappear after 7 days</option></select>
      <button>Create group</button></form></div>}
    {modal?.sn&&<div className="modal" onClick={()=>setModal(null)}><div className="card" onClick={e=>e.stopPropagation()}>
      <b>Safety number with {modal.n}</b><p className="mute">Compare these numbers on a call. If they match on both phones, nobody is intercepting your chat.</p>
      <code style={{whiteSpace:'pre'}}>{modal.sn}</code><button onClick={()=>setModal(null)}>Close</button></div></div>}
    {toast&&<div className="toast" role="status">{toast}</div>}
  </div>;
}
