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
