import {query,transaction} from './database';
import {hashPassword,validateRegistration} from './user-security';
import {sessionHash} from './security';
import {authSchema} from './auth';
export const recoverySchema=async()=>{await authSchema();await query(`CREATE TABLE IF NOT EXISTS password_recovery (token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,credential_revision INTEGER NOT NULL,expires_at TIMESTAMPTZ NOT NULL)`);};
export class RecoveryError extends Error {}
export async function recoverAccount(body:unknown){
 const input=body as Record<string,unknown>;
 if(!input||typeof input.token!=='string'||!/^[a-f0-9]{64}$/.test(input.token))throw new RecoveryError('Link inválido ou expirado. Solicite um novo link ao responsável pelo aplicativo.');
 const identity=validateRegistration({...input,name:'Recovery'});
 await recoverySchema();
 const tokenHash=sessionHash(input.token);
 const valid=(await query(`SELECT r.user_id FROM password_recovery r JOIN users u ON u.id=r.user_id WHERE r.token_hash=$1 AND r.expires_at>NOW() AND r.credential_revision=u.credential_revision`,[tokenHash])).rows[0];
 if(!valid)throw new RecoveryError('Link inválido ou expirado. Solicite um novo link ao responsável pelo aplicativo.');
 const passwordHash=await hashPassword(identity.password);
 await transaction(async client=>{
  await client.query('SELECT id FROM users WHERE id=$1 FOR UPDATE',[valid.user_id]);
  const consumed=await client.query(`DELETE FROM password_recovery WHERE token_hash=$1 AND expires_at>NOW() RETURNING user_id,credential_revision`,[tokenHash]);
  const grant=consumed.rows[0];if(!grant)throw new RecoveryError('Link inválido ou expirado. Solicite um novo link ao responsável pelo aplicativo.');
  const changed=await client.query(`UPDATE users SET username=$1,password_hash=$2,credential_revision=credential_revision+1 WHERE id=$3 AND credential_revision=$4 RETURNING id`,[identity.username,passwordHash,grant.user_id,grant.credential_revision]);
  if(changed.rowCount!==1)throw new RecoveryError('Link inválido ou expirado. Solicite um novo link ao responsável pelo aplicativo.');
  await client.query('DELETE FROM auth_sessions WHERE user_id=$1',[grant.user_id]);
  await client.query('DELETE FROM password_recovery WHERE user_id=$1',[grant.user_id]);
 });
}
