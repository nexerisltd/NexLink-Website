'use client';
import {useEffect,useMemo,useRef,useState,useCallback} from 'react';
import {sb} from '../lib/supabase';
import * as C from '../lib/crypto';
import * as A from '../lib/archive';
import * as D from '../lib/drive';
import * as P from '../lib/presence';
import * as K from '../lib/calls';
import {api,keepable,isMob,isSaved,LS,nm,other,title as titleOf} from '../lib/client';
import {Av,IC,Ic,Splash,ACC,applyAccent,toggleTheme} from './ui';
import {Auth,GuestLink,Keys,TempForm,storeRefresh,DRIVE_SCOPE} from './Auth';
import {FileMsg} from './Message';
import Sidebar from './Sidebar';
import ChatView from './ChatView';
import CallOverlay from './CallOverlay';
import dynamic from 'next/dynamic';
const MapView=dynamic(()=>import('./MapView'),{ssr:false});

export default function App({startUser,startChannel}){
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
  return s?<Gate session={s} startUser={startUser} startChannel={startChannel}/>:<Auth startUser={startUser}/>;
}

function Gate({session,startUser,startChannel}){
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
  if(st==='ready')return <Chat me={me} priv={priv} first={first} startUser={startUser} startChannel={startChannel} notice={notice}/>;
  return <Keys mode={st} session={session} me={me} done={(m,k)=>{if(m)setMe(m);setPriv(k);setSt('ready')}}/>;
}

const urlB64=s=>{const b=(s+'='.repeat((4-s.length%4)%4)).replace(/-/g,'+').replace(/_/g,'/');return Uint8Array.from(atob(b),c=>c.charCodeAt(0))};

