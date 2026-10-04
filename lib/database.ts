import {Pool} from 'pg';import {createPortfolioStore} from './portfolio-store';
const dbGlobal=globalThis as unknown as {plannerPool?:Pool};
function pool(){if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL is required');return dbGlobal.plannerPool??=new Pool({connectionString:process.env.DATABASE_URL,max:5,connectionTimeoutMillis:5000,idleTimeoutMillis:30000});}
export const portfolioStore=createPortfolioStore((sql,args)=>pool().query(sql,args));
export async function databaseReady(){await pool().query('SELECT 1');}
