'use client';
import {memo,useEffect,useRef,useState} from 'react';
import {sb} from '../lib/supabase';
import {ago,isMob,isSaved,left,title as titleOf,pic as picOf} from '../lib/client';
import {Av,IC,Ic,Menu} from './ui';

const AvM=memo(Av);

function ChatRow({c,meId,mem,last,unread,aid,open,pins,muted,nowMin,typing}){
  const t=titleOf(c,mem,meId),p2=picOf(c,mem,meId);
  const l=last;
  const tp=typing?.[c.id];
  const prev=()=>{if(tp)return <i className="typing">{tp==='me'?'typing…':tp+' is typing…'}</i>;
    if(!l)return c.kind==='temp'?`Temp room · ${left(new Date(c.expires_at)-nowMin*60000)}`:'No messages yet';return (l.from===meId?'You: ':'')+(l.p?(l.p.t==='file'?'📎 '+l.p.name:l.p.t==='react'?'Reacted '+l.p.e:l.p.t==='voice'?'🎤 Voice message':l.p.t==='sticker'?l.p.e+' Sticker':l.p.t==='poll'?'📊 '+(l.p.q||'Poll'):l.p.t==='loc'?'📍 Location':l.p.t==='hreq'?'Requested chat history':l.p.t==='hgrant'?'Shared chat history':l.p.text):'🔒 Encrypted message')};
  return <div className={'row'+(c.id===aid?' on':'')} tabIndex={0} role="button" onKeyDown={e=>e.key==='Enter'&&open(c.id)} onClick={()=>open(c.id)}>
    {isSaved(c)?<div className="av savedav"><Ic d={IC.bookmark} s={18}/></div>:<AvM n={t} src={p2}/>}
    <div className="grow"><div className="r1"><b>{t}</b><time>{pins.includes(c.id)?'📌 ':''}{muted.includes(c.id)?'🔕 ':''}{l?ago(l.at):''}</time></div>
      <div className="r1"><span>{prev()}</span>{unread[c.id]>0&&<i className="badge">{unread[c.id]}</i>}</div></div></div>;
}
const ChatRowM=memo(ChatRow);

