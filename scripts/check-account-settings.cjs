// Real PostgreSQL checks. All test writes use an isolated temporary schema.
const fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const {Pool}=require('pg'),vm=require('node:vm'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),sources={};
const options={compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}};
for(const name of ['database','security','user-security','auth','recovery','portfolio-store','request-body','finance','life'])sources['./'+name]=ts.transpileModule(fs.readFileSync(path.join(root,'lib',name+'.ts'),'utf8'),options).outputText;
for(const [name,file] of Object.entries({'route-register':'auth/register','route-login':'auth/login','route-portfolio':'portfolio','route-logout':'auth/logout','route-account':'auth/account'}))sources['./'+name]=ts.transpileModule(fs.readFileSync(path.join(root,'app/api',file,'route.ts'),'utf8'),options).outputText;
(async()=>{
 const schema='account_test_'+crypto.randomBytes(10).toString('hex');
 const admin=new Pool({connectionString:process.env.DATABASE_URL,max:1});
 const setup=new Pool({connectionString:process.env.DATABASE_URL,max:1,options:'-c search_path='+schema});
 const envBefore={url:process.env.DATABASE_URL,user:process.env.APP_USERNAME,password:process.env.APP_PASSWORD};
 const modules={};let checks=0;
 const check=(ok,name)=>{assert.ok(ok,name);checks++;console.log('PASS '+name);};
 function load(name){if(modules[name])return modules[name];const module={exports:{}};modules[name]=module.exports;vm.runInThisContext('(function(require,module,exports){'+sources[name]+'\n})')(id=>id.startsWith('@/lib/')?load('./'+id.slice(6)):id.startsWith('./')?load(id.replace(/\.ts$/,'')):require(id),module,module.exports);return modules[name]=module.exports;}
 const password='isolated-initial-password-1234',newPassword='isolated-updated-password-5678';
 const origin=process.env.APP_ORIGIN||'https://isolated.example';process.env.APP_ORIGIN=origin;
 const headers={'Content-Type':'application/json',Origin:origin,'X-Forwarded-For':'isolated-account-'+schema};
 const request=(body,extra={})=>new Request('http://internal/api',{method:'POST',headers:{...headers,...extra},body:JSON.stringify(body)});
 try{
  await admin.query('CREATE SCHEMA '+schema);
  const original=(await admin.query("SELECT data,revision FROM public.portfolios WHERE id='owner'")).rows[0];
  await setup.query('CREATE TABLE portfolios (id TEXT PRIMARY KEY,data JSONB NOT NULL,revision INTEGER NOT NULL DEFAULT 0,updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())');
  await setup.query('INSERT INTO portfolios(id,data,revision) VALUES($1,$2::jsonb,$3)',['owner',JSON.stringify(original.data),original.revision]);
  await setup.query('CREATE TABLE users(id TEXT PRIMARY KEY,username TEXT NOT NULL UNIQUE,name TEXT NOT NULL,password_hash TEXT,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())');
  await setup.query("INSERT INTO users(id,username,name,password_hash) VALUES('owner','owner-test','Owner Test',NULL)");
  await setup.query('CREATE TABLE auth_sessions(token_hash TEXT PRIMARY KEY,credential_version TEXT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),expires_at TIMESTAMPTZ NOT NULL)');
  const legacyToken=crypto.randomBytes(32).toString('hex');await setup.query("INSERT INTO auth_sessions(token_hash,credential_version,expires_at) VALUES($1,'legacy-fingerprint',NOW()+INTERVAL '1 hour')",[crypto.createHash('sha256').update(legacyToken).digest('hex')]);
  const url=new URL(envBefore.url);url.searchParams.set('options','-c search_path='+schema);process.env.DATABASE_URL=url.toString();
  process.env.APP_USERNAME='owner-test';process.env.APP_PASSWORD=password;
  let auth=load('./auth');await auth.authSchema();
  check((await setup.query("SELECT password_hash FROM users WHERE id='owner'")).rows[0].password_hash.startsWith('scrypt-v1$'),'legacy password migrates to salted database hash');
  check(await auth.sessionUser(legacyToken)===null,'legacy sessions are invalidated after migration');
  delete process.env.APP_USERNAME;delete process.env.APP_PASSWORD;delete modules['./auth'];auth=load('./auth');await auth.authSchema();
  const owner=await auth.loginUser('owner-test',password);check(owner?.id==='owner','owner login works without credential variables');
  process.env.APP_USERNAME='environment-override';process.env.APP_PASSWORD='environment-override-password-1234';delete modules['./auth'];auth=load('./auth');await auth.authSchema();
  check((await auth.loginUser('owner-test',password))?.id==='owner'&&await auth.loginUser('environment-override',process.env.APP_PASSWORD)===null,'environment never resets database credentials');
  delete process.env.APP_USERNAME;delete process.env.APP_PASSWORD;
  const register=load('./route-register'),account=load('./route-account'),login=load('./route-login'),portfolio=load('./route-portfolio');
  let response=await register.POST(request({name:'User A',username:'user-a',password,confirmation:password,id:'owner',role:'admin'}));check(response.status===201,'registration works without credential variables');
  let cookieA=response.headers.get('set-cookie').split(';')[0];
  response=await portfolio.GET(new Request('http://internal/api/portfolio?userId=owner',{headers:{Cookie:cookieA}}));const a=await response.json();check(a.user.id!=='owner'&&a.state.accounts.length===0,'new user cannot select owner portfolio');
  response=await register.POST(request({name:'User B',username:'user-b',password,confirmation:password}));check(response.status===201,'second independent user registers');const cookieB=response.headers.get('set-cookie').split(';')[0];
  const userB=(await auth.findUser('user-b')),tokenA2=await auth.newSession(await auth.findUser('user-a'),null);
  const change={name:'Updated A',username:'updated-a',currentPassword:password,newPassword,confirmation:newPassword,userId:'owner',role:'admin'};
  response=await account.POST(request(change));check(response.status===401,'anonymous credential changes blocked');
  response=await account.POST(request(change,{Cookie:cookieA,'X-Account-ID':'owner'}));check(response.status===409,'cross-account credential change blocked');
  response=await account.POST(request(change,{Cookie:cookieA,'X-Account-ID':a.user.id,Origin:'https://foreign.example'}));check(response.status===403,'cross-origin credential change blocked');
  response=await account.POST(request({...change,currentPassword:'wrong'},{Cookie:cookieA,'X-Account-ID':a.user.id}));check(response.status===403,'incorrect current password cannot change credentials');
  response=await account.POST(request({...change,username:'user-b'},{Cookie:cookieA,'X-Account-ID':a.user.id}));check(response.status===409,'duplicate username rolls back');
  check((await auth.sessionUser(cookieA.split('=')[1]))?.id===a.user.id,'failed change preserves old session');
  response=await account.POST(request(change,{Cookie:cookieA,'X-Account-ID':a.user.id}));const updated=await response.json();check(response.status===200&&updated.user.id===a.user.id&&updated.user.username==='updated-a'&&!JSON.stringify(updated).includes('password_hash'),'successful change returns only safe profile');
  cookieA=response.headers.get('set-cookie').split(';')[0];
  check(await auth.sessionUser(tokenA2)===null,'other devices lose old sessions');
  check((await auth.sessionUser(cookieA.split('=')[1]))?.id===a.user.id,'replacement session remains valid');
  check((await auth.sessionUser(cookieB.split('=')[1]))?.id===userB.id,'other users keep their sessions');
  check(await auth.loginUser('user-a',password)===null&&await auth.loginUser('updated-a',password)===null,'old username and password rejected');
  response=await login.POST(request({username:'updated-a',password:newPassword}));check(response.status===200,'new username and password log in');
  const ownerToken=await auth.newSession(await auth.findUser('owner-test'),null);
  response=await account.POST(request({name:'Owner Test',username:'allexbonilha',currentPassword:password,newPassword,confirmation:newPassword},{Cookie:load('./security').cookieName()+'='+ownerToken,'X-Account-ID':'owner','X-Forwarded-For':'isolated-owner-'+schema}));check(response.status===200,'owner can change username and password through site');
  check((await auth.loginUser('allexbonilha',newPassword))?.id==='owner','renamed owner retains original ID');
  const store=load('./database').portfolioStore,ownerRead=await store.read('owner');assert.deepEqual(ownerRead.state,original.data);check(ownerRead.revision===original.revision,'credential changes preserve financial state and revision');
  const latest=await auth.findUser('updated-a');
  const parallel=await Promise.allSettled([auth.changeAccount(latest.id,{name:'Parallel One',username:latest.username,currentPassword:newPassword,newPassword:''}),auth.changeAccount(latest.id,{name:'Parallel Two',username:latest.username,currentPassword:newPassword,newPassword:''})]);
  check(parallel.filter(r=>r.status==='fulfilled').length===1&&parallel.filter(r=>r.status==='rejected'&&r.reason.status===409).length===1,'concurrent name-only changes cannot revoke winning response session');
  const winner=parallel.find(r=>r.status==='fulfilled').value;check((await auth.sessionUser(winner.token))?.id===latest.id,'winning concurrent change leaves usable session');
  const recovery=load('./recovery');await recovery.recoverySchema();
  const mint=async(userId,minutes=30)=>{const token=crypto.randomBytes(32).toString('hex');await setup.query(`INSERT INTO password_recovery(token_hash,user_id,credential_revision,expires_at) SELECT $1,id,credential_revision,NOW()+($3*INTERVAL '1 minute') FROM users WHERE id=$2`,[load('./security').sessionHash(token),userId,minutes]);return token;};
  const recoveredPassword='isolated-recovered-password-8910';
  const recoveryBody=token=>({token,username:'recovered-owner',password:recoveredPassword,confirmation:recoveredPassword,userId:userB.id});
  await assert.rejects(()=>recovery.recoverAccount(recoveryBody('0'.repeat(64))));check(true,'unknown recovery token rejected');
  const expiredToken=await mint('owner',-1);await assert.rejects(()=>recovery.recoverAccount(recoveryBody(expiredToken)));check(true,'expired recovery token rejected');
  const resetToken=await mint('owner');
  await assert.rejects(()=>recovery.recoverAccount({...recoveryBody(resetToken),confirmation:'wrong'}));check(true,'recovery requires matching strong password');
  const resetRace=await Promise.allSettled([recovery.recoverAccount(recoveryBody(resetToken)),recovery.recoverAccount(recoveryBody(resetToken))]);
  check(resetRace.filter(x=>x.status==='fulfilled').length===1,'recovery token consumed exactly once under concurrency');
  check((await auth.loginUser('recovered-owner',recoveredPassword))?.id==='owner'&&await auth.loginUser('allexbonilha',newPassword)===null,'recovery updates original owner only');
  await assert.rejects(()=>recovery.recoverAccount(recoveryBody(resetToken)));check(true,'used recovery token cannot replay');
  assert.deepEqual((await store.read('owner')).state,original.data);check((await store.read('owner')).revision===original.revision,'recovery preserves original portfolio');
  check(await auth.sessionUser((response.headers.get('set-cookie')||'').split(';')[0].split('=')[1])===null,'recovery revokes owner sessions');
  console.log('ACCOUNT_SETTINGS_ISOLATED_PASSED '+checks);
 }finally{
  if(globalThis.plannerPool){await globalThis.plannerPool.end();delete globalThis.plannerPool;}
  await setup.end();await admin.query('DROP SCHEMA '+schema+' CASCADE');await admin.end();
  process.env.DATABASE_URL=envBefore.url;for(const [key,value] of [['APP_USERNAME',envBefore.user],['APP_PASSWORD',envBefore.password]]){if(value===undefined)delete process.env[key];else process.env[key]=value;}
 }
})().catch(()=>{console.log('ACCOUNT_SETTINGS_ISOLATED_FAILED');process.exitCode=1;});
