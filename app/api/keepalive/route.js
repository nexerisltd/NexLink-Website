import { createClient } from '@supabase/supabase-js';
import { removeKeys } from '../../../lib/r2';
export const dynamic='force-dynamic';
// Daily cron: keeps the Supabase project awake and deletes expired encrypted files from Cloudflare R2.
export async function GET(req){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL,sk=process.env.SUPABASE_SERVICE_ROLE_KEY;
  const r=await fetch(`${url}/rest/v1/profiles?select=id&limit=1`,{headers:{apikey:process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY},cache:'no-store'});
  let removed=0;
  const ok=!process.env.CRON_SECRET||req.headers.get('authorization')===`Bearer ${process.env.CRON_SECRET}`;
  if(sk&&ok){
    const db=createClient(url,sk,{auth:{persistSession:false}}),nowIso=new Date().toISOString();
    const {data:old}=await db.from('messages').select('id,file_path').not('file_path','is',null).lt('expires_at',nowIso).limit(300);
    if(old?.length){try{await removeKeys(old.map(m=>m.file_path))}catch{}await db.from('messages').delete().in('id',old.map(m=>m.id));removed+=old.length}
    const {data:tc}=await db.from('chats').select('id').eq('kind','temp').lt('expires_at',nowIso).limit(50);
    for(const c of tc||[]){
      const {data:fs}=await db.from('messages').select('file_path').eq('chat_id',c.id).not('file_path','is',null);
      if(fs?.length){try{await removeKeys(fs.map(f=>f.file_path))}catch{}removed+=fs.length}
      await db.from('chats').delete().eq('id',c.id);
    }
  }
  return Response.json({ok:r.ok,removed});
}
