import {compareTotals,investmentResult,investmentSummary,monthDistance,monthlyFlow,type Closing,type PortfolioState} from './finance.ts';
import {accountBalanceTotals,type BalanceBucket} from './account-organization.ts';
import {completeWealthTotal,filterWealth,wealthMovements,wealthScopeLabel,type WealthFilter} from './wealth-scope.ts';

export function monthlyReport(state:PortfolioState,month:string,filter:WealthFilter){
 const scoped=filterWealth(state,filter),selected=scoped.closings.find(c=>c.month===month);
 if(!selected)return null;
 const filtered=filter.ownership!=='all'||filter.bank!==null;
 const visibleClosing=(c:Closing):Closing=>filtered?{...c,note:'',flow:undefined}:c;
 const closing=visibleClosing(selected);
 const previousSaved=scoped.closings.filter(c=>c.status==='closed'&&c.month<month).sort((a,b)=>b.month.localeCompare(a.month))[0];
 const previous=previousSaved?visibleClosing(previousSaved):undefined;
 const recordedIds=new Set(closing.entries.map(e=>e.accountId));
 const unrecordedAccounts=closing.status==='draft'?scoped.accounts.filter(a=>!a.archived&&!recordedIds.has(a.id)):[];
 const balanceEntries=[...closing.entries,...unrecordedAccounts.map(a=>({accountId:a.id,name:a.name,value:null}))];
 const buckets=accountBalanceTotals(balanceEntries,scoped.accounts);
 const complete=(bucket:BalanceBucket)=>bucket.count>0&&bucket.missing===0?bucket.value:null;
 const balances={total:complete(buckets.total),pf:complete(buckets.pf),pj:complete(buckets.pj),banks:buckets.banks.map(bank=>({key:bank.key,name:bank.name,total:complete(bank.total),pf:complete(bank.pf),pj:complete(bank.pj)}))};
 const previousTotal=previous?completeWealthTotal(previous.entries):null;
 const comparison=balances.total===null?{difference:null,percent:null}:compareTotals(balances.total,previousTotal);
 const comparisonMonths=previous?monthDistance(previous.month,month):null;
 const investments=closing.entries.filter(e=>e.type==='investment');
 const resultValues=investments.map(investmentResult).filter((value):value is number=>value!==null);
 const knownResult=resultValues.length?resultValues.reduce((sum,value)=>sum+value,0):null;
 const summary=investmentSummary(investments);
 const unrecordedInvestments=unrecordedAccounts.filter(a=>a.type==='investment').length;
 const investmentComplete=summary.complete&&unrecordedInvestments===0;
 return {
  closing,previous,accounts:scoped.accounts,balanceEntries,scopeLabel:wealthScopeLabel(state,filter),filtered,
  balances,previousTotal,comparison,comparisonMonths,hasGap:comparisonMonths!==null&&comparisonMonths>1,
  investments:{count:investments.length+unrecordedInvestments,result:investmentComplete?knownResult:null,knownResult,complete:investmentComplete,knownCapital:summary.knownCapital,unknownCapitalCount:summary.unknownCapitalCount+unrecordedInvestments},
  pending:{balances:closing.entries.filter(e=>e.value===null||!Number.isSafeInteger(e.value)),investmentResults:investments.filter(e=>investmentResult(e)===null),unrecordedAccounts},
  movements:wealthMovements(previous?.entries??[],closing.entries),
  global:filtered?null:{flow:monthlyFlow(closing),note:closing.note},
 };
}
