import {allowedOrigin,sessionCookie} from '@/lib/security';
import {authenticated,reserveLogin,changeAccount,AccountChangeError} from '@/lib/auth';
import {validateAccountChange} from '@/lib/user-security';
import {readLimitedBody,BodyTooLarge} from '@/lib/request-body';
export const runtime='nodejs',dynamic='force-dynamic';
const reply=(error:string,status:number,headers:Record<string,string>={})=>Response.json({error},{status,headers:{'Cache-Control':'no-store',...headers}});
export async function POST(request:Request){
 if(!allowedOrigin(request.headers.get('origin'),request.url,process.env))return reply('Origem não permitida.',403);
 if(!request.headers.get('content-type')?.startsWith('application/json'))return reply('Solicitação inválida.',415);
 try{
  const user=await authenticated(request);if(!user)return reply('Sua sessão expirou. Entre novamente.',401);
  if(request.headers.get('x-account-id')!==user.id)return reply('A conta conectada mudou. Entre novamente na conta original.',409);
  const retry=await reserveLogin(request,'account');if(retry)return reply('Muitas tentativas. Aguarde antes de tentar novamente.',429,{'Retry-After':String(retry)});
  const text=await readLimitedBody(request,4096);let body;try{body=JSON.parse(text);}catch{return reply('Solicitação inválida.',400);}
  let input;try{input=validateAccountChange(body);}catch(error){return reply(error instanceof Error?error.message:'Dados inválidos.',400);}
  const updated=await changeAccount(user.id,input);return Response.json({ok:true,user:updated.user},{headers:{'Cache-Control':'no-store','Set-Cookie':sessionCookie(updated.token)}});
 }catch(error){if(error instanceof AccountChangeError)return reply(error.message,error.status);if(error instanceof BodyTooLarge)return reply('Solicitação muito grande.',413);return reply('Não foi possível confirmar a alteração. Tente entrar com os dados escolhidos antes de tentar novamente.',503);}
}
