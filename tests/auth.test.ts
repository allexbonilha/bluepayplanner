import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyCredentials,credentialVersion,sessionHash,createSessionToken,allowedOrigin} from '../lib/security.ts';
const env={APP_USERNAME:'owner',APP_PASSWORD:'test-only-secret-1234'};
test('credentials fail closed and compare both fields',async()=>{
 assert.equal(await verifyCredentials('owner',env.APP_PASSWORD,env),true);
 assert.equal(await verifyCredentials('wrong',env.APP_PASSWORD,env),false);
 assert.equal(await verifyCredentials('owner','wrong',env),false);
 assert.equal(await verifyCredentials('owner','short',{...env,APP_PASSWORD:'short'}),false);
});
test('sessions use independent opaque tokens and changes to credentials invalidate them',()=>{
 const a=createSessionToken(),b=createSessionToken();assert.match(a,/^[a-f0-9]{64}$/);assert.notEqual(a,b);assert.notEqual(sessionHash(a),a);
 assert.notEqual(credentialVersion(env),credentialVersion({...env,APP_PASSWORD:'another-secret-123456'}));
});
test('mutations require an explicit exact trusted origin',()=>{
 assert.equal(allowedOrigin(null,'http://localhost:5174',{}),false);
 assert.equal(allowedOrigin('https://foreign.example','http://internal',{APP_ORIGIN:'https://app.example',NODE_ENV:'production'}),false);
 assert.equal(allowedOrigin('https://app.example','http://internal',{APP_ORIGIN:'https://app.example',NODE_ENV:'production'}),true);
});
