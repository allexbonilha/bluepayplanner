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
function validateIdentity(body:unknown){
 if(!body||typeof body!=='object'||Array.isArray(body))throw new Error('Preencha os dados do cadastro.');
 const input=body as Record<string,unknown>;
 if(typeof input.name!=='string'||input.name.trim().length<2||input.name.trim().length>80||/[\x00-\x1f]/.test(input.name))throw new Error('Informe um nome entre 2 e 80 caracteres.');
 if(typeof input.username!=='string'||! /^[a-z0-9][a-z0-9._-]{2,31}$/.test(normalizeUsername(input.username)))throw new Error('Use de 3 a 32 caracteres no usuário: letras, números, ponto, traço ou sublinhado.');
 return {name:input.name.trim(),username:normalizeUsername(input.username)};
}
function validateNewPassword(password:unknown,confirmation:unknown){if(typeof password!=='string'||password.length<16||password.length>128)throw new Error('A senha precisa ter de 16 a 128 caracteres.');if(password!==confirmation)throw new Error('A confirmação da senha não confere.');return password;}
export function validateRegistration(body:unknown){const identity=validateIdentity(body);const input=body as Record<string,unknown>;return {...identity,password:validateNewPassword(input.password,input.confirmation)};
}
export function validateAccountChange(body:unknown){
 if(!body||typeof body!=='object'||Array.isArray(body))throw new Error('Preencha os dados da sua conta.');
 const input=body as Record<string,unknown>;
 const newPassword=input.newPassword??'';
 if(typeof newPassword!=='string')throw new Error('Nova senha inválida.');
 if(typeof input.currentPassword!=='string'||!input.currentPassword||input.currentPassword.length>1024)throw new Error('Informe sua senha atual para confirmar a alteração.');
 if(!newPassword&&input.confirmation)throw new Error('Informe a nova senha antes de confirmá-la.');
 const identity=validateIdentity(input);if(newPassword)validateNewPassword(newPassword,input.confirmation);
 return {...identity,currentPassword:input.currentPassword,newPassword};
}
