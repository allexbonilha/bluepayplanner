import {allowedOrigin,requestToken,sessionCookie} from '@/lib/security';
import {revokeSession} from '@/lib/auth';
export const runtime='nodejs',dynamic='force-dynamic';
export async function POST(request:Request){
 if(!allowedOrigin(request.headers.get('origin'),request.url,process.env))return Response.json({error:'Origem não permitida.'},{status:403});
 try{await revokeSession(requestToken(request));return Response.json({ok:true},{headers:{'Cache-Control':'no-store','Set-Cookie':sessionCookie('',0)}});}catch{return Response.json({error:'Não foi possível sair. Tente novamente.'},{status:503});}
}
