'use client';
import {useEffect,useRef,useState,useCallback} from 'react';
import {sb} from '../lib/supabase';
import * as C from '../lib/crypto';

const nm=p=>p?.display_name||'?';
const Av=({n})=><div className="av">{(n||'?')[0].toUpperCase()}</div>;
const Splash=({t})=><div className="center"><img src="/logo.png" width="96" height="96" alt=""/><p className="mute">{t||'Loading…'}</p></div>;

export default function App(){
  const [s,setS]=useState(undefined);
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
  const [m,setM]=useState('in'),[e,setE]=useState(''),[p,setP]=useState(''),[msg,setMsg]=useState('');
  async function go(ev){
    ev.preventDefault();setMsg('');
    const r=m==='in'?await sb.auth.signInWithPassword({email:e,password:p}):await sb.auth.signUp({email:e,password:p});
    if(r.error)setMsg(r.error.message);
    else if(m==='up'&&!r.data.session)setMsg('Check your email to confirm your account, then sign in.');
  }
  return <div className="center"><img src="/logo.png" width="110" height="110" alt="nexlink"/><h1>nexlink</h1>
    <p className="mute">Messages only you and your contacts can read</p>
    <form className="card" onSubmit={go}>
      <input type="email" required placeholder="Email" value={e} onChange={x=>setE(x.target.value)}/>
      <input type="password" required minLength={8} placeholder="Password (8+ characters)" value={p} onChange={x=>setP(x.target.value)}/>
      <button>{m==='in'?'Sign in':'Create account'}</button>
      {msg&&<p className="err">{msg}</p>}
      <a onClick={()=>setM(m==='in'?'up':'in')}>{m==='in'?'New here? Create an account':'Have an account? Sign in'}</a>
    </form></div>;
}

function Gate({session}){
  const [st,setSt]=useState('load'),[me,setMe]=useState(null),[priv,setPriv]=useState(null);
  useEffect(()=>{(async()=>{
    const {data:pr}=await sb.from('profiles').select('*').eq('id',session.user.id).maybeSingle();
    if(!pr)return setSt('setup');
    setMe(pr);const k=await C.getKey(pr.id);
    if(k){setPriv(k);setSt('ready')}else setSt('restore');
  })()},[session.user.id]);
  if(st==='load')return <Splash/>;
  if(st==='ready')return <Chat me={me} priv={priv}/>;
  return <Keys mode={st} session={session} me={me} done={(m,k)=>{if(m)setMe(m);setPriv(k);setSt('ready')}}/>;
}

