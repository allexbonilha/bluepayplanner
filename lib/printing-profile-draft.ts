import {parseMoney} from './finance.ts';
import {validatePrintProfiles,type CostProfile,type PrintProfiles} from './printing.ts';
export type ProfileDraft=Omit<CostProfile,'cost'> & {cost:string};
export type ProfileDrafts={printers:ProfileDraft[];filaments:ProfileDraft[]};
export class ProfileFieldError extends Error{
 kind:keyof ProfileDrafts;id:string;field:'name'|'cost';
 constructor(message:string,kind:keyof ProfileDrafts,id:string,field:'name'|'cost'){super(message);this.kind=kind;this.id=id;this.field=field;}
}
export function profileFieldId(kind:keyof ProfileDrafts,id:string,field:'name'|'cost'){return 'profile-'+kind+'-'+id+'-'+field;}
export function parseProfileDrafts(drafts:ProfileDrafts):PrintProfiles{
 const list=(kind:keyof ProfileDrafts)=>drafts[kind].flatMap((p,i)=>{
  if(!p.name.trim()&&!p.cost.trim()&&!p.isDefault)return [];
  const label=(kind==='printers'?'Impressora ':'Filamento ')+(i+1);
  if(!p.name.trim()||p.name.trim().length>100||/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(p.name))throw new ProfileFieldError(label+': informe um nome de até 100 caracteres.',kind,p.id,'name');
  let cost:number|null;try{cost=parseMoney(p.cost);}catch{throw new ProfileFieldError(label+': informe o preço em reais, como 89,90.',kind,p.id,'cost');}
  if(cost===null||cost<0||cost>1e10)throw new ProfileFieldError(label+': informe um preço não negativo. Use 0,00 se o custo for zero.',kind,p.id,'cost');
  return [{id:p.id,name:p.name.trim(),cost,isDefault:p.isDefault}];
 });
 return validatePrintProfiles({printers:list('printers'),filaments:list('filaments')});
}
