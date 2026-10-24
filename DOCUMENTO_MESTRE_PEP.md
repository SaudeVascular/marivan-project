# Documento Mestre do Projeto — PEP

**Responsável clínico:** Dr. Marivan Araujo
**Versão:** 2.0 — 19/09/2026
**Estado:** aplicação em estabilização e validação; publicação em produção ainda pendente.

Este documento distingue implementação de validação operacional. Um recurso
implementado no código não está necessariamente publicado nem liberado para uso real.
O histórico anterior foi preservado em [arquivo histórico](docs/historico/DOCUMENTO_MESTRE_ANTERIOR.md).

## Estados adotados

- **IMPLEMENTADO:** existe no código e tem o comportamento descrito abaixo.
- **EM VALIDAÇÃO:** existe, mas falta comprovação no ambiente ou fluxo indicado.
- **PLANEJADO:** evolução identificada, ainda não implementada.
- **PENDENTE:** decisão, configuração ou requisito ainda sem conclusão.

## Objetivo e arquitetura

Prontuário em nuvem para cadastro, atendimento, documentos, agenda e financeiro,
com autoria e acesso por função. Frontend React 19, React Router e CSS próprio;
backend Supabase Auth, PostgreSQL com RLS e Edge Functions.

O aplicativo oficial está em `prontuario-eletronico`. `src/App.js` reúne providers
e rotas; `src/pages/` organiza os domínios; `src/services/` concentra acesso ao
backend; `src/hooks/` e `src/utils/` oferecem lógica compartilhada.
As migrações versionadas estão em `supabase/migrations/` e os testes de banco
em `supabase/tests/`. Não alterar migrações já aplicadas.

O frontend recebe `REACT_APP_SUPABASE_URL` e `REACT_APP_SUPABASE_ANON_KEY`.
A chave `service_role` nunca pertence ao bundle ou às variáveis do frontend.

## Estado funcional

| Área | Estado | Implementação e limite atual |
|---|---|---|
| Consulta | IMPLEMENTADO | Digitar, salvar rascunho remoto, reabrir, editar e finalizar/assinar. Autosave de digitação ainda é local à aba. |
| Assinatura | IMPLEMENTADO / EM VALIDAÇÃO | Texto e assinatura atômicos, autoria com identidade profissional, imutabilidade e retificação vinculada. Migração 28 em homologação; produção pendente. Não equivale a certificação digital externa. |
| Concorrência | IMPLEMENTADO / EM VALIDAÇÃO | UUID por operação, recibo idempotente, versão esperada e revisão explícita em conflito. Testes HTTP passaram em homologação; validação do preview ainda pendente. |
| Receitas e documentos | IMPLEMENTADO | Quantidade, via, dose e demais campos preservados no registro. Erros de gravação não produzem confirmação de sucesso. |
| Cadastro | IMPLEMENTADO | Identificação, endereço, convênio e dados clínicos separados por view e triggers. Campos obrigatórios definitivos dependem de decisão clínica. |
| Perfis e autorização | IMPLEMENTADO / EM VALIDAÇÃO | RLS, views mascaradas e proteção de função/status. Administrador clínico agora é concessão explícita (migração 30), não automática. Migrações 29 e 30 ainda não aplicadas remotamente. |
| Agenda e recepção | IMPLEMENTADO | Agendamento e fluxo de status/check-in. A política atual da agenda ainda admite toda conta ativa; restrição adicional por função exige decisão explícita. |
| Financeiro | IMPLEMENTADO | Cobranças, catálogos, recibos e leitura do próprio repasse pelo médico. |
| Usuários | IMPLEMENTADO / EM VALIDAÇÃO | Convites por Edge Function com administrador ativo e origens explícitas. Função publicada em homologação; produção e fluxos finais de e-mail pendentes. |
| Clínica e filiais | IMPLEMENTADO | Cadastro/configuração e múltiplas filiais. Não representa isolamento entre organizações independentes. |
| Erros de carregamento | IMPLEMENTADO | Avisos nos carregamentos auxiliares, erros de impressão explícitos e nova tentativa para configuração da clínica e histórico. Não registrar objetos de erro potencialmente sensíveis no console. |
| Auditoria | IMPLEMENTADO / PLANEJADO | Triggers de alterações existentes; auditoria de leitura e monitoramento operacional ainda planejados. |

## Matriz de autorização atual

A matriz descreve o banco após a migração 29. Restrições devem existir no
backend mesmo quando uma rota está escondida no frontend. A matriz e suas
ressalvas estão detalhadas em [AUTORIZACAO.md](docs/AUTORIZACAO.md).

| Domínio | Médico | Enfermagem | Recepção | Financeiro | Administrador |
|---|---|---|---|---|---|
| Identificação do paciente | Ler/editar | Ler/editar | Ler/editar | Ler | Ler/editar |
| Dados clínicos e histórico | Sim | Sim | Não | Não | Só com papel clínico concedido |
| Emitir receita, prescrição e atestado | Sim | Não | Não | Não | Só com papel clínico Médico concedido |
| Modelos de receita | Próprios | Não | Não | Não | Próprios, só com papel clínico Médico concedido |
| Agenda | Sim | Sim | Sim | Só leitura | Sim |
| Cobranças | Leitura das próprias | Não | Não | Gerenciar | Gerenciar/excluir |
| Configuração e filiais | Ler | Ler | Ler | Ler | Gerenciar |
| Auditoria de alterações | Não | Não | Não | Não | Ler |

