import Portfolio from '@/components/portfolio-shell';
import {cookies} from 'next/headers';
import {redirect} from 'next/navigation';
import {cookieName} from '@/lib/security';
import {sessionUser} from '@/lib/auth';
export const dynamic='force-dynamic';
export default async function Home(){const user=await sessionUser((await cookies()).get(cookieName())?.value||null);if(!user)redirect('/login');return <Portfolio user={user}/>;}
