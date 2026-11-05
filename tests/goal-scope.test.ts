import {test} from 'node:test';
import assert from 'node:assert/strict';
import {applyOperation,goalProgress,goalForecast,type Goal,type PortfolioState} from '../lib/finance.ts';

const goal:Goal={id:'g',name:'Reserva',target:90000,accountId:null,deadline:'2025-09'};
function history():PortfolioState{
 const s:PortfolioState={categories:[{id:'bank',name:'Contas',color:'#2184d8'}],accounts:[
  {id:'personal',name:'Pessoal',categoryId:'bank',type:'balance',archived:false,ownership:'PF',bank:'Nubank'},
  {id:'business',name:'Empresa',categoryId:'bank',type:'balance',archived:false,ownership:'PJ',bank:'Nubank'},
  {id:'other',name:'Outra',categoryId:'bank',type:'balance',archived:false,ownership:'PF',bank:'Itaú'},
  {id:'cash',name:'Carteira',categoryId:'bank',type:'cash',archived:false,bank:''},
 ],closings:[]};
 return ([['2025-01',[10000,20000,30000,500]],['2025-03',[30000,50000,100000,0]]] as const).reduce((state,[month,values])=>applyOperation(state,{op:'saveMonth',month,status:'closed',entries:state.accounts.map((a,i)=>({accountId:a.id,value:values[i]}))}),s);
}

test('progress combines ownership and bank without including other balances',()=>{
 const s=history(),before=structuredClone(s);
 for(const [scope,value] of [[{ownership:'PF'},130000],[{ownership:'PJ'},50000],[{bank:'nubank'},80000],[{ownership:'PF',bank:'nubank'},30000],[{ownership:'PJ',bank:'nubank'},50000],[{bank:''},0]] as const){
  assert.equal(goalProgress(s,{...goal,...scope}).value,value);
 }
 assert.deepEqual(goalProgress(s,{...goal,ownership:'PF',bank:'nubank'}),{value:30000,month:'2025-03',percent:33.33333333333333,remaining:60000,monthsLeft:6,monthlyNeeded:10000});
 assert.deepEqual(s,before);
});

test('forecast uses only scoped closed samples and actual calendar intervals',()=>{
 const s=history();s.closings.reverse();s.closings.unshift({...structuredClone(s.closings[0]),month:'2025-04',status:'draft'});
 const before=structuredClone(s),g={...goal,ownership:'PF' as const,bank:'nubank'};
 assert.deepEqual(goalForecast(s,g),{averageMonthlyIncrease:10000,monthsToGoal:6,estimatedMonth:'2025-09',sampleCount:2,elapsedMonths:2,fromMonth:'2025-01',toMonth:'2025-03'});
 assert.equal(goalProgress(s,g).month,'2025-03');assert.deepEqual(s,before);
});

test('legacy total and account goals keep their meaning including archived accounts',()=>{
 const s=history();s.accounts[0].archived=true;
 assert.equal(goalProgress(s,goal).value,180000);
 assert.equal(goalProgress(s,{...goal,accountId:'personal'}).value,30000);
 assert.equal(goalForecast(s,{...goal,accountId:'personal'}).averageMonthlyIncrease,10000);
 const saved=applyOperation(s,{op:'goal',name:'Arquivada',target:90000,accountId:'personal',deadline:null});
 assert.equal(saved.goals![0].accountId,'personal');
});

test('scoped goals follow current account classification without rewriting snapshots',()=>{
 const s=history(),before=structuredClone(s.closings);s.accounts[0].ownership='PJ';s.accounts[0].bank='Itaú';
 assert.equal(goalProgress(s,{...goal,ownership:'PF',bank:'nubank'}).value,null);
 const g={...goal,ownership:'PJ' as const,bank:'itau'};
 assert.equal(goalProgress(s,g).value,30000);assert.equal(goalForecast(s,g).averageMonthlyIncrease,10000);
 assert.deepEqual(s.closings,before);
});

