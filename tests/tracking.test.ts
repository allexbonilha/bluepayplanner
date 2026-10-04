import {test} from 'node:test';
import assert from 'node:assert/strict';
import {initialState,applyOperation,goalProgress,recordHealth,type Goal} from '../lib/finance.ts';
const goal:Goal={id:'g',name:'Reserva',target:100000,accountId:null,deadline:'2025-06'};
function history(){let s=initialState();for(const month of ['2025-01','2025-03'])s=applyOperation(s,{op:'saveMonth',month,status:'closed',entries:s.accounts.map(a=>({accountId:a.id,value:10000,base:a.type==='investment'?9000:null}))});return s;}
test('metas persistem com validação de valores e escopo sem alterar fechamentos',()=>{
 const s=history(),n=applyOperation(s,{op:'goal',name:'Reserva',target:100000,accountId:null,deadline:'2025-06'});
 assert.equal(n.goals?.length,1);assert.deepEqual(n.closings,s.closings);assert.equal(s.goals,undefined);
 const id=n.goals![0].id;assert.equal(applyOperation(n,{op:'goal',id,name:'Novo alvo',target:120000,accountId:'wallet',deadline:null}).goals![0].target,120000);
 assert.equal(applyOperation(n,{op:'deleteGoal',id}).goals!.length,0);
 for(const patch of [{target:0},{target:-1},{target:1.5},{accountId:'missing'},{deadline:'2025-13'}])assert.throws(()=>applyOperation(s,{op:'goal',name:'Meta',target:100000,accountId:null,deadline:null,...patch}));
});
test('progresso usa último mês concluído e ritmo em meses inteiros sem estimar rendimento',()=>{
 const s=history();assert.deepEqual(goalProgress(s,goal),{value:60000,month:'2025-03',percent:60,remaining:40000,monthsLeft:3,monthlyNeeded:13334});
 s.closings.push({...s.closings[1],month:'2025-04',status:'draft'});assert.equal(goalProgress(s,goal).month,'2025-03');
 assert.equal(goalProgress(s,{...goal,accountId:'wallet'}).value,10000);
 assert.equal(goalProgress(s,{...goal,accountId:'missing'}).value,null);
 assert.equal(goalProgress(s,{...goal,deadline:'2025-02'}).monthlyNeeded,null);
 assert.equal(goalProgress(initialState(),goal).percent,null);
 s.closings.find(c=>c.month==='2025-03')!.entries[0].value=null;assert.equal(goalProgress(s,goal).value,null);
});
test('conferência identifica lacunas e rascunhos sem exigir contas atuais em snapshots antigos',()=>{
 const s=history();s.accounts.push({id:'new',name:'Nova',type:'balance',categoryId:'bank',archived:false});
 s.closings.push({month:'2025-04',status:'draft',entries:[],note:'',updatedAt:''});
 const h=recordHealth(s,'2025-04');assert.deepEqual(h.missingMonths,['2025-02']);assert.equal(h.drafts.length,1);assert.equal(h.closedCount,2);assert.equal(h.incompleteEntries.length,0);
 s.closings[0].entries[0].value=null;assert.equal(recordHealth(s,'2025-04').incompleteEntries.length,1);
});
