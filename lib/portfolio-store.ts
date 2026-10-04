import {initialState,type PortfolioState} from './finance.ts';
export type Query=(sql:string,args?:unknown[])=>Promise<{rows:any[];rowCount:number|null}>;
export class ConflictError extends Error {}
export function createPortfolioStore(query:Query){
 return {async read(userId:string){
 if(!userId)throw new Error('Authenticated user required');
 await query('CREATE TABLE IF NOT EXISTS portfolios (id TEXT PRIMARY KEY, data JSONB NOT NULL, revision INTEGER NOT NULL DEFAULT 0, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())');
 const empty=initialState();if(userId!=='owner')empty.accounts=[];
 await query('INSERT INTO portfolios (id,data) VALUES ($1,$2::jsonb) ON CONFLICT (id) DO NOTHING',[userId,JSON.stringify(empty)]);
 const result=await query('SELECT data,revision FROM portfolios WHERE id=$1',[userId]);const row=result.rows[0];if(!row)throw new Error('Portfolio unavailable');return {state:row.data as PortfolioState,revision:row.revision as number};
 },async write(state:PortfolioState,revision:number,userId:string){if(!userId)throw new Error('Authenticated user required');const result=await query('UPDATE portfolios SET data=$1::jsonb,revision=revision+1,updated_at=NOW() WHERE id=$3 AND revision=$2',[JSON.stringify(state),revision,userId]);if(result.rowCount!==1)throw new ConflictError('Concurrent update');return revision+1;}};
}
