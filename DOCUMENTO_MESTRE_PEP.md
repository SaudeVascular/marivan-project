# Documento Mestre do Projeto — PEP

**Projeto:** Prontuário Eletrônico de Pacientes  
**Responsável clínico:** Dr. Marivan Araujo  
**Versão do documento:** 1.0  
**Data:** 10/07/2026  
**Status:** Protótipo funcional em desenvolvimento

---

## 1. Objetivo do sistema

Construir um Prontuário Eletrônico de Pacientes (PEP) em nuvem, responsivo para computador, tablet e celular, com foco em:

- uso simples e rápido durante o atendimento médico;
- armazenamento prioritário das informações digitadas pelo médico;
- acesso restrito por login e senha;
- separação de funções por perfil de usuário;
- possibilidade de expansão modular;
- segurança adequada ao tratamento de dados pessoais sensíveis.

O sistema deverá atender inicialmente uma clínica médica e poderá ser expandido para outras unidades, profissionais e especialidades.

---

## 2. Perfis de usuário previstos

### 2.1 Médico

Acesso a:

- cadastro e consulta de pacientes;
- prontuário clínico;
- evoluções médicas;
- receitas e prescrições;
- atestados;
- relatórios;
- pedidos de exames;
- laudos;
- histórico do paciente.

### 2.2 Enfermeiro

Acesso previsto a:

- triagem;
- sinais vitais;
- evolução de enfermagem;
- curativos;
- procedimentos de enfermagem;
- informações clínicas permitidas.

### 2.3 Recepcionista

Acesso previsto a:

- cadastro administrativo do paciente;
- agenda;
- confirmação de atendimento;
- telefone, endereço e convênio;
- status de chegada.

Não deverá visualizar evoluções médicas completas sem autorização específica.

### 2.4 Financeiro

Acesso previsto a:

- pagamentos;
- contas a receber;
- repasses;
- recibos;
- relatórios financeiros.

Não deverá visualizar conteúdo clínico do prontuário.

### 2.5 Administrador

Acesso a:

- criação e bloqueio de usuários;
- definição de funções e permissões;
- configurações da clínica;
- auditoria;
- parametrização de modelos;
- manutenção do sistema.

---

## 3. Arquitetura atual

### 3.1 Front-end

- React 19
- Create React App
- React Router
- Lucide React para ícones
- CSS próprio

### 3.2 Backend e banco de dados

- Supabase
- PostgreSQL
- Supabase Auth para login
- Row Level Security (RLS)

### 3.3 Estrutura atual relevante

```text
src/
├── App.js
├── App.css
├── components/
│   ├── Login.js
│   ├── ProntuarioEletronico.js
│   ├── common/
│   ├── consultas/
│   ├── pacientes/
│   └── relatorios/
├── hooks/
│   ├── useAuth.js
│   ├── usePacientes.js
│   ├── useConsultas.js
│   ├── useAnexos.js
│   └── useAutoSave.js
├── services/
│   ├── supabase.js
│   ├── authService.js
│   ├── pacientes.service.js
│   ├── consultas.service.js
│   ├── registros.service.js
│   ├── usuarios.service.js
│   ├── modelos.service.js
│   ├── anexos.service.js
│   └── storageService.js
├── utils/
└── data/
```

### 3.4 Variáveis de ambiente

O projeto usa:

```text
REACT_APP_SUPABASE_URL
REACT_APP_SUPABASE_ANON_KEY
```

Essas variáveis ficam no arquivo `.env.local`.

Nunca inserir nesse arquivo uma chave `service_role` no front-end.

---

## 4. Banco de dados atual

### 4.1 Tabela `pacientes`

Campos identificados:

- id
- nome
- cpf
- nascimento
- nome_mae
- telefone
- convenio
- cep
- endereco
- alergias
- hipertensão arterial
- diabetes
- doença arterial coronariana
- dislipidemia
- tabagismo
- etilismo
- cirurgias
- medicamentos em uso
- ativo
- created_by
- created_at
- updated_at

### 4.2 Tabela `consultas`

Atualmente é usada como tabela genérica de registros clínicos e documentos.

Tipos previstos:

