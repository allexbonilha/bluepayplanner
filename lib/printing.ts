export type PrintSettings={printerHourly:number;filamentKg:number;taxPercent:number;feePercent:number;targetPercent:number;pricing:'margin'|'markup';lossPercent:number;laborHourly:number};
export type PrintInput=PrintSettings & {name:string;client:string;notes:string;printer:string;material:string;grams:number;minutes:number;quantity:number;laborMinutes:number;packaging:number;other:number;salePrice:number|null;status:'draft'|'quoted'|'approved'|'done'};
export type PrintProject={id:string;input:PrintInput;estimate:ReturnType<typeof calculatePrint>;archived:boolean;createdAt:string;updatedAt:string};
export const defaultPrintSettings=():PrintSettings=>({printerHourly:0,filamentKg:0,taxPercent:0,feePercent:0,targetPercent:30,pricing:'margin',lossPercent:0,laborHourly:0});
const numeric=(v:unknown,label:string,max:number,integer=false)=>{if(typeof v!=='number'||!Number.isFinite(v)||v<0||v>max||(integer&&!Number.isSafeInteger(v)))throw new Error(label+': informe um número válido e não negativo.');return v;};
const amount=(v:unknown,label:string)=>numeric(v,label,1e10,true);
const text=(v:unknown,label:string,max:number,required=false)=>{if(typeof v!=='string'||v.trim().length>max||(required&&!v.trim())||/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(v))throw new Error(label+': confira o texto informado.');return v.trim();};
export function validatePrintSettings(raw:unknown):PrintSettings{
 if(!raw||typeof raw!=='object')throw new Error('Custos inválidos.');const v=raw as PrintSettings;
 const s={printerHourly:amount(v.printerHourly,'Impressora/hora'),filamentKg:amount(v.filamentKg,'Filamento/kg'),laborHourly:amount(v.laborHourly,'Acabamento/hora'),taxPercent:numeric(v.taxPercent,'Impostos',99.99),feePercent:numeric(v.feePercent,'Taxas',99.99),targetPercent:numeric(v.targetPercent,'Margem ou acréscimo',1000),lossPercent:numeric(v.lossPercent,'Reserva de perdas',100),pricing:v.pricing};
 if(!['margin','markup'].includes(s.pricing))throw new Error('Escolha margem sobre a venda ou acréscimo sobre custo.');
 if(s.taxPercent+s.feePercent+(s.pricing==='margin'?s.targetPercent:0)>=100)throw new Error('Impostos, taxas e margem sobre a venda devem somar menos de 100%.');return s;
}
export function validatePrintInput(raw:unknown):PrintInput{
 const s=validatePrintSettings(raw),v=raw as PrintInput;
 const input={...s,name:text(v.name,'Nome',100),client:text(v.client,'Cliente',150),notes:text(v.notes,'Observações',3000),printer:text(v.printer,'Impressora',100),material:text(v.material,'Material',100),grams:numeric(v.grams,'Peso',1e7),minutes:numeric(v.minutes,'Tempo',1e7),quantity:numeric(v.quantity,'Quantidade',100000,true),laborMinutes:numeric(v.laborMinutes,'Tempo de acabamento',1e7),packaging:amount(v.packaging,'Embalagem'),other:amount(v.other,'Outros custos'),salePrice:v.salePrice===null?null:amount(v.salePrice,'Preço final'),status:v.status};
 if(!input.grams||!input.minutes||!input.quantity)throw new Error('Informe peso, tempo de impressão e quantidade maiores que zero.');
 if(!['draft','quoted','approved','done'].includes(input.status))throw new Error('Status inválido.');return input;
}
export function calculatePrint(raw:PrintInput){
 const v=validatePrintInput(raw),material=Math.round(v.grams*v.filamentKg/1000),machine=Math.round(v.minutes*v.printerHourly/60),production=material+machine,loss=Math.round(production*v.lossPercent/100),labor=Math.round(v.laborMinutes*v.laborHourly/60),cost=production+loss+labor+v.packaging+v.other;
 if(cost>1e12)throw new Error('Custo total fora do limite permitido.');
 const deductions=(price:number)=>{const tax=Math.round(price*v.taxPercent/100),fees=Math.round(price*v.feePercent/100),profit=price-cost-tax-fees;return {tax,fees,profit,marginPercent:price?profit/price*100:0};};
 const required=v.pricing==='margin'?cost/(1-(v.taxPercent+v.feePercent+v.targetPercent)/100):cost*(1+v.targetPercent/100)/(1-(v.taxPercent+v.feePercent)/100);
 let unitPrice=Math.ceil(required/v.quantity),suggestedPrice=unitPrice*v.quantity;
 // Round each deduction as charged in cents, then ensure rounding never erodes the requested target.
 for(let i=0;i<100;i++){const d=deductions(suggestedPrice);const target=v.pricing==='margin'?suggestedPrice*v.targetPercent/100:cost*v.targetPercent/100;if(d.profit+1e-7>=target)break;const denominator=1-(v.taxPercent+v.feePercent+(v.pricing==='margin'?v.targetPercent:0))/100;unitPrice+=Math.max(1,Math.ceil((target-d.profit)/denominator/v.quantity));suggestedPrice=unitPrice*v.quantity;}
 if(!Number.isSafeInteger(suggestedPrice)||suggestedPrice>1e12)throw new Error('Preço fora do limite permitido. Reduza os percentuais ou custos.');
 const price=v.salePrice??suggestedPrice;return {material,machine,production,loss,labor,packaging:v.packaging,other:v.other,cost,unitCost:cost/v.quantity,suggestedPrice,suggestedUnitPrice:unitPrice,price,unitPrice:price/v.quantity,...deductions(price)};
}
export function applyPrintOperation<T extends {printSettings?:PrintSettings;printProjects?:PrintProject[]}>(state:T,op:any):T{
 if(op.op==='printSettings'){state.printSettings=validatePrintSettings(op.settings);return state;}
 const projects=state.printProjects??=[];
 if(op.op==='printArchive'){const p=projects.find(p=>p.id===op.id);if(!p||typeof op.archived!=='boolean')throw new Error('Projeto não encontrado.');p.archived=op.archived;p.updatedAt=new Date().toISOString();return state;}
 if(op.op!=='printProject')throw new Error('Operação 3D inválida.');
 const input=validatePrintInput(op.project);if(!input.name)throw new Error('Dê um nome ao projeto.');const estimate=calculatePrint(input);if(!estimate.cost)throw new Error('Informe ao menos um custo para salvar o projeto.');
 const existing=op.id?projects.find(p=>p.id===op.id):undefined;if(op.id&&!existing)throw new Error('Projeto não encontrado.');
 const now=new Date().toISOString();if(existing){existing.input=input;existing.estimate=estimate;existing.updatedAt=now;}else{if(projects.length>=500)throw new Error('Limite de 500 projetos atingido.');projects.unshift({id:crypto.randomUUID(),input,estimate,archived:false,createdAt:now,updatedAt:now});}return state;
}
