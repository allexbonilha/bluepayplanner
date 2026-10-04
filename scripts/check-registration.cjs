// PostgreSQL integration checks: all test writes use a temporary isolated schema.
const fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const root=path.resolve(__dirname,'..'),sources={};
const compiler={compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}};
for(const name of ['security','user-security','auth','portfolio-store','request-body','finance','life'])sources['./'+name]=ts.transpileModule(fs.readFileSync(path.join(root,'lib',name+'.ts'),'utf8'),compiler).outputText;
for(const [name,file] of Object.entries({'route-register':'auth/register','route-login':'auth/login','route-portfolio':'portfolio','route-logout':'auth/logout'}))sources['./'+name]=ts.transpileModule(fs.readFileSync(path.join(root,'app/api',file,'route.ts'),'utf8'),compiler).outputText;
const {Pool}=require('pg'),vm=require('node:vm'),crypto=require('node:crypto'),assert=require('node:assert/strict');
(async()=>{
const schema='registration_test_'+crypto.randomBytes(10).toString('hex');
const admin=new Pool({connectionString:process.env.DATABASE_URL,max:1});
const pool=new Pool({connectionString:process.env.DATABASE_URL,max:1,options:'-c search_path='+schema});
let checks=0;const check=(condition,name)=>{assert.ok(condition,name);checks++;console.log('PASS '+name);};
const modules={'./database':{query:(...args)=>pool.query(...args)}};
function load(name){if(modules[name])return modules[name];const module={exports:{}};modules[name]=module.exports;vm.runInThisContext('(function(require,module,exports){'+sources[name]+'\n})')(id=>id.startsWith('@/lib/')?load('./'+id.slice(6)):id.startsWith('./')?load(id.replace(/\.ts$/,'')):require(id),module,module.exports);return modules[name]=module.exports;}
try{
 await admin.query('CREATE SCHEMA '+schema);
 const original=(await admin.query("SELECT data,revision FROM public.portfolios WHERE id='owner'")).rows[0];
 await pool.query('CREATE TABLE portfolios (id TEXT PRIMARY KEY,data JSONB NOT NULL,revision INTEGER NOT NULL DEFAULT 0,updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())');
 await pool.query('INSERT INTO portfolios(id,data,revision) VALUES($1,$2::jsonb,$3)',['owner',JSON.stringify(original.data),original.revision]);
 await pool.query('CREATE TABLE auth_sessions(token_hash TEXT PRIMARY KEY,credential_version TEXT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),expires_at TIMESTAMPTZ NOT NULL)');
 const security=load('./security'),legacy=security.createSessionToken();
 await pool.query("INSERT INTO auth_sessions(token_hash,credential_version,expires_at) VALUES($1,$2,NOW()+INTERVAL '1 hour')",[security.sessionHash(legacy),security.credentialVersion(process.env)]);
 const auth=load('./auth');await auth.authSchema();
 const legacyUser=await auth.sessionUser(legacy);check(legacyUser?.id==='owner','legacy session migration preserves owner');
 const owner=await auth.loginUser(process.env.APP_USERNAME,process.env.APP_PASSWORD);check(owner?.id==='owner'&&owner.username==='allex','existing owner is registered and can log in');
 const input={name:'Teste isolado',username:'isolated-a',password:'test-only-strong-password-123456'};
 const a=await auth.registerUser(input),b=await auth.registerUser({...input,username:'isolated-b'});check(a.id!==b.id&&a.id!=='owner','independent random user IDs');
 await assert.rejects(()=>auth.registerUser({...input,username:'allex'}),error=>error.code==='23505');check(true,'owner username cannot be taken');
 const concurrent=await Promise.allSettled([auth.registerUser({...input,username:'concurrent'}),auth.registerUser({...input,username:'concurrent'})]);check(concurrent.filter(x=>x.status==='fulfilled').length===1,'concurrent duplicate signup creates one user');
 const logged=await auth.loginUser(' ISOLATED-A ',input.password);check(logged?.id===a.id,'normalized member login');check(await auth.loginUser(a.username,'wrong')===null,'incorrect member password rejected');
 const token=await auth.newSession(a,null);check((await auth.sessionUser(token))?.id===a.id,'member session binds to member');
 const store=load('./portfolio-store').createPortfolioStore((...args)=>pool.query(...args));
 const pa=await store.read(a.id),pb=await store.read(b.id);check(pa.state.accounts.length===0&&pb.state.closings.length===0,'new users start empty');
 const stateA={...pa.state,accounts:[{id:'same-id',name:'Only A',categoryId:'bank',type:'balance',archived:false}]};
 const stateB={...pb.state,accounts:[{id:'same-id',name:'Only B',categoryId:'bank',type:'balance',archived:false}]};
 await store.write(stateA,0,a.id);await store.write(stateB,0,b.id);
 check((await store.read(a.id)).state.accounts[0].name==='Only A'&&(await store.read(b.id)).state.accounts[0].name==='Only B','same account identifiers do not cross tenants');
 const ownerRead=await store.read('owner');assert.deepEqual(ownerRead.state,original.data);check(ownerRead.revision===original.revision,'owner portfolio data and revision unchanged');
 await auth.revokeSession(token);check(await auth.sessionUser(token)===null,'member logout revokes session');

 modules['./database'].portfolioStore=store;
 const registerRoute=load('./route-register'),loginRoute=load('./route-login'),portfolioRoute=load('./route-portfolio');
 const headers={'Content-Type':'application/json',Origin:process.env.APP_ORIGIN,'X-Forwarded-For':'isolated-route-test'};
 const request=(body,extra={})=>new Request('http://internal/api',{method:'POST',headers:{...headers,...extra},body:JSON.stringify(body)});
 const routeUser={name:'Route Test',username:'route-test',password:input.password,confirmation:input.password,id:'owner',userId:'owner',role:'admin'};
 let response=await registerRoute.POST(request(routeUser));check(response.status===201,'actual registration route succeeds');
 const cookie=response.headers.get('set-cookie').split(';')[0];
 response=await portfolioRoute.GET(new Request('http://internal/api/portfolio?userId=owner',{headers:{Cookie:cookie,'X-User-ID':'owner'}}));const rp=await response.json();check(response.status===200&&rp.user.id!=='owner'&&rp.state.accounts.length===0,'request fields cannot select owner or grant privileges');
 response=await portfolioRoute.POST(request({revision:0,operation:{op:'account',name:'Route-only account',categoryId:'bank',type:'balance'},userId:'owner'},{Cookie:cookie,'X-Account-ID':rp.user.id}));check(response.status===200,'actual write route saves to member');
 response=await portfolioRoute.GET(new Request('http://internal/api/portfolio',{headers:{Cookie:cookie,'X-Account-ID':'owner'}}));check(response.status===409,'cross-tab read account mismatch blocked');
 response=await portfolioRoute.POST(request({revision:1,operation:{op:'account',name:'Wrong account',categoryId:'bank',type:'balance'}},{Cookie:cookie,'X-Account-ID':'owner'}));check(response.status===409,'cross-tab write account mismatch blocked');
 response=await portfolioRoute.POST(request({},{Cookie:cookie,'X-Account-ID':rp.user.id,Origin:'https://foreign.example'}));check(response.status===403,'cross-origin member write blocked');
 response=await registerRoute.POST(request({...routeUser,username:' ALLEX '}));check(response.status===409,'registration route reserves owner username');
 response=await loginRoute.POST(request({username:routeUser.username,password:input.password}));check(response.status===200,'member can log in through actual route');
 response=await load('./route-logout').POST(request({}, {Cookie:cookie}));check(response.status===200,'actual logout route succeeds');
 response=await portfolioRoute.GET(new Request('http://internal/api/portfolio',{headers:{Cookie:cookie}}));check(response.status===401,'actual route blocks revoked member session');
 assert.deepEqual((await store.read('owner')).state,original.data);check((await store.read('owner')).revision===original.revision,'route tests preserve owner data exactly');
 console.log('ISOLATED_REGISTRATION_PASSED '+checks);
}finally{await pool.end();await admin.query('DROP SCHEMA '+schema+' CASCADE');await admin.end();}
})().catch(()=>{console.log('ISOLATED_REGISTRATION_FAILED');process.exitCode=1;});
