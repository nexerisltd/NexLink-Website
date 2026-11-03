'use client';
import {useEffect,useRef,useState} from 'react';
import {hue,LS} from '../lib/client';

// ---- icons (all paths live here) ----
export const IC={
  plus:'M12 5v14M5 12h14',more:'more',send:'M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z',back:'M15 18l-6-6 6-6',
  timer:['M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16z','M12 9v4l2 2','M9 2h6'],moon:'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z',
  out:'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',cloud:'M17.5 19H9a7 7 0 1 1 6.7-9h1.8a4.5 4.5 0 0 1 0 9z',
  users:'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8',
  shield:'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',copy:['M9 9h11v11H9z','M5 15V4h11'],
  file:['M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z','M14 2v6h6'],
  clip:'M21.4 11.1l-9.2 9.2a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 0 1 5.7 5.7l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.5-8.5',
  smile:['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z','M8 14s1.5 2 4 2 4-2 4-2','M9 9h.01M15 9h.01'],
  chat:'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z',
  sliders:'M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6',
  camera:['M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z','M12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z'],
  search:['M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z','M21 21l-4.3-4.3'],pin:'M12 17v5M9 3h6l-1 7 3 3H7l3-3z',
  reply:['M9 17l-5-5 5-5','M4 12h11a5 5 0 0 1 5 5v2'],bell:['M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9','M13.7 21a2 2 0 0 1-3.4 0'],
  trash:['M3 6h18','M8 6V4h8v2','M19 6l-1 14H6L5 6'],fwd:'M15 17l5-5-5-5M4 18v-2a4 4 0 0 1 4-4h12',
  edit:'M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z',
  select:['M9 11l3 3 8-8','M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11'],
  hist:'M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l3 2',
  mic:['M12 1a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z','M19 10v1a7 7 0 0 1-14 0v-1M12 18v4M8 22h8'],
  phone:['M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.7A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.2a2 2 0 0 1 2.1-.5c.9.3 1.9.6 2.8.7a2 2 0 0 1 1.7 2z'],
  video:['M23 7l-7 5 7 5V7z','M14 5H3a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2z'],
  micOff:['M1 1l22 22','M9 9v3a3 3 0 0 0 5.1 2.1M15 12.4V4a3 3 0 0 0-5.9-.6','M19 10v1a7 7 0 0 1-1.4 4.2M12 18v4M8 22h8'],
  camOff:['M1 1l22 22','M14 5h-3L9.6 6.6','M5 5H3a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-3l7 5V7l-7 5'],
  phoneOff:['M10.7 13.3a15.9 15.9 0 0 0 3.3 3.3l1.9-1.9a2 2 0 0 1 2.1-.5c.9.3 1.9.6 2.8.7a2 2 0 0 1 1.7 2v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-3.9-3.3M2 2l20 20M4.1 4.1A2 2 0 0 0 2 5.9v3a2 2 0 0 0 2 2 15.6 15.6 0 0 0 2.8.7 2 2 0 0 1 1.7 2l.4 2.4'],
  down:['M12 5v14M5 12l7 7 7-7'],x:'M18 6L6 18M6 6l12 12',
  folder:['M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z'],
  archive:['M21 8v13H3V8M1 3h22v5H1zM10 12h4'],
  bookmark:'M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z',
  globe:['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z','M3 12h18M12 3c2.5 2.7 4 5.6 4 9s-1.5 6.3-4 9c-2.5-2.7-4-5.6-4-9s1.5-6.3 4-9z'],
  speaker:['M11 5L6 9H2v6h4l5 4V5z','M19.1 4.9a10 10 0 0 1 0 14.2M15.5 8.5a5 5 0 0 1 0 7'],
  play:'M5 3l14 9-14 9V3z',pause:['M6 4h4v16H6zM14 4h4v16h-4z'],
  clock:['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z','M12 7v5l3 3'],
  poll:['M18 20V10M12 20V4M6 20v-6'],
  loc:['M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z','M12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z'],
  check:'M20 6L9 17l-5-5',check2:['M18 7L10 16l-3-3','M22 10l-7.5 8.5L12 16'],
  vol:['M11 5L6 9H2v6h4l5 4V5z','M15.5 8.5a5 5 0 0 1 0 7'],
  info:['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z','M12 8h.01M12 12v4'],
  sticker:['M15.5 3H7a4 4 0 0 0-4 4v10a4 4 0 0 0 4 4h4l10-10V7a4 4 0 0 0-4-4z','M14 21v-4a3 3 0 0 1 3-3h4'],
  gif:'M3 8h4M3 8v8M7 8v8M12 8v8h3M21 8h-3a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h3v-4h-2',
  img:['M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2z','M8.5 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM21 15l-5-5L5 21'],
};
export const Ic=({d,s=20})=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d==='more'?<g fill="currentColor"><circle cx="12" cy="5" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="12" cy="19" r="1.6"/></g>:[].concat(d).map((x,i)=><path key={i} d={x}/>)}</svg>;

