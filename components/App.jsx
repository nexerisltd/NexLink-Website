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
const FMT=/(\*\*[^*\n]+\*\*|`[^`\n]+`)/g;
const Fmt=({s})=>s.split(FMT).map((p,i)=>i%2?(p[0]==='`'?<code key={i}>{p.slice(1,-1)}</code>:<b key={i}>{p.slice(2,-2)}</b>):p);
const Linkify=({text})=>text.split(URL_RE).map((p,i)=>i%2?<a key={i} href={p} target="_blank" rel="noopener noreferrer nofollow">{p}</a>:<Fmt key={i} s={p}/>);
const keepable=c=>c.kind!=='temp'&&!c.ttl_hours;
function Menu({items,label,icon}){
  const [o,setO]=useState(false),r=useRef(null);
  useEffect(()=>{if(!o)return;const f=e=>{if(!r.current?.contains(e.target))setO(false)};document.addEventListener('mousedown',f);return()=>document.removeEventListener('mousedown',f)},[o]);
  return <div className="menu" ref={r}><button className="ic" aria-label={label} aria-expanded={o} onClick={()=>setO(!o)}><Ic d={icon||IC.more}/></button>
    {o&&<div className="pop" role="menu">{items.filter(Boolean).map(it=><button key={it.t} role="menuitem" className={'mi'+(it.danger?' danger':'')} onClick={()=>{setO(false);it.f()}}><Ic d={it.i} s={18}/>{it.t}</button>)}</div>}</div>;
}
function toggleTheme(){const el=document.documentElement;const dark=(el.dataset.theme||(matchMedia('(prefers-color-scheme: light)').matches?'light':'dark'))==='dark';const n=dark?'light':'dark';el.dataset.theme=n;try{localStorage.setItem('nl-theme',n)}catch{}}
const Splash=({t})=><div className="center"><img className="pulse" src="/logo.png" width="96" height="96" alt=""/><p className="mute">{t||'Loading…'}</p></div>;

const DRIVE_SCOPE='https://www.googleapis.com/auth/drive.appdata';
const isMob=()=>typeof window!=='undefined'&&window.matchMedia('(max-width:760px)').matches;
async function storeRefresh(x){
  try{await fetch('/api/google/store',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+x.access_token},body:JSON.stringify({refresh_token:x.provider_refresh_token})})}catch{}
}
export default function App({startUser}){
  const [s,setS]=useState(undefined);
  useEffect(()=>{try{const t=localStorage.getItem('nl-theme');if(t)document.documentElement.dataset.theme=t;applyAccent(+localStorage.getItem('nl-accent')||0)}catch{}},[]);
  useEffect(()=>{
    sb.auth.getSession().then(({data})=>setS(data.session));
    const {data}=sb.auth.onAuthStateChange((_e,x)=>{setS(x);if(x?.provider_refresh_token)storeRefresh(x)});
    if('serviceWorker' in navigator)navigator.serviceWorker.register('/sw.js').catch(()=>{});
    return()=>data.subscription.unsubscribe();
  },[]);
  useEffect(()=>{const nx=LS('nl-next');if(s&&nx&&location.pathname==='/'){LS('nl-next',null);location.replace(nx)}},[s]);
  if(s===undefined)return <Splash/>;
  return s?<Gate session={s} startUser={startUser}/>:<Auth startUser={startUser}/>;
}

