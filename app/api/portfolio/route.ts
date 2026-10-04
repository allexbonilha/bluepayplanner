import {portfolioStore} from '@/lib/database';
import {ConflictError} from '@/lib/portfolio-store';
import {allowedOrigin} from '@/lib/security';
import {authenticated} from '@/lib/auth';
import {readLimitedBody,BodyTooLarge} from '@/lib/request-body';
import {applyOperation} from '@/lib/finance';
export const runtime='nodejs',dynamic='force-dynamic';
const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
const unauthorized=()=>reply({error:'Sua sessão expirou. Entre novamente para continuar.'},401);
const accountChanged=()=>reply({error:'A conta conectada mudou em outra aba. Entre novamente na conta original antes de salvar estes campos.'},409);
export async function GET(request:Request){
 try{const user=await authenticated(request);if(!user)return unauthorized();const expected=request.headers.get('x-account-id');if(expected&&expected!==user.id)return accountChanged();return reply({...await portfolioStore.read(user.id),user});}
 catch{return reply({error:'Não foi possível acessar os registros. Tente novamente.'},503);}
}
export async function POST(request:Request){
 if(!allowedOrigin(request.headers.get('origin'),request.url,process.env))return reply({error:'Origem não permitida.'},403);
 if(!request.headers.get('content-type')?.startsWith('application/json'))return reply({error:'Solicitação inválida.'},415);
 try{
  const user=await authenticated(request);if(!user)return unauthorized();
  if(request.headers.get('x-account-id')!==user.id)return accountChanged();
  const text=await readLimitedBody(request,1000000);let body;try{body=JSON.parse(text);}catch{return reply({error:'Solicitação inválida.'},400);}
  if(!body||typeof body!=='object'||Array.isArray(body))return reply({error:'Solicitação inválida.'},400);
  const current=await portfolioStore.read(user.id);
  if(body.revision!==current.revision)return reply({error:'Os dados mudaram em outra aba. Copie os campos digitados e recarregue antes de salvar.'},409);
  let next;try{next=applyOperation(current.state,body.operation);}catch(error){return reply({error:error instanceof Error?error.message:'Dados inválidos.'},400);}
  await portfolioStore.write(next,current.revision,user.id);return reply({state:next,revision:current.revision+1,user});
 }catch(error){
  if(error instanceof BodyTooLarge)return reply({error:'Solicitação muito grande.'},413);
  if(error instanceof ConflictError)return reply({error:'Outra alteração foi salva ao mesmo tempo. Recarregue antes de continuar.'},409);
  return reply({error:'Não foi possível salvar. Seus campos continuam preenchidos. Tente novamente.'},503);
 }
}
