// Google Drive backup into the hidden per-app folder (scope drive.appdata). Only this app can see the file.
const CID=process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,NAME='nexlink-backup.json',API='https://www.googleapis.com';
export const configured=!!CID;
const gis=()=>new Promise((res,rej)=>{if(window.google?.accounts?.oauth2)return res();const s=document.createElement('script');s.src='https://accounts.google.com/gsi/client';s.onload=res;s.onerror=()=>rej(new Error('Could not load Google sign-in'));document.head.appendChild(s)});
export async function token(){
  if(!CID)throw new Error('Google Drive backup is not configured');
  await gis();
  return new Promise((res,rej)=>window.google.accounts.oauth2.initTokenClient({client_id:CID,scope:'https://www.googleapis.com/auth/drive.appdata',
    callback:r=>r.access_token?res(r.access_token):rej(new Error(r.error_description||r.error||'Google sign-in failed')),
    error_callback:e=>rej(new Error(e.type==='popup_closed'?'Google window was closed':'Google sign-in failed'))}).requestAccessToken());
}
const hd=t=>({Authorization:'Bearer '+t});
async function find(t){const r=await fetch(`${API}/drive/v3/files?spaces=appDataFolder&q=${encodeURIComponent(`name='${NAME}'`)}&fields=files(id)`,{headers:hd(t)});if(!r.ok)throw new Error('Drive error '+r.status+' (is the Drive API enabled?)');return(await r.json()).files?.[0]?.id}
export async function save(t,text){
  const id=await find(t);
  if(id){const r=await fetch(`${API}/upload/drive/v3/files/${id}?uploadType=media`,{method:'PATCH',headers:{...hd(t),'Content-Type':'application/json'},body:text});if(!r.ok)throw new Error('Drive error '+r.status);return}
  const b='nl'+Date.now(),meta=JSON.stringify({name:NAME,parents:['appDataFolder']});
  const body=`--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${b}\r\nContent-Type: application/json\r\n\r\n${text}\r\n--${b}--`;
  const r=await fetch(`${API}/upload/drive/v3/files?uploadType=multipart`,{method:'POST',headers:{...hd(t),'Content-Type':`multipart/related; boundary=${b}`},body});
  if(!r.ok)throw new Error('Drive error '+r.status);
}
export async function load(t){const id=await find(t);if(!id)return null;const r=await fetch(`${API}/drive/v3/files/${id}?alt=media`,{headers:hd(t)});if(!r.ok)throw new Error('Drive error '+r.status);return r.text()}
