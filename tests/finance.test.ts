import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cashTotal, calculateTotals, compareTotals, parseMoney, applyOperation, initialState, exportCsv } from '../lib/finance.ts';
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
