import { test } from 'node:test';
import assert from 'node:assert/strict';
const url='http://127.0.0.1:5173/api/portfolio';
const read=async()=>{const r=await fetch(url);assert.equal(r.status,200);return await r.json() as any;};
const write=async(revision:number,operation:any)=>{const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({revision,operation})});return {status:r.status,body:await r.json() as any};};
test('D1 persiste conta nova, rejeita revisão antiga e preserva dados existentes',async()=>{
 let accountId:string|null=null;const initial=await read();const originalAccounts=initial.state.accounts.length;const name='Teste técnico '+crypto.randomUUID();
 try{const created=await write(initial.revision,{op:'account',name,categoryId:initial.state.categories[0].id,type:'balance'});assert.equal(created.status,200);accountId=created.body.state.accounts.find((a:any)=>a.name===name).id;const loaded=await read();assert.equal(loaded.state.accounts.length,originalAccounts+1);assert.ok(loaded.state.accounts.some((a:any)=>a.id===accountId));const stale=await write(initial.revision,{op:'category',name:'Não deve salvar',color:'#2184d8'});assert.equal(stale.status,409);assert.equal((await read()).revision,created.body.revision);const invalid=await write(loaded.revision,{op:'account',name:'Inválida',categoryId:'missing',type:'balance'});assert.equal(invalid.status,400);assert.equal((await read()).revision,loaded.revision);
 }finally{if(accountId){const latest=await read();const deleted=await write(latest.revision,{op:'deleteAccount',id:accountId});assert.equal(deleted.status,200);const final=await read();assert.ok(!final.state.accounts.some((a:any)=>a.id===accountId));assert.deepEqual(final.state.closings,initial.state.closings);}}
});
test('D1 persiste e edita metas sem alterar o histórico',async()=>{
 const initial=await read();let id:string|null=null;const name='Meta de teste '+crypto.randomUUID();
 try{
  const created=await write(initial.revision,{op:'goal',name,target:100000,accountId:null,deadline:'2027-12'});assert.equal(created.status,200);id=created.body.state.goals.find((g:any)=>g.name===name).id;
  const loaded=await read();assert.equal(loaded.state.goals.find((g:any)=>g.id===id).deadline,'2027-12');
  const edited=await write(loaded.revision,{op:'goal',id,name,target:200000,accountId:null,deadline:null});assert.equal(edited.status,200);assert.equal((await read()).state.goals.find((g:any)=>g.id===id).target,200000);
 }finally{if(id){const latest=await read();assert.equal((await write(latest.revision,{op:'deleteGoal',id})).status,200);const final=await read();assert.deepEqual(final.state.closings,initial.state.closings);assert.deepEqual(final.state.accounts,initial.state.accounts);assert.deepEqual(final.state.goals??[],initial.state.goals??[]);}}
});
test('D1 salva ocorrências e realização sem alterar saldos de patrimônio',async()=>{
 const initial=await read();let ids:string[]=[];const title='Movimento de teste '+crypto.randomUUID();
 try{const result=await write(initial.revision,{op:'transaction',title,amount:12345,kind:'expense',date:'2025-01-31',status:'pending',categoryId:'other',occurrences:3});assert.equal(result.status,200);ids=result.body.state.transactions.filter((t:any)=>t.title===title).map((t:any)=>t.id);assert.equal(ids.length,3);const loaded=await read();assert.deepEqual(loaded.state.transactions.filter((t:any)=>ids.includes(t.id)).map((t:any)=>t.date),['2025-01-31','2025-02-28','2025-03-31']);const done=await write(loaded.revision,{op:'transactionStatus',id:ids[0],status:'done',settledDate:'2025-02-01'});assert.equal(done.status,200);assert.equal((await read()).state.transactions.find((t:any)=>t.id===ids[0]).settledDate,'2025-02-01');
 }finally{for(const id of ids){const latest=await read();assert.equal((await write(latest.revision,{op:'deleteTransaction',id})).status,200);}const final=await read();assert.deepEqual(final.state.transactions??[],initial.state.transactions??[]);assert.deepEqual(final.state.closings,initial.state.closings);}
});
