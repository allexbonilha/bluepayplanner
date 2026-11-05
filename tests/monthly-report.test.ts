import test from 'node:test';
import assert from 'node:assert/strict';
import {monthlyReport} from '../lib/monthly-report.ts';
import type {Account,Closing,Entry,PortfolioState} from '../lib/finance.ts';

const accounts:Account[]=[
 {id:'personal',name:'Conta pessoal',categoryId:'bank',type:'balance',archived:false,ownership:'PF',bank:'Nubank'},
 {id:'business',name:'Conta empresa',categoryId:'bank',type:'balance',archived:false,ownership:'PJ',bank:'Nubank'},
 {id:'investment',name:'Reserva',categoryId:'invest',type:'investment',archived:false,ownership:'PF',bank:'Inter'},
];
const entry=(id:string,value:number|null,extra:Partial<Entry>={}):Entry=>({accountId:id,name:accounts.find(a=>a.id===id)?.name??id,categoryId:'bank',categoryName:'Contas',categoryColor:'#2184d8',type:'balance',value,base:null,counts:{},extra:0,mode:'direct',deposit:0,withdrawal:0,...extra});
const closing=(month:string,entries:Entry[],status:Closing['status']='closed'):Closing=>({month,entries,status,note:'Nota global do fechamento',updatedAt:month+'-28T18:40:00Z',flow:{income:20000,expense:9000}});
const state=(closings:Closing[]):PortfolioState=>({accounts:structuredClone(accounts.filter(a=>closings.some(c=>c.entries.some(e=>e.accountId===a.id)))),categories:[],closings});
const all={ownership:'all',bank:null} as const;

test('report totals combine bank and ownership filters without attributing other scopes to zero',()=>{
 const source=state([closing('2025-04',[entry('personal',12000),entry('business',5000),entry('investment',3000,{type:'investment',base:2500})])]);
 const full=monthlyReport(source,'2025-04',all)!;
 assert.equal(full.balances.total,20000);
 assert.equal(full.balances.pf,15000);
 assert.equal(full.balances.pj,5000);
 assert.deepEqual(full.balances.banks.map(b=>[b.name,b.total,b.pf,b.pj]),[['Inter',3000,3000,null],['Nubank',17000,12000,5000]]);
 const filtered=monthlyReport(source,'2025-04',{ownership:'PF',bank:'nubank'})!;
 assert.equal(filtered.balances.total,12000);
 assert.equal(filtered.balances.pf,12000);
 assert.equal(filtered.balances.pj,null);
 assert.deepEqual(filtered.closing.entries.map(e=>e.accountId),['personal']);
});

test('a draft compares to the latest earlier closed month in unsorted records',()=>{
 const source=state([closing('2025-05',[entry('personal',9000)]),closing('2025-04',[entry('personal',6000)],'draft'),closing('2025-01',[entry('personal',1000)]),closing('2025-03',[entry('personal',4000)]),closing('2025-02',[entry('personal',99999)],'draft')]);
 const report=monthlyReport(source,'2025-04',all)!;
 assert.equal(report.closing.status,'draft');
 assert.equal(report.previous?.month,'2025-03');
 assert.equal(report.comparison.difference,2000);
 assert.equal(report.comparison.percent,50);
 assert.equal(report.comparisonMonths,1);
 assert.equal(report.hasGap,false);
});

test('comparison describes actual calendar distance across missing or draft months',()=>{
 const report=monthlyReport(state([closing('2025-01',[entry('personal',1000)]),closing('2025-02',[entry('personal',1500)],'draft'),closing('2025-04',[entry('personal',4000)])]),'2025-04',all)!;
 assert.equal(report.comparisonMonths,3);
 assert.equal(report.hasGap,true);
 assert.equal(report.comparison.difference,3000);
});

test('missing balances make totals and comparisons unavailable while preserving valid breakdowns',()=>{
 const report=monthlyReport(state([closing('2025-03',[entry('personal',1000),entry('business',2000)]),closing('2025-04',[entry('personal',null),entry('business',2500)],'draft')]),'2025-04',all)!;
 assert.equal(report.balances.total,null);
 assert.equal(report.balances.pf,null);
 assert.equal(report.balances.pj,2500);
 assert.deepEqual(report.comparison,{difference:null,percent:null});
 assert.deepEqual(report.pending.balances.map(e=>e.accountId),['personal']);
 assert.equal(report.movements.comparableCount,1);
 assert.deepEqual(report.movements.down,[]);
});

test('missing and absent scopes do not fabricate a loss or an investment result',()=>{
 const source=state([closing('2025-03',[entry('investment',5000,{type:'investment',base:4000})]),closing('2025-04',[entry('personal',6000)])]);
 const report=monthlyReport(source,'2025-04',{ownership:'PF',bank:'inter'})!;
 assert.equal(report.balances.total,null);
 assert.equal(report.previousTotal,5000);
 assert.deepEqual(report.comparison,{difference:null,percent:null});
 assert.equal(report.investments.result,null);
 assert.equal(report.investments.knownResult,null);
 assert.equal(report.investments.count,0);
 assert.deepEqual(report.movements.down,[]);
 assert.equal(report.movements.absentCount,1);
 assert.equal(monthlyReport(source,'2025-02',all),null);
});

