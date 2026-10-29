import App from '../../../components/App';
const U=process.env.NEXT_PUBLIC_SUPABASE_URL,K=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
// Link preview (WhatsApp, Telegram, etc.): "Chat with NAME on NexLink.Chat"
export async function generateMetadata({params}){
  const {username}=await params;
  try{
    const r=await fetch(`${U}/rest/v1/rpc/get_public_profile`,{method:'POST',headers:{apikey:K,Authorization:`Bearer ${K}`,'Content-Type':'application/json'},body:JSON.stringify({uname:username}),cache:'no-store'});
    const p=(await r.json())?.[0];
    if(p){const t=`Chat with ${p.display_name} on NexLink.Chat`;return{title:t,description:'Private, end-to-end encrypted chat.',openGraph:{title:t,description:'Private, end-to-end encrypted chat.',images:['/icon-512.png']}}}
  }catch{}
  return{title:'NexLink.Chat'};
}
export default async function Page({params}){const {username}=await params;return <App startUser={String(username).toLowerCase()}/>}
