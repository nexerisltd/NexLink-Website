// Browser-side helpers shared by every component. No crypto here — see lib/crypto.js.
import {sb} from './supabase';

export const nm=p=>p?.display_name||'?';
export const hue=n=>[...(n||'?')].reduce((a,c)=>a+c.charCodeAt(0),0)*47%360;
export const LS=(k,v)=>{try{if(v===undefined)return localStorage.getItem(k);if(v===null)localStorage.removeItem(k);else localStorage.setItem(k,v)}catch{}return null};
export const ago=iso=>{const d=new Date(iso),t=new Date();return d.toDateString()===t.toDateString()?d.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}):t-d<6048e5?d.toLocaleDateString([],{weekday:'short'}):d.toLocaleDateString([],{day:'numeric',month:'short'})};
export const fsz=n=>n<1024?n+' B':n<1048576?(n/1024).toFixed(0)+' KB':(n/1048576).toFixed(1)+' MB';
export const isMob=()=>typeof window!=='undefined'&&window.matchMedia('(max-width:760px)').matches;
export const keepable=c=>c.kind!=='temp'&&!c.ttl_hours;
export const urlB64=s=>{const b=(s+'='.repeat((4-s.length%4)%4)).replace(/-/g,'+').replace(/_/g,'/');return Uint8Array.from(atob(b),c=>c.charCodeAt(0))};
export const other=(c,mem,meId)=>(mem[c?.id]||[]).find(p=>p.id!==meId);
export const isSaved=c=>c?.kind==='dm'&&!!c.dm_key?.startsWith('saved:');
export const title=(c,mem,meId)=>c?.kind==='dm'?(isSaved(c)?'Saved Messages':nm(other(c,mem,meId))):c?.title;
export const pic=(c,mem,meId)=>c?.kind==='dm'?other(c,mem,meId)?.avatar:c?.avatar;
export const left=ms=>{const m=Math.max(0,Math.round(ms/60000));return `${Math.floor(m/60)}h ${m%60}m left`};

export async function squarePic(file){const b=await createImageBitmap(file),s=Math.min(b.width,b.height),cv=document.createElement('canvas');cv.width=cv.height=128;cv.getContext('2d').drawImage(b,(b.width-s)/2,(b.height-s)/2,s,s,0,0,128,128);return cv.toDataURL('image/jpeg',.8)}
export async function shrink(f){
  if(!/^image\/(png|jpe?g|webp)$/.test(f.type)||f.size<300000)return f;
  const b=await createImageBitmap(f),k=Math.min(1,1600/Math.max(b.width,b.height)),cv=document.createElement('canvas');
  cv.width=Math.round(b.width*k);cv.height=Math.round(b.height*k);cv.getContext('2d').drawImage(b,0,0,cv.width,cv.height);
  const o=await new Promise(r=>cv.toBlob(r,'image/jpeg',.82));
  return o&&o.size<f.size?new File([o],f.name.replace(/\.\w+$/,'')+'.jpg',{type:'image/jpeg'}):f;
}
export async function api(path,body){
  const {data:{session}}=await sb.auth.getSession();
  const r=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${session?.access_token}`},body:JSON.stringify(body)});
  const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||'Request failed');return j;
}
