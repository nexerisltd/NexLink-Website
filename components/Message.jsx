'use client';
import {memo,useCallback,useEffect,useRef,useState} from 'react';
import * as C from '../lib/crypto';
import {fsz,hue,api} from '../lib/client';
import {Av,IC,Ic,Linkify} from './ui';

const blobs=new Map();
export function FileMsg({p}){
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
  return <div className="file">{u&&isImg?<img src={u} alt={p.name} className={'pic'+(p.mime==='image/gif'?' gif':'')} onClick={()=>window.dispatchEvent(new CustomEvent('nl-img',{detail:u}))}/>:
    <button type="button" className="fbtn" disabled={bz} onClick={async()=>{const url=await get();if(url){const a=document.createElement('a');a.href=url;a.download=p.name;a.click()}}}>
      <Ic d={IC.file}/><span><b>{p.name}</b><small>{fsz(p.size)}{bz?' · loading…':' · tap to download'}</small></span></button>}
    {err&&<small className="err">{err}</small>}</div>;
}

// encrypted voice note: fetch+decrypt on first play, waveform scrubbing, speed toggle
const vmeta=new Map(); // path -> {url,dur,wave}
function VoiceMsg({p}){
  const [st,setQuery]=useState({url:vmeta.get(p.path)?.url||null,pos:0,rate:1,bz:false,err:''});
  const auR=useRef(null);
  const load=async()=>{
    if(st.url)return st.url;
    setQuery(s=>({...s,bz:true}));
    try{
      const {url:dl}=await api('/api/files/download',{key:p.path});
      const res=await fetch(dl);if(!res.ok)throw 0;
      const url=URL.createObjectURL(new Blob([await C.decryptFile(await res.arrayBuffer(),p.k,p.iv)],{type:p.mime||'audio/webm'}));
      vmeta.set(p.path,{url});setQuery(s=>({...s,url,bz:false}));return url;
    }catch{setQuery(s=>({...s,bz:false,err:'Unavailable'}));return null}
  };
  const wave=p.wave||Array.from({length:36},(_,i)=>.35+.45*Math.abs(Math.sin(i*1.1+p.path.length)));
  const durS=Math.round((p.dur||0)/1000);
  const fmt=s=>Math.floor(s/60)+':'+String(Math.floor(s%60)).padStart(2,'0');
  const play=async()=>{
    const url=await load();if(!url)return;
    let au=auR.current;
    if(!au){au=new Audio(url);auR.current=au;au.onended=()=>setQuery(s=>({...s,pos:0}));au.ontimeupdate=()=>setQuery(s=>({...s,pos:au.currentTime}))}
    au.playbackRate=st.rate;
    if(au.paused){au.play()}else{au.pause();setQuery(s=>({...s,pos:au.currentTime}))}
    setQuery(s=>({...s,url}));
  };
  const seek=e=>{
    const au=auR.current;if(!au||!p.dur)return;
    const r=e.currentTarget.getBoundingClientRect();
    au.currentTime=Math.max(0,Math.min(1,(e.clientX-r.left)/r.width))*p.dur/1000;
    setQuery(s=>({...s,pos:au.currentTime}));
  };
  const rate=()=>{const au=auR.current;const n=[1,1.5,2][( [1,1.5,2].indexOf(st.rate)+1)%3];if(au)au.playbackRate=n;setQuery(s=>({...s,rate:n}))};
  const playing=auR.current&&!auR.current.paused;
  return <div className="voice">
    <button type="button" className="vbtn" onClick={play} aria-label={playing?'Pause':'Play'} disabled={st.bz}>
      {st.bz?<span className="vload"/>:<Ic d={playing?IC.pause:IC.play} s={18}/>}</button>
    <div className="vwave" onClick={seek}>{wave.map((h,i)=><i key={i} style={{height:Math.round(6+h*18)+'px',opacity:st.pos&&i/(wave.length)<=st.pos/((p.dur||1)/1000)?1:.45}}/>)}</div>
    <span className="vdur">{fmt(durS)}</span>
    <button type="button" className="vrate" onClick={rate} aria-label="Playback speed">{st.rate}x</button>
    {st.err&&<small className="err">{st.err}</small>}
  </div>;
}

