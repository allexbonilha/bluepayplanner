import {test} from 'node:test';
import assert from 'node:assert/strict';
import {applyOperation,initialState,calculateTotals,investmentResult,investmentSummary,exportCsv} from '../lib/finance.ts';
test('valor atual e perda informada funcionam sem capital aplicado',()=>{
 const e={value:98133,base:null,investmentMode:'result' as const,reportedGain:-8589};
 assert.equal(investmentResult(e),-8589);
 assert.deepEqual(calculateTotals([e]),{total:98133,invested:0,gain:-8589});
 assert.equal(investmentSummary([e]).unknownCapitalCount,1);
 assert.equal(investmentSummary([e]).capitalPercent,null);
});
test('modos mistos mantêm cálculo Nubank e percentual apenas sobre capital conhecido',()=>{
 const es=[{value:12000,base:10000},{value:98133,base:null,investmentMode:'result' as const,reportedGain:-8589}];
 assert.deepEqual(calculateTotals(es),{total:110133,invested:10000,gain:-6589});
 assert.equal(investmentSummary(es).capitalPercent,20);
});
test('zero informado é válido; campo vazio bloqueia conclusão',()=>{
 const s=initialState();const entries=s.accounts.map(a=>({accountId:a.id,value:10000,base:a.type==='investment'?8000:null}));
 const index=entries.findIndex(e=>e.accountId==='mp-btc');
 entries[index]={...entries[index],base:null,investmentMode:'result',reportedGain:0} as any;
 const closed=applyOperation(s,{op:'saveMonth',month:'2025-08',status:'closed',entries,note:''});
 assert.equal(closed.closings[0].entries[index].base,null);
 assert.equal(investmentResult(closed.closings[0].entries[index]),0);
 assert.ok(exportCsv(closed).includes('Resultado informado'));
 entries[index]={...entries[index],reportedGain:null} as any;
 assert.throws(()=>applyOperation(s,{op:'saveMonth',month:'2025-08',status:'closed',entries,note:''}));
});
test('modo inválido, frações de centavo e modo capital sem base são rejeitados',()=>{
 const s=initialState();
 for(const patch of [{investmentMode:'wrong',reportedGain:0},{investmentMode:'result',reportedGain:0.5},{investmentMode:'capital',base:null}]){
 const entries=s.accounts.map(a=>({accountId:a.id,value:10000,base:a.type==='investment'?8000:null,...(a.id==='mp-btc'?patch:{})}));
 assert.throws(()=>applyOperation(s,{op:'saveMonth',month:'2025-08',status:'closed',entries,note:''}));}
});
test('fechamentos antigos continuam calculáveis e rascunho não inventa resultado',()=>{
 assert.equal(investmentResult({value:12000,base:10000}),2000);
 assert.equal(investmentResult({value:98133,base:null,investmentMode:'result',reportedGain:null}),null);
 assert.equal(investmentSummary([{value:98133,base:null,investmentMode:'result',reportedGain:null}]).complete,false);
});
