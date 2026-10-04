import {createHash,randomBytes} from 'node:crypto';
type Env=Record<string,string|undefined>;
export const IDLE_SECONDS=30*60,ABSOLUTE_SECONDS=8*60*60;
export function legacyCredentialsConfigured(env:Env){return !!env.APP_USERNAME&&!!env.APP_PASSWORD&&env.APP_PASSWORD.length>=16;}
export function sessionHash(value:string){return createHash('sha256').update(value).digest('hex');}
export function createSessionToken(){return randomBytes(32).toString('hex');}
export function cookieName(env:Env=process.env){return env.NODE_ENV==='production'?'__Host-planner_session':'planner_session';}
export function requestToken(request:Request){const entry=request.headers.get('cookie')?.split(';').map(v=>v.trim()).find(v=>v.startsWith(cookieName()+'='));const token=entry?.slice(cookieName().length+1);return token&&/^[a-f0-9]{64}$/.test(token)?token:null;}
export function sessionCookie(token:string,maxAge=ABSOLUTE_SECONDS){return `${cookieName()}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${process.env.NODE_ENV==='production'?'; Secure':''}`;}
export function allowedOrigin(origin:string|null,url:string,env:Env){if(!origin)return false;try{const expected=env.APP_ORIGIN||(env.NODE_ENV==='production'?'':new URL(url).origin);return !!expected&&origin===new URL(expected).origin;}catch{return false;}}
