import {query} from './database';
import {configured,credentialVersion,sessionHash,createSessionToken,IDLE_SECONDS,ABSOLUTE_SECONDS,requestToken} from './security';
let schema:Promise<void>|undefined;
export function authSchema(){return schema??= (async()=>{
 await query(`CREATE TABLE IF NOT EXISTS auth_sessions (token_hash TEXT PRIMARY KEY, credential_version TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), expires_at TIMESTAMPTZ NOT NULL)`);
 await query(`CREATE TABLE IF NOT EXISTS auth_limits (bucket TEXT PRIMARY KEY, attempts INTEGER NOT NULL, reset_at TIMESTAMPTZ NOT NULL)`);
})().catch(error=>{schema=undefined;throw error;});}
export async function validSession(token:string|null){
 if(!configured(process.env)||!token||!/^[a-f0-9]{64}$/.test(token))return false;
 await authSchema();
 const result=await query(`UPDATE auth_sessions SET last_seen_at=NOW() WHERE token_hash=$1 AND credential_version=$2 AND expires_at>NOW() AND last_seen_at>NOW()-($3 * INTERVAL '1 second') RETURNING token_hash`,[sessionHash(token),credentialVersion(process.env),IDLE_SECONDS]);return result.rowCount===1;
}
export async function authenticated(request:Request){return validSession(requestToken(request));}
export async function newSession(oldToken:string|null){
 await authSchema();await revokeSession(oldToken);
 await query('DELETE FROM auth_sessions WHERE expires_at<=NOW() OR credential_version<>$1',[credentialVersion(process.env)]);
 const token=createSessionToken();await query(`INSERT INTO auth_sessions(token_hash,credential_version,expires_at) VALUES($1,$2,NOW()+($3 * INTERVAL '1 second'))`,[sessionHash(token),credentialVersion(process.env),ABSOLUTE_SECONDS]);return token;
}
export async function revokeSession(token:string|null){if(!token)return;await authSchema();await query('DELETE FROM auth_sessions WHERE token_hash=$1',[sessionHash(token)]);}
// Shared limits reserve before hashing to bound CPU work, including attempts with unknown usernames.
export async function reserveLogin(request:Request){
 await authSchema();await query('DELETE FROM auth_limits WHERE reset_at<NOW()');
 const ip=request.headers.get('x-forwarded-for')?.split(',').at(-1)?.trim()||'unknown';
 for(const [bucket,limit] of [['ip:'+sessionHash(ip),10],['global',60]] as const){
  const result=await query(`INSERT INTO auth_limits(bucket,attempts,reset_at) VALUES($1,1,NOW()+INTERVAL '15 minutes') ON CONFLICT(bucket) DO UPDATE SET attempts=CASE WHEN auth_limits.reset_at<=NOW() THEN 1 ELSE auth_limits.attempts+1 END,reset_at=CASE WHEN auth_limits.reset_at<=NOW() THEN NOW()+INTERVAL '15 minutes' ELSE auth_limits.reset_at END RETURNING attempts,GREATEST(1,CEIL(EXTRACT(EPOCH FROM (reset_at-NOW())))) AS retry`,[bucket]);
  if(result.rows[0].attempts>limit)return Number(result.rows[0].retry);
 }return 0;
}
