export type Ownership='PF'|'PJ';
export type AccountIdentity={name:string;bank?:string;ownership?:Ownership};
export function accountOwnership(a:AccountIdentity):Ownership{return a.ownership==='PJ'?'PJ':'PF';}
export function accountBank(a:AccountIdentity){
 if(a.bank!==undefined)return a.bank.trim();
 if(/\bnubank\b/i.test(a.name))return 'Nubank';
 if(/\bmercado pago\b/i.test(a.name))return 'Mercado Pago';
 return '';
}
export function organizationKey(a:AccountIdentity,by:'bank'|'ownership'='bank'){return by==='ownership'?accountOwnership(a):accountBank(a).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR');}
export function organizeAccounts<T extends AccountIdentity>(accounts:readonly T[],by:'bank'|'ownership'='bank'){
 return [...accounts].sort((a,b)=>{
  const bankOrder=()=>{const x=organizationKey(a),y=organizationKey(b);return !x&&y?1:x&&!y?-1:x.localeCompare(y,'pt-BR');};
  const typeOrder=()=>accountOwnership(a).localeCompare(accountOwnership(b));
  return (by==='bank'?bankOrder()||typeOrder():typeOrder()||bankOrder())||a.name.localeCompare(b.name,'pt-BR');
 });
}
export type BalanceBucket={value:number;count:number;missing:number};
export type BalanceEntry={accountId:string;name:string;value:number|null};
export function accountBalanceTotals(entries:readonly BalanceEntry[],accounts:readonly (AccountIdentity & {id:string})[]){
 const bucket=():BalanceBucket=>({value:0,count:0,missing:0});
 const total=bucket(),pf=bucket(),pj=bucket(),banks=new Map<string,{key:string;name:string;total:BalanceBucket;pf:BalanceBucket;pj:BalanceBucket}>();
 const identities=new Map(accounts.map(a=>[a.id,a]));
 const add=(b:BalanceBucket,value:number|null)=>{b.count++;if(value===null||!Number.isSafeInteger(value))b.missing++;else b.value+=value;};
 for(const entry of entries){
  const account=identities.get(entry.accountId)??entry,key=organizationKey(account),name=accountBank(account)||'Sem banco / dinheiro físico';
  if(!banks.has(key))banks.set(key,{key,name,total:bucket(),pf:bucket(),pj:bucket()});
  const bank=banks.get(key)!,personal=accountOwnership(account)==='PF';
  add(total,entry.value);add(personal?pf:pj,entry.value);add(bank.total,entry.value);add(personal?bank.pf:bank.pj,entry.value);
 }
 return {total,pf,pj,banks:[...banks.values()].sort((a,b)=>!a.key&&b.key?1:a.key&&!b.key?-1:a.key.localeCompare(b.key,'pt-BR'))};
}