function Keys({mode,session,me,done}){
  const [u,setU]=useState(''),[d,setD]=useState(''),[pw,setPw]=useState(''),[msg,setMsg]=useState(''),[busy,setBusy]=useState(false);
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

function Chat({me,priv}){
  const [chats,setChats]=useState([]),[mem,setMem]=useState({}),[msgs,setMsgs]=useState({}),[aid,setAid]=useState(null),[unread,setUn]=useState({});
  const [q,setQ]=useState(''),[hits,setHits]=useState([]),[txt,setTxt]=useState(''),[modal,setModal]=useState(null),[side,setSide]=useState(true),[live,setLive]=useState(true);
  const plain=useRef(new Map()),aidR=useRef(null),endR=useRef(null);
  aidR.current=aid;
  const cur=chats.find(c=>c.id===aid);
  const other=c=>(mem[c.id]||[]).find(p=>p.id!==me.id);
  const title=c=>c.kind==='dm'?nm(other(c)):c.title;

  const dec=useCallback(async m=>{
    if(!plain.current.has(m.id)){let p=null;try{p=await C.decryptMessage(m,me.id,priv)}catch{}plain.current.set(m.id,p)}
    return{...m,p:plain.current.get(m.id)};
  },[me.id,priv]);

  const load=useCallback(async()=>{
    const {data}=await sb.from('chat_members').select('chat_id,chats(id,kind,title,ttl_hours),profiles(id,username,display_name,public_key)');
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
          if(document.hidden&&'Notification' in window&&Notification.permission==='granted')new Notification('nexlink',{body:'New encrypted message',icon:'/icon-192.png'});
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
  },[aid,live,dec]);
  useEffect(()=>{endR.current?.scrollIntoView({block:'end'})},[msgs,aid]);

  useEffect(()=>{
    const s=q.trim().toLowerCase().replace(/[^a-z0-9_]/g,'');
    if(s.length<2){setHits([]);return}
    const t=setTimeout(async()=>{
      const {data}=await sb.from('profiles').select('id,username,display_name').ilike('username',s+'%').neq('id',me.id).limit(8);
      setHits(data||[]);
    },300);
    return()=>clearTimeout(t);
  },[q,me.id]);

  const open=id=>{setAid(id);setSide(false);setUn(u=>({...u,[id]:0}))};
  async function dm(u){
    const {data,error}=await sb.rpc('create_dm',{other:u.id});
    if(error)return alert(error.message);
    setQ('');await load();open(data);
  }
  async function group(ev){
    ev.preventDefault();const f=new FormData(ev.target);
    const names=String(f.get('u')).split(/[\s,]+/).map(x=>x.replace('@','').toLowerCase()).filter(Boolean);
    const {data:ps}=await sb.from('profiles').select('id').in('username',names);
    if(!ps?.length)return alert('No matching usernames found');
    const {data,error}=await sb.rpc('create_group',{t:String(f.get('t')),members:ps.map(p=>p.id),ttl:+f.get('ttl')});
    if(error)return alert(error.message);
    setModal(null);await load();open(data);
  }
  async function send(ev){
    ev.preventDefault();const t=txt.trim();if(!t||!cur)return;setTxt('');
    if('Notification' in window&&Notification.permission==='default')Notification.requestPermission();
    try{
      const e=await C.encryptMessage({text:t},mem[cur.id],cur.id);
      const {error}=await sb.from('messages').insert({chat_id:cur.id,sender_id:me.id,...e});
      if(error)throw error;
    }catch(x){setTxt(t);alert(x.message)}
  }
  async function verify(){const o=other(cur);setModal({sn:await C.safety(me.public_key,o.public_key),n:nm(o)})}
  async function leave(){if(!confirm('Leave this group?'))return;await sb.rpc('leave_chat',{c:cur.id});setAid(null);setSide(true);load()}

  const shown=cur?(msgs[cur.id]||[]).filter(m=>new Date(m.expires_at)>Date.now()):[];
  return <div className={'app'+(side?' open':'')}>
    <aside>
      <header><img src="/logo.png" width="36" height="36" alt=""/><b>nexlink</b>
        <button className="ic" title="New group" onClick={()=>setModal('g')}>＋</button>
        <button className="ic" title="Sign out" onClick={()=>sb.auth.signOut()}>⎋</button></header>
      <div className="who">{nm(me)} · @{me.username}</div>
      <input className="search" placeholder="Find people by username" value={q} onChange={e=>setQ(e.target.value)}/>
      {hits.map(h=><div key={h.id} className="row" onClick={()=>dm(h)}><Av n={h.display_name}/><div><b>{h.display_name}</b><span>@{h.username}</span></div></div>)}
      <div className="list">
        {chats.map(c=><div key={c.id} className={'row'+(c.id===aid?' on':'')} onClick={()=>open(c.id)}>
          <Av n={title(c)}/><div className="grow"><b>{title(c)}</b><span>{c.kind==='group'?'Group, ':''}{c.ttl_hours?`disappears after ${c.ttl_hours}h`:'end-to-end encrypted'}</span></div>
          {unread[c.id]>0&&<i className="badge">{unread[c.id]}</i>}</div>)}
        {!chats.length&&<p className="mute pad">No chats yet. Search for a username above to start one.</p>}
      </div>
    </aside>
    <main>{cur?<>
      <header><button className="ic back" onClick={()=>setSide(true)}>←</button>
        <div className="grow"><b>{title(cur)}</b><span className="mute">{(mem[cur.id]||[]).length} members</span></div>
        <select value={cur.ttl_hours} title="Disappearing messages" onChange={e=>sb.rpc('set_ttl',{c:cur.id,h:+e.target.value}).then(load)}>
          <option value="0">Keep 60 days</option><option value="1">1 hour</option><option value="24">1 day</option><option value="168">7 days</option></select>
        {cur.kind==='dm'?<button className="ic" title="Verify safety number" onClick={verify}>🔒</button>:<button className="ic" title="Leave group" onClick={leave}>⎋</button>}
      </header>
      <div className="msgs">
        {!shown.length&&<p className="mute" style={{margin:'auto'}}>No messages yet. Say hello.</p>}
        {shown.map(m=><div key={m.id} className={'b'+(m.sender_id===me.id?' me':'')}>
          {cur.kind==='group'&&m.sender_id!==me.id&&<i>{nm((mem[cur.id]||[]).find(p=>p.id===m.sender_id))}</i>}
          {m.p?m.p.text:<em>Can’t decrypt on this device</em>}
          <time>{new Date(m.created_at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</time></div>)}
        <div ref={endR}/>
      </div>
      <form className="send" onSubmit={send}><input value={txt} onChange={e=>setTxt(e.target.value)} placeholder="Write a message" maxLength={4000} autoComplete="off"/><button>Send</button></form>
    </>:<div className="center"><img src="/logo.png" width="120" height="120" alt=""/><p className="mute">Pick a chat or search for someone to start.</p></div>}</main>
    {modal==='g'&&<div className="modal" onClick={()=>setModal(null)}><form className="card" onClick={e=>e.stopPropagation()} onSubmit={group}>
      <b>New group</b><input name="t" required maxLength={60} placeholder="Group name"/><input name="u" required placeholder="Usernames, separated by commas"/>
      <select name="ttl" style={{width:'100%'}}><option value="0">Keep messages 60 days</option><option value="24">Disappear after 1 day</option><option value="168">Disappear after 7 days</option></select>
      <button>Create group</button></form></div>}
    {modal?.sn&&<div className="modal" onClick={()=>setModal(null)}><div className="card" onClick={e=>e.stopPropagation()}>
      <b>Safety number with {modal.n}</b><p className="mute">Compare these numbers on a call. If they match on both phones, nobody is intercepting your chat.</p>
      <code style={{whiteSpace:'pre'}}>{modal.sn}</code><button onClick={()=>setModal(null)}>Close</button></div></div>}
  </div>;
}
