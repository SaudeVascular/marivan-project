# Ambientes e migrações do PEP

## Objetivo

### Origens da função administrativa

Antes de publicar o frontend, configure `ADMIN_ALLOWED_ORIGINS` nos secrets
do respectivo projeto Supabase, com as origens HTTPS exatas separadas por
vírgula (sem caminho nem barra final). A função `admin-create-user` compara
a origem integralmente e continua exigindo um Administrador ativo. Não use
wildcards para previews de terceiros. Ao mudar a URL de homologação, atualize
a lista e os redirecionamentos permitidos do Auth no mesmo ambiente.

## Fluxo de migrações

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
npm run db:test:clinical
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

## Estado atual (25/10/2026)

| Ambiente | Ref | Migrações | Verificação P0 |
|---|---|---|---|
| Homologação | `snhmydckyypgucwbsaus` | 01–54 | — (30/10) |
| Produção | `vhaadfzdvhdztfrilohf` | 01–42 | OK (24/10); **43–55 pendentes** — aplicar logo depois de publicar o site (ver abaixo) |

A seção seguinte é histórica: a adoção na produção **já foi feita**, em
23/10/2026, por `scripts/supabase-atualizar-producao.sh`. O diagnóstico
`scripts/diagnostico-migracoes-producao.sql` mostrou que a produção já tinha
de 01 a 25, e não só as 23 iniciais. Por isso 01–25 foram registradas como
aplicadas, sem reexecutar, e 26–35 foram aplicadas depois do backup. A
conexão com a produção é direta (`db.vhaadfzdvhdztfrilohf.supabase.co`); o
pooler `aws-0-sa-east-1` não conhece esse projeto.

**Daqui em diante, para cada migração nova:**

```bash
bash scripts/supabase-push-producao.sh                   # dry-run, para
CONFIRMAR_PUSH=SIM bash scripts/supabase-push-producao.sh # backup, aplica, P0
```

### Publicação de 43–55 (site e banco juntos)

- 43: auditoria de acesso recusa registro de outro paciente;
- 44: assinar exige nome, número do conselho e UF no perfil;
- 45: CPF validado, gravado no formato 000.000.000-00 e único pelos dígitos;
  CNS, nascimento e tamanhos validados;
- 46: retrato da emissão guardado na assinatura (2ª via fiel);
- 47: criação idempotente e versão/transições em agenda e cobranças;
- 48: registros clínicos só legíveis pelas funções que registram o acesso;
  exportação do prontuário e da clínica;
- 49: procedimento e convênio no agendamento; assinar a consulta conclui o
  agendamento do dia; agendamento Realizado gera a cobrança Pendente com o
  valor da tabela do convênio;
- 50: dados da operadora e tabela de cada convênio (importação de
  planilha); código e tipo do procedimento; repasse por profissional;
  relatório de produção. O repasse por procedimento deixa de valer: depois
  de aplicar, o Administrador define em Administração → Usuários os
  percentuais de cada profissional, e o Financeiro confere o tipo de cada
  procedimento (procedimentos antigos com nome começando por "Consulta"
  viram Consulta; os demais, Procedimento). Até lá, cobranças novas nascem
  com repasse 0%.
- 51: importação do catálogo de procedimentos de planilha (código,
  descrição, tipo e valor particular opcionais); nada é apagado.
- 52: as duas importações gravam em lote (uma tabela do tamanho da TUSS
  passava do limite de 8 s da Supabase e não era gravada); descrição de
  procedimento até 1000 caracteres.
- 53: assinar a consulta conclui também o agendamento do dia ainda
  Agendado/Confirmado (sem check-in); sem agendamento, a consulta assinada
  gera a cobrança direto (a definir, uma por paciente, profissional e dia).
- 54: desconto no particular (dado pela Recepção, botão Receber) e glosa
  no convênio; repasse calculado sobre o que de fato entrou (pago − glosa);
  Financeiro e relatório com valor, desconto, pago, glosa, recebido e as
  partes da clínica e do profissional.
- 55: cobrança pendente acompanha a regra de repasse atual do profissional
  e o tipo atual do procedimento (a paga fica com o da época); totais com
  a divisão prevista das pendentes.

O site novo lê o histórico pela função da 48, e o antigo lê direto (e
passaria a ver o histórico vazio depois da 48). Por isso, como na
publicação de 39–42: num horário sem ninguém atendendo, (1) merge na
`main`, (2) logo em seguida o ensaio e o `CONFIRMAR_PUSH=SIM` do
`supabase-push-producao.sh`, (3) recarregar as abas abertas.

Antes de aplicar a 44, confira no
SQL Editor da produção que todo profissional que assina tem os três campos —
quem não tiver passa a receber a mensagem pedindo para completar o cadastro:

