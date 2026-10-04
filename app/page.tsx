import Portfolio from '@/components/portfolio-shell';
import {cookies} from 'next/headers';
import {redirect} from 'next/navigation';
import {cookieName} from '@/lib/security';
import {validSession} from '@/lib/auth';
export const dynamic='force-dynamic';
export default async function Home(){if(!await validSession((await cookies()).get(cookieName())?.value||null))redirect('/login');return <Portfolio/>;}