Desde a migração 30, "Administrador" na tabela acima é administração
técnica por padrão — sem qualquer poder clínico automático. Uma conta
Administrador só ganha as células marcadas "com papel clínico concedido"
se OUTRO Administrador ativo conceder explicitamente `papel_clinico_administrador`
(Médico ou Enfermeiro(a)) a ela; a concessão nunca é automática nem
autoatribuível, mesmo por quem já é Administrador. Ver [AUTORIZACAO.md](docs/AUTORIZACAO.md).

Contas inativas não conservam os poderes da função anterior. Perfis têm
exposição mínima da própria identidade para permitir o fluxo de autenticação.
Nenhum cliente recebe escrita direta em consultas, edição de auditoria,
acesso direto aos recibos de operação ou privilégios de `TRUNCATE`/`TRIGGER`.

**IMPLEMENTADO (migração 30, 19/09/2026):** administração técnica separada de
atuação clínica. Administrador só tem acesso clínico se outro administrador
conceder `papel_clinico_administrador` (Médico ou Enfermeiro(a)) — nunca
automático nem autoconcedido. Enfermagem consulta o histórico clínico,
inclusive documentos já existentes, mas não emite receita/prescrição/atestado.

## Rascunhos e armazenamento no navegador

**IMPLEMENTADO:** texto temporário no `sessionStorage`, com chave por usuário
e paciente; limpeza no logout; rascunhos antigos anônimos do `localStorage`
removidos na inicialização. No `localStorage` da interface atual permanece
somente a preferência de largura dos painéis. O serviço legado, não utilizado,
que permitia persistir listas de pacientes/consultas foi removido nesta revisão.

`sessionStorage` ainda contém informação clínica e pode ser restaurado pelo
navegador. Não é um mecanismo de expiração garantida. Não se impôs um prazo que
apagaria texto ainda não enviado ao servidor. Salvar antes de sair ou fechar a
aba continua necessário. Pedidos com resultado incerto preservam o mesmo UUID
na aba até sua confirmação; apagar esse estado pode induzir duplicação.

**PLANEJADO:** autosave remoto do rascunho, com debounce, recuperação da versão,
reconciliação de respostas perdidas e conflito entre sessões, seguido de redução
ou remoção do armazenamento local. O botão “Salvar rascunho” remoto já existe;
essa evolução não deve ser confundida com autosave remoto já implementado.

## Validação e publicação

- **IMPLEMENTADO:** testes de frontend, integridade clínica, concorrência e
  autorização diretamente em PostgreSQL descartável. `npm run db:test:clinical`
  inclui a matriz das 14 tabelas com contas ativas/inativas e privilégios anônimos.
- **EM VALIDAÇÃO:** alterações desta revisão e migração 29. A aplicação remota
  deve seguir homologação antes de produção; os testes HTTP anteriores cobrem a 28.
- **EM VALIDAÇÃO:** preview da Vercel exige autenticação para confirmar sua
  configuração e os fluxos de navegador. Produção ainda aguarda atualização coordenada.
- **IMPLEMENTADO:** backup pontual e ensaio de restauração do schema/dados de
  produção, incluindo comparação dos registros clínicos. Isso não comprova
  uma política recorrente de backup nem recuperação dos serviços gerenciados.

Evidências, commits, URLs e estado por ambiente estão em
[ESTABILIZACAO.md](docs/ESTABILIZACAO.md). Procedimento operacional em
[AMBIENTES_E_MIGRACOES.md](docs/AMBIENTES_E_MIGRACOES.md).

## Pendências abertas

| Estado | Pendência |
|---|---|
| PENDENTE | Confirmar nome definitivo, dados institucionais, especialidades e responsável administrativo. |
| PENDENTE | Aprovar campos obrigatórios e critérios clínicos para finalizar documentos. |
| EM VALIDAÇÃO | Validar fluxo já implementado da consulta com profissionais e cenários de falha. |
| IMPLEMENTADO | Administrador clínico e agenda do Financeiro resolvidos na migração 30 — ver seção "Matriz de autorização atual". |
| PENDENTE | Decidir se filiais compartilham pacientes ou precisam de isolamento institucional. |
| EM VALIDAÇÃO | Regras de assinatura já implementadas; validação operacional e requisitos externos ainda abertos. |
| IMPLEMENTADO / EM VALIDAÇÃO | Ambientes Supabase separados e hospedagem Vercel definidos; promoção coordenada pendente. |
| PENDENTE | Política de backup, retenção, RPO/RTO e teste recorrente de restauração. |
| PENDENTE | Comprovar MFA, monitoramento, revisão de acessos e recuperação operacional. |
| PLANEJADO | Autosave remoto, auditoria de leitura e paginação/busca de pacientes no servidor. |

## Histórico documental

| Versão | Data | Alteração |
|---|---|---|
| 1.0 | 10/07/2026 | Documento original e decisões subsequentes, preservados no arquivo histórico. |
| 2.0 | 19/09/2026 | Estado real por área, matriz de permissões, distinção entre rascunho remoto e autosave local, pendências e publicação. |
| 2.1 | 19/09/2026 | Migração 30: Administrador deixou de ter acesso clínico automático (passa a exigir concessão explícita de outro administrador); Financeiro passou a só ler a agenda. |