function Chat({me,priv,first,startUser,startChannel,notice}){
  const [chats,setChats]=useState([]),[mem,setMem]=useState({}),[msgs,setMsgs]=useState({}),[aid,setAid]=useState(null),[unread,setUn]=useState({}),[last,setLast]=useState({});
  const [modal,setModal]=useState(null),[side,setSide]=useState(true),[live,setLive]=useState(true);
  const [ver,setVer]=useState(0),[nowMin,setNowMin]=useState(()=>Math.floor(Date.now()/60000)),[unlock,setUnlock]=useState(''),[keyed,setKeyed]=useState(true),[tab,setTab]=useState('all'),[toast,setToast]=useState(''),[prof,setProf]=useState(me),[replyTo,setReplyTo]=useState(null),[editing,setEditing]=useState(null),[lim,setLim]=useState(300),[online,setOnline]=useState(true),[outN,setOutN]=useState(()=>JSON.parse(LS('nl-out:'+me.id)||'[]').length),[driveOk,setDriveOk]=useState(null),[loaded,setLoaded]=useState(false),[readAt,setReadAt]=useState(0),[muted,setMuted]=useState(()=>JSON.parse(LS('nl-mute:'+me.id)||'[]')),[pins,setPins]=useState(()=>JSON.parse(LS('nl-pin:'+me.id)||'[]')),[pushOn,setPushOn]=useState(LS('nl-push:'+me.id)==='1');
  const [menu,setMenu]=useState(null),[rxp,setRxp]=useState(null),[selIds,setSelIds]=useState([]),[selMode,setSelMode]=useState(false),[grantFor,setGrantFor]=useState(null),[fwd,setFwd]=useState(null),[fq,setFq]=useState(''),[lb,setLb]=useState(null),[pview,setPview]=useState(null),[burst,setBurst]=useState(null),[fresh,setFresh]=useState({}),[hid,setHid]=useState(()=>JSON.parse(LS('nl-hide:'+me.id)||'[]')),[clr,setClr]=useState({}),[grants,setGrants]=useState({}),[typing,setTyping]=useState({}),[pinMap,setPinMap]=useState({}),[arch,setArch]=useState(()=>JSON.parse(LS('nl-arch:'+me.id)||'[]'));
  const [searchTick,setSearchTick]=useState(0);
  const [bk,setBk]=useState(()=>({auto:LS('nl-auto:'+me.id)==='1',at:+LS('nl-last:'+me.id)||0,msg:'',busy:false,pass:'',stale:false}));
  const upd=p=>setBk(b=>({...b,...p}));
  const plain=useRef(new Map()),aidR=useRef(null),chatsR=useRef([]),fileR=useRef(null),grpR=useRef(null),lastDone=useRef(new Set()),mutedR=useRef([]),prevRx=useRef({}),dragMoved=useRef(false),menuAt=useRef(0),chatPushed=useRef(false),exitArm=useRef(false),skipPop=useRef(false),startDone=useRef(false),memR=useRef({}),msgsR=useRef({}),lastR=useRef({}),searchTickRef=useRef(0);
  aidR.current=aid;chatsR.current=chats;mutedR.current=muted;memR.current=mem;msgsR.current=msgs;lastR.current=last;
  const flash=m=>{setToast(m);setTimeout(()=>setToast(''),3500)};
  const cur=chats.find(c=>c.id===aid&&(!c.expires_at||new Date(c.expires_at)>Date.now()));
  const amAdmin=!!cur&&(mem[cur.id]||[]).some(p=>p.id===me.id&&p.is_admin);
  const gcount=(grants[aid]||[]).length;
  const snip=m=>m.p?(m.p.t==='file'?'📎 '+m.p.name:m.p.t==='voice'?'🎤 Voice message':m.p.text).slice(0,80):'Encrypted message';

  const dec=useCallback(async m=>{
    if(!plain.current.has(m.id)){let p=null;
      try{if(m.wraps?.t){const k=await C.getTempKey(m.chat_id);if(!k)return{...m,p:null};p=await C.decryptTemp(m,k)}else p=await C.decryptMessage(m,me.id,priv)}catch{}
      plain.current.set(m.id,p);
      if(p)A.index(me.id,[{id:m.id,chat_id:m.chat_id,created_at:m.created_at,p}]).catch(()=>{});
    }
    return{...m,p:plain.current.get(m.id)};
  },[me.id,priv]);
  const load=useCallback(async()=>{
    const {data,error}=await sb.from('chat_members').select('chat_id,is_admin,role,cleared_at,last_read_at,chats(id,kind,title,ttl_hours,code,expires_at,avatar,dm_key,perms,created_by),profiles(id,username,display_name,public_key,avatar,is_guest,last_seen,show_online)');
    if(error&&!data){try{const c=JSON.parse(LS('nl-cc:'+me.id)||'null');if(c){setMem(c.by);setClr(c.cl);setChats(c.cs)}}catch{}setLoaded(true);return}
    const by={},cs={},cl={};(data||[]).forEach(r=>{(by[r.chat_id]??=[]).push({...r.profiles,is_admin:r.is_admin,role:r.role||r.is_admin?'admin':'member',lastRead:r.last_read_at});cs[r.chat_id]=r.chats;if(r.profiles?.id===me.id)cl[r.chat_id]=r.cleared_at});
    try{localStorage.setItem('nl-cc:'+me.id,JSON.stringify({by:Object.fromEntries(Object.entries(by).map(([k,v])=>[k,v.map(p=>({...p,avatar:undefined}))])),cl,cs:Object.values(cs).filter(Boolean).map(c=>({...c,avatar:undefined}))}))}catch{}
    setMem(by);setClr(cl);setChats(Object.values(cs).filter(Boolean));setLoaded(true);loadGrants();loadPins();
  },[]);
  async function syncChat(id,full){
    let lastAt=full?null:(await A.byChat(me.id,id)).pop()?.created_at;
    for(;;){let qy=sb.from('messages').select('*').eq('chat_id',id).order('created_at').limit(500);if(lastAt)qy=qy.gt('created_at',lastAt);
      const {data}=await qy;if(!data?.length)break;await A.put(me.id,data);lastAt=data[data.length-1].created_at;if(data.length<500)break}
  }

  useEffect(()=>{const t=setInterval(()=>setNowMin(Math.floor(Date.now()/60000)),30000);return()=>clearInterval(t)},[]);
  useEffect(()=>{if(first){pushChat();setAid(first);setSide(false)}},[first]);
  useEffect(()=>{if(aid)C.getTempKey(aid).then(k=>setKeyed(!!k))},[aid,ver]);
  useEffect(()=>{const n=Object.values(unread).reduce((a,b)=>a+b,0);document.title=(n?`(${n}) `:'')+'NexLink.Chat'},[unread]);
  useEffect(()=>{const f=e=>{if(e.key==='Escape'){setModal(null);setLb(null);setFwd(null)}};window.addEventListener('keydown',f);return()=>window.removeEventListener('keydown',f)},[]);
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
        // clear the sender's typing indicator and mark visible messages as read
        if(x.p?.t!=='react'&&x.p?.t!=='edit'){
          if(typing[m.chat_id])setTyping(t2=>{const n={...t2};delete n[m.chat_id];return n});
          if(m.chat_id===aidR.current&&!document.hidden)setReadMark(m.chat_id);
        }
      })
      .on('postgres_changes',{event:'*',schema:'public',table:'chat_members'},()=>load())
      .on('postgres_changes',{event:'DELETE',schema:'public',table:'messages'},({old:o})=>removeLocal(o.id))
      .subscribe();
    return()=>{sb.removeChannel(ch)};
  },[load,dec,me.id,live]);
  useEffect(()=>{ // latest message per chat for the list preview (only chats we haven't seen yet)
    if(!live)return;
    chats.forEach(async c=>{
      if(lastDone.current.has(c.id))return;lastDone.current.add(c.id);
      const {data}=await sb.from('messages').select('*').eq('chat_id',c.id).order('created_at',{ascending:false}).limit(1);
      if(data?.[0]){const x=await dec(data[0]);setLast(l=>({...l,[c.id]:{p:x.p,at:x.created_at,from:x.sender_id}}))}
    });
  },[chats,live,dec]);
  // typing indicators: one broadcast channel per chat (no DB writes)
  useEffect(()=>{
    if(!live)return;
    const joined=typingJoined.current;
    chats.forEach(c=>{if(!joined.has(c.id)){joined.add(c.id);P.watchTyping(c.id,()=>{})}});
    const iv=setInterval(()=>{
      setTyping(prev=>{
        const next={};
        chats.forEach(c=>{
          if(!P.typingNow(c.id))return;
          const us=[...P.typingUsers(c.id)].filter(u=>u!==me.id);
          if(!us.length)return;
          const m=memR.current[c.id]||[];
          next[c.id]=us.length===1?(nm(m.find(p=>p.id===us[0]))||'Someone'):`${us.length} people`;
        });
        const same=Object.keys(next).length===Object.keys(prev).length&&Object.keys(next).every(k=>prev[k]===next[k]);
        return same?prev:next;
      });
    },1500);
    return()=>clearInterval(iv);
  },[chats,live,me.id]);
  const typingJoined=useRef(new Set());
  // remove typing channels for chats that no longer exist
  useEffect(()=>{
    const ids=new Set(chats.map(c=>c.id));
    typingJoined.current.forEach(id=>{if(!ids.has(id)){P.leaveTyping(id);typingJoined.current.delete(id)}});
  },[chats]);
  // presence heartbeat: keeps profiles.last_seen fresh while the tab is open
  useEffect(()=>{
    if(!live)return;
    P.touchPresence();
    const iv=setInterval(()=>{if(!document.hidden)P.touchPresence()},60000);
    const f=()=>{if(!document.hidden)P.touchPresence()};
    document.addEventListener('visibilitychange',f);
    return()=>{clearInterval(iv);document.removeEventListener('visibilitychange',f)};
  },[live]);
  // ---- calls (WebRTC, encrypted signaling) ----
  useEffect(()=>{if(priv)K.initCall(me,priv,id=>memR.current[id])},[me.id,priv]);
  const doCall=video=>{if(cur?.kind==='dm'&&!isSaved(cur))K.startCall(cur,video,nm(other(cur,mem,me.id))||'')};
  const headerButtons=cur?.kind==='dm'&&!isSaved(cur)?<>
    <button className="ic" aria-label="Voice call" title="Voice call" onClick={()=>doCall(false)}><Ic d={IC.phone}/></button>
    <button className="ic" aria-label="Video call" title="Video call" onClick={()=>doCall(true)}><Ic d={IC.video}/></button></>:null;
  // ---- live location ----
  const locIv=useRef(null),locUntil=useRef(0);
  useEffect(()=>()=>clearInterval(locIv.current),[]);
  async function shareLocation(until){
    if(!cur||!navigator.geolocation)return flash('Location not available in this browser');
    try{
      const pos=await new Promise((res,rej)=>navigator.geolocation.getCurrentPosition(res,rej,{timeout:10000}));
      await post({t:'loc',lat:pos.coords.latitude,lng:pos.coords.longitude,until:until||null});
      setModal(null);
      if(until){
        locUntil.current=until;clearInterval(locIv.current);
        locIv.current=setInterval(async()=>{
          if(Date.now()>locUntil.current){clearInterval(locIv.current);locIv.current=null;return}
          if(document.hidden)return;
          try{const p2=await new Promise((res,rej)=>navigator.geolocation.getCurrentPosition(res,rej,{timeout:10000}));
            await post({t:'loc',lat:p2.coords.latitude,lng:p2.coords.longitude,until:locUntil.current})}catch{}
        },30000);
        flash('Live location on — updates every 30s while the tab is open');
      }else flash('Location sent');
    }catch(x){flash('Location unavailable'+(x.message?': '+x.message:''))}
  }
  // map modal: latest location per member of the open chat
  const [mapOn,setMapOn]=useState(false);
  useEffect(()=>{const f=e=>setMapOn(!cur||e.detail?.chat_id===cur.id);window.addEventListener('nl-open-loc',f);return()=>window.removeEventListener('nl-open-loc',f)},[cur?.id]);
  const mapPoints=useMemo(()=>{
    const l={};
    (msgs[aid]||[]).forEach(m=>{if(m.p?.t==='loc')l[m.sender_id]={lat:m.p.lat,lng:m.p.lng,sender_id:m.sender_id,name:nm((mem[m.chat_id]||[]).find(p=>p.id===m.sender_id))}});
    return Object.values(l);
  },[msgs,aid,mem]);
  // ---- per-chat wallpaper ----
  const [wps,setWps]=useState(()=>JSON.parse(LS('nl-wp:'+me.id)||'{}'));
  const setWp=(id,css)=>{const n={...wps};if(css)n[id]=css;else delete n[id];setWps(n);LS('nl-wp:'+me.id,JSON.stringify(n));flash(css?'Wallpaper set':'Wallpaper removed')};
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
  // channel invite deep link: /c/<code>
  const joinDone=useRef(false);
  useEffect(()=>{
    if(!startChannel||joinDone.current)return;joinDone.current=true;
    try{history.replaceState(history.state,'','/')}catch{}
    if(me.is_guest)return flash('Sign in with Google to join channels');
    joinByCode(startChannel);
  },[startChannel]);
  useEffect(()=>{if(modal==='s'&&!me.is_guest)D.linked().then(setDriveOk)},[modal]);
  useEffect(()=>{if(!aid)return;const f=()=>LS('nl-read:'+me.id+':'+aid,String(Date.now()));window.addEventListener('beforeunload',f);return()=>{f();window.removeEventListener('beforeunload',f)}},[aid]);
  useEffect(()=>{const f=e=>setLb(e.detail);window.addEventListener('nl-img',f);return()=>window.removeEventListener('nl-img',f)},[]);
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
  useEffect(()=>{setSelIds([]);setSelMode(false);setGrantFor(null);setReplyTo(null);setEditing(null);setLim(300)},[aid]);

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

  function removeLocal(id){
    A.del(me.id,id).catch(()=>{});setMsgs(o=>({...o,[id]:(o[id]||[]).filter(x=>x.id!==id)}));
    // if a chat's latest message was deleted, refresh its preview
    const cid=Object.keys(msgsR.current).find(k=>msgsR.current[k]?.some(x=>x.id===id));
    if(cid&&lastR.current[cid]?.at){(async()=>{const {data}=await sb.from('messages').select('*').eq('chat_id',cid).order('created_at',{ascending:false}).limit(1);if(data?.[0]){const x=await dec(data[0]);setLast(l=>({...l,[cid]:{p:x.p,at:x.created_at,from:x.sender_id}}))}else setLast(l=>({...l,[cid]:undefined}))})()}
  }
  const jump=id=>window.dispatchEvent(new CustomEvent('nl-jump',{detail:id}));
  async function deleteMsgs(list){
    const mineIds=list.filter(m=>m.sender_id===me.id).map(m=>m.id),others=list.filter(m=>m.sender_id!==me.id).map(m=>m.id);
    const n=list.length,msg=others.length?`Delete ${n} message${n>1?'s':''}? Yours are removed for everyone. Messages from others are removed only for you.`:`Delete ${n>1?n+' messages':'this message'} for everyone?`;
    if(!confirm(msg))return;
    if(mineIds.length){const {error}=await sb.from('messages').delete().in('id',mineIds);if(error)return flash(error.message)}
    if(others.length){const nh=[...hid,...others];setHid(nh);LS('nl-hide:'+me.id,JSON.stringify(nh))}
    list.forEach(m=>removeLocal(m.id));clearSel();
  }
  async function react(m,e){
    const isOff=reactCur(m)===e;
    if(!isOff){setBurst({id:m.id,e,k:Date.now()});setTimeout(()=>setBurst(null),1100)}
    try{await post({t:'react',to:m.id,e:isOff?'':e})}catch(x){flash(x.message)}
  }
  function reactCur(m){
    // find my current reaction for message m from the decrypted stream
    const list=msgs[m.chat_id]||[];for(let i=list.length-1;i>=0;i--){const p=list[i].p;if(p?.t==='react'&&p.to===m.id&&list[i].sender_id===me.id)return p.e||''}
    return '';
  }
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
    setEditing(null);setReplyTo({id:m.id,n:nm(sp),t:snip(m)});setMenu(null);
  }
  async function openProfile(p){
    if(!p)return;let sn=null;
    try{if(p.id!==me.id&&p.public_key?.x&&me.public_key?.x)sn=await C.safety(me.public_key,p.public_key)}catch{}
    setPview({...p,sn});
  }
  const openHead=()=>!cur?null:cur.kind==='dm'?openProfile(other(cur,mem,me.id)):cur.kind==='group'?setModal('i'):null;
  const copyText=t=>navigator.clipboard?.writeText(t);
  const togglePick=id=>setSelIds(a=>a.includes(id)?a.filter(x=>x!==id):[...a,id]);
  const clearSel=()=>{setSelIds([]);setSelMode(false);setGrantFor(null)};
  const pushChat=()=>{if(isMob()&&!chatPushed.current){history.pushState({nl:'chat'},'');chatPushed.current=true}};
  const goBack=()=>{if(chatPushed.current)history.back();else setSide(true)};
  async function forwardTo(c){
    const list=fwd,text=fmtMsgs(list);setFwd(null);setFq('');
    if(text.length>3500)return flash('Too long to forward at once. Select fewer messages.');
    try{await post({text,fwd:true},null,c);flash('Forwarded to '+titleOf(c,mem,me.id));clearSel()}catch(x){flash(x.message)}
  }
  function fmtMsgs(list){
    return [...list].sort((a,b)=>new Date(a.created_at)-new Date(b.created_at)).filter(m=>m.p&&m.p.t!=='hreq'&&m.p.t!=='hgrant').map(m=>{
      const sp=(mem[m.chat_id]||[]).find(p=>p.id===m.sender_id),t=m.p.t==='file'?'[File] '+m.p.name:(m.p.text);
      return `${nm(sp)}: ${m.p.re?`Replied on "${m.p.re.t}" `:''}${t}`}).join('\n');
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
  async function loadPins(){
    try{const {data}=await sb.from('pinned_messages').select('chat_id,message_id,pinned_by');
      const p={};(data||[]).forEach(r=>{p[r.chat_id]=r});setPinMap(p)}catch{}
  }
  async function pinMsg(m){
    try{const {error}=await sb.rpc('pin_msg',{c:m.chat_id,m:m.id});if(error)return flash(error.message);await loadPins();flash('Message pinned')}
    catch(x){flash(x.message)}
  }
  async function unpinMsg(m){
    try{const {error}=await sb.rpc('unpin_msg',{c:m.chat_id,m:m.id});if(error)return flash(error.message);await loadPins();flash('Unpinned')}
    catch(x){flash(x.message)}
  }
  const toggleArch=id=>{const n=arch.includes(id)?arch.filter(x=>x!==id):[...arch,id];setArch(n);LS('nl-arch:'+me.id,JSON.stringify(n));flash(arch.includes(id)?'Unarchived':'Archived')};
  const onOpenMsg=(cid,id)=>{setSide(false);open(cid);setTimeout(()=>window.dispatchEvent(new CustomEvent('nl-jump',{detail:id})),600)};
  async function shareHistory(picked){
    const ps=picked.slice().sort((a,b)=>new Date(a.created_at)-new Date(b.created_at));if(!ps.length)return;
    const {error}=await sb.rpc('grant_history',{c:cur.id,u:grantFor.u,from_id:ps[0].id,to_id:ps[ps.length-1].id});if(error)return flash(error.message);
    try{await post({t:'hgrant',to:grantFor.u})}catch{}
    flash('Chat history shared');clearSel();
  }
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
  const open=id=>{pushChat();setReadAt(+LS('nl-read:'+me.id+':'+id)||0);setAid(id);setSide(false);setUn(u=>({...u,[id]:0}));setReadMark(id)};
  const setReadMark=useCallback(id=>{
    try{LS('nl-read:'+me.id+':'+id,String(Date.now()));
      // server-side read receipt (migration v10); safe no-op before migration
      // (supabase-js builders are thenable but have no .catch — use then with an error handler)
      sb.rpc('set_read',{c:id}).then(()=>{},()=>{});
    }catch{}
  },[me.id]);
  useEffect(()=>{if(aid&&live)setReadMark(aid)},[aid,live,setReadMark]);
  async function dm(u){const {data,error}=await sb.rpc('create_dm',{other:u.id});if(error)return flash(error.message);setModal(null);await load();open(data)}
  async function group(ev){
    ev.preventDefault();const f=new FormData(ev.target);
    const names=String(f.get('u')).split(/[\s,]+/).map(x=>x.replace('@','').toLowerCase()).filter(Boolean);
    const {data:ps}=await sb.from('profiles').select('id').in('username',names);
    if(!ps?.length)return flash('No matching usernames found');
    const {data,error}=await sb.rpc('create_group',{t:String(f.get('t')),members:ps.map(p=>p.id),ttl:+f.get('ttl')});
    if(error)return flash(error.message);setModal(null);await load();open(data);
  }
  async function sendRaw(chat,payload,fp,id,deliverAt){
    let e;
    if(chat.kind==='temp'){const k=await C.getTempKey(chat.id);if(!k)throw new Error('Enter the room password first');e=await C.encryptTemp(payload,k,chat.id)}
    else e=await C.encryptMessage(payload,memR.current[chat.id],chat.id);
    const {error}=await sb.from('messages').insert({id,chat_id:chat.id,sender_id:me.id,file_path:fp||null,deliver_at:deliverAt||null,...e});
    if(error&&error.code!=='23505')throw error;
  }
  async function post(payload,fp,tc,deliverAt){
    const chat=tc||cur,id=crypto.randomUUID(),cid=chat.id,opt=!tc&&payload.t!=='react'&&payload.t!=='edit';
    if(opt){plain.current.set(id,payload);setMsgs(o=>({...o,[cid]:[...(o[cid]||[]),{id,chat_id:cid,sender_id:me.id,created_at:new Date().toISOString(),expires_at:new Date(Date.now()+864e5).toISOString(),deliver_at:deliverAt||null,p:payload,pending:true}]}))}
    try{await sendRaw(chat,payload,fp,id,deliverAt)}
    catch(x){
      const net=!navigator.onLine||x instanceof TypeError||/fetch|network|Failed to/i.test(x?.message||'');
      if(net&&!deliverAt&&payload.t!=='file'&&chat.kind!=='temp'){const q=JSON.parse(LS('nl-out:'+me.id)||'[]');q.push({id,cid,payload});LS('nl-out:'+me.id,JSON.stringify(q));setOutN(q.length);return}
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
  async function send(text){
    if(!cur)return;const t=text.trim();if(!t)return;
    P.stopTyping(cur.id,me.id);
    if('Notification' in window&&Notification.permission==='default')Notification.requestPermission();
    const re=replyTo,ed0=editing;try{await post(ed0?{t:'edit',to:ed0.id,text:t}:re?{text:t,re}:{text:t});setReplyTo(null);setEditing(null)}catch(x){flash(x.message);throw x}
  }
  async function sendFile(f){
    if(!f||!cur)return;
    try{
      const {shrink}=await import('../lib/client');f=await shrink(f);
      if(f.size>100*1024*1024)return flash('Max file size is 100 MB');
      flash('Encrypting and uploading…');
      const {key:path,url,token}=await api('/api/files/upload',{chatId:cur.id,size:f.size+16});
      const e=await C.encryptFile(await f.arrayBuffer());
      if(token){const {error}=await sb.storage.from('files').uploadToSignedUrl(path,token,new Blob([e.ct]));if(error)throw error}
      else{const up=await fetch(url,{method:'PUT',body:new Blob([e.ct])});if(!up.ok)throw new Error('Upload failed. Check the bucket CORS settings.')}
      await post({t:'file',name:f.name,mime:f.type,size:f.size,path,k:e.k,iv:e.iv},path);setToast('');
    }catch(x){flash(x.message||'Upload failed')}
  }
  async function sendVoice(blob,dur,wave){
    if(!blob||!cur)return;
    try{
      const {key:path,url,token}=await api('/api/files/upload',{chatId:cur.id,size:blob.size+16});
      const e=await C.encryptFile(await blob.arrayBuffer());
      if(token){const {error}=await sb.storage.from('files').uploadToSignedUrl(path,token,new Blob([e.ct]));if(error)throw error}
      else{const up=await fetch(url,{method:'PUT',body:new Blob([e.ct])});if(!up.ok)throw new Error('Upload failed. Check the bucket CORS settings.')}
      await post({t:'voice',name:'Voice message',mime:blob.type||'audio/webm',size:blob.size,path,k:e.k,iv:e.iv,dur,wave},path);setToast('');
    }catch(x){flash(x.message||'Voice upload failed')}
  }
  async function sendSticker(id){
    if(!cur)return;
    try{await post({t:'sticker',id})}catch(x){flash(x.message)}
  }
  async function sendPoll(q,opts){
    try{await post({t:'poll',q,opts});setModal(null);flash('Poll sent')}catch(x){flash(x.message)}
  }
  async function sendVote(m,idx){
    try{await post({t:'pollvote',to:m.id,idx})}catch(x){flash(x.message)}
  }
  async function scheduleMsg(text,whenISO){
    if(!cur)return;
    const t=text.trim();if(!t)return;
    P.stopTyping(cur.id,me.id);
    const re=replyTo;
    try{await post(re?{text:t,re}:{text:t},null,null,whenISO);setReplyTo(null);setModal(null);flash('Message scheduled for '+new Date(whenISO).toLocaleString())}
    catch(x){flash(x.message);throw x}
  }
  async function newChannel(ev){
    ev.preventDefault();const f=new FormData(ev.target);
    const {data,error}=await sb.rpc('create_channel',{t:String(f.get('t'))});
    if(error)return flash(error.message);
    setModal(null);await load();open(data);flash('Channel created — share the invite link');
  }
  async function joinByCode(code){
    try{
      const {data,error}=await sb.rpc('join_channel',{code});
      if(error)return flash(error.message);
      await load();open(data);
    }catch(x){flash(x.message)}
  }
  async function setMyPic(f){
    if(!f)return;try{const {squarePic}=await import('../lib/client');const a=await squarePic(f);const {error}=await sb.from('profiles').update({avatar:a}).eq('id',me.id);if(error)throw error;setProf(p=>({...p,avatar:a}));load()}catch(x){flash(x.message)}
  }
  async function setGrpPic(f){
    if(!f||!cur)return;try{const {squarePic}=await import('../lib/client');const {error}=await sb.rpc('set_chat_avatar',{c:cur.id,a:await squarePic(f)});if(error)throw error;await load();flash('Group photo updated')}catch(x){flash(x.message)}
  }
  async function verify(){const o=other(cur,mem,me.id);setModal({sn:await C.safety(me.public_key,o.public_key),n:nm(o)})}
  async function leave(){if(!confirm('Leave this chat?'))return;await sb.rpc('leave_chat',{c:cur.id});setAid(null);setSide(true);load()}
  async function unlockRoom(ev){
    ev.preventDefault();const k=await C.tempKeys(cur.code,unlock);
    const {data,error}=await sb.rpc('join_temp',{c:cur.code,v:k.verifier});
    if(error)return flash(error.message);if(!data)return flash('Wrong password');
    await C.setTempKey(cur.id,k.raw);plain.current.clear();setUnlock('');setVer(v=>v+1);
  }
  const signOut=()=>(!me.is_guest||confirm('Guest accounts cannot sign back in. Leave anyway?'))&&sb.auth.signOut();

  // reaction fresh-pop tracking (prev counts -> burst styling)
  const onReactSig=useCallback(sig=>{
    const cur2=Object.fromEntries(JSON.parse(sig)),prev=prevRx.current[aid];prevRx.current[aid]=cur2;
    if(!prev)return;const f={};
    for(const [k,n] of Object.entries(cur2))if(n>(prev[k]||0))f[k]=1;
    if(Object.keys(f).length){setFresh(f);setTimeout(()=>setFresh({}),900)}
  },[aid]);

  // chat header menu items
  const chatMenuItems=cur?[
    cur.kind==='temp'&&{t:'Copy invite',i:IC.copy,f:()=>{navigator.clipboard?.writeText(`Join my NexLink.Chat temp room\nCode: ${cur.code.slice(0,4)}-${cur.code.slice(4)}\n${location.origin}\n(Ask me for the password)`);flash('Invite copied')}},
    cur.kind==='channel'&&{t:'Copy invite link',i:IC.copy,f:()=>{navigator.clipboard?.writeText(`${location.origin}/c/${cur.code}`);flash('Invite link copied')}},
    cur.kind==='channel'&&amAdmin&&{t:'Channel settings',i:IC.sliders,f:()=>setModal('cs')},
    {t:pins.includes(cur.id)?'Unpin chat':'Pin chat',i:IC.pin,f:()=>togglePin(cur.id)},
    {t:muted.includes(cur.id)?'Unmute notifications':'Mute notifications',i:IC.bell,f:()=>toggleMute(cur.id)},
    cur.kind==='group'&&{t:'Group info & members',i:IC.users,f:()=>setModal('i')},
    cur.kind==='channel'&&{t:'Channel info & subscribers',i:IC.users,f:()=>setModal('i')},
    {t:'Media, files and voice',i:IC.img,f:()=>setModal('m')},
    cur.kind!=='temp'&&{t:'Chat wallpaper',i:IC.camera,f:()=>setModal('wp')},
    {t:'Search in chat',i:IC.search,f:()=>{searchTickRef.current++;setSearchTick(searchTickRef.current)}},
    cur.kind==='group'&&{t:'Change group photo',i:IC.camera,f:()=>grpR.current.click()},
    cur.kind!=='temp'&&{t:'Disappearing messages',i:IC.timer,f:()=>setModal('d')},
    cur.kind==='dm'&&{t:'Verify safety number',i:IC.shield,f:verify},
    {t:'Select messages',i:IC.select,f:()=>setSelMode(true)},
    cur.kind!=='temp'&&{t:arch.includes(cur.id)?'Unarchive chat':'Archive chat',i:IC.archive,f:()=>toggleArch(cur.id)},
    cur.kind!=='temp'&&clr[cur.id]&&{t:'Request chat history',i:IC.hist,f:reqHistory},
    cur.kind!=='temp'&&{t:'Clear chat',i:IC.trash,f:clearChat},
    cur.kind!=='dm'&&{t:cur.kind==='temp'?'Leave room':'Leave group',i:IC.out,danger:true,f:leave}]:[];
  // header subtitle: typing > presence > default
  const headerSub=useMemo(()=>{
    if(!cur)return '';
    if(typing[cur.id])return typing[cur.id]+(typing[cur.id].endsWith('…')?'':' is typing…');
    if(cur.kind==='dm'&&!isSaved(cur)){
      const lbl=P.seenLabel(other(cur,mem,me.id),nowMin*60000);
      if(lbl==='online')return 'online';
      if(lbl)return lbl+' · end-to-end encrypted';
    }
    return null;
  },[cur,typing,mem,me.id,nowMin]);
  const openSaved=async()=>{
    const {data,error}=await sb.rpc('create_saved');
    if(error)return flash(error.message);
    await load();open(data);
  };
  const onTyping=()=>{if(cur)P.sendTyping(cur.id,me.id)};
  // who can post: channels are admin-only; groups follow perms.send
  const myRole=cur?((mem[cur.id]||[]).find(p=>p.id===me.id)?.role||'member'):'member';
  const amOwner=myRole==='owner';
  const perms=cur?.perms||{};
  const canSend=cur?(cur.kind==='channel'?amAdmin:(cur.kind==='group'&&perms.send==='admins'?amAdmin:true)):true;
  const composeDisabled=!canSend;
  const composePlaceholder=cur&&cur.kind==='channel'&&!amAdmin?'Only channel admins can post':undefined;
  const [schedText,setSchedText]=useState('');
  const onSchedulePick=t=>{setSchedText(t);setModal('sched')};
  // media gallery for the current chat (from the device archive, or live state for temp rooms)
  const [media,setMedia]=useState(null);
  useEffect(()=>{
    if(modal!=='m'||!cur)return;
    let off=false;
    (async()=>{
      const c=chatsR.current.find(x=>x.id===cur.id);
      const rows=c&&keepable(c)?(await A.byChat(me.id,cur.id)).slice(-300):(msgs[cur.id]||[]);
      const x=await Promise.all(rows.map(dec));
      if(!off)setMedia(x.filter(m=>m.p&&(m.p.t==='file'||m.p.t==='voice')).reverse());
    })();
    return()=>{off=true;setMedia(null)};
  },[modal,cur?.id,dec,me.id]);

  const chatsWithUnread=chats.filter(c=>!c.expires_at||new Date(c.expires_at)>nowMin*60000);
  return <div className={'app'+(side?' open':'')}>
    <Sidebar me={me} chats={chatsWithUnread} mem={mem} last={last} unread={unread} loaded={loaded} bk={bk} live={live} nowMin={nowMin}
      open={open} dm={dm} setModal={setModal} backupNow={backupNow} toggleTheme={toggleTheme} signOut={signOut} aid={aid} tab={tab} setTab={setTab} pins={pins} muted={muted} onTab={()=>setSide(true)} typing={typing} openSaved={openSaved} arch={arch} onOpenMsg={onOpenMsg}
      extraTab={chats.some(c=>c.kind==='channel')?{k:'channel',l:'Channels',i:IC.globe}:null}/>
    <ChatView me={me} cur={cur} mem={mem} msgs={msgs[aid]} clr={clr} grants={grants} hid={hid} lim={lim} setLim={setLim} readAt={readAt} now={nowMin*60000} ver={ver} keyed={keyed}
      selIds={selIds} selMode={selMode} grantFor={grantFor} setSelIds={setSelIds} setSelMode={setSelMode} setGrantFor={setGrantFor} clearSel={clearSel} togglePick={togglePick}
      deleteMsgs={deleteMsgs} copyText={copyText} setFwd={setFwd} shareHistory={shareHistory} reqHistory={reqHistory} clearChat={clearChat} flash={flash}
      doReply={doReply} setReplyTo={setReplyTo} editing={editing} setEditing={setEditing}
      react={react} setMenu={setMenu} setRxp={setRxp} freshMap={fresh} burst={burst} openProfile={openProfile} openHead={openHead} verify={verify}
      amAdmin={amAdmin} unlockRoom={unlockRoom} unlock={unlock} setUnlock={setUnlock} sendFile={sendFile} dragMoved={dragMoved} menuAt={menuAt}
      chatMenuItems={chatMenuItems} searchTick={searchTick} goBack={goBack} onSend={send} onReactSig={onReactSig} headerSub={headerSub} onTyping={onTyping}
      onVoice={sendVoice} onSticker={sendSticker} pin={pinMap[cur?.id]} onPin={pinMsg} onUnpin={unpinMsg}
      composeDisabled={composeDisabled} composePlaceholder={composePlaceholder} amOwner={amOwner} perms={perms}
      onSchedulePick={onSchedulePick} onPoll={sendPoll} onVote={sendVote} onChannel={newChannel}
      headerButtons={headerButtons} wp={wps[aid]} onLocation={()=>setModal('loc')}
      grpPicRef={grpR} setGrpPic={setGrpPic}
      emptyActions={<>{!me.is_guest&&<button className="wide" onClick={()=>setModal('g')}>＋ New group</button>}<button className="wide alt" onClick={()=>setModal('t')}>⏱ Temporary room</button></>}/>

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
      {cur.kind==='channel'&&cur.code&&<p className="mute" style={{fontSize:13}}>Invite link: {`${typeof location!=='undefined'?location.origin:''}/c/${cur.code}`}</p>}
      {(amAdmin||amOwner)&&<form className="inl" onSubmit={async e=>{e.preventDefault();const t=String(new FormData(e.target).get('t'));const {error}=await sb.rpc('rename_chat',{c:cur.id,t});if(error)return flash(error.message);await load();flash('Renamed')}}><input name="t" defaultValue={cur.title} maxLength={60} aria-label="Chat name"/><button>Save</button></form>}
      <p className="mute">{(mem[cur.id]||[]).length} {cur.kind==='channel'?'subscribers':'members'}. New members can’t read older messages.</p>
      {(mem[cur.id]||[]).map(p=>{const r2=p.role||(p.is_admin?'admin':'member');
        return <div key={p.id} className="row" onClick={()=>{setModal(null);openProfile(p)}}><Av n={p.display_name} src={p.avatar}/><div className="grow"><b>{p.display_name}{r2!=='member'?` · ${r2}`:''}</b><span>@{p.username}</span></div>
        <div className="mroles">
          {amOwner&&p.id!==me.id&&r2!=='owner'&&<button className="alt sm" onClick={async e=>{e.stopPropagation();const {error}=await sb.rpc(r2==='admin'?'demote':'promote',{c:cur.id,u:p.id});if(error)return flash(error.message);load()}}>{r2==='admin'?'Demote':'Promote'}</button>}
          {amOwner&&p.id!==me.id&&<button className="alt sm" onClick={async e=>{e.stopPropagation();if(!confirm('Make '+p.display_name+' the owner?'))return;const {error}=await sb.rpc('transfer_owner',{c:cur.id,u:p.id});if(error)return flash(error.message);load();flash('Ownership transferred')}}>Owner</button>}
          {(amAdmin||amOwner)&&p.id!==me.id&&<button className="alt danger sm" onClick={async e=>{e.stopPropagation();if(!confirm('Remove '+p.display_name+'?'))return;const {error}=await sb.rpc('remove_member',{c:cur.id,u:p.id});if(error)return flash(error.message);load()}}>Remove</button>}
        </div></div>})}
      {cur.kind==='group'&&amAdmin&&<form className="inl" onSubmit={async e=>{e.preventDefault();const f=e.target,u=String(new FormData(f).get('u')).replace('@','').toLowerCase().trim();const {data:pr}=await sb.from('profiles').select('id').eq('username',u).eq('is_guest',false).maybeSingle();if(!pr)return flash('No user @'+u);const {error}=await sb.rpc('add_member',{c:cur.id,u:pr.id});if(error)return flash(error.message);f.reset();load();flash('Added')}}><input name="u" placeholder="Add by username" required/><button>Add</button></form>}
      {cur.kind==='channel'&&amAdmin&&<form className="inl" onSubmit={async e=>{e.preventDefault();const f=e.target,u=String(new FormData(f).get('u')).replace('@','').toLowerCase().trim();const {data:pr}=await sb.from('profiles').select('id').eq('username',u).eq('is_guest',false).maybeSingle();if(!pr)return flash('No user @'+u);const {error}=await sb.rpc('add_member',{c:cur.id,u:pr.id});if(error)return flash(error.message);f.reset();load();flash('Added')}}><input name="u" placeholder="Add by username" required/><button>Add</button></form>}
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
        <p className="mute" style={{fontSize:13}}>Last seen & online</p>
        <select value={prof.show_online||'everyone'} onChange={async e=>{const v=e.target.value;const {error}=await sb.from('profiles').update({show_online:v}).eq('id',me.id);if(error)return flash(error.message);setProf(p=>({...p,show_online:v}));flash('Updated')}} style={{width:'100%'}} aria-label="Show when I was online">
          <option value="everyone">Show everyone</option><option value="nobody">Hide from everyone</option></select>
        <button className="alt" onClick={shareLink}>Share my profile link</button>
        {!me.is_guest&&<button className="alt" onClick={()=>sb.auth.signInWithOAuth({provider:'google',options:{redirectTo:window.location.origin,scopes:DRIVE_SCOPE,queryParams:{access_type:'offline',prompt:'select_account'}}})}>Switch / add Google account</button>}</>}
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
    {modal==='ch'&&<div className="modal" onClick={()=>setModal(null)}><form className="card" onClick={e=>e.stopPropagation()} onSubmit={newChannel}>
      <b>New channel</b>
      <p className="mute" style={{fontSize:13}}>Broadcast to any number of subscribers. Only you and admins you promote can post.</p>
      <input name="t" required maxLength={60} placeholder="Channel name"/>
      <button>Create channel</button></form></div>}
    {modal==='poll'&&<div className="modal" onClick={()=>setModal(null)}><PollForm onCancel={()=>setModal(null)} onDone={sendPoll}/></div>}
    {modal==='sched'&&<div className="modal" onClick={()=>setModal(null)}><form className="card" onClick={e=>e.stopPropagation()} onSubmit={async e=>{
      e.preventDefault();
      const f=new FormData(e.target),d=String(f.get('d')),t=String(f.get('t')||'09:00');
      const when=new Date(d+'T'+t);
      if(isNaN(when)||when<=new Date())return flash('Pick a future time');
      try{await scheduleMsg(schedText,when.toISOString())}catch{}
    }}>
      <b>Schedule message</b>
      <p className="mute" style={{fontSize:13}}>“{schedText.slice(0,80)}” will be sent automatically at the chosen time while NexLink.Chat is open on any of your devices.</p>
      <input type="date" name="d" required min={new Date().toISOString().slice(0,10)} aria-label="Date"/>
      <input type="time" name="t" required defaultValue="09:00" aria-label="Time"/>
      <button>Schedule</button>
      <button type="button" className="alt" onClick={()=>setModal(null)}>Cancel</button></form></div>}
    {modal==='cs'&&cur&&amOwner&&<div className="modal" onClick={()=>setModal(null)}><div className="card" onClick={e=>e.stopPropagation()}>
      <b>{cur.kind==='channel'?'Channel settings':'Group permissions'}</b>
      <p className="mute" style={{fontSize:13}}>Who can send messages</p>
      <select value={perms.send||'members'} onChange={async e=>{const p={...perms,send:e.target.value};const {error}=await sb.rpc('set_group_perms',{c:cur.id,p});if(error)return flash(error.message);await load();flash('Updated')}} style={{width:'100%'}}>
        {cur.kind==='group'&&<option value="members">All members</option>}<option value="admins">Only admins</option></select>
      <button className="alt" onClick={()=>setModal(null)}>Done</button></div></div>}
    {modal==='loc'&&cur&&<div className="modal" onClick={()=>setModal(null)}><div className="card" onClick={e=>e.stopPropagation()}>
      <b>Share location</b>
      <p className="mute" style={{fontSize:13}}>Your coordinates are end-to-end encrypted like a message. Live updates only run while NexLink.Chat is open in a tab.</p>
      <button onClick={()=>shareLocation(null)}>📍 Send my current location</button>
      <button className="alt" onClick={()=>shareLocation(Date.now()+15*60000)}>⏱ Live for 15 minutes</button>
      <button className="alt" onClick={()=>shareLocation(Date.now()+3600000)}>⏱ Live for 1 hour</button>
      <button className="alt" onClick={()=>shareLocation(Date.now()+8*3600000)}>⏱ Live for 8 hours</button>
      <a onClick={()=>setModal(null)}>Cancel</a></div></div>}
    {modal==='map'&&mapPoints.length>0&&<div className="modal" onClick={()=>setMapOn(false)}><div className="card" onClick={e=>e.stopPropagation()}>
      <b>Shared location{mapPoints.length>1?` · ${mapPoints.length} people`:''}</b>
      <MapView points={mapPoints} meId={me.id}/>
      <button className="alt" onClick={()=>setMapOn(false)}>Close</button></div></div>}
    {modal==='wp'&&cur&&<div className="modal" onClick={()=>setModal(null)}><div className="card" onClick={e=>e.stopPropagation()}>
      <b>Chat wallpaper</b>
      <div className="wps">{WPS.map(w=><button key={w} className="wpchip" style={{background:w}} onClick={()=>{setWp(cur.id,w);setModal(null)}} aria-label="Set wallpaper"/>)}</div>
      <button className="alt" onClick={()=>{setWp(cur.id,null);setModal(null)}}>Remove wallpaper</button>
      <a onClick={()=>setModal(null)}>Cancel</a></div></div>}
    {modal?.sn&&<div className="modal" onClick={()=>setModal(null)}><div className="card" onClick={e=>e.stopPropagation()}>
      <b>Safety number with {modal.n}</b><p className="mute">Compare these numbers on a call. If both match, nobody is intercepting your chat.</p>
      <code style={{whiteSpace:'pre'}}>{modal.sn}</code><button onClick={()=>setModal(null)}>Close</button></div></div>}
    {modal==='m'&&cur&&<div className="modal" onClick={()=>setModal(null)}><div className="card wide2" onClick={e=>e.stopPropagation()}>
      <b>Media, files and voice</b>
      {media&&media.length?<div className="mediagrid">{media.map(m=><div key={m.id} className="mcell"><FileMsg p={m.p}/><small>{new Date(m.created_at).toLocaleDateString()}</small></div>)}</div>
        :<p className="mute">{media===null?'Loading…':'Nothing shared here yet'}</p>}
      <button className="alt" onClick={()=>setModal(null)}>Close</button></div></div>}
    {fwd&&<div className="modal" onClick={()=>{setFwd(null);setFq('')}}><div className="card" onClick={e=>e.stopPropagation()}>
      <b>Forward {fwd.length>1?fwd.length+' messages':'message'} to…</b>
      <input value={fq} onChange={e=>setFq(e.target.value)} placeholder="Search chats" aria-label="Search chats" autoFocus/>
      <div className="fwdlist">{chats.filter(c=>(!c.expires_at||new Date(c.expires_at)>nowMin*60000)&&titleOf(c,mem,me.id).toLowerCase().includes(fq.trim().toLowerCase())).map(c=><div key={c.id} className="row" onClick={()=>forwardTo(c)}><Av n={titleOf(c,mem,me.id)} src={c.kind==='dm'?other(c,mem,me.id)?.avatar:c.avatar}/><div className="grow"><b>{titleOf(c,mem,me.id)}</b></div></div>)}</div>
      <button className="alt" onClick={()=>{setFwd(null);setFq('')}}>Cancel</button></div></div>}
    {lb&&<div className="modal" onClick={()=>setLb(null)}><img src={lb} alt="" className="lbimg"/></div>}
    {(!online||outN>0)&&<div className="offline" role="status">{online?`Sending ${outN} queued message${outN>1?'s':''}…`:`You’re offline. Messages send when you reconnect.${outN?` (${outN} waiting)`:''}`}</div>}
    <CallOverlay/>
    {toast&&<div className={'toast'+(/fail|error|cannot|can’t|wrong|not allowed|too large|limit|blocked|no user/i.test(toast)?' bad':'')} role="status">{toast}</div>}
  </div>;
}

function PollForm({onCancel,onDone}){
  const [opts,setOpts]=useState(['','']);
  const set=(i,v)=>setOpts(a=>a.map((x,j)=>j===i?v:x));
  return <form className="card" onClick={e=>e.stopPropagation()} onSubmit={e=>{
    e.preventDefault();
    const f=new FormData(e.target),q=String(f.get('q')).trim();
    const list=opts.map(x=>x.trim()).filter(Boolean);
    if(!q||list.length<2)return;
    onDone(q,list);
  }}>
    <b>Create poll</b>
    <input name="q" required maxLength={200} placeholder="Question"/>
    {opts.map((o,i)=><input key={i} value={o} maxLength={60} required={i<2} placeholder={'Option '+(i+1)} onChange={e=>set(i,e.target.value)}/>)}
    <button type="button" className="alt" disabled={opts.length>=10} onClick={()=>setOpts(a=>[...a,''])}>＋ Add option</button>
    <button>Create poll</button>
    <a onClick={onCancel}>Cancel</a>
  </form>;
}

const WPS=[
 'linear-gradient(135deg,#dfe9ff,#f4f9ff)','linear-gradient(135deg,#ffe4ec,#fff7f4)',
 'linear-gradient(135deg,#e0f7ef,#f2fff9)','linear-gradient(135deg,#232c4e,#101a38)',
 'linear-gradient(135deg,#3a2a5e,#1b1436)','linear-gradient(135deg,#0f3b34,#08211e)'];
