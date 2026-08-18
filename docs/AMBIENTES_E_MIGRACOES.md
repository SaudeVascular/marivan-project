# Ambientes e migrações do PEP

## Objetivo

Nenhuma mudança nova de banco deve ser criada diretamente no SQL Editor de
produção. O fluxo passa a ser:

```text
migração versionada → banco local → homologação → produção
```

Produção e homologação devem ser projetos Supabase diferentes. Nunca copie
dados reais de pacientes para local ou homologação.

## Estrutura

- `supabase/config.toml`: configuração do Supabase local, sem segredos;
- `supabase/migrations/`: histórico SQL aplicado em ordem pelo CLI;
- `supabase/seed.sql`: somente dados fictícios de desenvolvimento;
- `supabase_verify_security_p0.sql`: verificação somente-leitura das proteções P0.

Os 23 SQLs antigos foram congelados como o histórico inicial. Para toda mudança
nova, crie outro arquivo; não edite uma migração já aplicada:

```bash
npx supabase migration new descricao_da_mudanca
```

## Desenvolvimento local

Requisitos: Node.js 20 ou superior e Docker Desktop (ou runtime compatível).

```bash
npm install
npm run db:start
npm run db:reset
npm run db:lint
npm run db:verify:p0
```

`db:reset` é destrutivo somente para o banco local. Ele recria o banco usando
todas as migrações e o seed fictício.

Para usar o frontend contra o Supabase local, crie `.env.development.local`:

```dotenv
REACT_APP_SUPABASE_URL=http://127.0.0.1:54321
REACT_APP_SUPABASE_ANON_KEY=valor_mostrado_por_npx_supabase_status
```

## Criar a homologação

1. Crie no painel um novo projeto Supabase vazio, separado da produção.
2. Não importe pacientes ou backups de produção.
3. Defina as variáveis apenas no terminal, sem salvá-las no Git:

```bash
export SUPABASE_STAGING_PROJECT_REF="id-do-projeto-de-homologacao"
export SUPABASE_PRODUCTION_PROJECT_REF="id-do-projeto-de-producao"
npm run db:staging:link
```

Ao executar `npm run db:staging:push`, o script pede a senha do banco de forma
oculta e a fornece diretamente ao CLI, sem salvá-la no histórico do terminal ou
em arquivo. Em automações, ela também pode ser fornecida temporariamente pela
variável `SUPABASE_DB_PASSWORD`.

Se estiver reutilizando um projeto restaurado, inspecione antes o schema e as
contagens, sem exibir dados de pacientes:

```bash
npm run db:staging:inspect
```

Não aplique as migrações enquanto houver tabelas ou usuários antigos que ainda
precisem ser preservados.

Para a homologação descartável já autorizada neste projeto, o reset protegido
confere os IDs fixos de homologação e produção, pede confirmação explícita,
reaplica as migrações e executa a verificação P0:

```bash
npm run db:staging:reset
```

Esse comando é destrutivo e só pode ser usado na homologação configurada no script.

Depois do reset, configure o frontend local em `.env.development.local` e crie
as quatro contas fictícias de teste com:

```bash
npm run db:staging:users
```

O provisionador recusa produção, pede a senha do banco de forma oculta e mostra
novas senhas descartáveis para Administrador, Médico, Enfermagem e Recepção.

Primeiro visualize o que seria aplicado:

```bash
npm run db:staging:push
```

O comando acima sempre para depois do `--dry-run`. Após revisar a lista:

```bash
CONFIRM_STAGING_PUSH=APLICAR_EM_HOMOLOGACAO npm run db:staging:push
```

Depois execute `supabase_verify_security_p0.sql` no SQL Editor da homologação
e faça os testes de interface com dados fictícios.

## Adotar o histórico na produção existente — uma única vez

Produção já recebeu os 23 scripts manualmente. Eles não podem ser executados
novamente pelo CLI. Depois de confirmar `OK` em `supabase_verify_security_p0.sql`:

```bash
npm run db:production:verify
```

Esse preflight conecta diretamente à produção, mantém o CLI vinculado à
homologação e executa somente consultas de verificação.

```bash
export SUPABASE_PRODUCTION_PROJECT_REF="id-do-projeto-de-producao"
npx supabase link --project-ref "$SUPABASE_PRODUCTION_PROJECT_REF"
npm run db:production:adopt-history
```

O segundo comando apenas explica o bloqueio enquanto não houver confirmação. Para
registrar deliberadamente as 23 versões como aplicadas, sem executar o SQL novamente:

```bash
CONFIRM_PRODUCTION_HISTORY=REGISTRAR_HISTORICO_SEM_REAPLICAR \
  npm run db:production:adopt-history
```

Confira a saída de `supabase migration list --linked`. Local e remoto devem
mostrar as mesmas 23 versões.

## Promoção futura

1. Crie uma migração nova em uma branch Git.
2. Rode `db:reset`, `db:lint`, `db:verify:p0` e os testes do frontend.
3. Aplique primeiro na homologação e valide os fluxos.
4. Faça backup e teste de restauração conforme a política da clínica.
5. Somente depois vincule produção, execute `db push --dry-run` e aplique as
   migrações novas.

Nunca execute `supabase db reset --linked` em produção: ele apaga os dados do
projeto vinculado.

## Integração contínua

O workflow `.github/workflows/quality.yml` não acessa nenhum projeto remoto nem
usa credenciais de homologação ou produção. Em cada pull request ele:

1. procura credenciais acidentalmente versionadas;
2. confere as cópias do histórico inicial;
3. executa os testes e o build do frontend;
4. recria um PostgreSQL Supabase descartável com as 23 migrações;
5. analisa o schema e executa a verificação P0.

Falhas impedem que a alteração seja considerada pronta para homologação.

## Autenticação e sessões

- tokens do frontend usam `sessionStorage`, portanto não sobrevivem ao fechamento
  da aba;
- sessões abertas encerram após 15 minutos sem atividade e limpam rascunhos
  clínicos locais;
- senhas novas exigem ao menos 12 caracteres, maiúscula, minúscula e número;
- depois de uma recuperação de senha, todos os refresh tokens anteriores são
  revogados e o usuário precisa autenticar novamente;
- signup público está desabilitado;
- novos usuários são criados pela Edge Function `admin-create-user`, que exige
  JWT válido, confirma no banco que o solicitante é Administrador ativo e mantém
  a `service_role` exclusivamente no backend;
- alteração segura de senha está habilitada na configuração de Auth.
