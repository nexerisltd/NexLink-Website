// Sets CORS on a Backblaze B2 bucket so browsers can upload (PUT) and download through presigned S3 links.
// Needs the MASTER application key: bucket-level keys cannot change bucket settings.
// PowerShell:
//   $env:B2_KEY_ID="<master keyID / account ID>"; $env:B2_KEY="<master application key>"
//   $env:B2_BUCKET="<bucket name>"; $env:ORIGIN="https://nexlinkchat.vercel.app"
//   node scripts/b2-cors.mjs
const {B2_KEY_ID,B2_KEY,B2_BUCKET,ORIGIN}=process.env;
const j=async r=>{const t=await r.json();if(!r.ok)throw new Error(t.message||t.code||String(r.status));return t};
const auth=await j(await fetch('https://api.backblazeb2.com/b2api/v3/b2_authorize_account',{headers:{Authorization:'Basic '+Buffer.from(`${B2_KEY_ID}:${B2_KEY}`).toString('base64')}}));
const api=auth.apiInfo?.storageApi?.apiUrl||auth.apiUrl;
const post=(p,b)=>fetch(`${api}/b2api/v3/${p}`,{method:'POST',headers:{Authorization:auth.authorizationToken,'Content-Type':'application/json'},body:JSON.stringify(b)}).then(j);
const {buckets}=await post('b2_list_buckets',{accountId:auth.accountId,bucketName:B2_BUCKET});
if(!buckets?.length)throw new Error('Bucket not found: '+B2_BUCKET);
await post('b2_update_bucket',{accountId:auth.accountId,bucketId:buckets[0].bucketId,corsRules:[{corsRuleName:'nexlink',allowedOrigins:ORIGIN.split(','),allowedHeaders:['*'],allowedOperations:['s3_put','s3_get','s3_head','s3_delete'],exposeHeaders:['etag'],maxAgeSeconds:3600}]});
console.log('CORS updated for',buckets[0].bucketName,'->',ORIGIN);
