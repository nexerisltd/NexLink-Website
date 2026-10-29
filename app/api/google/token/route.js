import { ready, dec, userOf, admin } from '../../../../lib/gtoken';
export const dynamic='force-dynamic';
export async function POST(req){
  const u=await userOf(req);if(!u)return Response.json({error:'auth'},{status:401});
  if(!ready())return Response.json({error:'not configured'},{status:404});
  const db=admin(),{data:row}=await db.from('google_tokens').select('enc').eq('user_id',u.id).maybeSingle();
  if(!row)return Response.json({error:'not linked'},{status:404});
  let rt;try{rt=dec(row.enc)}catch{return Response.json({error:'bad token'},{status:404})}
  const r=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},
    body:new URLSearchParams({client_id:process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,client_secret:process.env.GOOGLE_CLIENT_SECRET,refresh_token:rt,grant_type:'refresh_token'})});
  const j=await r.json().catch(()=>({}));
  if(!r.ok||!j.access_token){if(j.error==='invalid_grant')await db.from('google_tokens').delete().eq('user_id',u.id);return Response.json({error:'google'},{status:404})}
  return Response.json({access_token:j.access_token,expires_in:j.expires_in});
}
