'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import {keepable,nm,title as titleOf,pic as picOf,left,other,isSaved} from '../lib/client';
import {Av,IC,Ic,Menu,REACTS} from './ui';
import {MessageRow,sw} from './Message';
import Compose from './Compose';

const ptr={t:'mouse'};

export default function ChatView(props){
  const {me,cur,mem,msgs,clr,grants,hid,lim,setLim,readAt,now,ver,keyed,
    selIds,selMode,grantFor,setSelIds,setSelMode,setGrantFor,clearSel,togglePick,
    deleteMsgs,copyText,setFwd,shareHistory,reqHistory,clearChat,flash,
    doReply,setReplyTo,editing,setEditing,
    react,setMenu,setRxp,fresh,burst,openProfile,openHead,verify,
    amAdmin,unlockRoom,unlock,setUnlock,sendFile,dragMoved,menuAt,
    togglePinChat,toggleMuteChat,grpPicRef,setGrpPic,wp} = props;
  const [find,setFind]=useState(null),[atBottom,setAtBottom]=useState(true);
  const boxR=useRef(null),endR=useRef(null),rxT=useRef(null),idsRef=useRef([]);
  const menu=props.menu,rxp=props.rxp;

  // jump to a message (quote clicks, search hits)
  const jump=id=>{const el=document.getElementById('m-'+id);if(el){el.scrollIntoView({block:'center',behavior:'smooth'});el.classList.add('hl');setTimeout(()=>el.classList.remove('hl'),1500)}};
  useEffect(()=>{const f=e=>jump(e.detail);window.addEventListener('nl-jump',f);return()=>window.removeEventListener('nl-jump',f)},[]);
  // reset per-chat view state
  useEffect(()=>{setFind(null);idsRef.current=[]},[cur?.id]);
  // Escape closes overlays owned here
  useEffect(()=>{const f=e=>{if(e.key==='Escape'){setMenu(null);setRxp(null);setFind(null)}};window.addEventListener('keydown',f);return()=>window.removeEventListener('keydown',f)},[]);
  // keep the touchmove blocker for held menus
  useEffect(()=>{const b=boxR.current;if(!b)return;const f=e=>{if(sw.o?.held)e.preventDefault()};b.addEventListener('touchmove',f,{passive:false});return()=>b.removeEventListener('touchmove',f)},[cur?.id]);
  // autscroll: anchor to the newest message on chat switch (only once content exists),
  // then follow when near the bottom or when the user sends
  useEffect(()=>{
    const b=boxR.current;if(!b||!cur)return;
    const list=msgs||[];
    if(!list.length)return;
    if(b.dataset.chat!==cur.id){endR.current?.scrollIntoView({block:'end'});b.dataset.chat=cur.id;return}
    const near=b.scrollHeight-b.scrollTop-b.clientHeight<160,mine=list.slice(-1)[0]?.sender_id===me.id;
    if(near||mine)endR.current?.scrollIntoView({block:'end'});
  },[msgs,cur?.id,me.id]);
  const openMenu=(m,x,y,touch)=>{
    if(!m)return setMenu(null);
    if(m.pending)return;setRxp(null);menuAt.current=Date.now();
    if(touch){const r=document.getElementById('m-'+m.id)?.getBoundingClientRect();
      if(r){x=m.sender_id===me.id?r.right-230:r.left;y=r.bottom+8;if(y+340>window.innerHeight)y=Math.max(8,r.top-348)}}
    setMenu({m,x,y});
  };
  const hoverPick=(m,e)=>{clearTimeout(rxT.current);const r=e.currentTarget.getBoundingClientRect();setRxp({m,x:r.left+r.width/2,y:r.top})};
  const hoverLeave=()=>{rxT.current=setTimeout(()=>setRxp(null),250)};
  const onCtx=(m,x,y)=>{
    if(m.pending)return;setRxp(null);menuAt.current=Date.now();
    if(ptr.t!=='mouse'){const r=document.getElementById('m-'+m.id)?.getBoundingClientRect();
      if(r){x=m.sender_id===me.id?r.right-230:r.left;y=r.bottom+8;if(y+340>window.innerHeight)y=Math.max(8,r.top-348)}}
    setMenu({m,x,y});
  };
  const onDbl=m=>{if(ptr.t!=='mouse')return;window.getSelection()?.removeAllRanges();doReply(m)};
  // unified double-tap (mouse + touch) → reply; mobile browsers fire dblclick unreliably
  const lastTap=useRef({t:0,id:null});
  const onTap=m=>{
    const now2=Date.now();
    if(lastTap.current.id===m.id&&now2-lastTap.current.t<350){
      lastTap.current={t:0,id:null};
      if(!selecting){window.getSelection()?.removeAllRanges();doReply(m);navigator.vibrate?.(10)}
    }else lastTap.current={t:now2,id:m.id};
  };
  const onRowClick=m=>{if(dragMoved.current)return;if(selIds.length>0||selMode)togglePick(m.id)};
  const onPointerDown=e=>{ptr.t=e.pointerType};
  // PC: drag on empty chat space to select rows
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

  const kind=cur?.kind,meId=me.id;
  const all=useMemo(()=>!cur?[]:(msgs||[])
    .filter(m=>keepable(cur)||new Date(m.expires_at)>Date.now())
    .filter(m=>{const c=clr[m.chat_id];if(!c)return true;const t=+new Date(m.created_at);if(t>+new Date(c))return true;return(grants[m.chat_id]||[]).some(g=>t>=+new Date(g.from_ts)&&t<=+new Date(g.to_ts))})
    .filter(m=>!hid.includes(m.id)),[cur,msgs,clr,grants,hid]);
  const byId=useMemo(()=>Object.fromEntries(all.map(m=>[m.id,m])),[all]);
  const ed=useMemo(()=>{const e={};all.forEach(m=>{const p=m.p;if(p?.t==='edit'&&byId[p.to]?.sender_id===m.sender_id)e[p.to]=p.text});return e},[all,byId]);
  const reactsAgg=useMemo(()=>{
    const r={};all.forEach(m=>{const p=m.p;if(!p||p.t!=='react')return;const target=byId[p.to];if(!target)return;(r[p.to]??={});if(p.e)r[p.to][m.sender_id]=p.e;else delete r[p.to][m.sender_id]});
    return r;
  },[all,byId]);
  const shown=useMemo(()=>{
    const latest={};all.forEach(m=>{if(m.p?.t==='loc')latest[m.sender_id]=m.id});
    return all
      .filter(m=>m.p?.t!=='react'&&m.p?.t!=='edit'&&m.p?.t!=='pollvote')
      .filter(m=>m.p?.t!=='loc'||latest[m.sender_id]===m.id)
      .filter(m=>!find||(m.p&&((ed[m.id]??m.p.text)||m.p.name||'').toLowerCase().includes(find.toLowerCase())));
  },[all,find,ed]);
  idsRef.current=shown.map(x=>x.id);
  // read receipts: my outgoing bubbles get ✓✓ once every other member has read past that message
  const othersMin=useMemo(()=>cur?(mem[cur.id]||[]).filter(p=>p.id!==meId).reduce((a,p)=>Math.min(a,p.lastRead?+new Date(p.lastRead):0),Infinity):Infinity,[cur,mem]);
  const selecting=selIds.length>0||selMode;
  const picked=shown.filter(m=>selIds.includes(m.id));
  const mm=menu?.m,mmine=mm?.sender_id===meId;
  const canPin=cur&&(cur.kind==='dm'||isSaved(cur)||amAdmin);
  const ctxItems=mm?[{t:'Reply',i:IC.reply,f:()=>doReply(mm)},{t:'Forward',i:IC.fwd,f:()=>setFwd([mm])},
    mmine&&mm.p?.text&&!mm.p.t&&{t:'Edit',i:IC.edit,f:()=>{setEditing(mm)}},
    mm.p?.text&&{t:'Copy',i:IC.copy,f:()=>{copyText(ed[mm.id]??mm.p.text);flash('Copied')}},
    cur?.kind!=='temp'&&cur?.kind!=='channel'&&canPin&&(props.pin?.message_id===mm.id?{t:'Unpin',i:IC.pin,f:()=>props.onUnpin(mm)}:{t:'Pin',i:IC.pin,f:()=>props.onPin(mm)}),
    {t:'Select',i:IC.select,f:()=>setSelIds([mm.id])},
    {t:mmine?'Delete':'Delete for me',i:IC.trash,danger:true,f:()=>deleteMsgs([mm])}]:[];
  // fresh-reaction pop effect
  const reactSig=useMemo(()=>JSON.stringify(Object.entries(reactsAgg).flatMap(([id,r])=>Object.entries(Object.values(r).reduce((a,e)=>(a[e]=(a[e]||0)+1,a),{})).map(([e,n])=>[id+'|'+e,n]))),[reactsAgg]);
  useEffect(()=>{props.onReactSig(reactSig)},[reactSig,props.onReactSig]);
  const sub=cur?.kind==='temp'?`Code ${cur.code.slice(0,4)}-${cur.code.slice(4)} · ${left(new Date(cur.expires_at)-now)} · ${(mem[cur.id]||[]).length} people`:cur?.kind==='dm'?'End-to-end encrypted':cur?`${(mem[cur.id]||[]).length} members`:'';
  const warn=cur?.kind==='temp'&&new Date(cur.expires_at)-now<600000;
  const htitle=cur?titleOf(cur,mem,meId):'',hpic=cur?picOf(cur,mem,meId):null;
  const otherP=cur?.kind==='dm'?other(cur,mem,meId):null;
  const pinMsgRow=props.pin?(all.find(x=>x.id===props.pin.message_id)):null;
  const pinSnippet=pinMsgRow?(pinMsgRow.p?.t==='file'?'📎 '+pinMsgRow.p.name:pinMsgRow.p?.t==='voice'?'🎤 Voice message':pinMsgRow.p?.t==='sticker'?pinMsgRow.p.id+' sticker':pinMsgRow.p?.text||'🔒 Encrypted'):'';

  return <main style={props.wp?{background:props.wp}:null} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();const f=e.dataTransfer.files[0];if(f&&cur&&!(cur.kind==='temp'&&!keyed))sendFile(f)}}>
    {cur?<>
      {selecting&&<header className="selbar"><button className="ic" aria-label="Cancel selection" onClick={clearSel}>✕</button><b className="grow">{grantFor?`Select messages to share with ${grantFor.name}`:`${selIds.length} selected`}</b>
        {grantFor?<button className="sm" disabled={!selIds.length} onClick={()=>shareHistory(picked)}>Share ({selIds.length})</button>:<>
          <button className="ic" aria-label="Forward" title="Forward" disabled={!selIds.length} onClick={()=>setFwd(picked)}><Ic d={IC.fwd}/></button>
          <button className="ic" aria-label="Copy" title="Copy" disabled={!selIds.length} onClick={()=>{copyText(fmtMsgs(picked));flash('Copied');clearSel()}}><Ic d={IC.copy}/></button>
          <button className="ic" aria-label="Delete" title="Delete" disabled={!selIds.length} onClick={()=>deleteMsgs(picked)}><Ic d={IC.trash}/></button></>}</header>}
      <header><button className="ic back" aria-label="Back" onClick={props.goBack}><Ic d={IC.back}/></button><span className="clk" onClick={openHead}><Av n={htitle} src={hpic}/></span>
        <div className="grow clk" onClick={openHead}><b>{htitle}</b><span className={'mute'+(warn?' warn':'')}>{props.headerSub||sub}</span></div>
        {props.headerButtons}
        <Menu label="Chat options" items={props.chatMenuItems}/></header>
      <input ref={grpPicRef} type="file" accept="image/*" hidden onChange={e=>{setGrpPic(e.target.files[0]);e.target.value=''}}/>
      {props.pin&&<div className="pinbar"><span className="pinico">📌</span>
        <button className="pintxt" onClick={()=>{const el=shown.find(x=>x.id===props.pin.message_id);if(el)jump(props.pin.message_id);else flash('Pinned message is not loaded')}}>
          <b>Pinned message</b><span>{pinSnippet}</span></button>
        {(cur.kind==='dm'||isSaved(cur)||amAdmin)&&<button className="ic" aria-label="Unpin" onClick={()=>props.onUnpin({id:props.pin.message_id,chat_id:cur.id})}>✕</button>}</div>}
      {find!=null&&<div className="findbar"><input autoFocus value={find} onChange={e=>setFind(e.target.value)} placeholder="Search in this chat" aria-label="Search in this chat"/><button className="ic" aria-label="Close search" onClick={()=>setFind(null)}>✕</button></div>}
      <div className={'msgs'+(selecting?' sel':'')} ref={boxR} style={props.wp?{background:'transparent'}:null} onMouseDown={startDrag} onScroll={e=>{const b=e.currentTarget;setAtBottom(b.scrollHeight-b.scrollTop-b.clientHeight<200)}}>
        {cur&&keepable(cur)&&(msgs||[]).length>=lim&&<button className="alt sm older" onClick={()=>setLim(l=>l+300)}>Load older messages</button>}
        {!shown.length&&<p className="mute" style={{margin:'auto'}}>No messages yet. Say hello.</p>}
        {shown.map((m,i)=>{const pv=shown[i-1],d=new Date(m.created_at),head=!pv||pv.sender_id!==m.sender_id||d-new Date(pv.created_at)>300000,newDay=!pv||new Date(pv.created_at).toDateString()!==d.toDateString(),mine=m.sender_id===meId,sp=(mem[cur.id]||[]).find(p=>p.id===m.sender_id),sn=nm(sp),firstNew=readAt>0&&!mine&&d>readAt&&(!pv||new Date(pv.created_at)<=readAt);
          if(m.p?.t==='hreq'||m.p?.t==='hgrant')return <div key={m.id} className="sysmsg">{m.p.t==='hreq'?(mine?'You asked for the chat history.':<>{sn} asked for the chat history from before they cleared this chat. <button onClick={()=>{setGrantFor({u:m.sender_id,name:sn});setSelMode(true);setSelIds([]);flash('Select the first and last message you want to share')}}>Share…</button></>):<>{sn} shared chat history with {m.p.to===meId?'you':nm((mem[cur.id]||[]).find(p=>p.id===m.p.to))}.</>}</div>;
          if(m.p?.t==='missed'||m.p?.t==='calllog'){
            const mm2=Math.floor((m.p.dur||0)/60),ss2=String((m.p.dur||0)%60).padStart(2,'0');
            const label=m.p.t==='missed'?`${m.p.video?'🎥 Missed video call':'📞 Missed voice call'}`:`${m.p.video?'🎥':'📞'} ${m.p.video?'Video':'Voice'} call · ${mm2}:${ss2}`;
            return <div key={m.id} className={'sysmsg'+(m.p.t==='missed'?' missed':'')}>{label}{mine?'':` · ${sn}`}<time>{d.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</time></div>;
          }
          const rl=reactsAgg[m.id]?Object.entries(Object.values(reactsAgg[m.id]).reduce((a,e)=>(a[e]=(a[e]||0)+1,a),{})):null;
          const myE=reactsAgg[m.id]?.[meId];
          const schedAt=m.deliver_at&&new Date(m.deliver_at)>Date.now()?new Date(m.deliver_at).toLocaleString([],{day:'short',month:'short',hour:'2-digit',minute:'2-digit'}):null;
          const pvotes=m.p?.t==='poll'?(()=>{const v={};all.forEach(x=>{if(x.p?.t==='pollvote'&&x.p.to===m.id)v[x.sender_id]={idx:x.p.idx}});return v})():null;
          return <MessageRow key={m.id} m={m} p={m.p} mine={mine} sn={sn} avatar={sp?.avatar} kind={kind} head={head} newDay={newDay} firstNew={firstNew}
            text={ed[m.id]??m.p?.text??''} edited={ed[m.id]!=null}
            reactList={rl} myReact={myE} fresh={!!(myE&&props.freshMap?.[m.id+'|'+myE])} burst={burst?.id===m.id?burst.e:null}
            read={mine&&!m.pending&&!schedAt&&othersMin!==Infinity&&othersMin>=d.getTime()}
            scheduled={schedAt} votes={pvotes} myVote={pvotes?.[meId]?.idx} onVote={props.onVote}
            selected={selIds.includes(m.id)} selecting={selecting} held={menu?.m.id===m.id} idsRef={idsRef}
            onCtx={onCtx} onPointerDown={onPointerDown} onRowClick={onRowClick} onTap={onTap} onMenu={openMenu}
            onReply={doReply} openProfile={openProfile} onReact={react} hoverPick={hoverPick} hoverLeave={hoverLeave} setSelIds={setSelIds}/>;})}
        <div ref={endR}/>
      </div>
      {!atBottom&&<button className="jump" aria-label="Scroll to latest" onClick={()=>endR.current?.scrollIntoView({behavior:'smooth',block:'end'})}><Ic d={IC.down} s={18}/></button>}
      {cur.kind==='temp'&&!keyed?<form className="send" onSubmit={unlockRoom}><input type="password" required value={unlock} onChange={e=>setUnlock(e.target.value)} placeholder="Room password to unlock"/><button>Unlock</button></form>:
        <Compose aid={cur.id} replyTo={props.replyTo} editing={editing} editingText={editing?(ed[editing.id]??(editing.p?.text||'')):''}
          onCancelReply={()=>setReplyTo(null)} onCancelEdit={()=>{setEditing(null)}}
          onSend={props.onSend} onFile={sendFile} disabled={props.composeDisabled} onTyping={props.onTyping}
          onVoice={props.onVoice} onSticker={props.onSticker} onSchedulePick={props.onSchedulePick} onPoll={props.onPoll} onLocation={props.onLocation}
          placeholder={props.composePlaceholder}/>}
    </>:<div className="center"><img className="pulse" src="/logo.png" width="120" height="120" alt=""/><h2><span className="brand">NexLink<em>.Chat</em></span></h2><p className="mute">Pick a chat, or start something new.</p>{props.emptyActions}</div>}

    {rxp&&<div className="rxpick" style={{left:Math.max(8,Math.min(rxp.x-110,window.innerWidth-236)),top:Math.max(8,rxp.y-50)}} onMouseEnter={()=>clearTimeout(rxT.current)} onMouseLeave={hoverLeave}>{REACTS.map(e=><button key={e} aria-label={'React '+e} onClick={()=>{react(rxp.m,e);setRxp(null)}}>{e}</button>)}</div>}
    {menu&&<div className="ctxwrap" onClick={()=>{if(Date.now()-menuAt.current>600)setMenu(null)}} onContextMenu={e=>{e.preventDefault();if(Date.now()-menuAt.current>600)setMenu(null)}}>
      <div className="ctx" role="menu" style={{left:Math.max(8,Math.min(menu.x,window.innerWidth-240)),top:Math.max(8,Math.min(menu.y,window.innerHeight-340))}} onClick={e=>e.stopPropagation()}>
        {cur.kind!=='channel'&&<div className="ctxr">{REACTS.map(e=><button key={e} aria-label={'React '+e} onClick={()=>{if(Date.now()-menuAt.current<600)return;react(menu.m,e);setMenu(null)}}>{e}</button>)}</div>}
        {ctxItems.filter(Boolean).map(it=><button key={it.t} role="menuitem" className={'mi'+(it.danger?' danger':'')} onClick={()=>{if(Date.now()-menuAt.current<600)return;setMenu(null);it.f()}}><Ic d={it.i} s={18}/>{it.t}</button>)}</div></div>}
  </main>;

  function fmtMsgs(list){
    return [...list].sort((a,b)=>new Date(a.created_at)-new Date(b.created_at)).filter(m=>m.p&&m.p.t!=='hreq'&&m.p.t!=='hgrant').map(m=>{
      const sp=(mem[cur.id]||[]).find(p=>p.id===m.sender_id),t=m.p.t==='file'?'[File] '+m.p.name:(ed[m.id]??m.p.text);
      return `${nm(sp)}: ${m.p.re?`Replied on "${m.p.re.t}" `:''}${t}`}).join('\n');
  }
}
