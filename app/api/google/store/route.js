import { ready, enc, userOf, admin } from '../../../../lib/gtoken';
export const dynamic='force-dynamic';
export async function POST(req){
  const u=await userOf(req);if(!u)return Response.json({ok:false},{status:401});
  if(!ready())return Response.json({ok:false,reason:'not configured'},{status:501});
  const {refresh_token}=await req.json().catch(()=>({}));
  if(!refresh_token||typeof refresh_token!=='string')return Response.json({ok:false},{status:400});
  const {error}=await admin().from('google_tokens').upsert({user_id:u.id,enc:enc(refresh_token),updated_at:new Date().toISOString()});
  return Response.json({ok:!error});
}
