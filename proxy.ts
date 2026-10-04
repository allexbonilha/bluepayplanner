import {randomBytes} from 'node:crypto';
import {NextResponse,type NextRequest} from 'next/server';
export function proxy(request:NextRequest){
 const nonce=randomBytes(16).toString('base64');
 const csp=`default-src 'self'; script-src 'self' 'nonce-${nonce}'${process.env.NODE_ENV==='production'?" 'strict-dynamic'":" 'unsafe-eval'"}; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'`;
 const headers=new Headers(request.headers);headers.set('Content-Security-Policy',csp);headers.set('x-nonce',nonce);
 const response=NextResponse.next({request:{headers}});response.headers.set('Content-Security-Policy',csp);
 response.headers.set('X-Content-Type-Options','nosniff');response.headers.set('X-Frame-Options','DENY');response.headers.set('Referrer-Policy','no-referrer');response.headers.set('Permissions-Policy','camera=(), microphone=(), geolocation=()');response.headers.set('Cache-Control','no-store, max-age=0');
 if(process.env.NODE_ENV==='production')response.headers.set('Strict-Transport-Security','max-age=31536000');return response;
}
export const config={matcher:['/((?!_next/static|_next/image|favicon.ico).*)']};
