# BluePay Planner / Saldo
Acompanhamento mensal de patrimônio, investimentos e fluxo consolidado. Next.js + PostgreSQL, preparado para EasyPanel.

## EasyPanel
Projeto: bluepayplanner. Serviços: app e db (PostgreSQL 17).
Fonte GitHub: allexbonilha/bluepayplanner, branch main, Build Path /. Builder Dockerfile, caminho Dockerfile. Porta interna 3000.
Configure DATABASE_URL com a conexão interna do serviço db. Não exponha a porta do banco. Os dados residem no volume persistente do PostgreSQL e sobrevivem a redeploys.
Configure APP_ORIGIN com a URL HTTPS pública (sem caminho) para validar salvamentos atrás do proxy.
Configure APP_USERNAME e APP_PASSWORD (mínimo 16 caracteres) na aba Environment. A tela /login usa essas credenciais privadas; não há cadastro público. Sem configuração, nenhuma sessão pode acessar os dados. Use somente HTTPS. Nunca coloque credenciais no repositório.
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

## Login privado
Sessões aleatórias de 256 bits ficam em cookies HttpOnly, Secure e SameSite=Strict em produção. Apenas o hash do token é armazenado no PostgreSQL. Expiram após 30 minutos sem requisições autenticadas ou 8 horas desde o login. Sair revoga a sessão no servidor; alterar APP_USERNAME ou APP_PASSWORD invalida todas as sessões. A API rejeita salvamentos sem sessão e sem Origin exato correspondente ao APP_ORIGIN. Tentativas de login são limitadas no banco: 10 por IP e 60 globais a cada 15 minutos. O último endereço X-Forwarded-For deve ser inserido pelo proxy confiável; mantenha a porta 3000 interna.

Não há recuperação por e-mail nem cadastro. Redefina a senha no Environment do EasyPanel e faça redeploy. Não compartilhe a credencial do proprietário. Os cabeçalhos incluem CSP com nonce, proteção contra frames, HSTS e no-store. Tokens não ficam no localStorage. Os campos não salvos permanecem disponíveis se a sessão expirar: entre em outra aba e tente salvar novamente.
