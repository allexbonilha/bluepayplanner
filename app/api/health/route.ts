import {databaseReady} from '@/lib/database';
export const runtime='nodejs';
export async function GET(){try{await databaseReady();return Response.json({status:'ok'},{headers:{'Cache-Control':'no-store'}});}catch{return Response.json({status:'unavailable'},{status:503,headers:{'Cache-Control':'no-store'}});}}
