import {allowedOrigin,requestToken,sessionCookie} from '@/lib/security';
import {reserveLogin,registerUser,newSession} from '@/lib/auth';
import {validateRegistration} from '@/lib/user-security';
import {readLimitedBody,BodyTooLarge} from '@/lib/request-body';
export const runtime='nodejs',dynamic='force-dynamic';
const reply=(error:string,status:number,headers:Record<string,string>={})=>Response.json({error},{status,headers:{'Cache-Control':'no-store',...headers}});
export async function POST(request:Request){
 if(!allowedOrigin(request.headers.get('origin'),request.url,process.env))return reply('Origem não permitida.',403);
 if(!request.headers.get('content-type')?.startsWith('application/json'))return reply('Solicitação inválida.',415);
 try{
  const retry=await reserveLogin(request,'register');if(retry)return reply('Muitas tentativas de cadastro. Aguarde e tente novamente.',429,{'Retry-After':String(retry)});
  const text=await readLimitedBody(request,4096);let body;try{body=JSON.parse(text);}catch{return reply('Solicitação inválida.',400);}
  let input;try{input=validateRegistration(body);}catch(error){return reply(error instanceof Error?error.message:'Dados inválidos.',400);}
  let user;try{user=await registerUser(input);}catch(error){if((error as {code?:string}).code==='23505')return reply('Esse usuário não está disponível. Escolha outro ou entre na sua conta.',409);throw error;}
  const token=await newSession(user,requestToken(request));return Response.json({ok:true},{status:201,headers:{'Cache-Control':'no-store','Set-Cookie':sessionCookie(token)}});
 }catch(error){return error instanceof BodyTooLarge?reply('Solicitação muito grande.',413):reply('Não foi possível concluir. Se já criou sua conta, tente entrar.',503);}
}
