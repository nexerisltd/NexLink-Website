import { authed, getUrl, signedGet, validKey, useR2 } from '../../../../lib/r2';
export const dynamic='force-dynamic';
export async function POST(req){
  const {key}=await req.json().catch(()=>({}));
  if(!validKey(key))return Response.json({error:'Bad request'},{status:400});
  const a=await authed(req,key.split('/')[0]);
  if(!a)return Response.json({error:'Not allowed'},{status:403});
  return Response.json({url:useR2?await getUrl(key):await signedGet(key)});
}
