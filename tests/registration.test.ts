import test from 'node:test';import assert from 'node:assert/strict';
import {hashPassword,verifyPassword,validateRegistration,normalizeUsername} from '../lib/user-security.ts';
import {createPortfolioStore} from '../lib/portfolio-store.ts';
test('password hashes are salted, verify exactly and do not store plaintext',async()=>{const password='test-only-password-1234',a=await hashPassword(password),b=await hashPassword(password);assert.notEqual(a,b);assert.equal(a.includes(password),false);assert.equal(await verifyPassword(password,a),true);assert.equal(await verifyPassword('wrong',a),false);assert.equal(await verifyPassword(password,'corrupt'),false);});
test('registration normalizes username and rejects weak credentials and mismatched confirmation',()=>{
 const input={name:'Pessoa Teste',username:'  PERSON.Test  ',password:'test-only-password-1234',confirmation:'test-only-password-1234'};
 assert.equal(normalizeUsername(input.username),'person.test');assert.equal(validateRegistration(input).username,'person.test');
 for(const bad of [{password:'short',confirmation:'short'},{confirmation:'different'},{username:'owner; DROP TABLE users'},{name:''}])assert.throws(()=>validateRegistration({...input,...bad}));
});
test('portfolio operations use the authenticated tenant ID in every data query',async()=>{
 const calls:any[]=[];const query=async(sql:string,args?:unknown[])=>{calls.push({sql,args});return{rows:sql.startsWith('SELECT')?[{data:{accounts:[],closings:[]},revision:0}]:[],rowCount:1};};
 const store=createPortfolioStore(query);await store.read('user-a');await store.write({accounts:[],closings:[]} as any,0,'user-a');
 assert.equal(calls.find(c=>c.sql.startsWith('INSERT')).args[0],'user-a');assert.equal(calls.find(c=>c.sql.startsWith('SELECT')).args[0],'user-a');assert.equal(calls.find(c=>c.sql.startsWith('UPDATE')).args[2],'user-a');
 const first=JSON.parse(calls.find(c=>c.sql.startsWith('INSERT')).args[1]);assert.equal(first.accounts.length,0);assert.equal(first.closings.length,0);
});
