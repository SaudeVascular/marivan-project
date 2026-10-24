# Auditoria de autorização — 19/09/2026

## Escopo e execução

`supabase/tests/authorization.sql` testa o banco com `SET ROLE authenticated`
e identidades JWT distintas. Não usa `service_role` para as tentativas de
acesso. As fixtures são criadas pelo proprietário em banco descartável e toda
a transação é revertida. `scripts/test-clinical-writes.mjs` recusa URLs remotas
e executa essa matriz junto dos testes de gravação clínica e concorrência.

O inventário exige exatamente as 14 tabelas públicas atuais e RLS habilitada
em cada uma. Uma nova tabela obriga revisão do inventário. Não se confunde
essa cobertura com auditoria de todos os objetos internos do Supabase Auth,
Storage ou dos privilégios de operadores da infraestrutura.

## Tabelas e regras verificadas

| Tabela | Leitura | Escrita |
|---|---|---|
| perfis | ID na base; dados permitidos pela view | Próprio perfil ativo ou administrador; função/status protegidos por trigger |
| pacientes | ID na base; identificação pela view para ativos; clínica somente perfis clínicos | Clínicos e recepção, com preservação de campos clínicos pelo trigger; sem exclusão física |
| consultas | Clínicos; rascunhos conforme autoria/RLS | Somente RPC; assinatura e concorrência na suíte clínica |
| medicamentos_receita | Conforme acesso ao registro pai | Rascunho do próprio autor; alterações em pai assinado recusadas |
| modelos_receita | Próprios de Médico/Administrador ativo | Criar/remover próprios; sem atualização direta |
| agendamentos | Todos os ativos, regra atual | Todos os ativos; exclusão somente Administrador |
| convenios | Todos os ativos | Financeiro/Administrador |
| procedimentos | Financeiro/Administrador | Financeiro/Administrador |
| convenio_valores | Financeiro/Administrador | Financeiro/Administrador |
| cobrancas | Financeiro/Administrador; Médico somente próprias | Financeiro/Administrador; exclusão somente Administrador |
| configuracoes_clinica | Ativos | Administrador atualiza; sem inserção/exclusão pelo cliente |
| filiais | Ativos | Administrador |
| auditoria | Administrador | Somente mecanismos internos; cliente não altera o rastro |
| operacoes_registro | Somente mecanismo interno | Somente RPC; cliente não acessa recibos diretamente |

São executadas tentativas positivas e negativas de leitura, inserção, edição
e exclusão conforme o domínio. Sete identidades cobrem Médico, Enfermagem,
Recepção, Financeiro, Administrador, Médico inativo e Pendente. A suíte clínica
complementa com autoria de outro profissional, retificação e disputas simultâneas.
Privilégios anônimos e ausência de `TRUNCATE`/`TRIGGER` são conferidos no catálogo
para cada tabela. `TRUNCATE` não deve ser confiado à proteção de RLS.

## Decisão registrada na migração 30 (19/09/2026)

Administrador deixou de ter acesso clínico automático. Passa a depender do
papel clínico EFETIVO (`current_user_papel_clinico()`): Médico/Enfermeiro(a)
direto, ou, para Administrador, o que estiver em `perfis.papel_clinico_administrador`
— coluna nova, só preenchível por OUTRO Administrador ativo (nunca pelo
próprio titular, nem quando ele mesmo já é Administrador; bloqueado por
trigger e por um CHECK que também exige `funcao = 'Administrador'` na
linha). Sem concessão, Administrador não lê nem grava consulta, histórico
clínico ou modelo de receita — nem rascunho alheio, exceto o suporte a
conflito de concorrência já existente, preservado só para quem já tem
concessão. Com concessão, a conta tem exatamente a mesma regra de Médico
ou Enfermeiro(a), inclusive na identidade de assinatura (CRM/COREN).

Financeiro passa a só ler a agenda — perdeu `criar`/`editar` (INSERT/UPDATE
em `agendamentos`); exclusão continua restrita a Administrador, como já era.

Recepção, Configurações da Clínica, Filiais, Auditoria e Usuários não
mudaram: continuam de acesso administrativo, não tratado como clínico.

## Correções na migração 29

- As políticas de modelos antes dependiam apenas do autor: uma conta bloqueada
  conservava acesso aos próprios modelos. Agora exigem função de prescritor ativo.
- Privilégios mínimos passam a ser explícitos, removendo dependência dos grants
  padrão de cada projeto, inclusive `TRUNCATE`, `TRIGGER` e `REFERENCES`.
- Tabelas de pacientes/perfis mantêm leitura mascarada pelas views; recibos e
  auditoria não recebem privilégios de escrita para clientes.
- A matriz funcional restante foi preservada, sem atribuir decisões clínicas
  novas implicitamente durante a correção técnica.

## Decisões ainda necessárias

Enfermagem pode ler o histórico clínico, mas não emitir receita, prescrição ou
atestado — mantido como estava. As duas pendências anteriores (Administrador
acumulando função clínica, Financeiro com agenda irrestrita) foram resolvidas
na migração 30, acima. Qualquer restrição futura ainda deve alterar banco,
frontend e expectativas dos testes em conjunto.

Auditoria de leitura, testes HTTP de todos os domínios, regras de arquivos
anexados, isolamento entre organizações e permissões dos operadores do
Supabase permanecem fora desta matriz. Os testes não certificam configuração
de produção nem substituem validação clínica do fluxo.
