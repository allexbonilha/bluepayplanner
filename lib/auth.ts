import {randomUUID} from 'node:crypto';
import {query} from './database';
import {configured,credentialVersion,sessionHash,createSessionToken,IDLE_SECONDS,ABSOLUTE_SECONDS,requestToken,verifyCredentials} from './security';
import {hashPassword,verifyPassword,normalizeUsername} from './user-security';
export type User={id:string;username:string;name:string;password_hash:string|null};
export type UserProfile=Pick<User,'id'|'username'|'name'>;
export const profile=(user:User):UserProfile=>({id:user.id,username:user.username,name:user.name});
let schema:Promise<void>|undefined;
export function authSchema(){return schema??= (async()=>{
 if(!configured(process.env))throw new Error('Owner credentials required');
 await query(`CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE, name TEXT NOT NULL, password_hash TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), CONSTRAINT member_password CHECK (id='owner' OR password_hash IS NOT NULL))`);
 await query(`INSERT INTO users(id,username,name,password_hash) VALUES('owner',$1,'Allex',NULL) ON CONFLICT(id) DO UPDATE SET username=EXCLUDED.username WHERE users.username<>EXCLUDED.username`,[normalizeUsername(process.env.APP_USERNAME!)]);
 await query(`CREATE TABLE IF NOT EXISTS auth_sessions (token_hash TEXT PRIMARY KEY, credential_version TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), expires_at TIMESTAMPTZ NOT NULL)`);
 await query(`ALTER TABLE auth_sessions ADD COLUMN IF NOT EXISTS user_id TEXT NOT NULL DEFAULT 'owner' REFERENCES users(id) ON DELETE CASCADE`);
 await query(`CREATE INDEX IF NOT EXISTS auth_sessions_user_idx ON auth_sessions(user_id)`);
 await query(`CREATE TABLE IF NOT EXISTS auth_limits (bucket TEXT PRIMARY KEY, attempts INTEGER NOT NULL, reset_at TIMESTAMPTZ NOT NULL)`);
})().catch(error=>{schema=undefined;throw error;});}
function userVersion(user:User){return user.id==='owner'?credentialVersion(process.env):sessionHash(user.password_hash!);}
export async function findUser(username:string):Promise<User|null>{await authSchema();const result=await query('SELECT id,username,name,password_hash FROM users WHERE username=$1',[normalizeUsername(username)]);return result.rows[0]||null;}
export async function loginUser(username:string,password:string):Promise<User|null>{
 const user=await findUser(username);
 const valid=user?.id==='owner'?await verifyCredentials(process.env.APP_USERNAME!,password,process.env):await verifyPassword(password,user?.password_hash||null);
 return user&&valid?user:null;
}
export async function registerUser(input:{name:string;username:string;password:string}):Promise<User>{
 await authSchema();const passwordHash=await hashPassword(input.password);
 const result=await query('INSERT INTO users(id,username,name,password_hash) VALUES($1,$2,$3,$4) RETURNING id,username,name,password_hash',[randomUUID(),input.username,input.name,passwordHash]);return result.rows[0];
}
export async function sessionUser(token:string|null):Promise<UserProfile|null>{
 if(!configured(process.env)||!token||!/^[a-f0-9]{64}$/.test(token))return null;
 await authSchema();const tokenHash=sessionHash(token);
 const result=await query(`SELECT u.id,u.username,u.name,u.password_hash,s.credential_version FROM auth_sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>NOW() AND s.last_seen_at>NOW()-($2 * INTERVAL '1 second')`,[tokenHash,IDLE_SECONDS]);
 const user=result.rows[0] as (User&{credential_version:string})|undefined;if(!user)return null;
 const version=userVersion(user);if(version!==user.credential_version)return null;
 const touched=await query(`UPDATE auth_sessions SET last_seen_at=NOW() WHERE token_hash=$1 AND user_id=$2 AND credential_version=$3 AND expires_at>NOW() AND last_seen_at>NOW()-($4 * INTERVAL '1 second') RETURNING token_hash`,[tokenHash,user.id,version,IDLE_SECONDS]);
 return touched.rowCount===1?profile(user):null;
}
export async function validSession(token:string|null){return !!await sessionUser(token);}
export async function authenticated(request:Request){return sessionUser(requestToken(request));}
export async function newSession(user:User,oldToken:string|null){
 await authSchema();await revokeSession(oldToken);await query('DELETE FROM auth_sessions WHERE expires_at<=NOW()');
 const token=createSessionToken();await query(`INSERT INTO auth_sessions(token_hash,credential_version,user_id,expires_at) VALUES($1,$2,$3,NOW()+($4 * INTERVAL '1 second'))`,[sessionHash(token),userVersion(user),user.id,ABSOLUTE_SECONDS]);return token;
}
export async function revokeSession(token:string|null){if(!token)return;await authSchema();await query('DELETE FROM auth_sessions WHERE token_hash=$1',[sessionHash(token)]);}
export async function reserveLogin(request:Request,kind:'login'|'register'='login'){
 await authSchema();await query('DELETE FROM auth_limits WHERE reset_at<NOW()');
 const ip=request.headers.get('x-forwarded-for')?.split(',').at(-1)?.trim()||'unknown';
 for(const [bucket,limit] of [[kind+':ip:'+sessionHash(ip),kind==='register'?5:10],[kind+':global',kind==='register'?30:60]] as const){
  const result=await query(`INSERT INTO auth_limits(bucket,attempts,reset_at) VALUES($1,1,NOW()+INTERVAL '15 minutes') ON CONFLICT(bucket) DO UPDATE SET attempts=CASE WHEN auth_limits.reset_at<=NOW() THEN 1 ELSE auth_limits.attempts+1 END,reset_at=CASE WHEN auth_limits.reset_at<=NOW() THEN NOW()+INTERVAL '15 minutes' ELSE auth_limits.reset_at END RETURNING attempts,GREATEST(1,CEIL(EXTRACT(EPOCH FROM (reset_at-NOW())))) AS retry`,[bucket]);if(result.rows[0].attempts>limit)return Number(result.rows[0].retry);
 }return 0;
}
