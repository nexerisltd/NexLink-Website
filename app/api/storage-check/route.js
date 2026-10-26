import { diagnose } from '../../../lib/r2';
export const dynamic='force-dynamic';
// Open /api/storage-check?secret=YOUR_CRON_SECRET to test the storage keys from the server.
export async function GET(req){
  const s=new URL(req.url).searchParams.get('secret');
  if(!process.env.CRON_SECRET||s!==process.env.CRON_SECRET)return Response.json({error:'forbidden'},{status:403});
  return Response.json(await diagnose());
}