// hold = menu, hold+drag = multi-select, swipe = reply (same gestures as before, but state lives here so the list can stay memoized)
export const sw={o:null};
function useSwipe(m,mine,{selecting,idsRef,onMenu,onReply,setSelIds}){
  return {
    onTouchStart:e=>{
      if(selecting){sw.o=null;return}
      const t=e.touches[0],o=sw.o={x:t.clientX,y:t.clientY,lock:null,d:0,held:false,drag:false};
      o.timer=setTimeout(()=>{if(o.lock)return;o.held=true;navigator.vibrate?.(15);onMenu(m,o.x,o.y,true)},500);
    },
    onTouchMove:e=>{
      const o=sw.o;if(!o||o.x==null)return;
      const t=e.touches[0],dx=t.clientX-o.x,dy=t.clientY-o.y;
      if(o.held){
        if(!o.drag&&Math.abs(dy)>14){o.drag=true;onMenu(null)}
        if(o.drag){
          const row=document.elementFromPoint(t.clientX,t.clientY)?.closest('.mrow'),ids=idsRef.current,a=ids.indexOf(m.id),b=row?ids.indexOf(row.dataset.mid):-1;
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
      const o=sw.o;if(!o||o.x==null)return;
      clearTimeout(o.timer);
      const row=e.currentTarget;row.style.transition='transform .2s';row.style.transform='';
      const ic=row.querySelector('.swi');if(ic)ic.style.opacity='0';
      if(o.lock==='x'&&o.d>=56&&!o.held){navigator.vibrate?.(12);onReply(m)}
      sw.o=null;
    },
    onTouchCancel:()=>{clearTimeout(sw.o?.timer);sw.o=null}
  };
}

// poll: votes are encrypted pollvote messages, tallied client-side
function PollMsg({m,p,votes,myVote,onVote}){
  const total=Object.values(votes||{}).length;
  const tally=(p.opts||[]).map((_,i)=>Object.values(votes||{}).filter(v=>v.idx===i).length);
  return <div className="poll">
    <b>{p.q}</b>
    {(p.opts||[]).map((o,i)=>{
      const n=tally[i],pc=total?Math.round(n/total*100):0;
      return <button type="button" key={i} className={'popt'+(myVote===i?' mine':'')} onClick={()=>onVote?.(m,i)}>
        <span className="plabel">{myVote===i?'◉':'○'} {o}</span>
        <span className="pbar" style={{width:pc+'%'}}/>
        <span className="ppc">{total?pc+'%':''}</span>
      </button>})}
    <small className="pmeta">{total} vote{total!==1?'s':''}</small>
  </div>;
}

export const MessageRow=memo(function MessageRow({m,p,mine,sn,avatar,kind,head,newDay,firstNew,text,edited,reactList,myReact,fresh,burst,selected,selecting,held,read,scheduled,myVote,votes,onVote,idsRef,onCtx,onPointerDown,onRowClick,onDbl,onMenu,onReply,openProfile,onReact,hoverPick,hoverLeave,setSelIds}){
  const swipe=useSwipe(m,mine,{selecting,idsRef,onMenu,onReply,setSelIds});
  return <>
    {newDay&&<div className="day">{new Date(m.created_at).toLocaleDateString([],{weekday:'long',day:'numeric',month:'short'})}</div>}
    {firstNew&&<div className="newdiv"><span>New messages</span></div>}
    <div className={'mrow'+(mine?' mine':'')+(selected?' picked':'')} data-mid={m.id} onClick={()=>onRowClick(m)} {...swipe}>{selecting&&<span className={'chk'+(selected?' on':'')} aria-hidden="true"/>}<span className="swi" aria-hidden="true"><Ic d={IC.reply} s={16}/></span>
      {!mine&&(head?<button className="avb" onClick={e=>{if(!selecting){e.stopPropagation();openProfile(m)}}} aria-label={'Open '+sn+' profile'}><Av n={sn} src={avatar}/></button>:<span className="avs"/>)}
      <div id={'m-'+m.id} className={'b'+(mine?' me':'')+(head?' first':'')+(m.pending?' pending':'')+(held?' held':'')} onContextMenu={e=>{e.preventDefault();onCtx(m,e.clientX,e.clientY)}} onPointerDown={e=>onPointerDown(e)} onDoubleClick={e=>onDbl(m)}>
        {kind!=='dm'&&!mine&&head&&<i className="who" onClick={e=>{if(!selecting){e.stopPropagation();openProfile(m)}}} style={{color:`hsl(${hue(m.sender_id)} 75% 45%)`}}>{sn}</i>}
        {p?.fwd&&<small className="fwdl">↪ Forwarded</small>}
        {p?.re&&<div className="quote" onClick={()=>window.dispatchEvent(new CustomEvent('nl-jump',{detail:p.re.id}))}><b>{p.re.n}</b><span>{p.re.t}</span></div>}
        {p?(p.t==='file'?<FileMsg p={p}/>:p.t==='voice'?<VoiceMsg p={p}/>:p.t==='sticker'?<img className="stkm" src={'/stickers/'+p.id+'.svg'} alt="Sticker"/>:p.t==='poll'?<PollMsg m={m} p={p} votes={votes} myVote={myVote} onVote={onVote}/>:p.t==='loc'?<button type="button" className="locchip" onClick={()=>window.dispatchEvent(new CustomEvent('nl-open-loc',{detail:{chat_id:m.chat_id}}))}><Ic d={IC.loc} s={16}/><span>{p.until&&new Date(p.until)>Date.now()?'Live until '+new Date(p.until).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}):'📍 Location'}</span></button>:<Linkify text={text}/>):<em>Can’t decrypt on this device</em>}{edited&&<small className="edited"> (edited)</small>}
        {reactList&&reactList.length>0&&<div className="chipsr">{reactList.map(([e2,n])=><button key={e2} className={'rx'+(myReact===e2?' mine':'')+(fresh?' pop':'')} onClick={e=>{e.stopPropagation();onReact(m,e2)}}>{e2} {n}</button>)}</div>}
        {burst&&<span className="burst">{burst}</span>}
        <time>{m.pending?'sending…':scheduled?'⏰ '+scheduled:new Date(m.created_at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</time>
        {mine&&!m.pending&&!scheduled&&read!==undefined&&<span className={'tick'+(read?' rok':'')} aria-label={read?'Read':'Sent'}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">{read?[].concat(IC.check2).map((x,i)=><path key={i} d={x}/>):<path d={IC.check}/>}</svg></span>}
      </div>
      <div className="hov"><button aria-label="React" title="React" onClick={e=>{e.stopPropagation();onReact(m,'❤️')}} onMouseEnter={e=>hoverPick(m,e)} onMouseLeave={hoverLeave}><Ic d={IC.smile} s={16}/></button><button aria-label="Reply" title="Reply" onClick={e=>{e.stopPropagation();onReply(m)}}><Ic d={IC.reply} s={16}/></button><button aria-label="More" title="More" onClick={e=>{e.stopPropagation();const r=e.currentTarget.getBoundingClientRect();onMenu(m,r.left,r.bottom+4)}}><Ic d={IC.more} s={16}/></button></div>
    </div></>;
});