test('zero and negative balances remain real values and compare with absolute prior base',()=>{
 const source=state([closing('2025-02',[entry('personal',-1000)]),closing('2025-03',[entry('personal',0)]),closing('2025-04',[entry('personal',-500)])]);
 assert.deepEqual(monthlyReport(source,'2025-03',all)!.comparison,{difference:1000,percent:100});
 const report=monthlyReport(source,'2025-04',all)!;
 assert.equal(report.previousTotal,0);
 assert.equal(report.balances.total,-500);
 assert.deepEqual(report.comparison,{difference:-500,percent:null});
});

test('investment results preserve reported or accumulated values and mark incomplete results',()=>{
 const report=monthlyReport(state([closing('2025-04',[
  entry('investment',5000,{type:'investment',base:4000}),
  entry('reported',2000,{type:'investment',investmentMode:'result',reportedGain:-300}),
  entry('unknown',1000,{type:'investment',base:null}),
 ],'draft')]),'2025-04',all)!;
 assert.equal(report.investments.count,3);
 assert.equal(report.investments.result,null);
 assert.equal(report.investments.knownResult,700);
 assert.equal(report.investments.knownCapital,4000);
 assert.equal(report.investments.unknownCapitalCount,2);
 assert.equal(report.investments.complete,false);
 assert.deepEqual(report.pending.investmentResults.map(e=>e.accountId),['unknown']);
});

test('complete zero investment result is available without treating unknown capital as pending result',()=>{
 const report=monthlyReport(state([closing('2025-04',[entry('investment',5000,{type:'investment',investmentMode:'result',reportedGain:0})])]),'2025-04',all)!;
 assert.equal(report.investments.result,0);
 assert.equal(report.investments.complete,true);
 assert.equal(report.investments.unknownCapitalCount,1);
 assert.deepEqual(report.pending.investmentResults,[]);
});

test('filtered report omits global flow and notes including previous closing',()=>{
 const source=state([closing('2025-03',[entry('personal',1000)]),closing('2025-04',[entry('personal',2000)])]);
 const unfiltered=monthlyReport(source,'2025-04',all)!;
 assert.deepEqual(unfiltered.global,{flow:{income:20000,expense:9000,net:11000},note:'Nota global do fechamento'});
 for(const filter of [{ownership:'PF',bank:null},{ownership:'all',bank:'nubank'}] as const){
  const report=monthlyReport(source,'2025-04',filter)!;
  assert.equal(report.global,null);
  assert.equal(report.closing.flow,undefined);
  assert.equal(report.closing.note,'');
  assert.equal(report.previous?.flow,undefined);
  assert.equal(report.previous?.note,'');
 }
});

test('report preserves original data, ordering and source timestamp',()=>{
 const source=state([closing('2025-04',[entry('personal',2000)],'draft'),closing('2025-01',[entry('personal',1000)])]);
 const copy=structuredClone(source);
 const report=monthlyReport(source,'2025-04',all)!;
 assert.equal(report.closing.updatedAt,'2025-04-28T18:40:00Z');
 assert.deepEqual(source,copy);
 assert.equal(report.previous?.month,'2025-01');
});

test('a draft includes active accounts missing from its saved rows as pending without rewriting historical closings',()=>{
 const source=state([closing('2025-03',[entry('personal',1000)]),closing('2025-04',[entry('personal',2000)],'draft')]);
 source.accounts.push(accounts[1],{...accounts[2],archived:true});
 const draft=monthlyReport(source,'2025-04',all)!;
 assert.deepEqual(draft.pending.unrecordedAccounts.map(a=>a.id),['business']);
 assert.equal(draft.balances.total,null);
 assert.equal(draft.balances.pf,2000);
 assert.equal(draft.balances.pj,null);
 assert.deepEqual(draft.comparison,{difference:null,percent:null});
 assert.equal(draft.closing.entries.length,1);
 const historical=monthlyReport(source,'2025-03',all)!;
 assert.equal(historical.balances.total,1000);
 assert.deepEqual(historical.pending.unrecordedAccounts,[]);
});

test('an investment absent from a draft prevents its investment result from looking complete',()=>{
 const source=state([closing('2025-04',[entry('reported',1000,{type:'investment',investmentMode:'result',reportedGain:100})],'draft')]);
 source.accounts.push(accounts[2]);
 const report=monthlyReport(source,'2025-04',all)!;
 assert.equal(report.investments.complete,false);
 assert.equal(report.investments.result,null);
 assert.equal(report.investments.knownResult,100);
 assert.equal(report.investments.count,2);
});
