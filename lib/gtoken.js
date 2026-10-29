// Server-only: stores each user's Google refresh token (AES-256-GCM encrypted) and exchanges it for short-lived Drive tokens.
import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
const key=()=>Buffer.from(process.env.TOKEN_ENC_KEY||'','base64');
export const ready=()=>key().length===32&&!!process.env.GOOGLE_CLIENT_SECRET;
export const enc=t=>{const iv=crypto.randomBytes(12),c=crypto.createCipheriv('aes-256-gcm',key(),iv),b=Buffer.concat([c.update(t,'utf8'),c.final()]);return Buffer.concat([iv,c.getAuthTag(),b]).toString('base64')};
export const dec=s=>{const b=Buffer.from(s,'base64'),d=crypto.createDecipheriv('aes-256-gcm',key(),b.subarray(0,12));d.setAuthTag(b.subarray(12,28));return Buffer.concat([d.update(b.subarray(28)),d.final()]).toString('utf8')};
export async function userOf(req){
  const token=(req.headers.get('authorization')||'').replace(/^Bearer /,'');if(!token)return null;
  const sb=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false}});
  const {data}=await sb.auth.getUser(token);return data?.user||null;
}
export const admin=()=>createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