- Consulta
- Atestado
- Receituário
- Prescrição
- Relatório
- Pedido de Exames
- Laudo

Campos clínicos encontrados:

- queixa principal
- exame físico
- hipótese diagnóstica
- conduta
- pressão arterial
- frequência cardíaca
- temperatura
- peso
- altura
- saturação

### 4.3 Tabela `medicamentos_receita`

Armazena itens vinculados a uma consulta ou receituário.

### 4.4 Tabela `perfis`

Campos identificados:

- id
- nome
- email
- função
- ativo
- nascimento
- sexo
- cpf
- especialidade
- área de atuação
- CRM

### 4.5 Tabela `modelos_receita`

Armazena modelos pessoais de prescrição por usuário.

---

## 5. Funcionalidades já implementadas ou parcialmente implementadas

- login por e-mail e senha usando Supabase Auth;
- proteção básica de rotas para usuário autenticado;
- cadastro e listagem de pacientes;
- edição de paciente;
- busca por nome e CPF;
- formatação de CPF, telefone e CEP;
- consulta automática de endereço pelo ViaCEP;
- prontuário com diferentes tipos de registro;
- receitas e modelos de receita;
- atestados;
- relatórios;
- pedidos de exames;
- laudos;
- gestão inicial de usuários;
- impressão de documentos;
- build de produção já gerada.

---

## 6. Situação atual do projeto

### Classificação

**Protótipo funcional avançado, ainda não liberado para uso clínico real.**

### Pontos positivos

- aplicação executa normalmente;
- autenticação está integrada ao Supabase;
- estrutura de banco já foi iniciada;
- existem serviços separados para várias entidades;
- há componentes e hooks organizados;
- existem políticas RLS básicas;
- o sistema já possui funções clínicas relevantes.

### Pontos que exigem correção antes do uso real

1. ~~O arquivo `App.js` concentra grande quantidade de lógica e interface.~~ Resolvido em 30/07/2026 — dividido por domínio em `src/pages/`, `App.js` ficou só com providers e rotas (~300 linhas). Ver registro de decisões.
2. Existem dados fictícios de pacientes dentro do código.
3. As permissões atuais do banco permitem que qualquer usuário autenticado veja, crie e edite todos os pacientes e consultas.
4. Ainda não existe separação efetiva de acesso entre médico, recepção, enfermagem e financeiro.
5. Não foi identificada auditoria completa de visualização e alteração.
6. Não existe recuperação de senha na tela de login.
7. Não foi confirmada política de backup, retenção e restauração.
8. Não foi confirmada autenticação em dois fatores.
9. Não foi confirmada assinatura digital dos documentos.
10. Não há documentação técnica própria; o README atual é o padrão do Create React App.
11. Existem arquivos de backup e cópias antigas dentro de `src`, que devem ser organizados.
12. A aplicação ainda precisa de revisão de segurança antes de receber dados reais.

---

## 7. Regra principal de segurança

Até que a revisão de segurança seja concluída, utilizar apenas dados fictícios ou anonimizados no ambiente de desenvolvimento.

O projeto não deve ser considerado pronto para armazenar prontuários reais apenas porque possui login.

Login é apenas uma das camadas de segurança.

---

## 8. Regras de negócio iniciais

### 8.1 Cadastro de paciente

Campos mínimos para salvar:

- nome do paciente;
- telefone de contato;
- pelo menos um dos seguintes:
  - CPF;
  - data de nascimento;
  - nome da mãe.

Regras:

- CPF não pode ser duplicado;
- CPF deve aceitar apenas números durante a digitação e ser exibido formatado;
- cadastro deve permanecer editável;
- exclusão deve ser preferencialmente lógica, usando `ativo = false`;
- alterações importantes devem gerar registro de auditoria.

### 8.2 Prontuário

- cada registro deve possuir data, hora e autor;
- registros concluídos não devem ser apagados sem rastreabilidade;
- correções devem preservar o conteúdo anterior;
- o histórico deve ser cronológico;
- cada documento deve estar vinculado ao paciente e ao profissional responsável.

### 8.3 Permissões

