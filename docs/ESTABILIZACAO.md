# Estabilização do PEP

## Primeira etapa — 19/09/2026

Implementada localmente, sem publicação nem alterações no banco remoto.

- Receituário: quantidade e via de administração passam a compor o conteúdo
  salvo no prontuário, junto dos demais campos já preservados.
- Datas: registros, retificações, documentos, agenda, recepção e financeiro
  usam a data civil local, coerente com o horário local exibido. O timestamp
  de assinatura continua sendo produzido pelo banco.
- Rascunhos: texto temporário em `sessionStorage`, identificado pelo usuário
  e paciente. A interface informa que é necessário salvar no servidor antes
  de fechar a aba ou sair. Falhas de armazenamento recebem aviso e não
  transformam uma gravação confirmada no servidor em erro de gravação.
- Sessões: mudança de usuário ou função remonta a área de dados, descartando
  cache e respostas pendentes da sessão anterior. Logout também limpa
  rascunhos temporários.
- Carregamento: falhas de pacientes e histórico aparecem com opção de nova
  tentativa. Erro no histórico não é apresentado como ausência de registros.
- Autosave: aguarda o resultado da gravação, informa erros e não apresenta
  confirmação de uma versão antiga como confirmação do texto atual.

### Antes de publicar esta etapa

Rascunhos do formato antigo em `localStorage` não têm identificação do autor
e serão removidos na inicialização. Antes de atualizar uma estação em uso,
salve os atendimentos pendentes no servidor pela versão atual. Registros já
salvos no banco não são removidos por esta mudança. Receitas antigas não têm
seus campos omitidos reconstruídos: a correção vale para novas gravações.

`sessionStorage` reduz persistência e compartilhamento entre abas, mas não
oferece proteção contra acesso ao perfil do navegador. Alguns navegadores
podem restaurar sessões ou copiar seu estado ao duplicar abas; não é mecanismo
de expiração no servidor nem resolve edição concorrente de um registro salvo.

Validar em homologação: login e troca de usuário, reload, fechamento de aba,
duas abas, reconexão, impressão e larguras de desktop/tablet/celular.

## Segunda etapa — gravação idempotente e concorrência

Implementada localmente em 19/09/2026, sem aplicar a migração em homologação
ou produção e sem publicar o frontend.

- Migração `20260919000028_gravacao_clinica_segura.sql`: acrescenta `versao`
  aos registros e um recibo de operação associado ao autor e a um UUID.
- A função `salvar_registro_clinico` executa criação, edição ou assinatura
  em uma transação. O identificador repetido com o mesmo pedido retorna o
  recibo original; um pedido diferente com o mesmo identificador é recusado.
- A função compara a versão esperada sob bloqueio da linha. Duas edições
  concorrentes não sobrescrevem silenciosamente uma à outra. Salvar texto e
  assinar ocorre na mesma transação, mantendo os triggers de autoria,
  imutabilidade, retificação e auditoria.
- O navegador persiste a operação antes de enviá-la. Em falha de rede/timeout,
  repete o mesmo pedido para obter sua confirmação. Se o resultado continuar
  incerto, mantém o pedido para a próxima tentativa na mesma aba. A identidade
  só é removida após a tela incorporar o resultado; no atendimento, isso
  inclui persistir o vínculo e a versão do rascunho.
- Se o profissional editar o texto depois de uma falha, a confirmação da
  tentativa anterior não é apresentada como confirmação do texto novo:
  o registro recuperado aparece no histórico e a edição atual é preservada.
- Em conflito, a interface permite consultar a versão atual e escolher
  explicitamente qual texto usar. Se o registro já foi assinado, permite
  iniciar uma retificação com o texto preservado.
- Gravações diretas de `authenticated`/`anon` em `consultas` são revogadas.
  A RPC verifica usuário ativo, função, paciente e autoria; não aceita
  identidade de assinatura fornecida pelo navegador. O recibo não tem acesso
  direto pelo frontend. As permissões profissionais existentes foram
  preservadas nesta etapa; sua revisão permanece pendente.
- Formulários ficam bloqueados durante gravação/reconciliação. O cache é
  atualizado por ID e versão, sem duplicar uma confirmação nem substituir
  uma versão mais recente por um recibo antigo.

### Validação

- 79 testes de frontend aprovados em 18 suítes, com `TZ=America/Bahia`.
- Build de produção, conferência das migrações iniciais e verificação de
  segredos nos arquivos rastreados aprovados.
- Testes de frontend abrangem timeout, resposta perdida após commit, duplo
  clique, tentativa posterior com o mesmo ID, texto alterado após falha,
  assinatura única, versão obsoleta e escolha explícita no conflito.
- `npm run db:test:clinical` executa fixtures transacionais e abre conexões
  PostgreSQL simultâneas para disputar criação, edição e assinatura. O script
  aceita apenas banco local descartável e remove suas fixtures ao terminar.
- Testado localmente em PostgreSQL descartável com as 28 migrações e funções
  auxiliares mínimas de Auth/Storage; a verificação P0 também passou. Isso
  valida transações, triggers e privilégios do PostgreSQL, mas não equivale
  a um teste HTTP completo com Supabase Auth/PostgREST.
- A integração contínua agora executa os mesmos testes de banco sobre o
  Supabase descartável. A primeira execução remota revelou a ausência de um
  `GRANT SELECT` explícito em `consultas` num banco novo. A migração 28 passa
  a conceder essa leitura a `authenticated`, sujeita à política RLS existente.

### Publicação e limites

1. Aplicar a migração em homologação e publicar o frontend compatível.
2. Validar os fluxos com Auth/PostgREST reais e duas sessões de navegador.
3. Coordenar a atualização em produção: abas com o frontend antigo deixam
   de gravar diretamente depois da migração e precisam ser recarregadas.
4. Rascunhos antigos sem versão são preservados, mas exigem consultar/comparar
   a versão atual antes de editar. Não se inventa uma versão automaticamente.

Mantenha a aba aberta enquanto uma gravação estiver sem confirmação. O pedido
pendente contém texto clínico e é removido no logout junto dos rascunhos;
fechar a aba/limpar seu armazenamento perde a identidade local para repetição.
Nessa situação, confira o histórico antes de iniciar um novo documento.
A idempotência vale por operação, não elimina documentos legitimamente iguais
criados com identificadores diferentes. O diário de recibos no servidor deve
ser incluído na política de retenção e backups junto à auditoria.

As garantias desta etapa cobrem os registros de `consultas` escritos pelo app
(atendimentos, documentos, sinais vitais e retificações). Edição cadastral,
antecedentes do paciente, agenda, financeiro e eventuais integrações que
escrevam itens diretamente em `medicamentos_receita` exigem análise própria.

Referências de implementação: bloqueios transacionais e por linha na
[documentação do PostgreSQL](https://www.postgresql.org/docs/current/explicit-locking.html)
e restrição de privilégios/search_path em
[funções SECURITY DEFINER](https://www.postgresql.org/docs/current/sql-createfunction.html).

## Próximas etapas

1. Separação de permissões administrativas e profissionais no banco e no
   frontend, com matriz de testes por função.
2. Paginação/busca de pacientes no servidor e carregamento independente por ID.
3. Validação completa em homologação, auditoria de leitura e comprovação
   operacional de MFA, backups, restauração e monitoramento.

O projeto continua sem liberação para dados reais. Estas etapas não fecham as
pendências acima nem comprovam a configuração do ambiente publicado.
