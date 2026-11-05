'use client';

import {CalendarCheck,ChartNoAxesCombined,FileText,Printer} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {investmentResult,money,monthLabel,type PortfolioState} from '@/lib/finance';
import {accountBank,accountOwnership} from '@/lib/account-organization';
import {monthlyReport} from '@/lib/monthly-report';
import {wealthScopeLabel,type WealthFilter} from '@/lib/wealth-scope';
import AccountTotals from './account-totals';
import WealthMovements from './wealth-movements';

type Props={state:PortfolioState;month:string;filter:WealthFilter;demo?:boolean;onOpen:(month:string)=>void};
const amount=(value:number|null)=>value===null?'—':money(value);
const signed=(value:number|null)=>value===null?'—':`${value>0?'+':''}${money(value)}`;
const tone=(value:number|null)=>value===null||value===0?'':value<0?'negative':'positive';

export default function MonthlyReport({state,month,filter,demo=false,onOpen}:Props){
 const report=monthlyReport(state,month,filter);
 const scopeLabel=report?.scopeLabel??wealthScopeLabel(state,filter);
 const printReport=()=>{
  const previousTitle=document.title;
  document.title=`Saldo · ${demo?'Demonstração · ':''}Relatório mensal · ${month} · ${scopeLabel}`;
  try{window.print();}finally{document.title=previousTitle;}
 };
 if(!report)return <article className="monthly-report-page">
  <section className="panel report-empty">
   <FileText aria-hidden="true" size={34}/>
   <h2>Nenhum registro salvo em {monthLabel(month)}</h2>
   <p>Salve um rascunho ou conclua o fechamento para gerar o relatório deste mês.</p>
   <small>{scopeLabel}</small>
   <Button onClick={()=>onOpen(month)}><CalendarCheck size={17}/> Abrir fechamento</Button>
  </section>
 </article>;

 const {closing,previous,balances,comparison,investments,pending}=report;
 const identities=new Map(state.accounts.map(account=>[account.id,account]));
 const pendingRows=[
  ...closing.entries.flatMap(entry=>{
   const reasons=[];
   if(entry.value===null||!Number.isSafeInteger(entry.value))reasons.push('saldo não informado');
   if(entry.type==='investment'&&investmentResult(entry)===null)reasons.push('resultado do investimento não informado');
   return reasons.length?[{id:entry.accountId,name:entry.name,reason:reasons.join(' · ')}]:[];
  }),
  ...pending.unrecordedAccounts.map(account=>({id:account.id,name:account.name,reason:'conta ativa sem registro neste rascunho'})),
 ];
 const date=new Date(closing.updatedAt);
 const savedAt=Number.isNaN(date.getTime())?'Data de atualização indisponível':date.toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo',dateStyle:'short',timeStyle:'short'});
 const recordedCount=closing.entries.length;

 return <article className="monthly-report-page" aria-label={`Relatório mensal de ${monthLabel(month)}`}>
  {demo&&<p className="report-notice" role="status"><strong>Demonstração — valores fictícios.</strong> Este relatório usa apenas exemplos e não representa seu patrimônio real.</p>}
  <header className="report-header">
   <div className="report-brand"><ChartNoAxesCombined size={26} aria-hidden="true"/><span>saldo<span>.</span></span><small>MEU PATRIMÔNIO MENSAL</small></div>
   <div className="report-heading-row">
    <div><span className="report-eyebrow">RELATÓRIO MENSAL</span><h2>{monthLabel(month)}</h2><p>{scopeLabel}</p></div>
    <span className={`report-status ${closing.status==='draft'?'report-status-draft':''}`}>{closing.status==='draft'?'Preliminar · rascunho':'Fechamento concluído'}</span>
   </div>
   <div className="report-source"><span>{recordedCount} conta(s) com registro salvo no filtro</span><span>{demo?'Exemplo gerado em':'Última gravação'}: <time dateTime={closing.updatedAt}>{savedAt}</time> · Brasília</span></div>
   <div className="report-actions"><Button variant="outline" onClick={()=>onOpen(month)}><CalendarCheck size={17}/> Abrir fechamento</Button><Button onClick={printReport}><Printer size={17}/> Imprimir / salvar PDF</Button></div>
  </header>

  {closing.status==='draft'&&<p className="report-notice" role="status"><strong>Relatório preliminar.</strong> Usa o rascunho salvo. Os valores podem mudar até a conclusão do mês.</p>}
  {!recordedCount&&<p className="report-notice">Nenhuma conta tem saldo registrado para este filtro no mês. Os valores indisponíveis aparecem como “—”.</p>}

  <section className="report-summary" aria-label="Resumo do mês">
   <div className="report-summary-total"><span>Patrimônio do filtro</span><strong>{amount(balances.total)}</strong><small>{balances.total===null?'Total indisponível: faltam registros ou saldos.':'Soma completa dos saldos do mês.'}</small></div>
   <div><span>Variação patrimonial</span><strong className={tone(comparison.difference)}>{signed(comparison.difference)}</strong><small>{previous?`Desde ${monthLabel(previous.month)}`:'Sem fechamento anterior concluído'}{comparison.percent!==null&&` · ${comparison.percent>0?'+':''}${comparison.percent.toLocaleString('pt-BR',{maximumFractionDigits:2})}%`}</small></div>
   <div><span>Resultado dos investimentos</span><strong className={tone(investments.result)}>{amount(investments.result)}</strong><small>{investments.count?`${investments.count} investimento(s) · ${investments.complete?'resultado completo':'resultado pendente'}`:'Nenhum investimento neste filtro'} · acumulado / informado</small></div>
  </section>

  {previous?<p className="report-comparison-note">Comparação com o último fechamento concluído anterior: <strong>{monthLabel(previous.month)}</strong> ({amount(report.previousTotal)}). {report.hasGap&&<><strong>Intervalo de {report.comparisonMonths} meses.</strong> A variação cobre todo esse intervalo. </>}{comparison.difference===null&&'A variação exige saldos completos para o mesmo filtro nas duas datas. '}As mudanças de saldo incluem aportes, retiradas e outras movimentações.</p>:<p className="report-comparison-note">Ainda não há fechamento concluído anterior a este mês para comparação.</p>}

  <AccountTotals entries={report.balanceEntries} accounts={report.accounts} available={report.balanceEntries.length>0} emptyAsUnavailable emptyMessage="Sem contas neste filtro" description="Saldos do mês selecionado. Valores parciais estão sinalizados e somam apenas os saldos informados."/>

  <section className="panel report-accounts">
   <div className="section-heading"><div><h2>Detalhamento das contas</h2><p>Saldos e resultados registrados em {monthLabel(month)}.</p></div></div>
   {recordedCount>0?<div className="report-table-wrap"><table className="report-table">
    <thead><tr><th scope="col">Conta</th><th scope="col">Saldo</th><th scope="col">Capital conhecido</th><th scope="col">Resultado acumulado / informado</th></tr></thead>
    <tbody>{closing.entries.map(entry=>{
     const identity=identities.get(entry.accountId)??entry,result=entry.type==='investment'?investmentResult(entry):null;
     return <tr key={entry.accountId}>
      <th scope="row"><strong>{entry.name}</strong><small>{accountOwnership(identity)} · {accountBank(identity)||'Sem banco / dinheiro físico'}</small><small>{entry.categoryName}{entry.type==='investment'?entry.investmentMode==='result'?' · Resultado informado':' · Capital aplicado':''}</small></th>
      <td data-label="Saldo" className={tone(entry.value)}>{amount(entry.value)}{entry.value===null&&<small>Pendente</small>}</td>
      <td data-label="Capital conhecido">{entry.type==='investment'&&entry.investmentMode!=='result'?amount(entry.base):'—'}</td>
      <td data-label="Resultado acumulado / informado" className={tone(result)}>{amount(result)}{entry.type==='investment'&&result===null&&<small>Pendente</small>}</td>
     </tr>;
    })}</tbody>
   </table></div>:<p className="report-muted">Sem contas registradas neste filtro.</p>}
   <p className="report-caption">O resultado do investimento é acumulado (saldo menos capital aplicado) ou informado no fechamento. Não representa rendimento apenas deste mês. “—” indica valor indisponível ou não aplicável.</p>
   {!investments.complete&&investments.knownResult!==null&&<p className="report-notice">Resultado parcial conhecido: <strong>{money(investments.knownResult)}</strong>. Faltam dados para consolidar todos os investimentos.</p>}
   {investments.unknownCapitalCount>0&&<p className="report-caption">{investments.unknownCapitalCount} investimento(s) sem capital aplicado conhecido. Um resultado informado pode estar completo mesmo sem esse capital.</p>}
  </section>

  <WealthMovements before={previous} after={closing}/>

  <section className="panel report-pending">
   <div className="section-heading"><div><h2>Conferência do relatório</h2><p>{pendingRows.length?`${pendingRows.length} conta(s) com dados pendentes neste filtro.`:'Os registros deste filtro foram conferidos.'}</p></div><span className={`report-status ${pendingRows.length?'report-status-draft':''}`}>{pendingRows.length?'Dados incompletos':recordedCount?'Saldos informados':'Sem registros'}</span></div>
   {pendingRows.length?<ul>{pendingRows.map(row=><li key={row.id}><strong>{row.name}</strong><span>{row.reason}</span></li>)}</ul>:<p className="report-muted">{recordedCount?'Nenhum saldo ou resultado de investimento pendente nos registros selecionados.':'Não há registros neste filtro para conferir.'}</p>}
   {pending.unrecordedAccounts.length>0&&<p className="report-caption">Contas ativas ausentes do rascunho entram como pendências. Fechamentos concluídos preservam a composição registrada na época.</p>}
  </section>

  {report.global?<section className="panel report-global">
   <div className="section-heading"><div><h2>Fluxo de caixa e observações do mês</h2><p>Totais gerais informados no fechamento, para todo o patrimônio.</p></div></div>
   <dl className="report-flow"><div><dt>Receitas</dt><dd>{amount(report.global.flow.income)}</dd></div><div><dt>Despesas</dt><dd>{amount(report.global.flow.expense)}</dd></div><div><dt>Resultado de caixa</dt><dd className={tone(report.global.flow.net)}>{amount(report.global.flow.net)}</dd></div></dl>
   <p className="report-caption">O resultado de caixa é receitas menos despesas; não equivale à variação patrimonial. Valores não informados aparecem como “—”.</p>
   <div className="report-notes"><h3>Observações do fechamento</h3><p>{report.global.note.trim()||'Nenhuma observação registrada.'}</p></div>
  </section>:<p className="report-notice"><strong>Relatório filtrado.</strong> Receitas, despesas e observações gerais do fechamento são exibidas apenas em “PF + PJ · Todos os bancos”, pois não podem ser distribuídas por banco ou titularidade.</p>}

  <footer className="report-footer"><span>Saldo · Relatório mensal de {monthLabel(month)}</span><span>{scopeLabel}</span><p>{demo?'Demonstração — valores fictícios.':'Gerado a partir dos registros salvos.'} A classificação de banco e PF/PJ é a atual de cada conta.</p></footer>
 </article>;
}
