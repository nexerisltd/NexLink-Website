import webpush from 'web-push';
import { authed, supaAdmin } from '../../../lib/r2';
export const dynamic='force-dynamic';
// Sends a generic "new encrypted message" push to the other members' devices. It never contains message text.
export async function POST(req){
  const {chatId}=await req.json().catch(()=>({}));
  const a=await authed(req,chatId);
  if(!a)return Response.json({ok:false},{status:403});
  if(!process.env.VAPID_PRIVATE_KEY||!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY)return Response.json({ok:false,reason:'push not configured'});
  webpush.setVapidDetails(process.env.VAPID_SUBJECT||'mailto:admin@example.com',process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,process.env.VAPID_PRIVATE_KEY);
  const db=supaAdmin();
  const [{data:ms},{data:me},{data:chat}]=await Promise.all([
    db.from('chat_members').select('user_id').eq('chat_id',chatId),
    db.from('profiles').select('display_name').eq('id',a.uid).single(),
    db.from('chats').select('kind,title').eq('id',chatId).single()]);
  const ids=(ms||[]).map(m=>m.user_id).filter(u=>u!==a.uid);
  if(!ids.length)return Response.json({ok:true,sent:0});
  const {data:subs}=await db.from('push_subs').select('id,sub,muted').in('user_id',ids);
  const dm=chat?.kind==='dm',title=dm?(me?.display_name||'NexLink.Chat'):(chat?.title||'NexLink.Chat');
  const body=dm?'New encrypted message':`${me?.display_name||'Someone'}: new encrypted message`;
  let sent=0;
  await Promise.all((subs||[]).filter(s=>!(s.muted||[]).includes(chatId)).map(async s=>{
    try{await webpush.sendNotification(s.sub,JSON.stringify({title,body,tag:chatId}));sent++}
    catch(e){if(e.statusCode===404||e.statusCode===410)await db.from('push_subs').delete().eq('id',s.id)}
  }));
  return Response.json({ok:true,sent});
}