- médico: acesso clínico completo conforme autorização;
- enfermeiro: acesso a registros de enfermagem e dados necessários ao cuidado;
- recepcionista: acesso prioritariamente administrativo;
- financeiro: acesso financeiro, sem conteúdo clínico;
- administrador: acesso administrativo e auditoria, com controles reforçados.

---

## 9. Roadmap recomendado

### Fase 1 — Organização e segurança da base

- substituir o README padrão por documentação do projeto;
- remover dados fictícios do código principal;
- dividir o `App.js` em páginas e componentes menores;
- revisar todas as políticas RLS;
- implementar permissões por função;
- criar tabela de auditoria;
- implementar recuperação de senha;
- revisar variáveis de ambiente;
- remover arquivos antigos e backups do diretório `src`;
- criar ambiente de desenvolvimento separado do ambiente de produção.

### Fase 2 — Núcleo clínico

- finalizar cadastro de pacientes;
- finalizar consulta médica;
- histórico cronológico;
- receitas;
- atestados;
- relatórios;
- pedidos de exames;
- laudos;
- autosave com controle de versões;
- validação de campos clínicos.

### Fase 3 — Módulos profissionais

- módulo de enfermagem;
- módulo de recepção;
- agenda;
- módulo financeiro;
- permissões específicas por módulo;
- painel administrativo.

### Fase 4 — Produção

- hospedagem em nuvem;
- domínio próprio;
- HTTPS;
- backups automáticos;
- testes de restauração;
- logs de segurança;
- monitoramento de erros;
- política de privacidade;
- termos internos de confidencialidade;
- plano de resposta a incidentes;
- validação jurídica, regulatória e de segurança.

---

## 10. Próxima tarefa recomendada

**Criar a documentação dentro do projeto e fazer uma cópia segura antes de alterar o código.**

Ordem sugerida:

1. salvar este arquivo na raiz do projeto como `DOCUMENTO_MESTRE_PEP.md`;
2. confirmar o repositório Git ativo;
3. criar um commit de segurança;
4. criar uma branch para as próximas alterações;
5. mapear todas as telas e rotas atuais;
6. corrigir primeiro a recuperação de senha;
7. revisar as permissões do Supabase.

---

## 11. Convenções para o desenvolvimento

### Código

- uma funcionalidade por componente sempre que possível;
- nomes claros em português ou inglês, sem mistura aleatória;
- não guardar dados clínicos em variáveis fixas no código;
- não registrar dados sensíveis no console;
- não expor chaves administrativas no front-end;
- validar os dados no front-end e no banco;
- registrar alterações relevantes.

### Git

Cada mudança deve ser salva com uma mensagem clara, por exemplo:

```text
feat: adiciona recuperação de senha
fix: corrige validação de CPF
security: restringe acesso de recepcionista ao prontuário
refactor: divide App.js em páginas
```

### Testes

Antes de considerar uma função concluída:

- testar no computador;
- testar em largura de tablet;
- testar em largura de celular;
- testar usuário autorizado;
- testar usuário sem permissão;
- testar erro de conexão;
- testar campos vazios e dados inválidos.

---

## 12. Registro de decisões

