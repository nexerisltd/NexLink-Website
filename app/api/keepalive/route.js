export const dynamic='force-dynamic';
export async function GET(){
  const r=await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/profiles?select=id&limit=1`,{headers:{apikey:process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY},cache:'no-store'});
  return Response.json({ok:r.ok});
}
