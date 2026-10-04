import {portfolioStore} from '@/lib/database';
import {ConflictError} from '@/lib/portfolio-store';
import {allowedOrigin} from '@/lib/security';
import {authenticated} from '@/lib/auth';
export const runtime='nodejs';
import { applyOperation,initialState,type PortfolioState } from '@/lib/finance';
export const dynamic='force-dynamic';
async function read(){return portfolioStore.read();}
async function denied(request:Request){try{return await authenticated(request)?null:Response.json({error:'Sua sessão expirou. Entre novamente para continuar.'},{status:401,headers:{'Cache-Control':'no-store'}});}catch{return Response.json({error:'Não foi possível verificar o acesso.'},{status:503});}}
const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
export async function GET(request:Request){const rejection=await denied(request);if(rejection)return rejection;try{return reply(await read());}catch(e){console.error('Portfolio read failed',e);return reply({error:'Não foi possível acessar o banco de dados. Tente novamente.'},503);}}
export async function POST(request:Request){const rejection=await denied(request);if(rejection)return rejection;try{const origin=request.headers.get('origin');if(!allowedOrigin(origin,request.url,process.env))return reply({error:'Origem não permitida.'},403);const text=await request.text();if(text.length>1000000)return reply({error:'Solicitação muito grande.'},413);let body;try{body=JSON.parse(text);}catch{return reply({error:'Solicitação inválida.'},400);}const current=await read();if(!body||typeof body!=='object'||Array.isArray(body))return reply({error:'Solicitação inválida.'},400);if(body.revision!==current.revision)return reply({error:'Os dados mudaram em outra aba. Copie os campos digitados e recarregue antes de salvar.'},409);let next;try{next=applyOperation(current.state,body.operation);}catch(e){return reply({error:e instanceof Error?e.message:'Dados inválidos.'},400);}try{await portfolioStore.write(next,current.revision);}catch(e){if(e instanceof ConflictError)return reply({error:'Outra alteração foi salva ao mesmo tempo. Recarregue antes de continuar.'},409);throw e;}return reply({state:next,revision:current.revision+1});}catch(e){console.error('Portfolio save failed',e);return reply({error:'Não foi possível salvar. Seus campos continuam preenchidos. Tente novamente.'},503);}}