// ---- shared visual bits ----
export const Av=({n,src})=>src?<img className="av" src={src} alt=""/>:<div className="av" style={{background:`linear-gradient(135deg,hsl(${hue(n)} 80% 55%),hsl(${(hue(n)+50)%360} 75% 40%))`}}>{(n||'?')[0].toUpperCase()}</div>;
export const Brand=()=><span className="brand">NexLink<em>.Chat</em></span>;
export const GIcon=()=><svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.2C12.4 13.6 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.6 5.9c4.4-4.1 7-10.1 7-17.6z"/><path fill="#FBBC05" d="M10.5 28.6c-.5-1.5-.8-3-.8-4.6s.3-3.1.8-4.6l-7.9-6.2C.9 16.4 0 20.1 0 24s.9 7.6 2.6 10.8l7.9-6.2z"/><path fill="#34A853" d="M24 48c6.5 0 12-2.1 16-5.8l-7.6-5.9c-2.1 1.4-4.9 2.3-8.4 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.2C6.5 42.6 14.6 48 24 48z"/></svg>;
export const Splash=({t})=><div className="center"><img className="pulse" src="/logo.png" width="96" height="96" alt=""/><p className="mute">{t||'Loading…'}</p></div>;
export const REACTS=['👍','❤️','😂','😮','😢','🙏'];
export const ACC=[['#2b7bff','#4f9bff'],['#7c5cff','#a78bfa'],['#10b981','#34d399'],['#f43f5e','#fb7185'],['#f59e0b','#fbbf24']];
export const applyAccent=i=>{const a=ACC[i]||ACC[0],r=document.documentElement.style;r.setProperty('--acc',a[0]);r.setProperty('--acc2',a[1])};
export function toggleTheme(){const el=document.documentElement;const dark=(el.dataset.theme||(matchMedia('(prefers-color-scheme: light)').matches?'light':'dark'))==='dark';const n=dark?'light':'dark';el.dataset.theme=n;try{localStorage.setItem('nl-theme',n)}catch{}}

export function Menu({items,label,icon}){
  const [o,setO]=useState(false),r=useRef(null);
  useEffect(()=>{if(!o)return;const f=e=>{if(!r.current?.contains(e.target))setO(false)};document.addEventListener('mousedown',f);return()=>document.removeEventListener('mousedown',f)},[o]);
  return <div className="menu" ref={r}><button className="ic" aria-label={label} aria-expanded={o} onClick={()=>setO(!o)}><Ic d={icon||IC.more}/></button>
    {o&&<div className="pop" role="menu">{items.filter(Boolean).map(it=><button key={it.t} role="menuitem" className={'mi'+(it.danger?' danger':'')} onClick={()=>{setO(false);it.f()}}><Ic d={it.i} s={18}/>{it.t}</button>)}</div>}</div>;
}

// ---- text formatting ----
export const URL_RE=/(https?:\/\/[^\s<]+[^\s<.,;:!?)\]'"])/g;
const FMT=/(\*\*[^*\n]+\*\*|`[^`\n]+`)/g;
export const Fmt=({s})=>s.split(FMT).map((p,i)=>i%2?(p[0]==='`'?<code key={i}>{p.slice(1,-1)}</code>:<b key={i}>{p.slice(2,-2)}</b>):p);
export const Linkify=({text})=>text.split(URL_RE).map((p,i)=>i%2?<a key={i} href={p} target="_blank" rel="noopener noreferrer nofollow">{p}</a>:<Fmt key={i} s={p}/>);
