import {createHash,timingSafeEqual} from 'node:crypto';
export function checkAccess(header:string|null,env:{[key:string]:string|undefined}):'authorized'|'unauthorized'|'unconfigured'{
 const {APP_USERNAME:user,APP_PASSWORD:password}=env;if(!user||user.includes(':')||!password||password.length<16)return 'unconfigured';
 if(!header?.startsWith('Basic '))return 'unauthorized';const encoded=header.slice(6);if(!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded))return 'unauthorized';
 const value=Buffer.from(encoded,'base64').toString('utf8');const digest=(v:string)=>createHash('sha256').update(v).digest();return timingSafeEqual(digest(value),digest(user+':'+password))?'authorized':'unauthorized';
}

export function allowedOrigin(origin:string|null,url:string,env:{[key:string]:string|undefined}){if(!origin)return true;try{const expected=env.APP_ORIGIN||(env.NODE_ENV==='production'?'':new URL(url).origin);if(!expected)return false;return origin===new URL(expected).origin;}catch{return false;}}