| Data | Decisão | Motivo |
|---|---|---|
| 10/07/2026 | Manter React e Supabase nesta fase | O projeto já está funcional nessa arquitetura |
| 10/07/2026 | Criar Documento Mestre | Evitar perda de contexto e organizar a evolução |
| 10/07/2026 | Não usar dados reais antes da revisão de segurança | As permissões atuais ainda são amplas |
| 10/07/2026 | Priorizar organização, recuperação de senha e RLS | São pontos críticos antes da expansão |
| 27/07/2026 | Mascarar alergias/antecedentes clínicos por view (`pacientes_view`), não só na tela | RLS de `pacientes` não filtra coluna, só linha; Recepcionista precisa do cadastro administrativo mas não do dado clínico |
| 27/07/2026 | Ampliar leitura de `perfis` pra qualquer usuário ativo ver colegas ativos, mascarando cpf/nascimento/sexo por view (`perfis_view`) | RLS anterior só deixava ver o próprio perfil ou Administrador ver todos — Recepcionista não conseguia listar Médico/Enfermeiro(a) pra agendar, e Financeiro não conseguia listar médico pra lançar cobrança nem mostrar nome no recibo |
| 27/07/2026 | Módulo de Enfermagem: tela de Sinais Vitais/Triagem, evolução de enfermagem com tipo próprio no histórico, e Receituário/Prescrição/Atestado restritos a Médico/Administrador (tela e RLS) | Seção 2.2 do Documento Mestre não lista atos exclusivos de CRM no acesso do Enfermeiro; sinais vitais tinham colunas na tabela desde o schema original mas nenhuma tela usava |
| 27/07/2026 | Painel Administrativo unificado (/painel) reunindo Usuários, Auditoria e nova tela de Configurações da Clínica; nome/endereço/telefone saem do código (`CLINICA` fixo) e viram tabela `configuracoes_clinica` editável | Seção 2.5 lista "configurações da clínica" no acesso do Administrador; dado fixo no código impedia corrigir informação administrativa sem mexer no código — e a pendência #2 (nome/dados reais da clínica) segue aberta até o Administrador preencher pela tela nova |
| 27/07/2026 | Configurações da Clínica ganha Nome Fantasia (no lugar de "subtitulo"), CNPJ, logomarca (upload, bucket público) e CEP separado com busca automática de endereço (ViaCEP) | Pedido direto do usuário após ver a primeira versão da tela; CNPJ e logomarca são esperados em documento impresso de clínica real |
| 27/07/2026 | Configurações da Clínica ganha número/complemento no endereço, modo de visualização com botão "Editar" explícito, e auditoria de alterações; nova tela de Filiais (cadastro de outras unidades, mesma estrutura de dados, cada uma com logomarca própria) | Pedido direto do usuário; exigir "Editar" antes de mexer, mais o trigger de auditoria já usado em outras tabelas, cria rastro de quem alterou os dados da clínica |
| 28/07/2026 | Rodada de estabilização após revisão externa (ChatGPT): corrigidos os 4 avisos do ESLint sem desativar regra nenhuma, `npm test` voltou a funcionar (Jest não resolvia `react-router-dom`/`react-router` — `moduleNameMapper` em `package.json` + polyfill de `TextEncoder` em `setupTests.js` + `.env.test` com credenciais falsas), removido fallback silencioso que fingia salvar atendimento/documento clínico quando a gravação no Supabase falhava, rascunho de atendimento passa a ser apagado do navegador no logout, criado `.env.example` | `npm ci` limpo confirmou que a falha do Jest era um bug real do pacote `react-router-dom` (não do node_modules do projeto) — `dist/main.js` declarado no `package.json` dele não existe nem recém-instalado; fallback silencioso é risco clínico real (profissional acredita que salvou e o registro não existe no banco); rascunho em localStorage sobrevivendo ao logout expõe dado clínico a quem usar o navegador depois |
| 30/07/2026 | Divide `App.js` (4903 linhas) por domínio em `src/pages/*`, `src/components/` (Layout, guards) e `src/constants/roles.js` — `App.js` final só com providers e rotas (~300 linhas) | Item 1 da lista de "pontos que exigem correção antes do uso real" desde a criação deste documento; build e teste automatizado verificados a cada domínio movido (nenhuma lógica alterada, só localização do código), tamanho do bundle final idêntico ao de antes do refactor |

---

## 13. Pendências abertas

- [ ] Confirmar nome definitivo do sistema.
- [ ] Confirmar nome e dados reais da clínica.
- [ ] Definir especialidades atendidas.
- [ ] Definir campos obrigatórios do cadastro.
- [ ] Definir fluxo completo da consulta.
- [ ] Definir permissões de cada função.
- [ ] Definir se haverá múltiplas clínicas ou unidades.
- [ ] Definir regras de assinatura dos documentos.
- [ ] Definir estratégia de hospedagem.
- [ ] Definir política de backup e retenção.
- [ ] Definir responsável administrativo pelo sistema.
- [ ] Definir ambiente de homologação e produção.

---

## 14. Histórico de versões deste documento

| Versão | Data | Alteração |
|---|---|---|
| 1.0 | 10/07/2026 | Criação do documento a partir da análise do projeto atual |
