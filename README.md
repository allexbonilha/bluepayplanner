# BluePay Planner / Saldo
Acompanhamento mensal de patrimônio, investimentos e fluxo consolidado. Next.js + PostgreSQL, preparado para EasyPanel.

## EasyPanel
Projeto: bluepayplanner. Serviços: app e db (PostgreSQL 17).
Fonte GitHub: allexbonilha/bluepayplanner, branch main, Build Path /. Builder Dockerfile, caminho Dockerfile. Porta interna 3000.
Configure DATABASE_URL com a conexão interna do serviço db. Não exponha a porta do banco. Os dados residem no volume persistente do PostgreSQL e sobrevivem a redeploys.
Configure APP_ORIGIN com a URL HTTPS pública (sem caminho) para validar salvamentos atrás do proxy.
Configure APP_USERNAME e APP_PASSWORD (mínimo 16 caracteres) na aba Environment. Sem essas duas variáveis o app bloqueia todo o acesso com HTTP 503, exceto /api/health (que verifica a conexão com o banco, sem retornar dados). Com elas, o navegador solicita autenticação HTTP; a interface financeira continua sem tela de login. Use somente HTTPS. Não coloque credenciais no repositório.
Ative Enable Auto Deploy no Overview: pushes em main acionam builds no EasyPanel. Dockerfile executa os testes antes do build. Não há agendamento ou agente executando mudanças por conta própria.

## Dados existentes
A versão Sites original permanece intacta. Seu banco D1 não acompanha o GitHub. Exporte Cópia completa JSON no Saldo original e mantenha um backup. A transferência deve ser feita somente depois de validar a proteção do novo endereço. Não envie backups financeiros ao repositório público.

## Local
npm ci
npm test
npm run build
Copie .env.example para .env.local e preencha suas variáveis localmente antes de npm run dev.

## Segurança e backup
API usa consultas parametrizadas e comparação de revisão para impedir que duas abas sobrescrevam alterações. Registros históricos e campos opcionais são preservados. Configure backups do serviço db para um destino de armazenamento seu e teste a recuperação. A cópia JSON no app continua disponível.
