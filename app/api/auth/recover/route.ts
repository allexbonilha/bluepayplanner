import {allowedOrigin} from '@/lib/security';
import {reserveLogin} from '@/lib/auth';
import {recoverAccount,RecoveryError} from '@/lib/recovery';
import {readLimitedBody,BodyTooLarge} from '@/lib/request-body';
export const runtime='nodejs',dynamic='force-dynamic';
const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
export async function POST(request:Request){
 if(!allowedOrigin(request.headers.get('origin'),request.url,process.env))return reply({error:'Origem não permitida.'},403);
 if(!request.headers.get('content-type')?.startsWith('application/json'))return reply({error:'Solicitação inválida.'},415);
 try{
  if(await reserveLogin(request,'account'))return reply({error:'Muitas tentativas. Aguarde antes de tentar novamente.'},429);
  let body;try{body=JSON.parse(await readLimitedBody(request,4096));}catch(error){if(error instanceof BodyTooLarge)throw error;return reply({error:'Solicitação inválida.'},400);}
  try{await recoverAccount(body);}catch(error){if(error instanceof RecoveryError)return reply({error:error.message},400);if((error as {code?:string}).code==='23505')return reply({error:'Esse usuário já está em uso. Escolha outro.'},409);throw error;}
  return reply({ok:true});
 }catch(error){if(error instanceof BodyTooLarge)return reply({error:'Solicitação muito grande.'},413);return reply({error:'Não foi possível redefinir o acesso. Confira os campos e tente novamente.'},400);}
}
