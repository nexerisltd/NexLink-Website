// Server-only helpers: Cloudflare R2 (S3 API) with short-lived presigned URLs.
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectsCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createClient } from '@supabase/supabase-js';
// S3-compatible storage: Backblaze B2 (S3_* vars) or Cloudflare R2 (R2_* vars)
const ep=(process.env.S3_ENDPOINT||'').trim();
const CFG={endpoint:ep?(ep.startsWith('http')?ep:'https://'+ep):(process.env.R2_ACCOUNT_ID?`https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`:''),
  region:process.env.S3_REGION||'auto',bucket:process.env.S3_BUCKET||process.env.R2_BUCKET,
  key:process.env.S3_ACCESS_KEY_ID||process.env.R2_ACCESS_KEY_ID,secret:process.env.S3_SECRET_ACCESS_KEY||process.env.R2_SECRET_ACCESS_KEY};
CFG.endpoint=CFG.endpoint?new URL(CFG.endpoint).origin:''; // host only, any pasted path is dropped
CFG.bucket=(CFG.bucket||'').trim();
const bucket=()=>CFG.bucket;
const r2=()=>new S3Client({region:CFG.region,endpoint:CFG.endpoint,credentials:{accessKeyId:CFG.key,secretAccessKey:CFG.secret},requestChecksumCalculation:'WHEN_REQUIRED',responseChecksumValidation:'WHEN_REQUIRED'});
// Storage provider: Cloudflare R2 when R2_ACCOUNT_ID is set, otherwise Supabase Storage (no card needed).
export const useR2=!!CFG.endpoint; // true for any S3-compatible provider (B2 or R2)
export const maxBytes=()=>(useR2?100:20)*1024*1024+64; // file + AES-GCM tag
export const supaAdmin=()=>createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
export async function signedGet(key){const {data,error}=await supaAdmin().storage.from('files').createSignedUrl(key,300);if(error)throw error;return data.signedUrl}
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
  if(!useR2){await supaAdmin().storage.from('files').remove(keys);return}
  for(let i=0;i<keys.length;i+=1000)await r2().send(new DeleteObjectsCommand({Bucket:bucket(),Delete:{Objects:keys.slice(i,i+1000).map(Key=>({Key})),Quiet:true}}));
}
