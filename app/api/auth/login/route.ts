import {configured,allowedOrigin,verifyCredentials,requestToken,sessionCookie} from '@/lib/security';
import {reserveLogin,newSession} from '@/lib/auth';
import {readLimitedBody,BodyTooLarge} from '@/lib/request-body';
export const runtime='nodejs',dynamic='force-dynamic';
const reply=(error:string,status:number,headers:Record<string,string>={})=>Response.json({error},{status,headers:{'Cache-Control':'no-store',...headers}});
export async function POST(request:Request){
 if(!allowedOrigin(request.headers.get('origin'),request.url,process.env))return reply('Origem não permitida.',403);
 if(!request.headers.get('content-type')?.startsWith('application/json'))return reply('Solicitação inválida.',415);
 if(!configured(process.env))return reply('O acesso precisa ser configurado no servidor.',503);
 try{
  const retry=await reserveLogin(request);if(retry)return reply('Muitas tentativas. Aguarde antes de tentar novamente.',429,{'Retry-After':String(retry)});
  const text=await readLimitedBody(request,4096);
  let body;try{body=JSON.parse(text);}catch{return reply('Solicitação inválida.',400);}
  if(!body||typeof body.username!=='string'||typeof body.password!=='string'||body.username.length>100||body.password.length>1024)return reply('Usuário ou senha incorretos.',401);
  if(!await verifyCredentials(body.username,body.password,process.env))return reply('Usuário ou senha incorretos.',401);
  const token=await newSession(requestToken(request));return Response.json({ok:true},{headers:{'Cache-Control':'no-store','Set-Cookie':sessionCookie(token)}});
 }catch(error){return error instanceof BodyTooLarge?reply('Solicitação muito grande.',413):reply('Não foi possível entrar agora. Tente novamente.',503);}
}
