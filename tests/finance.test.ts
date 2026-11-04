import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cashTotal,cashAmountsTotal, calculateTotals, compareTotals, parseMoney, applyOperation, initialState, exportCsv } from '../lib/finance.ts';
test('valores em reais de notas e moedas somam centavos sem multiplicar pela denominação',()=>{
 assert.equal(parseMoney('2,50'),250);assert.equal(parseMoney('2.50'),250);assert.equal(parseMoney('1.234,56'),123456);assert.equal(parseMoney('1.234'),123400);
 assert.equal(cashAmountsTotal({'5':115,'10':110,'25':250},35),510);
 for(const bad of [{'5':1.5},{'5':-1},{'3':100}] as Record<string,number>[])assert.throws(()=>cashAmountsTotal(bad,0));
 assert.throws(()=>parseMoney('2,501'));assert.throws(()=>parseMoney('1.2.50'));
});
test('fechamento preserva valores monetários por denominação ao salvar e reabrir',()=>{
 const amounts={'5':115,'25':250};let s=applyOperation(initialState(),{op:'saveMonth',month:'2025-08',status:'draft',entries:[{accountId:'wallet',mode:'amounts',cashAmounts:amounts,extra:35,counts:{'25':99},value:99999}]});
 let entry=s.closings[0].entries[0];assert.equal(entry.value,400);assert.deepEqual(entry.cashAmounts,amounts);assert.equal(entry.mode,'amounts');
 s.accounts=[s.accounts[0]];s=applyOperation(s,{op:'saveMonth',month:'2025-08',status:'closed',entries:[entry]});s=applyOperation(s,{op:'reopen',month:'2025-08'});assert.equal(s.closings[0].status,'draft');assert.deepEqual(s.closings[0].entries[0].cashAmounts,amounts);assert.equal(s.closings[0].entries[0].value,400);
 s=applyOperation(s,{op:'saveMonth',month:'2025-08',status:'draft',entries:[{accountId:'wallet',mode:'count',counts:{'25':3},extra:0}]});assert.equal(s.closings[0].entries[0].value,75);
 assert.throws(()=>applyOperation(initialState(),{op:'saveMonth',month:'2025-08',status:'draft',entries:[{accountId:'wallet',mode:'amounts',cashAmounts:{'5':-1}}]}));
});
test('investimento incompleto não inventa perda nem exporta ganho',()=>{
 assert.deepEqual(calculateTotals([{value:null,base:10000}]),{total:0,invested:10000,gain:0});
 let s=initialState();s=applyOperation(s,{op:'saveMonth',month:'2025-08',status:'draft',entries:[{accountId:'nu-fixed',value:null,base:10000}],note:''});
 assert.ok(!exportCsv(s).includes('-100,00'));
});
test('categoria inexistente é rejeitada sem modificar estado',()=>{
 const s=initialState(),before=JSON.stringify(s);assert.throws(()=>applyOperation(s,{op:'account',name:'Teste inválido',categoryId:'inexistente',type:'balance'}));assert.equal(JSON.stringify(s),before);
});
test('contagem em centavos e investimento sem dupla contagem',()=>{
 assert.equal(cashTotal({'10000':2,'25':3},0),20075);
 assert.deepEqual(calculateTotals([{value:20075,base:null},{value:12000,base:10000}]),{total:32075,invested:10000,gain:2000});
});
test('zero e ausência de base não geram divisão inválida',()=>{
 assert.equal(compareTotals(100,0).percent,null); assert.equal(compareTotals(100,null).difference,null);
 assert.equal(parseMoney('1.234,56'),123456); assert.equal(parseMoney('0'),0); assert.equal(parseMoney(''),null);
 assert.throws(()=>parseMoney('12abc')); assert.throws(()=>cashTotal({'25':1.5},0));
});
test('fechamento completo exige todos os saldos e mantém histórico',()=>{
 let s=initialState(); const acc=s.accounts[0];
 assert.throws(()=>applyOperation(s,{op:'saveMonth',month:'2025-08',status:'closed',entries:[],note:''}));
 s=applyOperation(s,{op:'saveMonth',month:'2025-08',status:'closed',entries:s.accounts.map(a=>({accountId:a.id,value:10000,base:a.type==='investment'?8000:null,counts:{},extra:0,mode:'direct'})),note:''});
 assert.equal(s.closings.length,1);
 const oldName=s.closings[0].entries[0].name;
 s=applyOperation(s,{op:'account',id:acc.id,name:'Novo nome',categoryId:acc.categoryId,type:acc.type});
 assert.equal(s.closings[0].entries[0].name,oldName);
 assert.throws(()=>applyOperation(s,{op:'saveMonth',month:'2025-08',status:'draft',entries:[],note:''}));
 s=applyOperation(s,{op:'reopen',month:'2025-08'}); assert.equal(s.closings[0].status,'draft');
});
test('remoção preserva contas com histórico e categoria ocupada',()=>{
 const s=initialState(); assert.throws(()=>applyOperation(s,{op:'deleteCategory',id:s.categories[0].id}));
 const archived=applyOperation(s,{op:'archive',id:s.accounts[0].id,archived:true});assert.equal(archived.accounts[0].archived,true);
});
test('CSV protege fórmulas e escapa nomes',()=>{
 let s=initialState();s.accounts[0].name='=SOMA(1;2)';
 s=applyOperation(s,{op:'saveMonth',month:'2025-08',status:'draft',entries:[{accountId:s.accounts[0].id,value:10000,base:null,counts:{},extra:0,mode:'direct'}],note:''});
 assert.match(exportCsv(s),/'=SOMA/);
});

import {accountBalanceTotals,accountBank,accountOwnership,organizeAccounts} from '../lib/account-organization.ts';
test('banco e PF/PJ persistem sem alterar saldos históricos e edições antigas preservam metadados',()=>{
 const initial=initialState(),s=applyOperation(initial,{op:'saveMonth',month:'2025-01',status:'closed',entries:initial.accounts.map(a=>({accountId:a.id,value:10000,base:a.type==='investment'?9000:null}))}),account=s.accounts.find(a=>a.id==='nubank')!;
 const op={op:'account',id:account.id,name:account.name,type:account.type,categoryId:account.categoryId};
 const n=applyOperation(s,{...op,bank:' Nubank ',ownership:'PJ'});
 assert.equal(n.accounts.find(a=>a.id===account.id)!.bank,'Nubank');assert.equal(n.accounts.find(a=>a.id===account.id)!.ownership,'PJ');assert.deepEqual(n.closings,s.closings);assert.equal(account.ownership,undefined);
 const edited=applyOperation(n,{...op,name:'Conta empresa'});assert.equal(edited.accounts.find(a=>a.id===account.id)!.ownership,'PJ');assert.equal(edited.accounts.find(a=>a.id===account.id)!.bank,'Nubank');
 for(const patch of [{ownership:'XX'},{ownership:null},{bank:123},{bank:'x'.repeat(81)}])assert.throws(()=>applyOperation(s,{...op,...patch}));
 assert.equal(accountBank(account),'Nubank');assert.equal(accountOwnership(account),'PF');assert.equal(accountBank({...account,bank:''}),'');
 const fresh=applyOperation(s,{op:'account',name:'Outra conta',type:'balance',categoryId:'bank'});assert.equal(fresh.accounts.at(-1)!.ownership,'PF');
});
test('organização agrupa banco, PF antes de PJ, sem modificar a ordem original',()=>{
 const accounts=[{name:'Z',bank:'Nubank',ownership:'PJ' as const},{name:'A',bank:'Nubank',ownership:'PF' as const},{name:'C',bank:'Inter',ownership:'PJ' as const},{name:'Carteira'}];
 assert.deepEqual(organizeAccounts(accounts).map(a=>a.name),['C','A','Z','Carteira']);assert.deepEqual(accounts.map(a=>a.name),['Z','A','C','Carteira']);
 assert.deepEqual(organizeAccounts(accounts,'ownership').map(a=>a.name),['A','Carteira','C','Z']);
});

test('totais PF/PJ e por banco incluem saldos negativos e investimentos uma única vez',()=>{
 const accounts=[{id:'pf',name:'Conta pessoal',bank:'Nubank',ownership:'PF' as const},{id:'pj',name:'Empresa',bank:' nubank ',ownership:'PJ' as const},{id:'inv',name:'Investimento',bank:'Inter',ownership:'PF' as const},{id:'cash',name:'Carteira'}];
 const entries=[{accountId:'pf',name:'Pessoal',value:10000},{accountId:'pj',name:'Empresa',value:-2000},{accountId:'inv',name:'Investimento',value:35000,base:30000},{accountId:'cash',name:'Carteira',value:500}];
 const before=structuredClone({accounts,entries}),t=accountBalanceTotals(entries,accounts);
 assert.equal(t.pf.value,45500);assert.equal(t.pj.value,-2000);assert.equal(t.total.value,43500);assert.equal(t.pf.value+t.pj.value,t.total.value);
 assert.equal(t.banks.length,3);assert.equal(t.banks.find(b=>b.key==='nubank')!.total.value,8000);assert.equal(t.banks.reduce((sum,b)=>sum+b.total.value,0),t.total.value);assert.equal(t.banks.at(-1)!.key,'');assert.deepEqual({accounts,entries},before);
});
test('totais diferenciam zero de saldo ausente ou inválido e não incluem contas fora do mês',()=>{
 const accounts=[{id:'a',name:'A',bank:'Nubank',ownership:'PF' as const},{id:'b',name:'B',bank:'Nubank',ownership:'PJ' as const},{id:'c',name:'Nova conta',bank:'Inter'}];
 const t=accountBalanceTotals([{accountId:'a',name:'A',value:0},{accountId:'b',name:'B',value:null}],accounts);
 assert.deepEqual(t.pf,{value:0,count:1,missing:0});assert.deepEqual(t.pj,{value:0,count:1,missing:1});assert.equal(t.total.count,2);assert.equal(t.total.missing,1);assert.equal(t.banks.length,1);
 for(const value of [NaN,Infinity,1.5])assert.equal(accountBalanceTotals([{accountId:'a',name:'A',value}],accounts).total.missing,1);
 assert.deepEqual(accountBalanceTotals([],accounts).total,{value:0,count:0,missing:0});
});
test('totais usam classificação atual mesmo com nome histórico e preservam conta antiga ausente do cadastro',()=>{
 const t=accountBalanceTotals([{accountId:'old',name:'Nome antigo',value:900},{accountId:'missing',name:'Mercado Pago antigo',value:100}], [{id:'old',name:'Conta nova',bank:'Banco novo',ownership:'PJ'}]);
 assert.equal(t.pj.value,900);assert.equal(t.pf.value,100);assert.equal(t.banks.find(b=>b.key==='banco novo')!.total.value,900);assert.equal(t.banks.find(b=>b.key==='mercado pago')!.total.value,100);
});
