import type {PortfolioState,Entry,Closing} from './finance.ts';
import {accountBank,accountOwnership,organizationKey} from './account-organization.ts';
export type WealthFilter={ownership:'all'|'PF'|'PJ';bank:string|null};
export const allWealth:WealthFilter={ownership:'all',bank:null};
export function wealthScopeLabel(state:PortfolioState,filter:WealthFilter){return (filter.ownership==='all'?'PF + PJ':filter.ownership)+' · '+(filter.bank===null?'Todos os bancos':bankChoices(state).find(b=>b.key===filter.bank)?.name??'Banco sem registros');}
export function bankChoices(state:PortfolioState){
 const banks=new Map<string,string>();
 const identities=new Map(state.accounts.map(a=>[a.id,a]));
 for(const a of [...state.accounts,...state.closings.flatMap(c=>c.entries.map(e=>identities.get(e.accountId)??e))])banks.set(organizationKey(a),accountBank(a)||'Sem banco / dinheiro físico');
 return [...banks].map(([key,name])=>({key,name})).sort((a,b)=>!a.key&&b.key?1:a.key&&!b.key?-1:a.key.localeCompare(b.key,'pt-BR'));
}
export function filterWealth(state:PortfolioState,filter:WealthFilter):PortfolioState{
 const identities=new Map(state.accounts.map(a=>[a.id,a]));
 const matches=(a:{name:string;bank?:string;ownership?:'PF'|'PJ'})=>(filter.ownership==='all'||accountOwnership(a)===filter.ownership)&&(filter.bank===null||organizationKey(a)===filter.bank);
 return {...state,accounts:state.accounts.filter(matches),closings:state.closings.map(c=>({...c,entries:c.entries.filter(e=>matches(identities.get(e.accountId)??e))}))};
}
export function completeWealthTotal(entries:readonly Pick<Entry,'value'>[]){return entries.length&&entries.every(e=>e.value!==null&&Number.isSafeInteger(e.value))?entries.reduce((sum,e)=>sum+e.value!,0):null;}
export function wealthSeries(closings:readonly Closing[]){
 const sorted=closings.filter(c=>c.status==='closed').slice().sort((a,b)=>a.month.localeCompare(b.month));
 const first=sorted[0],last=sorted.at(-1);if(!first||!last)return [];
 const index=(m:string)=>{const [y,mm]=m.split('-').map(Number);return y*12+mm-1;};
 const byMonth=new Map(sorted.map(c=>[c.month,c]));
 const series:{month:string;value:number|null}[]=[];
 for(let i=index(first.month);i<=index(last.month)&&series.length<3600;i++){const month=String(Math.floor(i/12)).padStart(4,'0')+'-'+String(i%12+1).padStart(2,'0'),closing=byMonth.get(month);series.push({month,value:closing?completeWealthTotal(closing.entries):null});}
 return series;
}
export function wealthMovements(before:readonly Entry[],after:readonly Entry[]){
 const old=new Map(before.map(e=>[e.accountId,e])),now=new Map(after.map(e=>[e.accountId,e]));
 const comparable=after.flatMap(e=>{const prev=old.get(e.accountId);return prev?.value!=null&&e.value!=null?[{id:e.accountId,name:e.name,delta:e.value-prev.value}]:[];});
 return {up:comparable.filter(e=>e.delta>0).sort((a,b)=>b.delta-a.delta).slice(0,3),down:comparable.filter(e=>e.delta<0).sort((a,b)=>a.delta-b.delta).slice(0,3),newCount:after.filter(e=>!old.has(e.accountId)).length,absentCount:before.filter(e=>!now.has(e.accountId)).length,comparableCount:comparable.length};
}
