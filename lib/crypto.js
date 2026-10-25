// All crypto is WebCrypto in the browser. The server only ever sees ciphertext and public keys.
const E=new TextEncoder(),D=new TextDecoder(),EC={name:'ECDH',namedCurve:'P-256'};
export const b64=b=>{let s='';new Uint8Array(b).forEach(c=>s+=String.fromCharCode(c));return btoa(s)};
export const ub=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
const rnd=n=>crypto.getRandomValues(new Uint8Array(n));
const pubKey=j=>crypto.subtle.importKey('jwk',{kty:'EC',crv:'P-256',x:j.x,y:j.y,ext:true},EC,true,[]);
async function kek(priv,pub){
  const bits=await crypto.subtle.deriveBits({name:'ECDH',public:pub},priv,256);
  const h=await crypto.subtle.importKey('raw',bits,'HKDF',false,['deriveKey']);
  return crypto.subtle.deriveKey({name:'HKDF',hash:'SHA-256',salt:new Uint8Array(32),info:E.encode('nexlink-wrap-v1')},h,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
}
// identity key (kept non-extractable in IndexedDB; encrypted backup lives on the server)
export async function newIdentity(){
  const kp=await crypto.subtle.generateKey(EC,true,['deriveBits']);
  const p=await crypto.subtle.exportKey('jwk',kp.publicKey);
  return{pub:{x:p.x,y:p.y},priv:await crypto.subtle.exportKey('jwk',kp.privateKey)};
}
export const loadPriv=j=>crypto.subtle.importKey('jwk',j,EC,false,['deriveBits']);
const idb=()=>new Promise((r,j)=>{const q=indexedDB.open('nexlink',1);q.onupgradeneeded=()=>q.result.createObjectStore('k');q.onsuccess=()=>r(q.result);q.onerror=()=>j(q.error)});
export const saveKey=async(id,k)=>{const d=await idb();return new Promise((r,j)=>{const t=d.transaction('k','readwrite');t.objectStore('k').put(k,id);t.oncomplete=r;t.onerror=()=>j(t.error)})};
export const getKey=async id=>{const d=await idb();return new Promise((r,j)=>{const q=d.transaction('k').objectStore('k').get(id);q.onsuccess=()=>r(q.result);q.onerror=()=>j(q.error)})};
// passphrase-protected key backup (for new devices)
async function pk(pass,salt){const b=await crypto.subtle.importKey('raw',E.encode(pass),'PBKDF2',false,['deriveKey']);return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:310000,hash:'SHA-256'},b,{name:'AES-GCM',length:256},false,['encrypt','decrypt'])}
export async function sealBackup(priv,pass){const s=rnd(16),i=rnd(12);const c=await crypto.subtle.encrypt({name:'AES-GCM',iv:i},await pk(pass,s),E.encode(JSON.stringify(priv)));return{s:b64(s),i:b64(i),c:b64(c)}}
export async function openBackup(b,pass){return JSON.parse(D.decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:ub(b.i)},await pk(pass,ub(b.s)),ub(b.c))))}
// messages: random key per message, wrapped separately for every current member (works for DMs and groups)
export async function encryptMessage(payload,members,chatId){
  const mk=rnd(32),iv=rnd(12);
  const key=await crypto.subtle.importKey('raw',mk,'AES-GCM',false,['encrypt']);
  const ct=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:E.encode(chatId)},key,E.encode(JSON.stringify(payload)));
  const eph=await crypto.subtle.generateKey(EC,false,['deriveBits']);
  const ep=await crypto.subtle.exportKey('jwk',eph.publicKey);
  const k={};
  for(const m of members){const w=rnd(12);k[m.id]=[b64(w),b64(await crypto.subtle.encrypt({name:'AES-GCM',iv:w},await kek(eph.privateKey,await pubKey(m.public_key)),mk))]}
  return{iv:b64(iv),ciphertext:b64(ct),wraps:{e:{x:ep.x,y:ep.y},k}};
}
export async function decryptMessage(m,myId,priv){
  const w=m.wraps.k[myId];if(!w)throw new Error('no key for me');
  const mk=await crypto.subtle.decrypt({name:'AES-GCM',iv:ub(w[0])},await kek(priv,await pubKey(m.wraps.e)),ub(w[1]));
  const key=await crypto.subtle.importKey('raw',mk,'AES-GCM',false,['decrypt']);
  return JSON.parse(D.decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:ub(m.iv),additionalData:E.encode(m.chat_id)},key,ub(m.ciphertext))));
}
export async function safety(a,b){
  const h=new Uint8Array(await crypto.subtle.digest('SHA-256',E.encode([a.x+a.y,b.x+b.y].sort().join('|'))));
  const g=Array.from(h.slice(0,12)).map(x=>String(x).padStart(3,'0'));
  return[g.slice(0,4),g.slice(4,8),g.slice(8)].map(r=>r.join(' ')).join('\n');
}
