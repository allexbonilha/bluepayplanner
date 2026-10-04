import {randomBytes,scrypt,timingSafeEqual} from 'node:crypto';
const PARAMS={N:32768,r:8,p:3,maxmem:64*1024*1024};
const PREFIX='scrypt-v1$32768$8$3';
const DUMMY_HASH=PREFIX+'$'+'0'.repeat(32)+'$'+'0'.repeat(128);
function derive(password:string,salt:string):Promise<Buffer>{return new Promise((resolve,reject)=>scrypt(password,salt,64,PARAMS,(error,key)=>error?reject(error):resolve(key)));}
export async function hashPassword(password:string){const salt=randomBytes(16).toString('hex');return `${PREFIX}$${salt}$${(await derive(password,salt)).toString('hex')}`;}
export async function verifyPassword(password:string,stored:string|null){
 const valid=!!stored&&/^scrypt-v1\$32768\$8\$3\$[a-f0-9]{32}\$[a-f0-9]{128}$/.test(stored);
 const parts=(valid?stored!:DUMMY_HASH).split('$');const actual=await derive(password,parts[4]);
 return timingSafeEqual(actual,Buffer.from(parts[5],'hex'))&&valid;
}
export function normalizeUsername(value:string){return value.trim().toLowerCase();}
export function validateRegistration(body:unknown){
 if(!body||typeof body!=='object'||Array.isArray(body))throw new Error('Preencha os dados do cadastro.');
 const input=body as Record<string,unknown>;
 if(typeof input.name!=='string'||input.name.trim().length<2||input.name.trim().length>80||/[\x00-\x1f]/.test(input.name))throw new Error('Informe um nome entre 2 e 80 caracteres.');
 if(typeof input.username!=='string'||! /^[a-z0-9][a-z0-9._-]{2,31}$/.test(normalizeUsername(input.username)))throw new Error('Use de 3 a 32 caracteres no usuário: letras, números, ponto, traço ou sublinhado.');
 if(typeof input.password!=='string'||input.password.length<16||input.password.length>128)throw new Error('A senha precisa ter de 16 a 128 caracteres.');
 if(input.password!==input.confirmation)throw new Error('A confirmação da senha não confere.');
 return {name:input.name.trim(),username:normalizeUsername(input.username),password:input.password};
}
