'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import {CATS,DATA,pushRecent,recents,searchEmoji,STICKERS} from '../lib/emoji';
import {IC,Ic} from './ui';

// Telegram-style picker: category tabs, keyword search, recents, sticker tab.
export default function EmojiPicker({onEmoji,onSticker,stickyR}){
  const [tab,setTab]=useState(-1); // -1 = recents, -2 = search, -3 = stickers, else category index
  const [q,setQ]=useState('');
  const [recent,setRecent]=useState(()=>recents());
  const boxR=useRef(null),qR=useRef(null);
  const list=useMemo(()=>{
    if(tab===-2)return searchEmoji(q);
    if(tab===-1)return recent;
    return (DATA[CATS[tab]]||[]).map(x=>x[0]);
  },[tab,q,recent]);
  useEffect(()=>{if(tab===-2)qR.current?.focus()},[tab]);
  useEffect(()=>{
    if(!stickyR)return;
    const f=e=>{if(!stickyR.current?.contains(e.target)&&!boxR.current?.contains(e.target))return;
      // stop clicks inside the picker from bubbling into the chat list
    };
    document.addEventListener('mousedown',f);return()=>document.removeEventListener('mousedown',f);
  },[stickyR]);
  const pick=e=>{pushRecent(e);setRecent(recents());onEmoji(e)};
  return <div className={'emo2'+(stickyR?' docked':'')} ref={boxR} role="dialog" aria-label="Emoji picker">
    <div className="emotop">
      <div className="emotabs">
        <button type="button" className={'ett'+(tab===-1?' on':'')} aria-label="Recent" onClick={()=>setTab(-1)}>🕘</button>
        {CATS.map((c,i)=><button type="button" key={c} className={'ett'+(tab===i?' on':'')} aria-label={c} onClick={()=>setTab(i)}>{c[0]}</button>)}
        <button type="button" className={'ett'+(tab===-3?' on':'')} aria-label="Stickers" onClick={()=>setTab(-3)}><Ic d={IC.sticker} s={18}/></button>
      </div>
      {tab===-3?null:<div className="emosearch"><input ref={qR} value={q} placeholder="Search emoji" aria-label="Search emoji"
        onChange={e=>{setQ(e.target.value);setTab(e.target.value?-2:tab===-2?-1:tab)}}/></div>}
    </div>
    {tab===-3?<div className="emogrid stick">{STICKERS.map(s=><button type="button" key={s} className="stk" onClick={()=>onSticker(s)} aria-label={'Sticker '+s}><img src={'/stickers/'+s+'.svg'} alt="" loading="lazy"/></button>)}</div>
    :<div className="emogrid">{list.length?list.map(e=><button type="button" key={e} className="emi2" onClick={()=>pick(e)} aria-label={'Emoji '+e}>{e}</button>):<p className="mute pad">No emoji found</p>}</div>}
  </div>;
}
