import {createHash,randomBytes,scrypt,scryptSync,timingSafeEqual} from 'node:crypto';
type Env=Record<string,string|undefined>;
export const IDLE_SECONDS=30*60,ABSOLUTE_SECONDS=8*60*60;
export function configured(env:Env){return !!env.APP_USERNAME&&!!env.APP_PASSWORD&&env.APP_PASSWORD.length>=16;}
export function sessionHash(value:string){return createHash('sha256').update(value).digest('hex');}
export function createSessionToken(){return randomBytes(32).toString('hex');}
let versionCache:{key:string;value:string}|undefined;
export function credentialVersion(env:Env){const key=sessionHash(JSON.stringify([env.APP_USERNAME,env.APP_PASSWORD]));if(versionCache?.key!==key)versionCache={key,value:scryptSync(env.APP_PASSWORD||'unconfigured','bluepayplanner-version:'+env.APP_USERNAME,32,{N:32768,r:8,p:1,maxmem:64*1024*1024}).toString('hex')};return versionCache.value;}
function derive(value:string,salt:string):Promise<Buffer>{return new Promise((resolve,reject)=>scrypt(value,salt,64,{N:16384,r:8,p:1},(error,key)=>error?reject(error):resolve(key)));}
let cached:{version:string;key:Promise<Buffer>}|undefined;
export async function verifyCredentials(user:string,password:string,env:Env){
 if(!configured(env))return false;
 const version=credentialVersion(env),salt='bluepayplanner-owner:'+env.APP_USERNAME;
 if(cached?.version!==version)cached={version,key:derive(env.APP_PASSWORD!,salt)};
 const [expected,actual]=await Promise.all([cached.key,derive(password,salt)]);
 return timingSafeEqual(expected,actual)&&timingSafeEqual(Buffer.from(sessionHash(user)),Buffer.from(sessionHash(env.APP_USERNAME!)));
}
export function cookieName(env:Env=process.env){return env.NODE_ENV==='production'?'__Host-planner_session':'planner_session';}
export function requestToken(request:Request){const entry=request.headers.get('cookie')?.split(';').map(v=>v.trim()).find(v=>v.startsWith(cookieName()+'='));const token=entry?.slice(cookieName().length+1);return token&&/^[a-f0-9]{64}$/.test(token)?token:null;}
export function sessionCookie(token:string,maxAge=ABSOLUTE_SECONDS){return `${cookieName()}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${process.env.NODE_ENV==='production'?'; Secure':''}`;}
export function allowedOrigin(origin:string|null,url:string,env:Env){if(!origin)return false;try{const expected=env.APP_ORIGIN||(env.NODE_ENV==='production'?'':new URL(url).origin);return !!expected&&origin===new URL(expected).origin;}catch{return false;}}
