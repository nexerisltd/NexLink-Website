'use client';
import {useEffect,useRef,useState,useCallback} from 'react';
import {sb} from '../lib/supabase';
import * as C from '../lib/crypto';
import * as A from '../lib/archive';
import * as D from '../lib/drive';

const nm=p=>p?.display_name||'?';
const hue=n=>[...(n||'?')].reduce((a,c)=>a+c.charCodeAt(0),0)*47%360;
const Av=({n,src})=>src?<img className="av" src={src} alt=""/>:<div className="av" style={{background:`linear-gradient(135deg,hsl(${hue(n)} 80% 55%),hsl(${(hue(n)+50)%360} 75% 40%))`}}>{(n||'?')[0].toUpperCase()}</div>;
const Brand=()=><span className="brand">NexLink<em>.Chat</em></span>;
const GIcon=()=><svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.2C12.4 13.6 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.6 5.9c4.4-4.1 7-10.1 7-17.6z"/><path fill="#FBBC05" d="M10.5 28.6c-.5-1.5-.8-3-.8-4.6s.3-3.1.8-4.6l-7.9-6.2C.9 16.4 0 20.1 0 24s.9 7.6 2.6 10.8l7.9-6.2z"/><path fill="#34A853" d="M24 48c6.5 0 12-2.1 16-5.8l-7.6-5.9c-2.1 1.4-4.9 2.3-8.4 2.3-6.3 0-11.600-4.100-13.500-9.800l-7.900 6.200C6.500 42.600 14.600 48 24 48z"/></svg>;
const IC={plus:'M12 5v14M5 12h14',more:'more',send:'M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z',back:'M15 18l-6-6 6-6',timer:['M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16z','M12 9v4l2 2','M9 2h6'],moon:'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z',out:'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',cloud:'M17.5 19H9a7 7 0 1 1 6.7-9h1.8a4.5 4.5 0 0 1 0 9z',users:'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8',shield:'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',copy:['M9 9h11v11H9z','M5 15V4h11']};
const Ic=({d,s=20})=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d==='more'?<g fill="currentColor"><circle cx="12" cy="5" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="12" cy="19" r="1.6"/></g>:[].concat(d).map((x,i)=><path key={i} d={x}/>)}</svg>;
const URL_RE=/(https?:\/\/[^\s<]+[^\s<.,;:!?)\]'"])/g;
const Linkify=({text})=>text.split(URL_RE).map((p,i)=>i%2?<a key={i} href={p} target="_blank" rel="noopener noreferrer nofollow">{p}</a>:p);
const keepable=c=>c.kind!=='temp'&&!c.ttl_hours;
function Menu({items,label,icon}){
  const [o,setO]=useState(false),r=useRef(null);
  useEffect(()=>{if(!o)return;const f=e=>{if(!r.current?.contains(e.target))setO(false)};document.addEventListener('mousedown',f);return()=>document.removeEventListener('mousedown',f)},[o]);
  return <div className="menu" ref={r}><button className="ic" aria-label={label} aria-expanded={o} onClick={()=>setO(!o)}><Ic d={icon||IC.more}/></button>
    {o&&<div className="pop" role="menu">{items.filter(Boolean).map(it=><button key={it.t} role="menuitem" className={'mi'+(it.danger?' danger':'')} onClick={()=>{setO(false);it.f()}}><Ic d={it.i} s={18}/>{it.t}</button>)}</div>}</div>;
}
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

