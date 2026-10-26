import { authed, putUrl, MAX_BYTES } from '../../../../lib/r2';
export const dynamic='force-dynamic';
export async function POST(req){
  const {chatId,size}=await req.json().catch(()=>({}));
  const a=await authed(req,chatId);
  if(!a)return Response.json({error:'Not allowed'},{status:403});
  if(!Number.isInteger(size)||size<1||size>MAX_BYTES)return Response.json({error:'File is too large (max 100 MB)'},{status:413});
  const {count}=await a.sb.from('messages').select('id',{count:'exact',head:true}).eq('sender_id',a.uid).not('file_path','is',null).gte('created_at',new Date(Date.now()-864e5).toISOString());
  if((count||0)>=30)return Response.json({error:'Daily file limit reached'},{status:429});
  const key=`${chatId}/${crypto.randomUUID()}`;
  return Response.json({key,url:await putUrl(key,size)});
}