test('empty scopes and missing latest balances stay unavailable instead of zero or reached',()=>{
 for(const variant of ['unknown','empty','missing'] as const){
  const s=history(),g={...goal,ownership:'PF' as const,bank:variant==='unknown'?'missing':'nubank'};
  if(variant==='empty')s.closings[1].entries=s.closings[1].entries.filter(e=>e.accountId!=='personal');
  if(variant==='missing')s.closings[1].entries[0].value=null;
  const p=goalProgress(s,g);assert.equal(p.value,null);assert.equal(p.percent,null);assert.equal(p.remaining,null);assert.equal(p.monthlyNeeded,null);
  assert.equal(goalForecast(s,g).estimatedMonth,null);
 }
 const s=history();s.closings[1].entries=[];assert.equal(goalProgress(s,goal).value,null);
});

test('scoped negative and zero balances are valid and do not produce false achievement',()=>{
 const s=history(),g={...goal,ownership:'PF' as const,bank:'nubank'};
 s.closings[0].entries[0].value=-30000;s.closings[1].entries[0].value=-10000;
 assert.equal(goalProgress(s,g).value,-10000);assert.equal(goalProgress(s,g).remaining,100000);assert.equal(goalProgress(s,g).percent,0);
 assert.equal(goalForecast(s,g).estimatedMonth,'2026-01');
 s.closings[0].entries[0].value=0;s.closings[1].entries[0].value=0;
 assert.equal(goalProgress(s,g).value,0);assert.equal(goalProgress(s,g).remaining,90000);
 assert.equal(goalForecast(s,g).averageMonthlyIncrease,0);assert.equal(goalForecast(s,g).estimatedMonth,null);
});

test('goal operation normalizes bank keys and preserves omitted scope metadata on edits',()=>{
 const s=history(),saved=applyOperation(s,{op:'goal',name:'Empresa',target:90000,accountId:null,ownership:'PJ',bank:'  ITAÚ  ',deadline:null}),g=saved.goals![0];
 assert.equal(g.ownership,'PJ');assert.equal(g.bank,'itau');assert.deepEqual(saved.closings,s.closings);assert.equal(s.goals,undefined);
 const edited=applyOperation(saved,{op:'goal',id:g.id,name:'Nome novo',target:100000,accountId:null,deadline:'2026-01'});
 assert.equal(edited.goals![0].ownership,'PJ');assert.equal(edited.goals![0].bank,'itau');
 const ownershipReset=applyOperation(edited,{op:'goal',...edited.goals![0],ownership:'all'});
 assert.equal(ownershipReset.goals![0].bank,'itau');
 const reset=applyOperation(edited,{op:'goal',...edited.goals![0],ownership:'all',bank:null});
 assert.equal(reset.goals![0].ownership,'all');assert.equal(reset.goals![0].bank,null);assert.equal(goalProgress(reset,reset.goals![0]).value,180000);
 assert.equal(applyOperation(s,{op:'goal',name:'Dinheiro',target:100,bank:'   '}).goals![0].bank,'');
});

test('goal operation validates scope types and rejects combining account with filters',()=>{
 const s=history(),base={op:'goal',name:'Meta',target:90000,accountId:null,deadline:null};
 for(const patch of [{ownership:'pf'},{ownership:null},{ownership:3},{bank:5},{bank:{}},{bank:'x'.repeat(81)},{accountId:'personal',ownership:'PF'},{accountId:'personal',bank:'nubank'},{accountId:'personal',bank:''}]){
  assert.throws(()=>applyOperation(s,{...base,...patch}));
 }
 const saved=applyOperation(s,{...base,ownership:'PJ',bank:'nubank'}),g=saved.goals![0];
 assert.throws(()=>applyOperation(saved,{...base,id:g.id,accountId:'personal'}));
 const reset=applyOperation(saved,{...base,id:g.id,accountId:'personal',ownership:'all',bank:null});assert.equal(reset.goals![0].accountId,'personal');
});