Object.assign(IC,{file:['M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z','M14 2v6h6'],clip:'M21.4 11.1l-9.2 9.2a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 0 1 5.7 5.7l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.5-8.5',smile:['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z','M8 14s1.5 2 4 2 4-2 4-2','M9 9h.01M15 9h.01'],chat:'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z',sliders:'M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6',camera:['M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z','M12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z']});
const EMOJI=['😀','😂','😍','🥰','😎','🤔','👍','🙏','🔥','🎉','❤️','😢','😮','😡','🙌','👏','✨','💯','🚀','✅','👀','🤝','💬','🔒'];
const MAXF=10*1024*1024,fsz=n=>n<1024?n+' B':n<1048576?(n/1024).toFixed(0)+' KB':(n/1048576).toFixed(1)+' MB';
const LS=(k,v)=>{try{if(v===undefined)return localStorage.getItem(k);if(v===null)localStorage.removeItem(k);else localStorage.setItem(k,v)}catch{}return null};
const ago=iso=>{const d=new Date(iso),t=new Date();return d.toDateString()===t.toDateString()?d.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}):t-d<6048e5?d.toLocaleDateString([],{weekday:'short'}):d.toLocaleDateString([],{day:'numeric',month:'short'})};
async function squarePic(file){const b=await createImageBitmap(file),s=Math.min(b.width,b.height),cv=document.createElement('canvas');cv.width=cv.height=128;cv.getContext('2d').drawImage(b,(b.width-s)/2,(b.height-s)/2,s,s,0,0,128,128);return cv.toDataURL('image/jpeg',.8)}
async function shrink(f){
  if(!/^image\/(png|jpe?g|webp)$/.test(f.type)||f.size<300000)return f;
  const b=await createImageBitmap(f),k=Math.min(1,1600/Math.max(b.width,b.height)),cv=document.createElement('canvas');
  cv.width=Math.round(b.width*k);cv.height=Math.round(b.height*k);cv.getContext('2d').drawImage(b,0,0,cv.width,cv.height);
  const o=await new Promise(r=>cv.toBlob(r,'image/jpeg',.82));
  return o&&o.size<f.size?new File([o],f.name.replace(/\.\w+$/,'')+'.jpg',{type:'image/jpeg'}):f;
}
const blobs=new Map();
function FileMsg({p}){
  const [u,setU]=useState(blobs.get(p.path)||null),[err,setErr]=useState(''),[bz,setBz]=useState(false);
  const isImg=/^image\/(png|jpe?g|webp|gif)$/.test(p.mime);
  const get=useCallback(async()=>{
    if(blobs.has(p.path))return blobs.get(p.path);
    setBz(true);
    try{const {data,error}=await sb.storage.from('files').download(p.path);if(error)throw error;
      const url=URL.createObjectURL(new Blob([await C.decryptFile(await data.arrayBuffer(),p.k,p.iv)],{type:isImg?p.mime:'application/octet-stream'}));
      blobs.set(p.path,url);setU(url);return url}
    catch{setErr('File expired or unavailable');return null}
    finally{setBz(false)}
  },[p,isImg]);
  useEffect(()=>{if(isImg&&!u&&p.size<2e6)get()},[]);
  return <div className="file">{u&&isImg?<img src={u} alt={p.name} className="pic" onClick={()=>window.open(u)}/>:
    <button type="button" className="fbtn" disabled={bz} onClick={async()=>{const url=await get();if(url){const a=document.createElement('a');a.href=url;a.download=p.name;a.click()}}}>
      <Ic d={IC.file}/><span><b>{p.name}</b><small>{fsz(p.size)}{bz?' · loading…':' · tap to download'}</small></span></button>}
    {err&&<small className="err">{err}</small>}</div>;
}

