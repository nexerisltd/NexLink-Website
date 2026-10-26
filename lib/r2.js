// Server-only helpers: Cloudflare R2 (S3 API) with short-lived presigned URLs.
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectsCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createClient } from '@supabase/supabase-js';
const bucket=()=>process.env.R2_BUCKET;
const r2=()=>new S3Client({region:'auto',endpoint:`https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials:{accessKeyId:process.env.R2_ACCESS_KEY_ID,secretAccessKey:process.env.R2_SECRET_ACCESS_KEY},
  requestChecksumCalculation:'WHEN_REQUIRED',responseChecksumValidation:'WHEN_REQUIRED'});
export const MAX_BYTES=100*1024*1024+64; // 100 MB file + AES-GCM tag
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const validKey=k=>/^[0-9a-f-]{36}\/[0-9a-f-]{36}$/i.test(k||'')&&UUID.test(k.split('/')[0]);
// verifies the caller's Supabase login and that they are an active member of the chat
export async function authed(req,chatId){
  const token=(req.headers.get('authorization')||'').replace(/^Bearer /,'');
  if(!token||!UUID.test(chatId||''))return null;
  const sb=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{global:{headers:{Authorization:`Bearer ${token}`}},auth:{persistSession:false}});
  const {data:u}=await sb.auth.getUser(token);if(!u?.user)return null;
  const {data:ok}=await sb.rpc('is_member',{c:chatId});
  return ok?{sb,uid:u.user.id}:null;
}
export const putUrl=(Key,len)=>getSignedUrl(r2(),new PutObjectCommand({Bucket:bucket(),Key,ContentLength:len}),{expiresIn:300});
export const getUrl=Key=>getSignedUrl(r2(),new GetObjectCommand({Bucket:bucket(),Key}),{expiresIn:300});
export async function removeKeys(keys){
  for(let i=0;i<keys.length;i+=1000)await r2().send(new DeleteObjectsCommand({Bucket:bucket(),Delete:{Objects:keys.slice(i,i+1000).map(Key=>({Key})),Quiet:true}}));
}