```sql
SELECT nome, funcao, crm, uf FROM public.perfis
 WHERE ativo AND (funcao IN ('Médico','Enfermeiro(a)','Psicólogo(a)','Fisioterapeuta')
                  OR papel_clinico_administrador IS NOT NULL)
   AND (char_length(btrim(coalesce(nome,''))) < 3 OR btrim(coalesce(crm,'')) = ''
        OR upper(btrim(coalesce(uf,''))) NOT IN ('AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'));
```

A 45 para sozinha, sem mudar nada, se já houver CPFs repetidos.

### Publicação de 39–42 (site e banco juntos — feita em 24/10/2026)

As migrações 41 e 42 trocam a edição de paciente por uma função com versão
obrigatória: o site antigo (que grava direto) para de editar pacientes
depois da 42, e o site novo precisa da 41. A 40 dá os totais do
Financeiro. Por isso, num horário sem ninguém editando:

1. publicar o site novo (merge na `main`);
2. logo em seguida, `bash scripts/supabase-push-producao.sh` (ensaio) e
   `CONFIRMAR_PUSH=SIM bash scripts/supabase-push-producao.sh`;
3. pedir a quem estiver com o PEP aberto que recarregue a página.

## Adotar o histórico na produção existente — uma única vez (já feito)

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
4. recria um PostgreSQL Supabase descartável com todas as migrações versionadas;
5. analisa o schema e executa a verificação P0.

Falhas impedem que a alteração seja considerada pronta para homologação.

## Autenticação e sessões

- tokens do frontend usam `sessionStorage`, portanto não sobrevivem ao fechamento
  da aba;
- sessões abertas encerram após 15 minutos sem atividade e limpam rascunhos
  clínicos locais;
- sair (pelo botão ou por inatividade) fecha a tela na hora e apaga o token
  deste navegador mesmo sem rede (`services/sessao.service.js`). A revogação
  no servidor é tentada em seguida; sem conexão, a tela de login avisa e a aba
  tenta de novo quando a rede voltar (o access token fica só em memória até
  expirar). Se a aba for recarregada antes disso, a sessão não revogada fica
  só no servidor — sem nenhuma cópia do token no navegador;
- o atendimento em digitação é salvo sozinho no servidor como rascunho
  (consulta com status "Rascunho", pela mesma RPC versionada): 10 s depois da
  última tecla, ao esconder a aba e ao sair da tela; em falha, nova tentativa
  a cada 30 s. Até a confirmação do servidor, o texto fica também em
  `sessionStorage` (por usuário e paciente), que sobrevive a recarregar a aba
  mas não a fechá-la. Cada gravação automática gera uma versão e uma linha de
  auditoria — por isso a espera de 10 s, e não a cada tecla. Um pedido que
  chega com outra gravação em andamento (sair da tela, Finalizar e Assinar)
  entra na fila e roda logo em seguida, no mesmo rascunho, com o texto mais
  recente. A gravação ao fechar a aba é tentativa, não garantia (o navegador
  pode cortar a requisição); a garantia é a gravação a cada 10 s;
- ao trocar de usuário ou função, o frontend descarta o cache de pacientes e
  histórico da sessão anterior e ignora respostas atrasadas daquela sessão;
- senhas novas exigem ao menos 12 caracteres, maiúscula, minúscula e número;
- depois de uma recuperação de senha, todos os refresh tokens anteriores são
  revogados e o usuário precisa autenticar novamente;
- signup público está desabilitado;
- novos usuários são criados pela Edge Function `admin-create-user`, que exige
  JWT válido, confirma no banco que o solicitante é Administrador ativo e mantém
  a `service_role` exclusivamente no backend;
- o administrador não escolhe nem conhece a senha: a Edge Function envia um
  convite de uso único para `/ativar-conta`, onde o usuário define a própria senha;
- usuários autenticados podem trocar a senha em `/minha-conta`, após confirmar
  a senha atual; todas as sessões são revogadas depois da alteração;
- alteração segura de senha está habilitada na configuração de Auth.

## Gravações clínicas e migração 28

A partir de `20260919000028_gravacao_clinica_segura.sql`, o frontend grava
registros pela RPC `salvar_registro_clinico`, com identificador de operação
e versão esperada. A migração deve preceder a publicação do frontend novo.
Clientes antigos em cache precisam recarregar: a escrita direta em consultas
é bloqueada para não contornar o controle de concorrência.

Use `npm run db:test:clinical` apenas no banco local descartável. O padrão é
`127.0.0.1:54322`; para outro PostgreSQL descartável local, configure
`CLINICAL_TEST_DATABASE_URL`. O script recusa hosts remotos, cria dados
fictícios e verifica transações concorrentes com processos `psql` separados.
O escopo e os limites estão em [ESTABILIZACAO.md](./ESTABILIZACAO.md).