function Chat({me,priv,first}){
  const [chats,setChats]=useState([]),[mem,setMem]=useState({}),[msgs,setMsgs]=useState({}),[aid,setAid]=useState(null),[unread,setUn]=useState({}),[last,setLast]=useState({});
  const [q,setQ]=useState(''),[hits,setHits]=useState([]),[txt,setTxt]=useState(''),[modal,setModal]=useState(null),[side,setSide]=useState(true),[live,setLive]=useState(true);
  const [ver,setVer]=useState(0),[now,setNow]=useState(Date.now()),[unlock,setUnlock]=useState(''),[keyed,setKeyed]=useState(true),[tab,setTab]=useState('all'),[toast,setToast]=useState(''),[emo,setEmo]=useState(false),[prof,setProf]=useState(me);
  const [bk,setBk]=useState(()=>({auto:LS('nl-auto:'+me.id)==='1',at:+LS('nl-last:'+me.id)||0,msg:'',busy:false,pass:'',stale:false}));
  const upd=p=>setBk(b=>({...b,...p}));
  const plain=useRef(new Map()),aidR=useRef(null),endR=useRef(null),taR=useRef(null),chatsR=useRef([]),fileR=useRef(null),grpR=useRef(null),lastDone=useRef(new Set());
  aidR.current=aid;chatsR.current=chats;
  const flash=m=>{setToast(m);setTimeout(()=>setToast(''),3500)};
  const cur=chats.find(c=>c.id===aid&&(!c.expires_at||new Date(c.expires_at)>Date.now()));
  const other=c=>(mem[c.id]||[]).find(p=>p.id!==me.id);
  const title=c=>c.kind==='dm'?nm(other(c)):c.title;
  const pic=c=>c.kind==='dm'?other(c)?.avatar:c.avatar;
  const left=c=>{const m=Math.max(0,Math.round((new Date(c.expires_at)-now)/60000));return `${Math.floor(m/60)}h ${m%60}m left`};
  const prev=c=>{const l=last[c.id];if(!l)return c.kind==='temp'?`Temp room · ${left(c)}`:'No messages yet';return(l.from===me.id?'You: ':'')+(l.p?(l.p.t==='file'?'📎 '+l.p.name:l.p.text):'🔒 Encrypted message')};

  const dec=useCallback(async m=>{
    if(!plain.current.has(m.id)){let p=null;
      try{if(m.wraps?.t){const k=await C.getTempKey(m.chat_id);if(!k)return{...m,p:null};p=await C.decryptTemp(m,k)}else p=await C.decryptMessage(m,me.id,priv)}catch{}
      plain.current.set(m.id,p)}
    return{...m,p:plain.current.get(m.id)};
  },[me.id,priv]);
  const load=useCallback(async()=>{
    const {data}=await sb.from('chat_members').select('chat_id,chats(id,kind,title,ttl_hours,code,expires_at,avatar),profiles(id,username,display_name,public_key,avatar)');
    const by={},cs={};(data||[]).forEach(r=>{(by[r.chat_id]??=[]).push(r.profiles);cs[r.chat_id]=r.chats});
    setMem(by);setChats(Object.values(cs).filter(Boolean));
  },[]);
  async function syncChat(id){
    let lastAt=(await A.byChat(me.id,id)).pop()?.created_at;
    for(;;){let qy=sb.from('messages').select('*').eq('chat_id',id).order('created_at').limit(500);if(lastAt)qy=qy.gt('created_at',lastAt);
      const {data}=await qy;if(!data?.length)break;await A.put(me.id,data);lastAt=data[data.length-1].created_at;if(data.length<500)break}
  }

  useEffect(()=>{const t=setInterval(()=>setNow(Date.now()),30000);return()=>clearInterval(t)},[]);
  useEffect(()=>{if(first){setAid(first);setSide(false)}},[first]);
  useEffect(()=>{if(aid)C.getTempKey(aid).then(k=>setKeyed(!!k))},[aid,ver]);
  useEffect(()=>{const n=Object.values(unread).reduce((a,b)=>a+b,0);document.title=(n?`(${n}) `:'')+'NexLink.Chat'},[unread]);
  useEffect(()=>{const f=e=>e.key==='Escape'&&(setModal(null),setEmo(false));window.addEventListener('keydown',f);return()=>window.removeEventListener('keydown',f)},[]);
  useEffect(()=>{if(!txt&&taR.current)taR.current.style.height='auto'},[txt]);
  useEffect(()=>{let t;const f=()=>{clearTimeout(t);if(document.hidden)t=setTimeout(()=>setLive(false),120000);else setLive(true)};document.addEventListener('visibilitychange',f);return()=>{document.removeEventListener('visibilitychange',f);clearTimeout(t)}},[]);
  useEffect(()=>{
    load();if(!live)return;
    const ch=sb.channel('cc')
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'messages'},async({new:m})=>{
        const c0=chatsR.current.find(c=>c.id===m.chat_id);if(c0&&keepable(c0))A.put(me.id,[m]).catch(()=>{});
        const x=await dec(m);
        setLast(l=>({...l,[m.chat_id]:{p:x.p,at:m.created_at,from:m.sender_id}}));
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
  useEffect(()=>{ // latest message per chat for the list preview
    if(!live)return;
    chats.forEach(async c=>{
      if(lastDone.current.has(c.id))return;lastDone.current.add(c.id);
      const {data}=await sb.from('messages').select('*').eq('chat_id',c.id).order('created_at',{ascending:false}).limit(1);
      if(data?.[0]){const x=await dec(data[0]);setLast(l=>({...l,[c.id]:{p:x.p,at:x.created_at,from:x.sender_id}}))}
    });
  },[chats,live,dec]);
  useEffect(()=>{
    if(!aid||!live)return;let off=false;
    (async()=>{
      const c=chatsR.current.find(x=>x.id===aid);let rows;
      if(c&&keepable(c)){await syncChat(aid);rows=(await A.byChat(me.id,aid)).slice(-300)}
      else{const {data}=await sb.from('messages').select('*').eq('chat_id',aid).order('created_at',{ascending:false}).limit(80);rows=(data||[]).reverse()}
      const x=await Promise.all(rows.map(dec));
      if(!off)setMsgs(o=>({...o,[aid]:x}));
    })();
    return()=>{off=true};
  },[aid,live,dec,ver]);
  useEffect(()=>{endR.current?.scrollIntoView({block:'end'})},[msgs,aid]);
  useEffect(()=>{
    const s=q.trim().toLowerCase().replace(/[^a-z0-9_]/g,'');
    if(me.is_guest||s.length<2){setHits([]);return}
    const t=setTimeout(async()=>{
      const {data}=await sb.from('profiles').select('id,username,display_name,avatar').ilike('username',s+'%').eq('is_guest',false).neq('id',me.id).limit(6);
      setHits(data||[]);
    },300);
    return()=>clearTimeout(t);
  },[q,me.id,me.is_guest]);

  // ---- auto-backup (encrypted rows -> hidden Google Drive app folder) ----
  async function pushBackup(tok){
    const key=await C.getKey('bk:'+me.id),kw=LS('nl-kw:'+me.id);if(!key||!kw)throw new Error('Backup is not set up yet');
    for(const c of chatsR.current.filter(keepable))await syncChat(c.id);
    const rows=(await A.all(me.id)).map(({k,c,...m})=>m);
    await D.save(tok,JSON.stringify({v:2,kw:JSON.parse(kw),...await C.encWith(key,{at:Date.now(),rows})}));
    const t=Date.now();LS('nl-last:'+me.id,String(t));upd({at:t,stale:false});return rows.length;
  }
  async function connectBackup(){
    if(!bk.pass)return upd({msg:'Enter your key passphrase first'});
    upd({busy:true,msg:'Waiting for Google…'});
    try{
      // the passphrase must match the account's key passphrase before any backup is created or opened
      const {data:kb,error:ke}=await sb.from('key_backups').select('data').eq('user_id',me.id).single();
      if(ke)throw ke;
      try{await C.openBackup(kb.data,bk.pass)}catch{throw new Error('Wrong passphrase. Use the key passphrase you chose at setup.')}
      const tok=await D.token(),txt=await D.load(tok);let key=null,kw=null,o=null;
      if(txt){try{const f=JSON.parse(txt);key=await C.openBackupKey(f.kw,bk.pass);o=await C.decWith(key,f);kw=f.kw}catch{o=null}}
      if(o){await A.put(me.id,o.rows);plain.current.clear();setVer(v=>v+1)}
      else{
        if(txt&&!confirm('The backup already in your Google Drive cannot be opened with this passphrase. Replace it with a fresh backup from this device?'))throw new Error('Cancelled');
        ({key,kw}=await C.makeBackupKey(bk.pass));
      }
      await C.saveKey('bk:'+me.id,key);LS('nl-kw:'+me.id,JSON.stringify(kw));LS('nl-auto:'+me.id,'1');
      const n=await pushBackup(tok);upd({auto:true,pass:'',msg:`Auto-backup is on. ${n} messages saved ✓`});
    }catch(e){upd({msg:e.message||'Failed'})}
    upd({busy:false});
  }
  async function backupNow(){
    upd({busy:true,msg:'Waiting for Google…'});
    try{const n=await pushBackup(await D.token());upd({msg:`Backed up ${n} messages ✓`})}catch(e){upd({msg:e.message||'Backup failed'})}
    upd({busy:false});
  }
  useEffect(()=>{
    if(me.is_guest||!D.configured)return;
    const run=async()=>{if(LS('nl-auto:'+me.id)!=='1'||Date.now()-(+LS('nl-last:'+me.id)||0)<864e5)return;try{await pushBackup(await D.token(true))}catch{upd({stale:true})}};
    const t0=setTimeout(run,6000),iv=setInterval(run,36e5);return()=>{clearTimeout(t0);clearInterval(iv)};
  },[me.id]);

  // ---- actions ----
  const open=id=>{setAid(id);setSide(false);setUn(u=>({...u,[id]:0}))};
  async function dm(u){const {data,error}=await sb.rpc('create_dm',{other:u.id});if(error)return flash(error.message);setQ('');await load();open(data)}
  async function group(ev){
    ev.preventDefault();const f=new FormData(ev.target);
    const names=String(f.get('u')).split(/[\s,]+/).map(x=>x.replace('@','').toLowerCase()).filter(Boolean);
    const {data:ps}=await sb.from('profiles').select('id').in('username',names);
    if(!ps?.length)return flash('No matching usernames found');
    const {data,error}=await sb.rpc('create_group',{t:String(f.get('t')),members:ps.map(p=>p.id),ttl:+f.get('ttl')});
    if(error)return flash(error.message);setModal(null);await load();open(data);
  }
  async function post(payload,fp){
    let e;
    if(cur.kind==='temp'){const k=await C.getTempKey(cur.id);if(!k)throw new Error('Enter the room password first');e=await C.encryptTemp(payload,k,cur.id)}
    else e=await C.encryptMessage(payload,mem[cur.id],cur.id);
    const {error}=await sb.from('messages').insert({chat_id:cur.id,sender_id:me.id,file_path:fp||null,...e});if(error)throw error;
  }
  async function send(ev){
    ev.preventDefault();const t=txt.trim();if(!t||!cur)return;setTxt('');setEmo(false);
    if('Notification' in window&&Notification.permission==='default')Notification.requestPermission();
    try{await post({text:t})}catch(x){setTxt(t);flash(x.message)}
  }
  async function sendFile(f){
    if(!f||!cur)return;
    try{
      f=await shrink(f);if(f.size>MAXF)return flash('Max file size is 10 MB');
      flash('Encrypting and uploading…');
      const e=await C.encryptFile(await f.arrayBuffer()),path=`${cur.id}/${crypto.randomUUID()}`;
      const {error}=await sb.storage.from('files').upload(path,new Blob([e.ct]),{contentType:'application/octet-stream'});if(error)throw error;
      await post({t:'file',name:f.name,mime:f.type,size:f.size,path,k:e.k,iv:e.iv},path);setToast('');
    }catch(x){flash(x.message||'Upload failed')}
  }
  async function setMyPic(f){
    if(!f)return;try{const a=await squarePic(f);const {error}=await sb.from('profiles').update({avatar:a}).eq('id',me.id);if(error)throw error;setProf(p=>({...p,avatar:a}));load()}catch(x){flash(x.message)}
  }
  async function setGrpPic(f){
    if(!f||!cur)return;try{const {error}=await sb.rpc('set_chat_avatar',{c:cur.id,a:await squarePic(f)});if(error)throw error;await load();flash('Group photo updated')}catch(x){flash(x.message)}
  }
  async function verify(){const o=other(cur);setModal({sn:await C.safety(me.public_key,o.public_key),n:nm(o)})}
  async function leave(){if(!confirm('Leave this chat?'))return;await sb.rpc('leave_chat',{c:cur.id});setAid(null);setSide(true);load()}
  async function unlockRoom(ev){
    ev.preventDefault();const k=await C.tempKeys(cur.code,unlock);
    const {data,error}=await sb.rpc('join_temp',{c:cur.code,v:k.verifier});
    if(error)return flash(error.message);if(!data)return flash('Wrong password');
    await C.setTempKey(cur.id,k.raw);plain.current.clear();setUnlock('');setVer(v=>v+1);
  }
  const signOut=()=>(!me.is_guest||confirm('Guest accounts cannot sign back in. Leave anyway?'))&&sb.auth.signOut();

  const vis=chats.filter(c=>(!c.expires_at||new Date(c.expires_at)>now)&&(tab==='all'||(tab==='unread'?unread[c.id]>0:c.kind===tab))&&(!q.trim()||title(c).toLowerCase().includes(q.trim().toLowerCase())))
    .sort((a,b)=>new Date(last[b.id]?.at||0)-new Date(last[a.id]?.at||0));
  const shown=cur?(msgs[cur.id]||[]).filter(m=>keepable(cur)||new Date(m.expires_at)>Date.now()):[];

  return <div className={'app'+(side?' open':'')}>
    <nav className="rail"><img src="/logo.png" width="42" height="42" alt="NexLink.Chat"/>
      {[['all','Chats',IC.chat],['group','Groups',IC.users],['temp','Temp',IC.timer]].map(([k,l,i])=><button key={k} className={'rb'+(tab===k?' on':'')} onClick={()=>{setTab(k);setSide(true)}}><Ic d={i}/><span>{l}</span></button>)}
      <div className="grow"/><button className="rb" onClick={()=>setModal('s')}><Ic d={IC.sliders}/><span>Settings</span></button></nav>
    <aside>
      <header><img className="hlogo" src="/logo.png" width="34" height="34" alt=""/><h2 className="grow">Chats</h2><span className={'dot'+(live?' on':'')} title={live?'Live':'Paused to save free quota'}/>
        <Menu label="New" icon={IC.plus} items={[!me.is_guest&&{t:'New group',i:IC.users,f:()=>setModal('g')},{t:'Temporary room',i:IC.timer,f:()=>setModal('t')}]}/>
        <Menu label="Menu" items={[{t:'Settings',i:IC.sliders,f:()=>setModal('s')},{t:'Switch theme',i:IC.moon,f:toggleTheme},{t:'Sign out',i:IC.out,danger:true,f:signOut}]}/></header>
      <input className="search" placeholder={me.is_guest?'Search chats':'Search chats or find people'} value={q} onChange={e=>setQ(e.target.value)} aria-label="Search"/>
      <div className="chips">{[['all','All'],['dm','Direct'],['group','Groups'],['unread','Unread']].map(([k,l])=><button key={k} className={'chip'+(tab===k?' on':'')} onClick={()=>setTab(k)}>{l}</button>)}</div>
      {bk.stale&&bk.auto&&<div className="banner">Auto-backup needs a tap<button onClick={backupNow}>Back up</button></div>}
      <div className="list">
        {hits.length>0&&<><p className="mute pad">People</p>{hits.map(h=><div key={h.id} className="row" onClick={()=>dm(h)}><Av n={h.display_name} src={h.avatar}/><div className="grow"><b>{h.display_name}</b><span>@{h.username}</span></div></div>)}</>}
        {vis.map(c=><div key={c.id} className={'row'+(c.id===aid?' on':'')} tabIndex={0} role="button" onKeyDown={e=>e.key==='Enter'&&open(c.id)} onClick={()=>open(c.id)}>
          <Av n={title(c)} src={pic(c)}/>
          <div className="grow"><div className="r1"><b>{title(c)}</b><time>{last[c.id]?ago(last[c.id].at):''}</time></div>
            <div className="r1"><span>{prev(c)}</span>{unread[c.id]>0&&<i className="badge">{unread[c.id]}</i>}</div></div></div>)}
        {!vis.length&&!hits.length&&<p className="mute pad">Nothing here yet. Search a username or start a temp room.</p>}
      </div>
    </aside>
    <main>{cur?<>
      <header><button className="ic back" aria-label="Back" onClick={()=>setSide(true)}><Ic d={IC.back}/></button><Av n={title(cur)} src={pic(cur)}/>
        <div className="grow"><b>{title(cur)}</b><span className={'mute'+(cur.kind==='temp'&&new Date(cur.expires_at)-now<600000?' warn':'')}>{cur.kind==='temp'?`Code ${cur.code.slice(0,4)}-${cur.code.slice(4)} · ${left(cur)} · ${(mem[cur.id]||[]).length} people`:cur.kind==='dm'?'End-to-end encrypted':`${(mem[cur.id]||[]).length} members`}</span></div>
        <Menu label="Chat options" items={[cur.kind==='temp'&&{t:'Copy invite',i:IC.copy,f:()=>{navigator.clipboard?.writeText(`Join my NexLink.Chat temp room\nCode: ${cur.code.slice(0,4)}-${cur.code.slice(4)}\n${location.origin}\n(Ask me for the password)`);flash('Invite copied')}},cur.kind==='group'&&{t:'Change group photo',i:IC.camera,f:()=>grpR.current.click()},cur.kind!=='temp'&&{t:'Disappearing messages',i:IC.timer,f:()=>setModal('d')},cur.kind==='dm'&&{t:'Verify safety number',i:IC.shield,f:verify},cur.kind!=='dm'&&{t:cur.kind==='temp'?'Leave room':'Leave group',i:IC.out,danger:true,f:leave}]}/></header>
      <input ref={grpR} type="file" accept="image/*" hidden onChange={e=>{setGrpPic(e.target.files[0]);e.target.value=''}}/>
      <div className="msgs">
        {!shown.length&&<p className="mute" style={{margin:'auto'}}>No messages yet. Say hello.</p>}
        {shown.map((m,i)=>{const pv=shown[i-1],d=new Date(m.created_at),head=!pv||pv.sender_id!==m.sender_id||d-new Date(pv.created_at)>300000,newDay=!pv||new Date(pv.created_at).toDateString()!==d.toDateString(),mine=m.sender_id===me.id;
          return <div key={m.id} style={{display:'contents'}}>
            {newDay&&<div className="day">{d.toLocaleDateString([],{weekday:'long',day:'numeric',month:'short'})}</div>}
            <div className={'b'+(mine?' me':'')+(head?' first':'')}>
              {cur.kind!=='dm'&&!mine&&head&&<i style={{color:`hsl(${hue(m.sender_id)} 75% 45%)`}}>{nm((mem[cur.id]||[]).find(p=>p.id===m.sender_id))}</i>}
              {m.p?(m.p.t==='file'?<FileMsg p={m.p}/>:<Linkify text={m.p.text}/>):<em>Can’t decrypt on this device</em>}
              <time>{d.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</time></div></div>})}
        <div ref={endR}/>
      </div>
      {cur.kind==='temp'&&!keyed?<form className="send" onSubmit={unlockRoom}><input type="password" required value={unlock} onChange={e=>setUnlock(e.target.value)} placeholder="Room password to unlock"/><button>Unlock</button></form>:
      <form className="send" onSubmit={send}>
        <input ref={fileR} type="file" hidden onChange={e=>{sendFile(e.target.files[0]);e.target.value=''}}/>
        <button type="button" className="ic" aria-label="Attach a file" onClick={()=>fileR.current.click()}><Ic d={IC.clip}/></button>
        <textarea ref={taR} rows={1} value={txt} aria-label="Message" placeholder="Type a message…" maxLength={4000} onChange={e=>setTxt(e.target.value)} onInput={e=>{e.target.style.height='auto';e.target.style.height=Math.min(e.target.scrollHeight,140)+'px'}} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();send(e)}}}/>
        <div className="menu"><button type="button" className="ic" aria-label="Emoji" onClick={()=>setEmo(!emo)}><Ic d={IC.smile}/></button>
          {emo&&<div className="pop emo">{EMOJI.map(e=><button type="button" key={e} className="mi" onClick={()=>{setTxt(t=>t+e);setEmo(false)}}>{e}</button>)}</div>}</div>
        <button className="sendbtn" aria-label="Send" disabled={!txt.trim()}><Ic d={IC.send}/></button></form>}
    </>:<div className="center"><img className="pulse" src="/logo.png" width="120" height="120" alt=""/><h2><Brand/></h2><p className="mute">Pick a chat, or start something new.</p>{!me.is_guest&&<button className="wide" onClick={()=>setModal('g')}>＋ New group</button>}<button className="wide alt" onClick={()=>setModal('t')}>⏱ Temporary room</button></div>}</main>

    {modal==='s'&&<div className="modal" onClick={()=>setModal(null)}><div className="card" onClick={e=>e.stopPropagation()}>
      <div className="prow"><label className="pbtn" title="Change photo"><Av n={nm(prof)} src={prof.avatar}/><span className="cam"><Ic d={IC.camera} s={14}/></span><input type="file" accept="image/*" hidden onChange={e=>{setMyPic(e.target.files[0]);e.target.value=''}}/></label>
        <div><b>{nm(prof)}</b><span className="mute" style={{display:'block'}}>@{prof.username}{me.is_guest?' · guest':''}</span></div></div>
      <button className="alt" onClick={toggleTheme}>Switch light / dark theme</button>
      {!me.is_guest&&<><b>Google Drive backup</b>
        {!D.configured?<p className="err">Add NEXT_PUBLIC_GOOGLE_CLIENT_ID in Vercel to enable backup.</p>:bk.auto?<>
          <p className="mute">Auto-backup is on. Last backup: {bk.at?new Date(bk.at).toLocaleString():'never'}. It runs about once a day while NexLink.Chat is open.</p>
          <button disabled={bk.busy} onClick={backupNow}>Back up now</button>
          <a onClick={()=>{LS('nl-auto:'+me.id,null);upd({auto:false,msg:''})}}>Turn off auto-backup</a></>:<>
          <p className="mute">Encrypted history in a hidden Google Drive folder. Enter your key passphrase to turn on auto-backup, or to restore on a new device.</p>
          <input type="password" autoComplete="off" placeholder="Key passphrase" value={bk.pass} onChange={e=>upd({pass:e.target.value})}/>
          <button disabled={bk.busy} onClick={connectBackup}>Turn on auto-backup / restore</button></>}
        {bk.msg&&<p className="mute" role="status">{bk.msg}</p>}</>}
      <button className="alt danger" onClick={signOut}>Sign out</button></div></div>}
    {modal==='d'&&cur&&<div className="modal" onClick={()=>setModal(null)}><div className="card" onClick={e=>e.stopPropagation()}>
      <b>Disappearing messages</b>
      <p className="mute">Keep history: messages stay on your devices and backup (the server keeps only a short cache). Timed options delete messages everywhere when time is up.</p>
      {[[0,'Keep history'],[1,'1 hour'],[24,'1 day'],[168,'7 days']].map(([h,l])=><button key={h} className={cur.ttl_hours===h?'':'alt'} onClick={async()=>{const {error}=await sb.rpc('set_ttl',{c:cur.id,h});if(error)return flash(error.message);await load();setModal(null);flash('Updated')}}>{l}</button>)}</div></div>}
    {modal==='t'&&<div className="modal" onClick={()=>setModal(null)}><div style={{width:'min(390px,100%)'}} onClick={e=>e.stopPropagation()}><TempForm onCancel={()=>setModal(null)} onDone={async id=>{setModal(null);await load();open(id)}}/></div></div>}
    {modal==='g'&&<div className="modal" onClick={()=>setModal(null)}><form className="card" onClick={e=>e.stopPropagation()} onSubmit={group}>
      <b>New group</b><input name="t" required maxLength={60} placeholder="Group name"/><input name="u" required placeholder="Usernames, separated by commas"/>
      <select name="ttl" style={{width:'100%'}}><option value="0">Keep history</option><option value="24">Disappear after 1 day</option><option value="168">Disappear after 7 days</option></select>
      <button>Create group</button></form></div>}
    {modal?.sn&&<div className="modal" onClick={()=>setModal(null)}><div className="card" onClick={e=>e.stopPropagation()}>
      <b>Safety number with {modal.n}</b><p className="mute">Compare these numbers on a call. If both match, nobody is intercepting your chat.</p>
      <code style={{whiteSpace:'pre'}}>{modal.sn}</code><button onClick={()=>setModal(null)}>Close</button></div></div>}
    {toast&&<div className="toast" role="status">{toast}</div>}
  </div>;
}
