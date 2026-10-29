import {calculatePrint,type PrintProject} from './printing.ts';
export type CatalogSort='updated'|'name'|'price-asc'|'price-desc';
const searchable=(text:string)=>text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR');
export function catalogItems(projects:readonly PrintProject[],query='',sort:CatalogSort='updated',includeArchived=false){
 const text=searchable(query.trim());
 return projects.filter(p=>(includeArchived||!p.archived)&&searchable([p.input.name,p.input.material,p.input.client].join(' ')).includes(text)).map(project=>({project,value:project.estimate??calculatePrint(project.input)})).sort((a,b)=>sort==='name'?a.project.input.name.localeCompare(b.project.input.name,'pt-BR'):sort==='price-asc'?a.value.unitPrice-b.value.unitPrice:sort==='price-desc'?b.value.unitPrice-a.value.unitPrice:b.project.updatedAt.localeCompare(a.project.updatedAt));
}