export default function Sidebar({me,chats,mem,last,unread,loaded,bk,live,nowMin,open,dm,setModal,backupNow,toggleTheme,signOut,aid,tab,setTab,pins,muted,extraTab,onTab,typing,openSaved,arch,onArchive,onOpenMsg}){
  const [q,setQ]=useState(''),[hits,setHits]=useState([]),[msgHits,setMsgHits]=useState([]),[showArch,setShowArch]=useState(false);
  const searchR=useRef(null);
  // global search: chats by title, people by username, messages by device-local plaintext index (Ctrl+K focuses)
  useEffect(()=>{const f=e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();setTab('all');setTimeout(()=>searchR.current?.focus(),50)}};window.addEventListener('keydown',f);return()=>window.removeEventListener('keydown',f)},[setTab]);
  useEffect(()=>{
    const s=q.trim().toLowerCase().replace(/[^a-z0-9_]/g,'');
    if(me.is_guest||s.length<2){setHits([]);return}
    const t=setTimeout(async()=>{
      const {data}=await sb.from('profiles').select('id,username,display_name,avatar').ilike('username',s+'%').eq('is_guest',false).neq('msg_policy','none').neq('id',me.id).limit(6);
      setHits(data||[]);
    },300);
    return()=>clearTimeout(t);
  },[q,me.id,me.is_guest]);
  useEffect(()=>{
    const s=q.trim();
    if(s.length<2){setMsgHits([]);return}
    let off=false;
    (async()=>{
      try{const {search}=await import('../lib/archive');const r=await search(me.id,s);if(!off)setMsgHits(r)}catch{}
    })();
    return()=>{off=true};
  },[q,me.id]);
  const qs=q.trim().toLowerCase();
  const base=chats.filter(c=>(!c.expires_at||new Date(c.expires_at)>nowMin*60000)&&(tab==='all'||(tab==='unread'?unread[c.id]>0:c.kind===tab))&&(!qs||titleOf(c,mem,me.id).toLowerCase().includes(qs)));
  const norm=base.filter(c=>!arch.includes(c.id)).sort((a,b)=>(pins.includes(b.id)-pins.includes(a.id))||new Date(last[b.id]?.at||0)-new Date(last[a.id]?.at||0));
  const archd=base.filter(c=>arch.includes(c.id)).sort((a,b)=>new Date(last[b.id]?.at||0)-new Date(last[a.id]?.at||0));
  const rows=showArch?archd:norm;
  return <>
    <nav className="rail"><img src="/logo.png" width="42" height="42" alt="NexLink.Chat"/>
      {[['all','Chats',IC.chat],['group','Groups',IC.users],['temp','Temp',IC.timer],...(extraTab?[[extraTab.k,extraTab.l,extraTab.i]]:[])].map(([k,l,i])=><button key={k} className={'rb'+(tab===k?' on':'')} onClick={()=>{setTab(k);onTab?.()}}><Ic d={i}/><span>{l}</span></button>)}
      <div className="grow"/><button className="rb" onClick={()=>setModal('s')}><Ic d={IC.sliders}/><span>Settings</span></button></nav>
    <aside>
      <header><img className="hlogo" src="/logo.png" width="34" height="34" alt=""/><h2 className="grow">Chats</h2><span className={'dot'+(live?' on':'')} title={live?'Live':'Paused to save free quota'}/>
        <Menu label="New" icon={IC.plus} items={[!me.is_guest&&{t:'New group',i:IC.users,f:()=>setModal('g')},{t:'New channel',i:IC.globe,f:()=>setModal('ch')},!me.is_guest&&openSaved&&{t:'Saved Messages',i:IC.bookmark,f:openSaved},{t:'Temporary room',i:IC.timer,f:()=>setModal('t')}]}/>
        <Menu label="Menu" items={[{t:'Settings',i:IC.sliders,f:()=>setModal('s')},{t:'Switch theme',i:IC.moon,f:toggleTheme},{t:'Sign out',i:IC.out,danger:true,f:signOut}]}/></header>
      <input ref={searchR} className="search" placeholder={me.is_guest?'Search chats':'Search chats, messages, people'} value={q} onChange={e=>setQ(e.target.value)} aria-label="Search"/>
      <div className="chips">{[['all','All'],['dm','Direct'],['group','Groups'],['unread','Unread']].map(([k,l])=><button key={k} className={'chip'+(tab===k?' on':'')} onClick={()=>setTab(k)}>{l}</button>)}</div>
      {bk.stale&&bk.auto&&<div className="banner">Auto-backup needs a tap<button onClick={backupNow}>Back up</button></div>}
      <div className="list">
        {hits.length>0&&<><p className="mute pad">People</p>{hits.map(h=><div key={h.id} className="row" onClick={()=>dm(h)}><Av n={h.display_name} src={h.avatar}/><div className="grow"><b>{h.display_name}</b><span>@{h.username}</span></div></div>)}</>}
        {msgHits.length>0&&<><p className="mute pad">Messages</p>{msgHits.map(h=>{
          const c=chats.find(x=>x.id===h.chat_id);
          return <div key={h.id} className="row" onClick={()=>onOpenMsg?.(h.chat_id,h.id)}>
            <Av n={c?titleOf(c,mem,me.id):'?'} src={c?picOf(c,mem,me.id):null}/>
            <div className="grow"><b>{c?titleOf(c,mem,me.id):'Chat'}</b><span>{h.text.slice(0,70)}{h.text.length>70?'…':''}</span></div>
            <time>{ago(h.created_at)}</time></div>})}</>}
        {arch.length>0&&!qs&&<div className={'row archrow'+(showArch?' on':'')} onClick={()=>setShowArch(s=>!s)} role="button" tabIndex={0} onKeyDown={e=>e.key==='Enter'&&setShowArch(s=>!s)}>
          <div className="av archav"><Ic d={IC.archive} s={18}/></div><div className="grow"><b>Archived</b><span>{archd.length} chat{archd.length!==1?'s':''}</span></div><i className={'archchev'+(showArch?' up':'')}>›</i></div>}
        {!loaded&&[0,1,2,3].map(i=><div key={i} className="row skel"><div className="av sk"/><div className="grow"><div className="skl w60"/><div className="skl w40"/></div></div>)}
        {rows.map(c=><ChatRowM key={c.id} c={c} meId={me.id} mem={mem} last={last[c.id]} unread={unread[c.id]||0} aid={aid} open={open} pins={pins} muted={muted} nowMin={nowMin} typing={typing[c.id]}/>)}
        {loaded&&!rows.length&&!hits.length&&!msgHits.length&&<div className="empty"><img src="/logo.png" width="72" height="72" alt=""/><p className="mute">{showArch?'No archived chats':tab==='all'&&!q?'No chats yet':'Nothing matches here'}</p>{tab==='all'&&!q&&<>{!me.is_guest&&<button className="wide" onClick={()=>setModal('g')}>＋ New group</button>}<button className="wide alt" onClick={()=>setModal('t')}>⏱ Temporary room</button><p className="mute" style={{fontSize:13}}>Or type a username above to find someone.</p></>}</div>}
      </div>
    </aside></>;
}
