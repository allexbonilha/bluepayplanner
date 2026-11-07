'use client';
import {useEffect,useRef,useState} from 'react';
import {appRouteHash,readAppRoute,type AppRoute} from '../lib/app-route';
export function useAppNavigation(initial:AppRoute,{dirty,busy,onDiscard}:{dirty:boolean;busy:boolean;onDiscard:()=>void}){
 const [route,setRoute]=useState(initial),[historyRevision,setHistoryRevision]=useState(0),[ready,setReady]=useState(false);
 const current=useRef({route:initial,index:0}),guard=useRef({dirty,busy,onDiscard}),restoring=useRef(false);
 guard.current={dirty,busy,onDiscard};
 useEffect(()=>{const restored=readAppRoute(window.location.hash,initial);const index=Number.isSafeInteger(window.history.state?.saldoIndex)?window.history.state.saldoIndex:0;current.current={route:restored,index};window.history.replaceState({...window.history.state,saldoIndex:index},'',appRouteHash(restored));setRoute(restored);setReady(true);
 const pop=(event:PopStateEvent)=>{if(restoring.current){restoring.current=false;return;}const target=typeof event.state?.saldoIndex==='number'?event.state.saldoIndex:null;const g=guard.current;
 if(g.busy||(g.dirty&&!window.confirm('Há alterações não salvas. Descartar e voltar para a outra tela?'))){if(target!==null&&target!==current.current.index){restoring.current=true;window.history.go(current.current.index-target);}else window.history.pushState({...window.history.state,saldoIndex:current.current.index},'',appRouteHash(current.current.route));return;}
 if(g.dirty)g.onDiscard();const next=readAppRoute(window.location.hash,initial);current.current={route:next,index:target??0};setRoute(next);setHistoryRevision(v=>v+1);
 };window.addEventListener('popstate',pop);return()=>window.removeEventListener('popstate',pop);},[]);
 useEffect(()=>{if(!ready)return;const hash=appRouteHash(route);if(hash!==window.location.hash){const index=current.current.index+1;window.history.pushState({...window.history.state,saldoIndex:index},'',hash);current.current={route,index};}else current.current.route=route;},[route,ready]);
 return {route,setRoute,historyRevision,ready};
}
