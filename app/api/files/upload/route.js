import { authed, putUrl, maxBytes, useR2, supaAdmin } from '../../../../lib/r2';
export const dynamic='force-dynamic';
export async function POST(req){
  const {chatId,size}=await req.json().catch(()=>({}));
  const a=await authed(req,chatId);
  if(!a)return Response.json({error:'Not allowed'},{status:403});
  if(!Number.isInteger(size)||size<1||size>maxBytes())return Response.json({error:`File is too large (max ${useR2?100:20} MB)`},{status:413});
  const {count}=await a.sb.from('messages').select('id',{count:'exact',head:true}).eq('sender_id',a.uid).not('file_path','is',null).gte('created_at',new Date(Date.now()-864e5).toISOString());
  if((count||0)>=30)return Response.json({error:'Daily file limit reached'},{status:429});
  const key=`${chatId}/${crypto.randomUUID()}`;
  if(useR2)return Response.json({key,url:await putUrl(key,size)});
  const {data,error}=await supaAdmin().storage.from('files').createSignedUploadUrl(key);
  if(error)return Response.json({error:'Storage error'},{status:500});
  return Response.json({key,token:data.token});
}