function Auth({startUser}){
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

function GuestLink({startUser,session,onDone}){
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

function Gate({session,startUser}){
  const anon=session.user.is_anonymous;
  const [st,setSt]=useState('load'),[me,setMe]=useState(null),[priv,setPriv]=useState(null),[first,setFirst]=useState(null),[notice,setNotice]=useState('');
  useEffect(()=>{(async()=>{
    let {data:pr,error}=await sb.from('profiles').select('*').eq('id',session.user.id).maybeSingle();
    if(error&&!pr){try{pr=JSON.parse(LS('nl-prof:'+session.user.id)||'null')}catch{}if(!pr)return setSt('offline')}
    if(!pr)return setSt(anon?(startUser?'glink':'guest'):'setup');
    if(pr.msg_policy==='none'){await sb.from('profiles').update({msg_policy:'everyone'}).eq('id',pr.id);pr={...pr,msg_policy:'everyone'};setNotice('Welcome back. Your account is active again.')}
    try{LS('nl-prof:'+pr.id,JSON.stringify({...pr,avatar:undefined}))}catch{}
    setMe(pr);
    const k=await C.getKey(pr.id);
    if(pr.is_guest){if(k||!startUser){setPriv(k||null);return setSt('ready')}return setSt('glink')}
    if(k){setPriv(k);setSt('ready')}else setSt('restore');
  })()},[session.user.id,anon]);
  useEffect(()=>{if(st!=='offline')return;const f=()=>location.reload();window.addEventListener('online',f);return()=>window.removeEventListener('online',f)},[st]);
  if(st==='load')return <Splash/>;
  if(st==='offline')return <Splash t="You’re offline. Reconnect to continue."/>;
  if(st==='glink')return <GuestLink startUser={startUser} session={session} onDone={(p,k)=>{setMe(p);setPriv(k);setSt('ready')}}/>;
  if(st==='guest')return <div className="center"><img src="/logo.png" width="90" height="90" alt=""/><h1>Temporary chat</h1>
    <TempForm needNick onCancel={()=>sb.auth.signOut()} onDone={async id=>{const {data}=await sb.from('profiles').select('*').eq('id',session.user.id).single();setMe(data);setFirst(id);setSt('ready')}}/></div>;
  if(st==='ready')return <Chat me={me} priv={priv} first={first} startUser={startUser} notice={notice}/>;
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
const MAXF=100*1024*1024,fsz=n=>n<1024?n+' B':n<1048576?(n/1024).toFixed(0)+' KB':(n/1048576).toFixed(1)+' MB';
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
async function api(path,body){
  const {data:{session}}=await sb.auth.getSession();
  const r=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${session?.access_token}`},body:JSON.stringify(body)});
  const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||'Request failed');return j;
}
const blobs=new Map();
function FileMsg({p}){
  const [u,setU]=useState(blobs.get(p.path)||null),[err,setErr]=useState(''),[bz,setBz]=useState(false);
  const isImg=/^image\/(png|jpe?g|webp|gif)$/.test(p.mime);
  const get=useCallback(async()=>{
    if(blobs.has(p.path))return blobs.get(p.path);
    setBz(true);
    try{const {url:dl}=await api('/api/files/download',{key:p.path});const res=await fetch(dl);if(!res.ok)throw new Error('gone');
      const url=URL.createObjectURL(new Blob([await C.decryptFile(await res.arrayBuffer(),p.k,p.iv)],{type:isImg?p.mime:'application/octet-stream'}));
      blobs.set(p.path,url);setU(url);return url}
    catch{setErr('File expired or unavailable');return null}
    finally{setBz(false)}
  },[p,isImg]);
  useEffect(()=>{if(isImg&&!u&&p.size<2e6)get()},[]);
  return <div className="file">{u&&isImg?<img src={u} alt={p.name} className="pic" onClick={()=>window.dispatchEvent(new CustomEvent('nl-img',{detail:u}))}/>:
    <button type="button" className="fbtn" disabled={bz} onClick={async()=>{const url=await get();if(url){const a=document.createElement('a');a.href=url;a.download=p.name;a.click()}}}>
      <Ic d={IC.file}/><span><b>{p.name}</b><small>{fsz(p.size)}{bz?' · loading…':' · tap to download'}</small></span></button>}
    {err&&<small className="err">{err}</small>}</div>;
}

Object.assign(IC,{search:['M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z','M21 21l-4.3-4.3'],pin:'M12 17v5M9 3h6l-1 7 3 3H7l3-3z',reply:['M9 17l-5-5 5-5','M4 12h11a5 5 0 0 1 5 5v2'],bell:['M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9','M13.7 21a2 2 0 0 1-3.4 0']});
Object.assign(IC,{trash:['M3 6h18','M8 6V4h8v2','M19 6l-1 14H6L5 6'],fwd:'M15 17l5-5-5-5M4 18v-2a4 4 0 0 1 4-4h12',edit:'M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z',select:['M9 11l3 3 8-8','M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11'],hist:'M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l3 2'});
const REACTS=['👍','❤️','😂','😮','😢','🙏'];
const ACC=[['#2b7bff','#4f9bff'],['#7c5cff','#a78bfa'],['#10b981','#34d399'],['#f43f5e','#fb7185'],['#f59e0b','#fbbf24']];
const applyAccent=i=>{const a=ACC[i]||ACC[0],r=document.documentElement.style;r.setProperty('--acc',a[0]);r.setProperty('--acc2',a[1])};
const urlB64=s=>{const b=(s+'='.repeat((4-s.length%4)%4)).replace(/-/g,'+').replace(/_/g,'/');return Uint8Array.from(atob(b),c=>c.charCodeAt(0))};
function Chat({me,priv,first,startUser,notice}){
  const [chats,setChats]=useState([]),[mem,setMem]=useState({}),[msgs,setMsgs]=useState({}),[aid,setAid]=useState(null),[unread,setUn]=useState({}),[last,setLast]=useState({});
  const [q,setQ]=useState(''),[hits,setHits]=useState([]),[txt,setTxt]=useState(''),[modal,setModal]=useState(null),[side,setSide]=useState(true),[live,setLive]=useState(true);
  const [ver,setVer]=useState(0),[now,setNow]=useState(Date.now()),[unlock,setUnlock]=useState(''),[keyed,setKeyed]=useState(true),[tab,setTab]=useState('all'),[toast,setToast]=useState(''),[emo,setEmo]=useState(false),[prof,setProf]=useState(me),[sel,setSel]=useState(null),[replyTo,setReplyTo]=useState(null),[find,setFind]=useState(null),[lb,setLb]=useState(null),[editing,setEditing]=useState(null),[atBottom,setAtBottom]=useState(true),[pview,setPview]=useState(null),[menu,setMenu]=useState(null),[rxp,setRxp]=useState(null),[selIds,setSelIds]=useState([]),[selMode,setSelMode]=useState(false),[grantFor,setGrantFor]=useState(null),[fwd,setFwd]=useState(null),[fq,setFq]=useState(''),[clr,setClr]=useState({}),[grants,setGrants]=useState({}),[hid,setHid]=useState(()=>JSON.parse(LS('nl-hide:'+me.id)||'[]')),[fresh,setFresh]=useState({}),[burst,setBurst]=useState(null),[lim,setLim]=useState(300),[online,setOnline]=useState(true),[outN,setOutN]=useState(()=>JSON.parse(LS('nl-out:'+me.id)||'[]').length),[driveOk,setDriveOk]=useState(null),[loaded,setLoaded]=useState(false),[readAt,setReadAt]=useState(0),[muted,setMuted]=useState(()=>JSON.parse(LS('nl-mute:'+me.id)||'[]')),[pins,setPins]=useState(()=>JSON.parse(LS('nl-pin:'+me.id)||'[]')),[pushOn,setPushOn]=useState(LS('nl-push:'+me.id)==='1');
  const [bk,setBk]=useState(()=>({auto:LS('nl-auto:'+me.id)==='1',at:+LS('nl-last:'+me.id)||0,msg:'',busy:false,pass:'',stale:false}));
  const upd=p=>setBk(b=>({...b,...p}));
  const plain=useRef(new Map()),aidR=useRef(null),endR=useRef(null),taR=useRef(null),chatsR=useRef([]),fileR=useRef(null),grpR=useRef(null),lastDone=useRef(new Set()),boxR=useRef(null),mutedR=useRef([]),searchR=useRef(null),swRef=useRef({}),ptrRef=useRef('mouse'),rxT=useRef(null),dragMoved=useRef(false),prevRx=useRef({}),menuAt=useRef(0),drafts=useRef({}),chatPushed=useRef(false),exitArm=useRef(false),skipPop=useRef(false),startDone=useRef(false),memR=useRef({});
  aidR.current=aid;chatsR.current=chats;mutedR.current=muted;memR.current=mem;
  const flash=m=>{setToast(m);setTimeout(()=>setToast(''),3500)};
  const cur=chats.find(c=>c.id===aid&&(!c.expires_at||new Date(c.expires_at)>Date.now()));
  const other=c=>(mem[c.id]||[]).find(p=>p.id!==me.id);
  const title=c=>c.kind==='dm'?nm(other(c)):c.title;
  const pic=c=>c.kind==='dm'?other(c)?.avatar:c.avatar;
  const amAdmin=!!cur&&(mem[cur.id]||[]).some(p=>p.id===me.id&&p.is_admin);
  const selecting=selIds.length>0||selMode,gcount=(grants[aid]||[]).length;
  const visibleMsg=m=>{const c=clr[m.chat_id];if(!c)return true;const t=+new Date(m.created_at);if(t>+new Date(c))return true;return(grants[m.chat_id]||[]).some(g=>t>=+new Date(g.from_ts)&&t<=+new Date(g.to_ts))};
  const left=c=>{const m=Math.max(0,Math.round((new Date(c.expires_at)-now)/60000));return `${Math.floor(m/60)}h ${m%60}m left`};
  const prev=c=>{const l=last[c.id];if(!l)return c.kind==='temp'?`Temp room · ${left(c)}`:'No messages yet';return(l.from===me.id?'You: ':'')+(l.p?(l.p.t==='file'?'📎 '+l.p.name:l.p.t==='react'?'Reacted '+l.p.e:l.p.t==='hreq'?'Requested chat history':l.p.t==='hgrant'?'Shared chat history':l.p.text):'🔒 Encrypted message')};

  const dec=useCallback(async m=>{
    if(!plain.current.has(m.id)){let p=null;
      try{if(m.wraps?.t){const k=await C.getTempKey(m.chat_id);if(!k)return{...m,p:null};p=await C.decryptTemp(m,k)}else p=await C.decryptMessage(m,me.id,priv)}catch{}
      plain.current.set(m.id,p)}
    return{...m,p:plain.current.get(m.id)};
  },[me.id,priv]);
  const load=useCallback(async()=>{
    const {data,error}=await sb.from('chat_members').select('chat_id,is_admin,cleared_at,chats(id,kind,title,ttl_hours,code,expires_at,avatar),profiles(id,username,display_name,public_key,avatar,is_guest)');
    if(error&&!data){try{const c=JSON.parse(LS('nl-cc:'+me.id)||'null');if(c){setMem(c.by);setClr(c.cl);setChats(c.cs)}}catch{}setLoaded(true);return}
    const by={},cs={},cl={};(data||[]).forEach(r=>{(by[r.chat_id]??=[]).push({...r.profiles,is_admin:r.is_admin});cs[r.chat_id]=r.chats;if(r.profiles?.id===me.id)cl[r.chat_id]=r.cleared_at});
    try{localStorage.setItem('nl-cc:'+me.id,JSON.stringify({by:Object.fromEntries(Object.entries(by).map(([k,v])=>[k,v.map(p=>({...p,avatar:undefined}))])),cl,cs:Object.values(cs).filter(Boolean).map(c=>({...c,avatar:undefined}))}))}catch{}
    setMem(by);setClr(cl);setChats(Object.values(cs).filter(Boolean));setLoaded(true);loadGrants();
  },[]);
  async function syncChat(id,full){
    let lastAt=full?null:(await A.byChat(me.id,id)).pop()?.created_at;
    for(;;){let qy=sb.from('messages').select('*').eq('chat_id',id).order('created_at').limit(500);if(lastAt)qy=qy.gt('created_at',lastAt);
      const {data}=await qy;if(!data?.length)break;await A.put(me.id,data);lastAt=data[data.length-1].created_at;if(data.length<500)break}
  }

  useEffect(()=>{const t=setInterval(()=>setNow(Date.now()),30000);return()=>clearInterval(t)},[]);
  useEffect(()=>{if(first){pushChat();setAid(first);setSide(false)}},[first]);
  useEffect(()=>{if(aid)C.getTempKey(aid).then(k=>setKeyed(!!k))},[aid,ver]);
  useEffect(()=>{const n=Object.values(unread).reduce((a,b)=>a+b,0);document.title=(n?`(${n}) `:'')+'NexLink.Chat'},[unread]);
  useEffect(()=>{const f=e=>e.key==='Escape'&&(setModal(null),setEmo(false),setLb(null),setPview(null),setMenu(null),setRxp(null),setFwd(null),setSelIds([]),setSelMode(false),setGrantFor(null));window.addEventListener('keydown',f);return()=>window.removeEventListener('keydown',f)},[]);
  useEffect(()=>{if(!txt&&taR.current)taR.current.style.height='auto'},[txt]);
  useEffect(()=>{let t;const f=()=>{clearTimeout(t);if(document.hidden)t=setTimeout(()=>setLive(false),120000);else setLive(true)};document.addEventListener('visibilitychange',f);return()=>{document.removeEventListener('visibilitychange',f);clearTimeout(t)}},[]);
  useEffect(()=>{
    load();if(!live)return;
    const ch=sb.channel('cc')
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'messages'},async({new:m})=>{
        const c0=chatsR.current.find(c=>c.id===m.chat_id);if(c0&&keepable(c0))A.put(me.id,[m]).catch(()=>{});
        const x=await dec(m);
        if(x.p?.t==='hgrant'&&x.p.to===me.id){await loadGrants();syncChat(m.chat_id,true).then(()=>setVer(v=>v+1)).catch(()=>{})}
        setLast(l=>({...l,[m.chat_id]:{p:x.p,at:m.created_at,from:m.sender_id}}));
        setMsgs(o=>o[m.chat_id]?{...o,[m.chat_id]:[...o[m.chat_id].filter(y=>y.id!==m.id),x]}:o);
        if(m.sender_id!==me.id&&x.p?.t!=='react'&&(m.chat_id!==aidR.current||document.hidden)){
          setUn(u=>({...u,[m.chat_id]:(u[m.chat_id]||0)+1}));
          if(document.hidden&&LS('nl-push:'+me.id)!=='1'&&!mutedR.current.includes(m.chat_id)&&'Notification' in window&&Notification.permission==='granted')new Notification('NexLink.Chat',{body:'New encrypted message',icon:'/icon-192.png'});
        }
      })
      .on('postgres_changes',{event:'*',schema:'public',table:'chat_members'},()=>load())
      .on('postgres_changes',{event:'DELETE',schema:'public',table:'messages'},({old:o})=>removeLocal(o.id))
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
      if(c&&keepable(c)){const gk='nl-gs:'+me.id+':'+aid,full=+LS(gk)!==gcount;try{await syncChat(aid,full);if(full)LS(gk,String(gcount))}catch{}rows=(await A.byChat(me.id,aid)).slice(-lim)}
      else{const {data}=await sb.from('messages').select('*').eq('chat_id',aid).order('created_at',{ascending:false}).limit(80);rows=(data||[]).reverse()}
      const x=await Promise.all(rows.map(dec));
      if(!off)setMsgs(o=>({...o,[aid]:x}));
    })();
    return()=>{off=true};
  },[aid,live,dec,ver,gcount,lim]);
  useEffect(()=>{
    const b=boxR.current;if(!b)return;
    const near=b.scrollHeight-b.scrollTop-b.clientHeight<160,mine=(msgs[aid]||[]).slice(-1)[0]?.sender_id===me.id;
    if(near||mine||b.dataset.chat!==aid){endR.current?.scrollIntoView({block:'end'});b.dataset.chat=aid}
  },[msgs,aid]);
  useEffect(()=>{
    const s=q.trim().toLowerCase().replace(/[^a-z0-9_]/g,'');
    if(me.is_guest||s.length<2){setHits([]);return}
    const t=setTimeout(async()=>{
      const {data}=await sb.from('profiles').select('id,username,display_name,avatar').ilike('username',s+'%').eq('is_guest',false).neq('msg_policy','none').neq('id',me.id).limit(6);
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

  useEffect(()=>{const f=e=>setLb(e.detail);window.addEventListener('nl-img',f);return()=>window.removeEventListener('nl-img',f)},[]);
  useEffect(()=>{const f=e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();setSide(true);setTimeout(()=>searchR.current?.focus(),50)}};window.addEventListener('keydown',f);return()=>window.removeEventListener('keydown',f)},[]);
  useEffect(()=>{
    setOnline(navigator.onLine);
    const on=()=>{setOnline(true);setVer(v=>v+1);load();flushOutbox()},off=()=>setOnline(false);
    window.addEventListener('online',on);window.addEventListener('offline',off);
    const t=setTimeout(()=>{if(navigator.onLine)flushOutbox()},3000);
    return()=>{window.removeEventListener('online',on);window.removeEventListener('offline',off);clearTimeout(t)};
  },[]);
  useEffect(()=>{if(notice)flash(notice)},[notice]);
  useEffect(()=>{
    if(!startUser||startDone.current)return;startDone.current=true;
    (async()=>{
      const {data}=await sb.rpc('get_public_profile',{uname:startUser});const u=data?.[0];
      try{history.replaceState(history.state,'','/')}catch{}
      if(!u)return flash('That profile does not exist');
      if(u.id===me.id)return setModal('s');
      setPview(u);
    })();
  },[startUser]);
  useEffect(()=>{if(modal==='s'&&!me.is_guest)D.linked().then(setDriveOk)},[modal]);
  useEffect(()=>{if(!aid)return;const f=()=>LS('nl-read:'+me.id+':'+aid,String(Date.now()));window.addEventListener('beforeunload',f);return()=>{f();window.removeEventListener('beforeunload',f)}},[aid]);
  function removeLocal(id){A.del(me.id,id).catch(()=>{});setMsgs(o=>Object.fromEntries(Object.entries(o).map(([k,v])=>[k,v.filter(x=>x.id!==id)])))}
  const snip=m=>m.p?(m.p.t==='file'?'📎 '+m.p.name:m.p.text).slice(0,80):'Encrypted message';
  const jump=id=>{const el=document.getElementById('m-'+id);if(el){el.scrollIntoView({block:'center',behavior:'smooth'});el.classList.add('hl');setTimeout(()=>el.classList.remove('hl'),1500)}};
  async function del(m){
    if(!confirm('Delete this message for everyone?'))return;
    const {error}=await sb.from('messages').delete().eq('id',m.id);
    if(error)return flash(error.message);removeLocal(m.id);setSel(null);
  }
  async function react(m,e){const off=reacts[m.id]?.[me.id]===e;if(!off){setBurst({id:m.id,e,k:Date.now()});setTimeout(()=>setBurst(null),1100)}try{await post({t:'react',to:m.id,e:off?'':e})}catch(x){flash(x.message)}}
  const togglePin=id=>{const n=pins.includes(id)?pins.filter(x=>x!==id):[...pins,id];setPins(n);LS('nl-pin:'+me.id,JSON.stringify(n))};
  const toggleMute=async id=>{
    const n=muted.includes(id)?muted.filter(x=>x!==id):[...muted,id];setMuted(n);LS('nl-mute:'+me.id,JSON.stringify(n));
    try{if(pushOn){const sub=await (await navigator.serviceWorker.ready).pushManager.getSubscription();if(sub)await sb.from('push_subs').update({muted:n}).eq('endpoint',sub.endpoint)}}catch{}
  };
  async function enablePush(){
    try{
      const key=process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;if(!key)return flash('Push is not configured yet');
      if(!('serviceWorker' in navigator)||!('PushManager' in window))return flash('This browser does not support push notifications');
      if(await Notification.requestPermission()!=='granted')return flash('Notifications are blocked in the browser settings');
      const reg=await navigator.serviceWorker.ready;
      const sub=(await reg.pushManager.getSubscription())||await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:urlB64(key)});
      const {error}=await sb.from('push_subs').upsert({user_id:me.id,endpoint:sub.endpoint,sub:sub.toJSON(),muted},{onConflict:'endpoint'});if(error)throw error;
      LS('nl-push:'+me.id,'1');setPushOn(true);flash('Background notifications are on');
    }catch(x){flash(x.message||'Could not turn on notifications')}
  }
  async function disablePush(){
    try{const sub=await (await navigator.serviceWorker.ready).pushManager.getSubscription();if(sub){await sb.from('push_subs').delete().eq('endpoint',sub.endpoint);await sub.unsubscribe()}}catch{}
    LS('nl-push:'+me.id,null);setPushOn(false);
  }
  function doReply(m){
    if(!cur||m.pending||(cur.kind==='temp'&&!keyed))return;
    const sp=(mem[cur.id]||[]).find(p=>p.id===m.sender_id);
    setEditing(null);setReplyTo({id:m.id,n:nm(sp),t:snip(m)});setSel(null);taR.current?.focus();
  }
  async function openProfile(p){
    if(!p)return;let sn=null;
    try{if(p.id!==me.id&&p.public_key?.x&&me.public_key?.x)sn=await C.safety(me.public_key,p.public_key)}catch{}
    setPview({...p,sn});
  }
  const openHead=()=>!cur?null:cur.kind==='dm'?openProfile(other(cur)):cur.kind==='group'?setModal('i'):null;
  const openMenu=(m,x,y,touch)=>{
    if(m.pending)return;setRxp(null);menuAt.current=Date.now();
    if(touch){const r=document.getElementById('m-'+m.id)?.getBoundingClientRect();
      if(r){x=m.sender_id===me.id?r.right-230:r.left;y=r.bottom+8;if(y+340>window.innerHeight)y=Math.max(8,r.top-348)}}
    setMenu({m,x,y});
  };
  const copyText=t=>navigator.clipboard?.writeText(t);
  const togglePick=id=>setSelIds(a=>a.includes(id)?a.filter(x=>x!==id):[...a,id]);
  const clearSel=()=>{setSelIds([]);setSelMode(false);setGrantFor(null)};
  useEffect(()=>{setSelIds([]);setSelMode(false);setGrantFor(null);setMenu(null);setRxp(null);setReplyTo(null);setEditing(null);setLim(300);setTxt(drafts.current[aid]||'')},[aid]);
  const pushChat=()=>{if(isMob()&&!chatPushed.current){history.pushState({nl:'chat'},'');chatPushed.current=true}};
  const goBack=()=>{if(chatPushed.current)history.back();else setSide(true)};
  // Android/mobile back: chat -> list, then "press back again to exit"
  useEffect(()=>{
    if(!isMob())return;
    history.pushState({nl:'root'},'');
    const f=e=>{
      if(e.state&&(e.state.nl||!e.state.__NA))e.stopImmediatePropagation();
      if(skipPop.current){skipPop.current=false;return}
      if(!isMob())return;
      if(chatPushed.current){chatPushed.current=false;setSide(true);return}
      if(exitArm.current){history.back();return}
      exitArm.current=true;flash('Press back again to exit');history.pushState({nl:'root'},'');setTimeout(()=>{exitArm.current=false},2000);
    };
    window.addEventListener('popstate',f,true);return()=>window.removeEventListener('popstate',f,true);
  },[]);
  useEffect(()=>{if(side&&chatPushed.current&&isMob()){chatPushed.current=false;skipPop.current=true;history.back()}},[side]);
  useEffect(()=>{const b=boxR.current;if(!b)return;const f=e=>{if(swRef.current?.held)e.preventDefault()};b.addEventListener('touchmove',f,{passive:false});return()=>b.removeEventListener('touchmove',f)},[aid,!!cur]);
  // "Name: text" lines, replies as: Name: Replied on "quote" text
  const fmtMsgs=list=>[...list].sort((a,b)=>new Date(a.created_at)-new Date(b.created_at)).filter(m=>m.p&&m.p.t!=='hreq'&&m.p.t!=='hgrant').map(m=>{
    const sp=(mem[m.chat_id]||[]).find(p=>p.id===m.sender_id),t=m.p.t==='file'?'[File] '+m.p.name:(ed[m.id]??m.p.text);
    return `${nm(sp)}: ${m.p.re?`Replied on "${m.p.re.t}" `:''}${t}`}).join('\n');
  async function forwardTo(c){
    const list=fwd,text=fmtMsgs(list);setFwd(null);setFq('');
    if(text.length>3500)return flash('Too long to forward at once. Select fewer messages.');
    try{await post({text,fwd:true},null,c);flash('Forwarded to '+title(c));clearSel()}catch(x){flash(x.message)}
  }
  async function deleteMsgs(list){
    const mineIds=list.filter(m=>m.sender_id===me.id).map(m=>m.id),others=list.filter(m=>m.sender_id!==me.id).map(m=>m.id);
    const n=list.length,msg=others.length?`Delete ${n} message${n>1?'s':''}? Yours are removed for everyone. Messages from others are removed only for you.`:`Delete ${n>1?n+' messages':'this message'} for everyone?`;
    if(!confirm(msg))return;
    if(mineIds.length){const {error}=await sb.from('messages').delete().in('id',mineIds);if(error)return flash(error.message)}
    if(others.length){const nh=[...hid,...others];setHid(nh);LS('nl-hide:'+me.id,JSON.stringify(nh))}
    list.forEach(m=>removeLocal(m.id));clearSel();
  }
  async function clearChat(){
    if(!confirm('Clear this chat for you? Other people keep their copy. If everyone clears it, the messages are deleted for good.'))return;
    const id=cur.id,{error}=await sb.rpc('clear_chat',{c:id});if(error)return flash(error.message);
    await A.clearChat(me.id,id).catch(()=>{});setMsgs(o=>({...o,[id]:[]}));setLast(l=>({...l,[id]:undefined}));await load();flash('Chat cleared');
  }
  async function reqHistory(){
    if(!confirm('Ask the other people in this chat to share the earlier messages with you?'))return;
    try{await post({t:'hreq'});flash('Request sent')}catch(x){flash(x.message)}
  }
  async function loadGrants(){
    const {data,error}=await sb.from('history_grants').select('chat_id,from_ts,to_ts').eq('user_id',me.id);
    if(error)return;const g={};(data||[]).forEach(r=>{(g[r.chat_id]??=[]).push(r)});setGrants(g);
  }
  async function shareHistory(){
    const ps=picked.slice().sort((a,b)=>new Date(a.created_at)-new Date(b.created_at));if(!ps.length)return;
    const {error}=await sb.rpc('grant_history',{c:cur.id,u:grantFor.u,from_id:ps[0].id,to_id:ps[ps.length-1].id});if(error)return flash(error.message);
    try{await post({t:'hgrant',to:grantFor.u})}catch{}
    flash('Chat history shared');clearSel();
  }
  // PC: press on empty chat space and drag up/down to select every message row the drag touches
  function startDrag(e){
    const box=boxR.current;if(!box||e.button!==0||e.target.closest('.b,button,a,input,textarea,.hov,.sysmsg'))return;
    const r0=box.getBoundingClientRect();if(e.clientX>=r0.left+box.clientWidth)return;
    e.preventDefault();dragMoved.current=false;
    const y0=e.clientY-r0.top+box.scrollTop,sy=e.clientY;
    const move=ev=>{
      if(!dragMoved.current&&Math.abs(ev.clientY-sy)<6)return;dragMoved.current=true;
      const rr=box.getBoundingClientRect();
      if(ev.clientY<rr.top+30)box.scrollTop-=14;else if(ev.clientY>rr.bottom-30)box.scrollTop+=14;
      const y1=ev.clientY-rr.top+box.scrollTop,lo=Math.min(y0,y1),hi=Math.max(y0,y1);
      setSelIds([...box.querySelectorAll('.mrow')].filter(row=>{const q=row.getBoundingClientRect(),t=q.top-rr.top+box.scrollTop;return t+q.height>=lo&&t<=hi}).map(row=>row.dataset.mid));
    };
    const up=()=>{window.removeEventListener('mousemove',move);window.removeEventListener('mouseup',up);setTimeout(()=>{dragMoved.current=false},0)};
    window.addEventListener('mousemove',move);window.addEventListener('mouseup',up);
  }
  // touch: swipe to reply (others right, yours left); hold = menu; hold then drag up/down = multi-select
  const swipe=(m,mine)=>({
    onTouchStart:e=>{
      if(selecting){swRef.current={};return}
      const t=e.touches[0],o=swRef.current={x:t.clientX,y:t.clientY,lock:null,d:0,held:false,drag:false};
      o.timer=setTimeout(()=>{if(o.lock)return;o.held=true;navigator.vibrate?.(15);openMenu(m,o.x,o.y,true)},500);
    },
    onTouchMove:e=>{
      const o=swRef.current;if(!o||o.x==null)return;
      const t=e.touches[0],dx=t.clientX-o.x,dy=t.clientY-o.y;
      if(o.held){
        if(!o.drag&&Math.abs(dy)>14){o.drag=true;setMenu(null)}
        if(o.drag){
          const row=document.elementFromPoint(t.clientX,t.clientY)?.closest('.mrow'),ids=shown.map(x=>x.id),a=ids.indexOf(m.id),b=row?ids.indexOf(row.dataset.mid):-1;
          if(a>=0&&b>=0)setSelIds(ids.slice(Math.min(a,b),Math.max(a,b)+1));
        }
        return;
      }
      if(o.lock==null&&(Math.abs(dx)>8||Math.abs(dy)>8)){clearTimeout(o.timer);o.lock=Math.abs(dx)>Math.abs(dy)*1.3?'x':'y'}
      if(o.lock!=='x')return;
      const dir=mine?-1:1,d=Math.max(0,Math.min(72,dx*dir)),row=e.currentTarget;
      o.d=d;row.style.transition='none';row.style.transform=`translateX(${d*dir}px)`;
      const ic=row.querySelector('.swi');if(ic)ic.style.opacity=String(Math.min(1,d/56));
    },
    onTouchEnd:e=>{
      const o=swRef.current;if(!o||o.x==null)return;
      clearTimeout(o.timer);
      const row=e.currentTarget;row.style.transition='transform .2s';row.style.transform='';
      const ic=row.querySelector('.swi');if(ic)ic.style.opacity='0';
      if(o.lock==='x'&&o.d>=56&&!o.held){navigator.vibrate?.(12);doReply(m)}
      swRef.current={};
    },
    onTouchCancel:()=>{clearTimeout(swRef.current?.timer);swRef.current={}}
  });
  async function setPolicy(v){
    if(v==='none'&&!confirm('This deactivates your account: nobody can find or message you. Sign in again any time to reactivate it. Continue?'))return;
    const {error}=await sb.from('profiles').update({msg_policy:v}).eq('id',me.id);if(error)return flash(error.message);
    setProf(p=>({...p,msg_policy:v}));
    if(v==='none')await sb.auth.signOut();else flash('Privacy updated');
  }
  async function shareLink(){
    const url=`${location.origin}/u/${prof.username}`;
    try{if(navigator.share){await navigator.share({title:'NexLink.Chat',text:'Chat with me on NexLink.Chat',url});return}}catch{}
    copyText(url);flash('Profile link copied');
  }
  const linkDrive=()=>sb.auth.signInWithOAuth({provider:'google',options:{redirectTo:window.location.origin,scopes:DRIVE_SCOPE,queryParams:{access_type:'offline',prompt:'consent'}}});
  // ---- actions ----
  const open=id=>{pushChat();setReadAt(+LS('nl-read:'+me.id+':'+id)||0);setAid(id);setSide(false);setUn(u=>({...u,[id]:0}))};
  async function dm(u){const {data,error}=await sb.rpc('create_dm',{other:u.id});if(error)return flash(error.message);setQ('');await load();open(data)}
  async function group(ev){
    ev.preventDefault();const f=new FormData(ev.target);
    const names=String(f.get('u')).split(/[\s,]+/).map(x=>x.replace('@','').toLowerCase()).filter(Boolean);
    const {data:ps}=await sb.from('profiles').select('id').in('username',names);
    if(!ps?.length)return flash('No matching usernames found');
    const {data,error}=await sb.rpc('create_group',{t:String(f.get('t')),members:ps.map(p=>p.id),ttl:+f.get('ttl')});
    if(error)return flash(error.message);setModal(null);await load();open(data);
  }
  async function sendRaw(chat,payload,fp,id){
    let e;
    if(chat.kind==='temp'){const k=await C.getTempKey(chat.id);if(!k)throw new Error('Enter the room password first');e=await C.encryptTemp(payload,k,chat.id)}
    else e=await C.encryptMessage(payload,memR.current[chat.id],chat.id);
    const {error}=await sb.from('messages').insert({id,chat_id:chat.id,sender_id:me.id,file_path:fp||null,...e});
    if(error&&error.code!=='23505')throw error;
  }
  async function post(payload,fp,tc){
    const chat=tc||cur,id=crypto.randomUUID(),cid=chat.id,opt=!tc&&payload.t!=='react'&&payload.t!=='edit';
    if(opt){plain.current.set(id,payload);setMsgs(o=>({...o,[cid]:[...(o[cid]||[]),{id,chat_id:cid,sender_id:me.id,created_at:new Date().toISOString(),expires_at:new Date(Date.now()+864e5).toISOString(),p:payload,pending:true}]}))}
    try{await sendRaw(chat,payload,fp,id)}
    catch(x){
      const net=!navigator.onLine||x instanceof TypeError||/fetch|network|Failed to/i.test(x?.message||'');
      if(net&&payload.t!=='file'&&chat.kind!=='temp'){const q=JSON.parse(LS('nl-out:'+me.id)||'[]');q.push({id,cid,payload});LS('nl-out:'+me.id,JSON.stringify(q));setOutN(q.length);return}
      if(opt)setMsgs(o=>({...o,[cid]:(o[cid]||[]).filter(m=>m.id!==id)}));
      throw x;
    }
    if(opt)setMsgs(o=>({...o,[cid]:(o[cid]||[]).map(m=>m.id===id?{...m,pending:false}:m)}));
    if(payload.t!=='react'&&payload.t!=='edit')api('/api/push',{chatId:cid}).catch(()=>{});
  }
  async function flushOutbox(){
    const q=JSON.parse(LS('nl-out:'+me.id)||'[]');if(!q.length)return;
    const left=[];
    for(const it of q){
      const chat=chatsR.current.find(c=>c.id===it.cid);if(!chat){left.push(it);continue}
      try{await sendRaw(chat,it.payload,null,it.id);setMsgs(o=>({...o,[it.cid]:(o[it.cid]||[]).map(m=>m.id===it.id?{...m,pending:false}:m)}))}catch{left.push(it)}
    }
    LS('nl-out:'+me.id,JSON.stringify(left));setOutN(left.length);
  }
  async function send(ev){
    ev.preventDefault();const t=txt.trim();if(!t||!cur)return;setTxt('');drafts.current[cur.id]='';setEmo(false);
    if('Notification' in window&&Notification.permission==='default')Notification.requestPermission();
    const re=replyTo,ed0=editing;try{await post(ed0?{t:'edit',to:ed0.id,text:t}:re?{text:t,re}:{text:t});setReplyTo(null);setEditing(null)}catch(x){setTxt(t);flash(x.message)}
  }
  async function sendFile(f){
    if(!f||!cur)return;
    try{
      f=await shrink(f);if(f.size>MAXF)return flash('Max file size is 100 MB');
      flash('Encrypting and uploading…');
      const {key:path,url,token}=await api('/api/files/upload',{chatId:cur.id,size:f.size+16});
      const e=await C.encryptFile(await f.arrayBuffer());
      if(token){const {error}=await sb.storage.from('files').uploadToSignedUrl(path,token,new Blob([e.ct]));if(error)throw error}
      else{const up=await fetch(url,{method:'PUT',body:new Blob([e.ct])});if(!up.ok)throw new Error('Upload failed. Check the bucket CORS settings.')}
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
    .sort((a,b)=>(pins.includes(b.id)-pins.includes(a.id))||new Date(last[b.id]?.at||0)-new Date(last[a.id]?.at||0));
  const all=cur?(msgs[cur.id]||[]).filter(m=>keepable(cur)||new Date(m.expires_at)>Date.now()).filter(visibleMsg).filter(m=>!hid.includes(m.id)):[];
  const reacts={},ed={},byId={};
  all.forEach(m=>{byId[m.id]=m});
  all.forEach(m=>{const p=m.p;if(!p)return;
    if(p.t==='react'&&byId[p.to]){const r=(reacts[p.to]??={});if(p.e)r[m.sender_id]=p.e;else delete r[m.sender_id]}
    else if(p.t==='edit'&&byId[p.to]?.sender_id===m.sender_id)ed[p.to]=p.text});
  const shown=all.filter(m=>m.p?.t!=='react'&&m.p?.t!=='edit').filter(m=>!find||(m.p&&((ed[m.id]??m.p.text)||m.p.name||'').toLowerCase().includes(find.toLowerCase())));
  const picked=shown.filter(m=>selIds.includes(m.id));
  const reactSig=JSON.stringify(Object.entries(reacts).flatMap(([id,r])=>Object.entries(Object.values(r).reduce((a,e)=>(a[e]=(a[e]||0)+1,a),{})).map(([e,n])=>[id+'|'+e,n])));
  useEffect(()=>{
    if(!all.length)return;
    const cur2=Object.fromEntries(JSON.parse(reactSig)),prev=prevRx.current[aid];prevRx.current[aid]=cur2;
    if(!prev)return;const f={};
    for(const [k,n] of Object.entries(cur2))if(n>(prev[k]||0))f[k]=1;
    if(Object.keys(f).length){setFresh(f);setTimeout(()=>setFresh({}),900)}
  },[reactSig,aid]);
  const mm=menu?.m,mmine=mm?.sender_id===me.id;
  const ctxItems=mm?[{t:'Reply',i:IC.reply,f:()=>doReply(mm)},{t:'Forward',i:IC.fwd,f:()=>setFwd([mm])},mmine&&mm.p?.text&&!mm.p.t&&{t:'Edit',i:IC.edit,f:()=>{setEditing(mm);setTxt(ed[mm.id]??mm.p.text);taR.current?.focus()}},mm.p?.text&&{t:'Copy',i:IC.copy,f:()=>{copyText(ed[mm.id]??mm.p.text);flash('Copied')}},{t:'Select',i:IC.select,f:()=>setSelIds([mm.id])},{t:mmine?'Delete':'Delete for me',i:IC.trash,danger:true,f:()=>deleteMsgs([mm])}]:[];

  return <div className={'app'+(side?' open':'')}>
    <nav className="rail"><img src="/logo.png" width="42" height="42" alt="NexLink.Chat"/>
      {[['all','Chats',IC.chat],['group','Groups',IC.users],['temp','Temp',IC.timer]].map(([k,l,i])=><button key={k} className={'rb'+(tab===k?' on':'')} onClick={()=>{setTab(k);setSide(true)}}><Ic d={i}/><span>{l}</span></button>)}
      <div className="grow"/><button className="rb" onClick={()=>setModal('s')}><Ic d={IC.sliders}/><span>Settings</span></button></nav>
    <aside>
      <header><img className="hlogo" src="/logo.png" width="34" height="34" alt=""/><h2 className="grow">Chats</h2><span className={'dot'+(live?' on':'')} title={live?'Live':'Paused to save free quota'}/>
        <Menu label="New" icon={IC.plus} items={[!me.is_guest&&{t:'New group',i:IC.users,f:()=>setModal('g')},{t:'Temporary room',i:IC.timer,f:()=>setModal('t')}]}/>
        <Menu label="Menu" items={[{t:'Settings',i:IC.sliders,f:()=>setModal('s')},{t:'Switch theme',i:IC.moon,f:toggleTheme},{t:'Sign out',i:IC.out,danger:true,f:signOut}]}/></header>
      <input ref={searchR} className="search" placeholder={me.is_guest?'Search chats':'Search chats or find people'} value={q} onChange={e=>setQ(e.target.value)} aria-label="Search"/>
      <div className="chips">{[['all','All'],['dm','Direct'],['group','Groups'],['unread','Unread']].map(([k,l])=><button key={k} className={'chip'+(tab===k?' on':'')} onClick={()=>setTab(k)}>{l}</button>)}</div>
      {bk.stale&&bk.auto&&<div className="banner">Auto-backup needs a tap<button onClick={backupNow}>Back up</button></div>}
      <div className="list">
        {hits.length>0&&<><p className="mute pad">People</p>{hits.map(h=><div key={h.id} className="row" onClick={()=>dm(h)}><Av n={h.display_name} src={h.avatar}/><div className="grow"><b>{h.display_name}</b><span>@{h.username}</span></div></div>)}</>}
        {!loaded&&[0,1,2,3].map(i=><div key={i} className="row skel"><div className="av sk"/><div className="grow"><div className="skl w60"/><div className="skl w40"/></div></div>)}
        {vis.map(c=><div key={c.id} className={'row'+(c.id===aid?' on':'')} tabIndex={0} role="button" onKeyDown={e=>e.key==='Enter'&&open(c.id)} onClick={()=>open(c.id)}>
          <Av n={title(c)} src={pic(c)}/>
          <div className="grow"><div className="r1"><b>{title(c)}</b><time>{pins.includes(c.id)?'📌 ':''}{muted.includes(c.id)?'🔕 ':''}{last[c.id]?ago(last[c.id].at):''}</time></div>
            <div className="r1"><span>{prev(c)}</span>{unread[c.id]>0&&<i className="badge">{unread[c.id]}</i>}</div></div></div>)}
        {loaded&&!vis.length&&!hits.length&&<div className="empty"><img src="/logo.png" width="72" height="72" alt=""/><p className="mute">{tab==='all'&&!q?'No chats yet':'Nothing matches here'}</p>{tab==='all'&&!q&&<>{!me.is_guest&&<button className="wide" onClick={()=>setModal('g')}>＋ New group</button>}<button className="wide alt" onClick={()=>setModal('t')}>⏱ Temporary room</button><p className="mute" style={{fontSize:13}}>Or type a username above to find someone.</p></>}</div>}
      </div>
    </aside>
    <main onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();const f=e.dataTransfer.files[0];if(f&&cur&&!(cur.kind==='temp'&&!keyed))sendFile(f)}}>{cur?<>
      {selecting&&<header className="selbar"><button className="ic" aria-label="Cancel selection" onClick={clearSel}>✕</button><b className="grow">{grantFor?`Select messages to share with ${grantFor.name}`:`${selIds.length} selected`}</b>
        {grantFor?<button className="sm" disabled={!selIds.length} onClick={shareHistory}>Share ({selIds.length})</button>:<>
          <button className="ic" aria-label="Forward" title="Forward" disabled={!selIds.length} onClick={()=>setFwd(picked)}><Ic d={IC.fwd}/></button>
          <button className="ic" aria-label="Copy" title="Copy" disabled={!selIds.length} onClick={()=>{copyText(fmtMsgs(picked));flash('Copied');clearSel()}}><Ic d={IC.copy}/></button>
          <button className="ic" aria-label="Delete" title="Delete" disabled={!selIds.length} onClick={()=>deleteMsgs(picked)}><Ic d={IC.trash}/></button></>}</header>}
      <header><button className="ic back" aria-label="Back" onClick={goBack}><Ic d={IC.back}/></button><span className="clk" onClick={openHead}><Av n={title(cur)} src={pic(cur)}/></span>
        <div className="grow clk" onClick={openHead}><b>{title(cur)}</b><span className={'mute'+(cur.kind==='temp'&&new Date(cur.expires_at)-now<600000?' warn':'')}>{cur.kind==='temp'?`Code ${cur.code.slice(0,4)}-${cur.code.slice(4)} · ${left(cur)} · ${(mem[cur.id]||[]).length} people`:cur.kind==='dm'?'End-to-end encrypted':`${(mem[cur.id]||[]).length} members`}</span></div>
        <Menu label="Chat options" items={[cur.kind==='temp'&&{t:'Copy invite',i:IC.copy,f:()=>{navigator.clipboard?.writeText(`Join my NexLink.Chat temp room\nCode: ${cur.code.slice(0,4)}-${cur.code.slice(4)}\n${location.origin}\n(Ask me for the password)`);flash('Invite copied')}},{t:pins.includes(cur.id)?'Unpin chat':'Pin chat',i:IC.pin,f:()=>togglePin(cur.id)},{t:muted.includes(cur.id)?'Unmute notifications':'Mute notifications',i:IC.bell,f:()=>toggleMute(cur.id)},cur.kind==='group'&&{t:'Group info & members',i:IC.users,f:()=>setModal('i')},{t:'Search in chat',i:IC.search,f:()=>setFind('')},cur.kind==='group'&&{t:'Change group photo',i:IC.camera,f:()=>grpR.current.click()},cur.kind!=='temp'&&{t:'Disappearing messages',i:IC.timer,f:()=>setModal('d')},cur.kind==='dm'&&{t:'Verify safety number',i:IC.shield,f:verify},{t:'Select messages',i:IC.select,f:()=>setSelMode(true)},cur.kind!=='temp'&&clr[cur.id]&&{t:'Request chat history',i:IC.hist,f:reqHistory},cur.kind!=='temp'&&{t:'Clear chat',i:IC.trash,f:clearChat},cur.kind!=='dm'&&{t:cur.kind==='temp'?'Leave room':'Leave group',i:IC.out,danger:true,f:leave}]}/></header>
      <input ref={grpR} type="file" accept="image/*" hidden onChange={e=>{setGrpPic(e.target.files[0]);e.target.value=''}}/>
      {find!=null&&<div className="findbar"><input autoFocus value={find} onChange={e=>setFind(e.target.value)} placeholder="Search in this chat" aria-label="Search in this chat"/><button className="ic" aria-label="Close search" onClick={()=>setFind(null)}>✕</button></div>}
      <div className={'msgs'+(selecting?' sel':'')} ref={boxR} onMouseDown={startDrag} onScroll={e=>{const b=e.currentTarget;setAtBottom(b.scrollHeight-b.scrollTop-b.clientHeight<200)}}>
        {cur&&keepable(cur)&&(msgs[cur.id]||[]).length>=lim&&<button className="alt sm older" onClick={()=>setLim(l=>l+300)}>Load older messages</button>}
        {!shown.length&&<p className="mute" style={{margin:'auto'}}>No messages yet. Say hello.</p>}
        {shown.map((m,i)=>{const pv=shown[i-1],d=new Date(m.created_at),head=!pv||pv.sender_id!==m.sender_id||d-new Date(pv.created_at)>300000,newDay=!pv||new Date(pv.created_at).toDateString()!==d.toDateString(),mine=m.sender_id===me.id,sp=(mem[cur.id]||[]).find(p=>p.id===m.sender_id),sn=nm(sp),firstNew=readAt>0&&!mine&&d>readAt&&(!pv||new Date(pv.created_at)<=readAt);
          if(m.p?.t==='hreq'||m.p?.t==='hgrant')return <div key={m.id} className="sysmsg">{m.p.t==='hreq'?(mine?'You asked for the chat history.':<>{sn} asked for the chat history from before they cleared this chat. <button onClick={()=>{setGrantFor({u:m.sender_id,name:sn});setSelMode(true);setSelIds([]);flash('Select the first and last message you want to share')}}>Share…</button></>):<>{sn} shared chat history with {m.p.to===me.id?'you':nm((mem[cur.id]||[]).find(p=>p.id===m.p.to))}.</>}</div>;
          return <div key={m.id} style={{display:'contents'}}>
            {newDay&&<div className="day">{d.toLocaleDateString([],{weekday:'long',day:'numeric',month:'short'})}</div>}
            {firstNew&&<div className="newdiv"><span>New messages</span></div>}
            <div className={'mrow'+(mine?' mine':'')+(selIds.includes(m.id)?' picked':'')} data-mid={m.id} onClick={()=>{if(dragMoved.current)return;if(selecting)togglePick(m.id)}} {...swipe(m,mine)}>{selecting&&<span className={'chk'+(selIds.includes(m.id)?' on':'')} aria-hidden="true"/>}<span className="swi" aria-hidden="true"><Ic d={IC.reply} s={16}/></span>{!mine&&(head?<button className="avb" onClick={e=>{if(!selecting){e.stopPropagation();openProfile(sp)}}} aria-label={'Open '+sn+' profile'}><Av n={sn} src={sp?.avatar}/></button>:<span className="avs"/>)}<div id={'m-'+m.id} className={'b'+(mine?' me':'')+(head?' first':'')+(m.pending?' pending':'')+(menu?.m.id===m.id?' held':'')} onContextMenu={e=>{e.preventDefault();openMenu(m,e.clientX,e.clientY,ptrRef.current!=='mouse')}} onPointerDown={e=>{ptrRef.current=e.pointerType}} onDoubleClick={()=>{if(ptrRef.current!=='mouse')return;window.getSelection()?.removeAllRanges();doReply(m)}}>
              {cur.kind!=='dm'&&!mine&&head&&<i className="who" onClick={e=>{if(!selecting){e.stopPropagation();openProfile(sp)}}} style={{color:`hsl(${hue(m.sender_id)} 75% 45%)`}}>{sn}</i>}
              {m.p?.fwd&&<small className="fwdl">↪ Forwarded</small>}
              {m.p?.re&&<div className="quote" onClick={()=>jump(m.p.re.id)}><b>{m.p.re.n}</b><span>{m.p.re.t}</span></div>}
              {m.p?(m.p.t==='file'?<FileMsg p={m.p}/>:<Linkify text={ed[m.id]??m.p.text}/>):<em>Can’t decrypt on this device</em>}{ed[m.id]!=null&&<small className="edited"> (edited)</small>}
              {reacts[m.id]&&Object.keys(reacts[m.id]).length>0&&<div className="chipsr">{Object.entries(Object.values(reacts[m.id]).reduce((a,e)=>(a[e]=(a[e]||0)+1,a),{})).map(([e,n])=><button key={e} className={'rx'+(reacts[m.id][me.id]===e?' mine':'')+(fresh[m.id+'|'+e]?' pop':'')} onClick={()=>react(m,e)}>{e} {n}</button>)}</div>}
              {burst?.id===m.id&&<span key={burst.k} className="burst">{burst.e}</span>}
              <time>{m.pending?'sending…':d.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</time>
              </div><div className="hov"><button aria-label="React" title="React" onClick={()=>react(m,'❤️')} onMouseEnter={e=>{clearTimeout(rxT.current);const r=e.currentTarget.getBoundingClientRect();setRxp({m,x:r.left+r.width/2,y:r.top})}} onMouseLeave={()=>{rxT.current=setTimeout(()=>setRxp(null),250)}}><Ic d={IC.smile} s={16}/></button><button aria-label="Reply" title="Reply" onClick={()=>doReply(m)}><Ic d={IC.reply} s={16}/></button><button aria-label="More" title="More" onClick={e=>{const r=e.currentTarget.getBoundingClientRect();openMenu(m,r.left,r.bottom+4)}}><Ic d={IC.more} s={16}/></button></div></div></div>})}
        <div ref={endR}/>
      </div>
      {!atBottom&&<button className="jump" aria-label="Scroll to latest" onClick={()=>endR.current?.scrollIntoView({behavior:'smooth',block:'end'})}>↓</button>}
      {cur.kind==='temp'&&!keyed?<form className="send" onSubmit={unlockRoom}><input type="password" required value={unlock} onChange={e=>setUnlock(e.target.value)} placeholder="Room password to unlock"/><button>Unlock</button></form>:<>{replyTo&&<div className="replybar"><span><b>{replyTo.n}</b> {replyTo.t}</span><button className="ic" onClick={()=>setReplyTo(null)} aria-label="Cancel reply">✕</button></div>}
      {editing&&<div className="replybar"><span><b>Editing</b> {snip(editing)}</span><button className="ic" onClick={()=>{setEditing(null);setTxt('')}} aria-label="Cancel edit">✕</button></div>}
      <form className="send" onSubmit={send}>
        <input ref={fileR} type="file" hidden onChange={e=>{sendFile(e.target.files[0]);e.target.value=''}}/>
        <button type="button" className="ic" aria-label="Attach a file" onClick={()=>fileR.current.click()}><Ic d={IC.clip}/></button>
        <textarea ref={taR} rows={1} value={txt} aria-label="Message" placeholder="Type a message…" maxLength={4000} onPaste={e=>{const f=e.clipboardData.files[0];if(f){e.preventDefault();sendFile(f)}}} onChange={e=>{setTxt(e.target.value);drafts.current[aid]=e.target.value}} onInput={e=>{e.target.style.height='auto';e.target.style.height=Math.min(e.target.scrollHeight,140)+'px'}} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();send(e)}}}/>
        <div className="menu"><button type="button" className="ic" aria-label="Emoji" onClick={()=>setEmo(!emo)}><Ic d={IC.smile}/></button>
          {emo&&<div className="pop emo">{EMOJI.map(e=><button type="button" key={e} className="mi" onClick={()=>{setTxt(t=>t+e);setEmo(false)}}>{e}</button>)}</div>}</div>
        <button className="sendbtn" aria-label="Send" disabled={!txt.trim()}><Ic d={IC.send}/></button></form></>}
    </>:<div className="center"><img className="pulse" src="/logo.png" width="120" height="120" alt=""/><h2><Brand/></h2><p className="mute">Pick a chat, or start something new.</p>{!me.is_guest&&<button className="wide" onClick={()=>setModal('g')}>＋ New group</button>}<button className="wide alt" onClick={()=>setModal('t')}>⏱ Temporary room</button></div>}</main>

    {pview&&<div className="modal" onClick={()=>setPview(null)}><div className="card" onClick={e=>e.stopPropagation()}>
      <div className="pbig"><Av n={pview.display_name} src={pview.avatar}/></div>
      <b style={{fontSize:20,textAlign:'center'}}>{pview.display_name}</b>
      <span className="mute" style={{textAlign:'center'}}>@{pview.username}{pview.is_guest?' · guest':''}</span>
      {pview.id===me.id?<p className="mute" style={{textAlign:'center'}}>This is you</p>:<>
        {(()=>{const pol=pview.msg_policy||'everyone';const why=pview.is_guest?'':pol==='none'?'This person is not accepting messages.':pol==='signed'&&me.is_guest?'This person only accepts messages from signed-in users.':pol==='temp'&&!me.is_guest?'This person only accepts messages from temporary guests.':'';return why?<p className="mute" style={{textAlign:'center'}}>{why}</p>:!pview.is_guest&&<button onClick={()=>{const u=pview;setPview(null);dm(u)}}>Message</button>})()}
        {pview.sn&&<><p className="mute" style={{fontSize:13}}>Safety number. Compare it with {pview.display_name} on a call to make sure nobody is intercepting your chat.</p><code style={{whiteSpace:'pre'}}>{pview.sn}</code></>}</>}
      <button className="alt" onClick={()=>setPview(null)}>Close</button></div></div>}
    {modal==='i'&&cur&&<div className="modal" onClick={()=>setModal(null)}><div className="card" onClick={e=>e.stopPropagation()}>
      <b>{cur.title}</b>
      {amAdmin&&<form className="inl" onSubmit={async e=>{e.preventDefault();const t=String(new FormData(e.target).get('t'));const {error}=await sb.rpc('rename_chat',{c:cur.id,t});if(error)return flash(error.message);await load();flash('Renamed')}}><input name="t" defaultValue={cur.title} maxLength={60} aria-label="Group name"/><button>Save</button></form>}
      <p className="mute">{(mem[cur.id]||[]).length} members. New members can’t read older messages.</p>
      {(mem[cur.id]||[]).map(p=><div key={p.id} className="row" onClick={()=>{setModal(null);openProfile(p)}}><Av n={p.display_name} src={p.avatar}/><div className="grow"><b>{p.display_name}{p.is_admin?' · admin':''}</b><span>@{p.username}</span></div>
        {amAdmin&&p.id!==me.id&&<button className="alt danger sm" onClick={async e=>{e.stopPropagation();if(!confirm('Remove '+p.display_name+'?'))return;const {error}=await sb.rpc('remove_member',{c:cur.id,u:p.id});if(error)return flash(error.message);load()}}>Remove</button>}</div>)}
      {amAdmin&&<form className="inl" onSubmit={async e=>{e.preventDefault();const f=e.target,u=String(new FormData(f).get('u')).replace('@','').toLowerCase().trim();const {data:pr}=await sb.from('profiles').select('id').eq('username',u).eq('is_guest',false).maybeSingle();if(!pr)return flash('No user @'+u);const {error}=await sb.rpc('add_member',{c:cur.id,u:pr.id});if(error)return flash(error.message);f.reset();load();flash('Added')}}><input name="u" placeholder="Add by username" required/><button>Add</button></form>}
      <button onClick={()=>setModal(null)}>Close</button></div></div>}
    {modal==='s'&&<div className="modal" onClick={()=>setModal(null)}><div className="card" onClick={e=>e.stopPropagation()}>
      <div className="prow"><label className="pbtn" title="Change photo"><Av n={nm(prof)} src={prof.avatar}/><span className="cam"><Ic d={IC.camera} s={14}/></span><input type="file" accept="image/*" hidden onChange={e=>{setMyPic(e.target.files[0]);e.target.value=''}}/></label>
        <div><b>{nm(prof)}</b><span className="mute" style={{display:'block'}}>@{prof.username}{me.is_guest?' · guest':''}</span></div></div>
      <button className="alt" onClick={toggleTheme}>Switch light / dark theme</button>
      <button className="alt" onClick={pushOn?disablePush:enablePush}>{pushOn?'Turn off background notifications':'Turn on background notifications'}</button>
      <div className="swatches" role="group" aria-label="Accent colour">{ACC.map((a,i)=><button key={i} type="button" className="sw" aria-label={'Accent colour '+(i+1)} style={{background:`linear-gradient(135deg,${a[0]},${a[1]})`}} onClick={()=>{applyAccent(i);LS('nl-accent',String(i))}}/>)}</div>
      {!me.is_guest&&<>
        <b>Privacy</b>
        <p className="mute" style={{fontSize:13}}>Who can start a chat with you</p>
        <select value={prof.msg_policy||'everyone'} onChange={e=>setPolicy(e.target.value)} style={{width:'100%'}} aria-label="Who can start a chat with you">
          <option value="everyone">Everyone</option><option value="signed">Signed-in users only</option><option value="temp">Temporary guests only</option><option value="none">No one (deactivate my account)</option></select>
        <button className="alt" onClick={shareLink}>Share my profile link</button></>}
      {!me.is_guest&&<><b>Google Drive backup</b>
        {driveOk===false&&<><p className="mute">Allow NexLink.Chat to keep an encrypted backup in your own Google Drive. Google asks for permission once, then backups run without popups.</p><button onClick={linkDrive}>Allow Google Drive access</button></>}
        {driveOk===false&&!D.configured?null:bk.auto?<>
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
    {rxp&&<div className="rxpick" style={{left:Math.max(8,Math.min(rxp.x-110,window.innerWidth-236)),top:Math.max(8,rxp.y-50)}} onMouseEnter={()=>clearTimeout(rxT.current)} onMouseLeave={()=>{rxT.current=setTimeout(()=>setRxp(null),250)}}>{REACTS.map(e=><button key={e} aria-label={'React '+e} onClick={()=>{react(rxp.m,e);setRxp(null)}}>{e}</button>)}</div>}
    {menu&&<div className="ctxwrap" onClick={()=>{if(Date.now()-menuAt.current>600)setMenu(null)}} onContextMenu={e=>{e.preventDefault();if(Date.now()-menuAt.current>600)setMenu(null)}}>
      <div className="ctx" role="menu" style={{left:Math.max(8,Math.min(menu.x,window.innerWidth-240)),top:Math.max(8,Math.min(menu.y,window.innerHeight-340))}} onClick={e=>e.stopPropagation()}>
        <div className="ctxr">{REACTS.map(e=><button key={e} aria-label={'React '+e} onClick={()=>{if(Date.now()-menuAt.current<600)return;react(menu.m,e);setMenu(null)}}>{e}</button>)}</div>
        {ctxItems.filter(Boolean).map(it=><button key={it.t} role="menuitem" className={'mi'+(it.danger?' danger':'')} onClick={()=>{if(Date.now()-menuAt.current<600)return;setMenu(null);it.f()}}><Ic d={it.i} s={18}/>{it.t}</button>)}</div></div>}
    {fwd&&<div className="modal" onClick={()=>{setFwd(null);setFq('')}}><div className="card" onClick={e=>e.stopPropagation()}>
      <b>Forward {fwd.length>1?fwd.length+' messages':'message'} to…</b>
      <input value={fq} onChange={e=>setFq(e.target.value)} placeholder="Search chats" aria-label="Search chats" autoFocus/>
      <div className="fwdlist">{chats.filter(c=>(!c.expires_at||new Date(c.expires_at)>now)&&title(c).toLowerCase().includes(fq.trim().toLowerCase())).map(c=><div key={c.id} className="row" onClick={()=>forwardTo(c)}><Av n={title(c)} src={pic(c)}/><div className="grow"><b>{title(c)}</b></div></div>)}</div>
      <button className="alt" onClick={()=>{setFwd(null);setFq('')}}>Cancel</button></div></div>}
    {lb&&<div className="modal" onClick={()=>setLb(null)}><img src={lb} alt="" className="lbimg"/></div>}
    {(!online||outN>0)&&<div className="offline" role="status">{online?`Sending ${outN} queued message${outN>1?'s':''}…`:`You’re offline. Messages send when you reconnect.${outN?` (${outN} waiting)`:''}`}</div>}
    {toast&&<div className={'toast'+(/fail|error|cannot|can’t|wrong|not allowed|too large|limit|blocked|no user/i.test(toast)?' bad':'')} role="status">{toast}</div>}
  </div>;
}
