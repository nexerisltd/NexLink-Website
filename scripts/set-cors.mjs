// Fallback for Backblaze B2 if the web UI CORS option does not work.
// Run: S3_ENDPOINT=... S3_REGION=... S3_BUCKET=... S3_ACCESS_KEY_ID=... S3_SECRET_ACCESS_KEY=... ORIGIN=https://nexlinkchat.vercel.app node scripts/set-cors.mjs
import { S3Client, PutBucketCorsCommand } from '@aws-sdk/client-s3';
const e=process.env;
const c=new S3Client({region:e.S3_REGION,endpoint:'https://'+e.S3_ENDPOINT.replace(/^https?:\/\//,''),credentials:{accessKeyId:e.S3_ACCESS_KEY_ID,secretAccessKey:e.S3_SECRET_ACCESS_KEY}});
await c.send(new PutBucketCorsCommand({Bucket:e.S3_BUCKET,CORSConfiguration:{CORSRules:[{AllowedOrigins:e.ORIGIN.split(','),AllowedMethods:['GET','PUT'],AllowedHeaders:['*'],MaxAgeSeconds:3600}]}}));
console.log('CORS set for',e.ORIGIN);
