# Documento Mestre do Projeto — PEP

**Responsável clínico:** Dr. Marivan Araujo
**Versão:** 2.5 — 25/10/2026
**Estado:** publicado em produção (https://marivan-project.vercel.app) e em uso; validação operacional com a equipe em andamento.

Este documento distingue implementação de validação operacional. Um recurso
implementado no código não está necessariamente validado por quem usa.
O histórico anterior foi preservado em [arquivo histórico](docs/historico/DOCUMENTO_MESTRE_ANTERIOR.md).

## Estados adotados

- **IMPLEMENTADO:** existe no código e tem o comportamento descrito abaixo.
- **EM VALIDAÇÃO:** existe, mas falta comprovação no ambiente ou fluxo indicado.
- **PLANEJADO:** evolução identificada, ainda não implementada.
- **PENDENTE:** decisão, configuração ou requisito ainda sem conclusão.

## Objetivo e arquitetura

Prontuário em nuvem para cadastro, atendimento, documentos, agenda e financeiro,
com autoria e acesso por função. Frontend React 19, React Router e CSS próprio,
montado com Vite e testado com Jest; backend Supabase Auth, PostgreSQL com RLS e
Edge Functions. Hospedagem do frontend na Vercel (produção = branch `main`).

O aplicativo oficial está em `prontuario-eletronico`. `src/App.jsx` reúne providers
e rotas; `src/pages/` organiza os domínios; `src/services/` concentra acesso ao
backend; `src/hooks/` e `src/utils/` oferecem lógica compartilhada.
As migrações versionadas estão em `supabase/migrations/` e os testes de banco
em `supabase/tests/`. Não alterar migrações já aplicadas.

O frontend recebe `REACT_APP_SUPABASE_URL` e `REACT_APP_SUPABASE_ANON_KEY`
(nomes mantidos do Create React App; o Vite injeta só esse prefixo).
A chave `service_role` nunca pertence ao bundle ou às variáveis do frontend.

## Ambientes

| Ambiente | Uso | Banco | Usuários |
|---|---|---|---|
| Produção | https://marivan-project.vercel.app | Supabase `vhaadfzdvhdztfrilohf`, migrações 01–42 | Equipe real, criada por convite |
| Homologação | Previews da Vercel (cada pull request) | Supabase `snhmydckyypgucwbsaus`, migrações 01–42 | Só contas fictícias |
| Local | `npm start` no computador de desenvolvimento | Supabase local (Docker) | Só contas fictícias |

Cada ambiente tem seu próprio Auth: uma conta de um não existe nos outros.
Dados reais de pacientes ficam só na produção. Procedimento em
[AMBIENTES_E_MIGRACOES.md](docs/AMBIENTES_E_MIGRACOES.md).

## Estado funcional

| Área | Estado | Implementação e limite atual |
|---|---|---|
| Sessão | IMPLEMENTADO | Sair (botão ou 15 min de inatividade) fecha a tela e apaga o token do navegador na hora, mesmo sem rede; a revogação no servidor é tentada e, sem conexão, repetida quando a rede volta, com aviso na tela de login. |
| Consulta | IMPLEMENTADO | Digitar, salvar rascunho, reabrir, editar e finalizar/assinar. Autosave remoto: 10 s após a última tecla, ao esconder a aba e ao sair da tela, com fila para pedidos simultâneos (ver "Rascunhos"). |
| Assinatura | IMPLEMENTADO / EM VALIDAÇÃO | Texto e assinatura atômicos, autoria com identidade profissional (conselho e RQE), imutabilidade e retificação vinculada; assinatura digitalizada nos impressos (migração 31). O banco só assina com nome, número do conselho e UF no perfil, inclusive por chamada direta à API (migração 44) — confere preenchimento, não a regularidade no conselho. Não equivale a certificação digital externa (ICP-Brasil). |
| Concorrência | IMPLEMENTADO | Registros clínicos: UUID por operação, recibo idempotente e versão esperada. Paciente: cadastro e antecedentes só pela função `atualizar_paciente`, com versão obrigatória; edição concorrente devolve conflito em vez de sobrescrever (migrações 37, 41 e 42). |
| Receitas e documentos | IMPLEMENTADO | Um formulário por paciente (trocar de paciente não leva dados nem "salvo"). Salvar e imprimir só com a identidade do profissional completa (nome, registro e UF). Na assinatura, o banco guarda o retrato do documento — paciente, idade, antecedentes, clínica, profissional, datas — e um código de verificação (SHA-256); a 2ª via usa esse retrato e se identifica como tal (migração 46). A reimpressão só abre registro do paciente da URL. Receituário, prescrição, atestado, pedido de exames (catálogo TUSS no banco), laudos, relatórios e guia SP/SADT em PDF. Erros de gravação não produzem confirmação de sucesso. |
| Cadastro | IMPLEMENTADO | Identificação, endereço, convênio, CNS e dados clínicos separados por view e triggers; busca de pacientes no servidor. CPF opcional, mas validado, padronizado e único pelos dígitos; CNS, nascimento e tamanhos validados no banco (migração 45). Criação idempotente (migração 47). Tela para localizar e reativar desativados. Campos obrigatórios definitivos dependem de decisão clínica. |
| Perfis e autorização | IMPLEMENTADO | RLS, views mascaradas e proteção de função/status. Administrador clínico só por concessão explícita (migração 30). Profissões não médicas registram só os tipos permitidos (migração 39). |
| Agenda e recepção | IMPLEMENTADO | Agendamento com procedimento e convênio (o convênio vem do cadastro; a Recepção confirma ou ajusta na chegada) e fluxo de status/check-in, com transições e versão no banco e criação idempotente (migrações 47 e 49). Assinar a Consulta (ou Evolução de Enfermagem) conclui o agendamento do dia, do mesmo profissional, que esteja Aguardando ou Em atendimento. A agenda admite toda conta ativa (Financeiro só lê); restrição adicional por função exige decisão explícita. |
| Convênios e tabelas | IMPLEMENTADO / EM VALIDAÇÃO | Cada convênio guarda os dados da operadora (razão social, CNPJ — inclusive alfanumérico —, registro ANS, código da clínica na operadora, contato, endereço, prazo de pagamento, tabela de referência) e a própria tabela: código, procedimento e valor acordado. A tabela é importada de planilha (.xls, .xlsx, .ods ou .csv) com prévia e erros por linha, gravada de uma vez (tudo ou nada), acrescentando/atualizando ou substituindo; também é exportada em .xlsx. O "Particular" é a tabela da própria clínica. Procedimento tem código (TUSS/CBHPM, sem pontos) e tipo — Consulta, Exame ou Procedimento —, que decide o repasse (migração 50). |
| Repasse | IMPLEMENTADO / EM VALIDAÇÃO | Por profissional, não por procedimento: cada um tem o percentual de consultas, de exames e de procedimentos, definido só pelo Administrador no cadastro do usuário. O banco calcula o percentual da cobrança ao lançá-la (e se o profissional ou o procedimento mudar enquanto Pendente); mudar a regra não reescreve cobranças já lançadas. Regras auditadas (migração 50). |
| Relatório de produção | IMPLEMENTADO / EM VALIDAÇÃO | Cada profissional de saúde vê a própria produção; Financeiro e Administrador, a de todos. Mês ou intervalo de dias, por profissional, tipo, procedimento, convênio e situação; totais de produção, repasse, parte da clínica, recebido, a receber e glosado, por profissional, por procedimento e por convênio; impressão. O alcance é decidido no banco (`relatorio_producao`); canceladas não entram (migração 50). |
| Financeiro | IMPLEMENTADO | Cobranças, catálogos, recibos e leitura das próprias cobranças por todo profissional de saúde (migração 50). Totais calculados no banco (`resumo_cobrancas`) e lista paginada, sem o limite de 1000 linhas da API. Criação idempotente, versão nas alterações, transições de status e data de pagamento definida pelo banco (apagada ao desfazer o pagamento) — migração 47. Agendamento Realizado gera a cobrança Pendente com procedimento, convênio, profissional, valor da tabela do convênio e repasse (uma por agendamento); sem procedimento, nasce "valor a definir" e só pode ser paga depois de ajustada — migração 49. |
| Usuários | IMPLEMENTADO / EM VALIDAÇÃO | Convites por Edge Function com Administrador ativo e origens explícitas, publicada em produção. Falta acompanhar o fluxo completo de convite por e-mail com cada novo membro. |
| Clínica e filiais | IMPLEMENTADO | Cadastro/configuração e múltiplas filiais. Não representa isolamento entre organizações independentes. |
| Exportação | IMPLEMENTADO | Prontuário de um paciente (quem lê o prontuário) e clínica inteira (Administrador com papel clínico), em JSON com registros, autoria, datas, retificações e retrato das emissões; montado no navegador, sem cópia no servidor; registrado na auditoria (migração 48). |
| Erros de carregamento | IMPLEMENTADO | Falha ao abrir um paciente aparece como erro de conexão, com nova tentativa — "não encontrado" só quando o banco respondeu sem o registro; falha nos totais do Financeiro aparece como "Indisponível", com "Recarregar totais". Avisos nos carregamentos auxiliares, erros de impressão explícitos e nova tentativa para configuração da clínica e histórico (paginado, sem limite de 1000 registros). Não registrar objetos de erro potencialmente sensíveis no console. |
| Auditoria | IMPLEMENTADO | Alterações por trigger, lidas pelo Administrador com conteúdo clínico mascarado para quem não tem papel clínico (migração 36). Leitura no banco (migração 48): registros clínicos só são entregues pelas funções que registram o acesso antes — leitura direta pela API não devolve nada; exportações também registradas. Impressões são registradas pelo app, com fila de reenvio. Limite: antecedentes do cadastro seguem legíveis por perfis clínicos na busca. Monitoramento operacional ainda planejado. |

## Matriz de autorização atual

A matriz descreve o banco após a migração 50. Restrições devem existir no
backend mesmo quando uma rota está escondida no frontend. A matriz e suas
ressalvas estão detalhadas em [AUTORIZACAO.md](docs/AUTORIZACAO.md).

| Domínio | Médico | Enfermagem | Psicologia / Fisioterapia | Recepção | Financeiro | Administrador |
|---|---|---|---|---|---|---|
| Identificação do paciente | Ler/editar | Ler/editar | Ler/editar | Ler/editar | Ler | Ler/editar |
| Dados clínicos e histórico | Sim | Sim | Sim | Não | Não | Só com papel clínico concedido |
| Registrar no prontuário | Todos os tipos | Consulta, Evolução de Enfermagem, Sinais Vitais | Consulta, Atestado, Relatório | Não | Não | Conforme o papel clínico concedido |
| Receita e prescrição | Sim | Não | Não | Não | Não | Só com papel clínico Médico concedido |
| Modelos de receita | Próprios | Não | Não | Não | Não | Próprios, só com papel clínico Médico concedido |
| Agenda | Sim | Sim | Sim | Sim | Só leitura | Sim |
| Cobranças | Leitura das próprias | Leitura das próprias | Leitura das próprias | Não | Gerenciar | Gerenciar/excluir |
| Convênios e tabelas | Não | Não | Não | Não | Gerenciar | Gerenciar |
| Regras de repasse | A própria | A própria | A própria | Não | Ler | Gerenciar |
| Relatório de produção | O próprio | O próprio | O próprio | Não | Todos | Todos |
| Configuração e filiais | Ler | Ler | Ler | Ler | Ler | Gerenciar |
| Auditoria (alterações e acessos) | Não | Não | Não | Não | Não | Ler, mascarada sem papel clínico |

A lista de tipos por profissão fica no banco (`papel_clinico_pode_registrar`)
e é espelhada em `src/constants/roles.js` (`TIPOS_PERMITIDOS`); tipo novo nasce
bloqueado para as profissões não médicas. Mantenha as duas em sincronia.

Desde a migração 30, "Administrador" na tabela acima é administração
técnica por padrão — sem qualquer poder clínico automático. Uma conta
Administrador só ganha as células marcadas "com papel clínico concedido"
se OUTRO Administrador ativo conceder explicitamente `papel_clinico_administrador`
(Médico ou Enfermeiro(a)) a ela; a concessão nunca é automática nem
autoatribuível, mesmo por quem já é Administrador. Ver [AUTORIZACAO.md](docs/AUTORIZACAO.md).

Contas inativas não conservam os poderes da função anterior. Perfis têm
exposição mínima da própria identidade para permitir o fluxo de autenticação.
Nenhum cliente recebe escrita direta em consultas ou pacientes (só pelas funções
versionadas), edição de auditoria, acesso direto aos recibos de operação ou
privilégios de `TRUNCATE`/`TRIGGER`. A imagem de assinatura nunca sai pela auditoria.

## Rascunhos e armazenamento no navegador

**IMPLEMENTADO:** autosave remoto do atendimento como rascunho (consulta com
status "Rascunho"), pela mesma RPC versionada dos registros clínicos: 10 s
depois da última tecla, ao esconder a aba e ao sair da tela; em falha, nova
tentativa a cada 30 s. Um pedido que chega com outra gravação em andamento
(sair da tela, Finalizar e Assinar) entra numa fila e roda em seguida, no mesmo
rascunho, com o texto mais recente. A tela mostra "Salvo no prontuário às…".
Cada gravação gera uma versão e uma linha de auditoria — por isso a espera de 10 s.

Até a confirmação do servidor, o texto fica também no `sessionStorage`, com
chave por usuário e paciente; limpeza no logout e após 15 minutos sem atividade.
No `localStorage` permanece somente a preferência de largura dos painéis.

Limites: a gravação ao fechar a aba é tentativa, não garantia (o navegador pode
cortar a requisição); a garantia é a gravação a cada 10 s. `sessionStorage`
contém informação clínica e pode ser restaurado pelo navegador. Pedidos com
resultado incerto preservam o mesmo UUID na aba até sua confirmação; apagar
esse estado pode induzir duplicação.

## Validação e publicação

- **IMPLEMENTADO:** testes de frontend (Jest), verificação de código (ESLint),
  testes de integridade clínica, concorrência e autorização em PostgreSQL
  descartável e testes de navegador (Playwright) com login e banco reais —
  sessão sem rede e por inatividade, troca de usuário, troca de paciente,
  duas abas, resposta perdida após gravar, impressão e 2ª via —, todos no CI
  a cada pull request. `npm run db:test:clinical`
  inclui a matriz de tabelas com contas ativas/inativas e privilégios anônimos.
- **IMPLEMENTADO:** fluxo migração versionada → local → homologação → produção.
  O script de produção faz ensaio, backup completo, aplica e roda a verificação
  P0. Produção em 01–42 com P0 OK (24/10/2026).
- **IMPLEMENTADO:** dependências do frontend sem alertas conhecidos (`npm audit`
  com 0 após a troca do Create React App pelo Vite, 24/10/2026).
- **IMPLEMENTADO:** backup pontual e ensaio de restauração do schema/dados de
  produção, incluindo comparação dos registros clínicos. Isso não comprova
  uma política recorrente de backup nem recuperação dos serviços gerenciados.
- **EM VALIDAÇÃO:** uso diário pela equipe nos fluxos reais.

Evidências, commits, URLs e estado por ambiente estão em
[ESTABILIZACAO.md](docs/ESTABILIZACAO.md). Procedimento operacional em
[AMBIENTES_E_MIGRACOES.md](docs/AMBIENTES_E_MIGRACOES.md).

## Pendências abertas

| Estado | Pendência |
|---|---|
| PENDENTE | Confirmar nome definitivo, dados institucionais, especialidades e responsável administrativo. |
| PENDENTE | Logo do PEP para cabeçalho e impressos (`public/logo-pep.png`); hoje aparece o marcador "PEP". |
| PENDENTE | Aprovar campos obrigatórios e critérios clínicos para finalizar documentos. |
| EM VALIDAÇÃO | Validar o fluxo da consulta com profissionais e cenários de falha. |
| PENDENTE | Decidir se filiais compartilham pacientes ou precisam de isolamento institucional. |
| EM VALIDAÇÃO | Regras de assinatura já implementadas; validação operacional e requisitos externos ainda abertos. |
| PENDENTE | Supabase Pro: limite de gastos, política de backup, retenção, RPO/RTO e teste recorrente de restauração; rotina automatizada de backup externo verificado. |
| PENDENTE | Assinatura criptográfica verificável (ICP-Brasil) se for oferecida comercialmente; guarda do PDF final, se exigida. A imagem de assinatura e o código de verificação não substituem certificação digital. |
| PENDENTE | Comprovar MFA nas contas administrativas (Supabase, Vercel, GitHub), monitoramento e revisão periódica de acessos. |
| PENDENTE | Repositório GitHub hoje público; torná-lo privado. |
| PENDENTE | Limite de duração/inatividade das sessões no Auth da Supabase (plano Pro): fecha no servidor sessões que o app não conseguiu revogar. |
| PENDENTE | Homologação acompanhada com a equipe — roteiro em [ROTEIRO_HOMOLOGACAO.md](docs/ROTEIRO_HOMOLOGACAO.md). |
| PENDENTE | Para uso comercial: um ambiente (projeto Supabase) por clínica enquanto não houver isolamento entre organizações; assinatura verificável (ICP-Brasil); exportação dos dados do paciente; suporte e contratos. |
| PENDENTE | Proteção dos previews da Vercel (hoje abertos; usam só a homologação). |
| PLANEJADO | Botão "Reenviar convite" na gestão de usuários. |

## Histórico documental

| Versão | Data | Alteração |
|---|---|---|
| 1.0 | 10/07/2026 | Documento original e decisões subsequentes, preservados no arquivo histórico. |
| 2.0 | 19/09/2026 | Estado real por área, matriz de permissões, distinção entre rascunho remoto e autosave local, pendências e publicação. |
| 2.1 | 19/09/2026 | Migração 30: Administrador deixou de ter acesso clínico automático (passa a exigir concessão explícita de outro administrador); Financeiro passou a só ler a agenda. |
| 2.2 | 24/10/2026 | Publicação em produção (migrações 31–42): autosave remoto, versão obrigatória do paciente, totais do Financeiro no banco, histórico paginado, auditoria mascarada e de acessos, Psicologia/Fisioterapia com tipos permitidos, assinatura digitalizada, catálogo TUSS e guia SP/SADT. Frontend migrado para Vite. Tabela de ambientes. |
| 2.3 | 24/10/2026 | Terceira avaliação: saída de sessão sem depender da rede, documentos só com identidade profissional completa, falhas de conexão distintas de "paciente não encontrado" e dos totais do Financeiro; auditoria de leitura registrada como parcial; script de limpeza dos pacientes fictícios retirado (usado uma vez, em 24/10/2026). |
| 2.4 | 25/10/2026 | Quarta avaliação (migrações 43–48) e agenda → cobrança (49): reimpressão presa ao paciente do registro; formulários de documento por paciente; identidade profissional exigida pelo banco na assinatura; CPF/CNS/nascimento validados e CPF único pelos dígitos; reativação de pacientes; retrato da emissão e 2ª via fiel com código de verificação; criação idempotente e versão em cadastro, agenda e cobranças; leitura clínica auditada no banco; exportação do prontuário e da clínica; testes de navegador no CI. |
| 2.5 | 25/10/2026 | Convênios com dados da operadora e tabela própria importada de planilha; procedimento com código e tipo; repasse por profissional (consulta, exame, procedimento) definido pelo Administrador; relatório de produção individual e da clínica, com impressão (migração 50). |
