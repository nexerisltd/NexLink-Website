// Local-first history: encrypted message rows are kept in IndexedDB so they outlive the server's cache window.
const open=()=>new Promise((r,j)=>{const q=indexedDB.open('nexlink-archive',1);q.onupgradeneeded=()=>{const s=q.result.createObjectStore('m',{keyPath:'k'});s.createIndex('c','c')};q.onsuccess=()=>r(q.result);q.onerror=()=>j(q.error)});
const tx=async(mode,f)=>{const d=await open();return new Promise((r,j)=>{const t=d.transaction('m',mode);const o=f(t.objectStore('m'));t.oncomplete=()=>r(o&&o.result);t.onerror=()=>j(t.error)})};
export const put=(uid,rows)=>tx('readwrite',s=>{rows.forEach(m=>s.put({...m,k:uid+'|'+m.id,c:uid+'|'+m.chat_id}))});
export const byChat=async(uid,chat)=>((await tx('readonly',s=>s.index('c').getAll(uid+'|'+chat)))||[]).sort((a,b)=>new Date(a.created_at)-new Date(b.created_at));
export const all=async uid=>((await tx('readonly',s=>s.getAll()))||[]).filter(m=>m.k.startsWith(uid+'|'));
export const del=(uid,id)=>tx('readwrite',s=>{s.delete(uid+'|'+id)});
