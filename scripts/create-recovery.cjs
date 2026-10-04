// Run only in the administrator-controlled app container. Never expose this command as a public endpoint.
const {Pool}=require('pg'),crypto=require('node:crypto');
(async()=>{const pool=new Pool({connectionString:process.env.DATABASE_URL});const client=await pool.connect();try{
 await client.query('BEGIN');
 await client.query(`CREATE TABLE IF NOT EXISTS password_recovery (token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,credential_revision INTEGER NOT NULL,expires_at TIMESTAMPTZ NOT NULL)`);
 const userId=process.argv[2]||'owner';
 const user=(await client.query('SELECT id,credential_revision FROM users WHERE id=$1 FOR UPDATE',[userId])).rows[0];if(!user)throw new Error('Account not found');
 const token=crypto.randomBytes(32).toString('hex');
 await client.query('DELETE FROM password_recovery WHERE user_id=$1',[userId]);
 await client.query(`INSERT INTO password_recovery(token_hash,user_id,credential_revision,expires_at) VALUES($1,$2,$3,NOW()+INTERVAL '30 minutes')`,[crypto.createHash('sha256').update(token).digest('hex'),userId,user.credential_revision]);
 await client.query('COMMIT');
 console.log(process.env.APP_ORIGIN+'/recover#token='+token);
}catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();await pool.end();}})().catch(()=>{console.error('Unable to create recovery link');process.exitCode=1;});
