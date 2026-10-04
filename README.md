# BluePay Planner / Saldo
Acompanhamento mensal de patrimônio, investimentos e fluxo consolidado. Next.js + PostgreSQL no EasyPanel.

## Deploy
Projeto bluepayplanner, serviços app e db (PostgreSQL 17). GitHub allexbonilha/bluepayplanner, main, Build Path /, Dockerfile e porta interna 3000. Auto Deploy atualiza o app a cada push; o build executa a suíte antes de compilar.

Configure somente DATABASE_URL (conexão interna, com banco em volume persistente) e APP_ORIGIN (URL HTTPS pública sem caminho). Não exponha a porta do PostgreSQL. Credenciais de usuário não são variáveis de ambiente: nomes de usuário e hashes de senha ficam na tabela users.

## Cadastro, login e Minha conta
/register cria uma conta independente com nome, usuário único normalizado (3–32 caracteres) e senha confirmada (16–128 caracteres). As senhas usam scrypt com salt aleatório (N=32768, r=8, p=3), nunca texto puro. Novos usuários começam sem contas ou fechamentos pessoais.

Minha conta permite alterar nome, usuário e senha pelo site. A senha atual é obrigatória. A nova senha é opcional e precisa de confirmação. O servidor valida a sessão, Origin, tamanho, limite de tentativas, senha atual, unicidade e revisão das credenciais. A atualização e revogação de sessões ocorrem em uma transação; uma sessão nova mantém o dispositivo atual conectado. Outros dispositivos precisam entrar novamente. Os registros financeiros continuam vinculados ao mesmo ID.

O proprietário existente conserva o ID owner e seu patrimônio. Durante a atualização, somente se o proprietário ainda não possuir hash, o app migra uma vez a senha legada de APP_PASSWORD para scrypt. Depois disso, essas variáveis nunca redefinem o usuário ou a senha. Remova APP_USERNAME e APP_PASSWORD do EasyPanel após verificar a migração; não são necessárias para login, sessões ou cadastro. Se um proprietário legado não tiver hash nem senha disponível para migrar, seu acesso falha fechado e não pode ser reivindicado pelo cadastro público.

## Segurança e dados
Tokens aleatórios de 256 bits ficam em cookies HttpOnly, Secure e SameSite=Strict em produção; somente o hash do token fica no banco. Sessões expiram após 30 minutos sem requisições autenticadas ou 8 horas desde o login. Logout revoga a sessão. Nome de usuário e hash atual vinculam a versão da sessão; alterações invalidam tokens anteriores.

Todas as operações financeiras usam exclusivamente o user_id da sessão validada, nunca campos enviados pelo cliente. X-Account-ID detecta trocas entre abas e não concede acesso. Escritas financeiras usam comparação de revisão para impedir perda de atualizações. Login e ajustes de conta têm limites compartilhados no banco de 10 tentativas por IP e 60 globais a cada 15 minutos; cadastro tem 5 por IP e 30 globais. O último X-Forwarded-For precisa ser inserido pelo proxy confiável; mantenha a porta interna. CSP com nonce, HSTS, proteção contra frames e no-store acompanham as respostas.

Não há redefinição pública sem prova de identidade nem recuperação por e-mail. Configure backups do PostgreSQL e teste sua recuperação. A exportação JSON do app continua disponível; nunca envie backups financeiros para este repositório público.

## Local e verificação
npm ci
npm test
npm run build
Copie .env.example para .env.local e configure DATABASE_URL e APP_ORIGIN antes de npm run dev.

Verificações opcionais da migração e das rotas contra PostgreSQL: node --env-file=.env.local scripts/check-registration.cjs e scripts/check-account-settings.cjs. Requerem um banco já inicializado e permissão para criar schemas. Todos os usuários, credenciais e escritas de teste ficam em schemas temporários; o portfólio owner é copiado somente para comparação. Os schemas são removidos ao terminar. Não imprima nem compartilhe .env.local.
