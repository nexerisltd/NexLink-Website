// Local-first history: encrypted message rows are kept in IndexedDB so they outlive the server's cache window.
// A second store ('t') keeps a device-local plaintext index (text, chat, time) for global search —
// same trust level as the decrypted view already rendered on screen.
const DB='nexlink-archive',VER=2;
const open=()=>new Promise((r,j)=>{const q=indexedDB.open(DB,VER);q.onupgradeneeded=()=>{const d=q.result;
  if(!d.objectStoreNames.contains('m')){const s=d.createObjectStore('m',{keyPath:'k'});s.createIndex('c','c')}
  if(!d.objectStoreNames.contains('t')){const s=d.createObjectStore('t',{keyPath:'k'});s.createIndex('c','c')}
};q.onsuccess=()=>r(q.result);q.onerror=()=>j(q.error)});
const tx=async(mode,f)=>{const d=await open();return new Promise((r,j)=>{const t=d.transaction('m',mode);const o=f(t.objectStore('m'));t.oncomplete=()=>r(o&&o.result);t.onerror=()=>j(t.error)})};
const txtTx=async(mode,f)=>{const d=await open();return new Promise((r,j)=>{const t=d.transaction('t',mode);const o=f(t.objectStore('t'));t.oncomplete=()=>r(o&&o.result);t.onerror=()=>j(t.error)})};
export const put=(uid,rows)=>tx('readwrite',s=>{rows.forEach(m=>s.put({...m,k:uid+'|'+m.id,c:uid+'|'+m.chat_id}))});
export const byChat=async(uid,chat)=>((await tx('readonly',s=>s.index('c').getAll(uid+'|'+chat)))||[]).sort((a,b)=>new Date(a.created_at)-new Date(b.created_at));
export const all=async uid=>((await tx('readonly',s=>s.getAll()))||[]).filter(m=>m.k.startsWith(uid+'|'));
export const del=async(uid,id)=>{await tx('readwrite',s=>s.delete(uid+'|'+id));await txtTx('readwrite',s=>s.delete(uid+'|'+id))};
export const clearChat=async(uid,chat)=>{const rows=await byChat(uid,chat);await tx('readwrite',s=>{rows.forEach(r=>s.delete(r.k))});await txtTx('readwrite',s=>{rows.forEach(r=>s.delete(r.k))})};
// ---- plaintext search index (device-local only) ----
export const index=(uid,rows)=>{
  const skip=['react','edit','pollvote','hreq','hgrant'];
  const r=rows.filter(m=>m.p&&!skip.includes(m.p.t)&&(m.p.text!==undefined||m.p.name));
  if(!r.length)return Promise.resolve();
  return txtTx('readwrite',s=>{r.forEach(m=>s.put({k:uid+'|'+m.id,c:uid+'|'+m.chat_id,at:m.created_at,tx:String(m.p.text??m.p.name).slice(0,400)}))});
};
export const search=async(uid,q)=>{
  const s=String(q).trim().toLowerCase();if(s.length<2)return[];
  const rows=((await txtTx('readonly',st=>st.getAll()))||[]).filter(m=>m.k.startsWith(uid+'|')&&m.tx.toLowerCase().includes(s));
  return rows.sort((a,b)=>new Date(b.at)-new Date(a.at)).slice(0,40).map(m=>({id:m.k.split('|')[1],chat_id:m.c.split('|')[1],text:m.tx,created_at:m.at}));
};
