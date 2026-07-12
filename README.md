# PEP — Prontuário Eletrônico de Pacientes

Sistema de prontuário eletrônico em nuvem para uso em clínica médica, com acesso por
login, perfis de usuário (médico, enfermagem, recepção, administrador) e prontuário
clínico completo (evoluções, receituários, atestados, relatórios, pedidos de exame,
laudos).

> **Antes de mexer no código ou no banco, leia [`DOCUMENTO_MESTRE_PEP.md`](./DOCUMENTO_MESTRE_PEP.md).**
> É a fonte de verdade sobre objetivo do sistema, perfis de usuário, regras de negócio,
> situação atual e roadmap. Este README cobre só a parte prática de rodar o projeto.

## Status

Protótipo funcional em desenvolvimento, **ainda não liberado para dados reais de
pacientes** — ver seção 7 do Documento Mestre. Use apenas dados fictícios ou
anonimizados até a revisão de segurança ser concluída.

## Stack

- React 19 + Create React App
- React Router (rotas reais, não troca de tela por estado)
- Supabase (Postgres + Auth + Row Level Security)
- Lucide React (ícones)
- CSS próprio (sem framework de UI)

## Rodando localmente

1. Instale as dependências:

   ```bash
   npm install
   ```

2. Crie um arquivo `.env.local` na raiz com as credenciais do projeto Supabase:

   ```
   REACT_APP_SUPABASE_URL=
   REACT_APP_SUPABASE_ANON_KEY=
   ```

   Use sempre a chave `anon`, **nunca** a `service_role`, no front-end.

3. Suba o servidor de desenvolvimento:

   ```bash
   npm start
   ```

   Abre em [http://localhost:3000](http://localhost:3000).

### Testar em celular/tablet na mesma rede

Com o `npm start` rodando, descubra o IP local do computador (`ipconfig getifaddr en0`
no Mac) e acesse `http://SEU-IP:3000` pelo navegador do celular, desde que os dois
estejam na mesma rede Wi-Fi. Isso não é acesso público — só funciona dentro da mesma
rede local. Acesso de qualquer lugar exige hospedar o app de verdade (Fase 4 do
Documento Mestre, ainda não feita).

### Outros scripts

```bash
npm run build   # build de produção em build/
npm test        # roda os testes
```

## Banco de dados (Supabase)

O schema e as políticas de acesso não são aplicados automaticamente — cada arquivo
`supabase_*.sql` na raiz do projeto precisa ser rodado manualmente no **SQL Editor**
do painel do Supabase. Em um projeto novo, rode nesta ordem:

1. `supabase_schema.sql` — tabelas base: `pacientes`, `consultas`, `medicamentos_receita`
2. `supabase_usuarios.sql` — tabela `perfis` + trigger que cria o perfil no cadastro
3. `supabase_fix_trigger.sql` — corrige esse trigger para não travar o cadastro em caso de erro
4. `supabase_perfis_extra.sql` — colunas extras em `perfis` (nascimento, sexo, cpf, especialidade, área de atuação)
5. `supabase_crm.sql` — coluna `crm` em `perfis`
6. `supabase_modelos_receita.sql` — tabela `modelos_receita` (modelos de prescrição por usuário)
7. `supabase_pedido_exames.sql` — adiciona os tipos "Pedido de Exames" e "Laudo" em `consultas`
8. `supabase_rls_rbac.sql` — substitui as políticas de RLS por controle de acesso por função (perfis.funcao)
9. `supabase_auditoria.sql` — tabela de auditoria + triggers de registro automático

Os arquivos são idempotentes (podem ser rodados mais de uma vez sem quebrar nada).

## Perfis de usuário e permissões

Resumo — regras completas na seção 2 e 8.3 do Documento Mestre:

| Função | Acesso |
|---|---|
| Médico / Enfermeiro(a) | Cadastro de pacientes + prontuário clínico completo |
| Recepcionista | Só cadastro de pacientes (telas clínicas ficam bloqueadas, no app e no banco) |
| Administrador | Tudo, mais gestão de usuários (`/usuarios`) e auditoria (`/auditoria`) |

O controle é feito em duas camadas: no app (rotas escondidas/redirecionadas por
função) e no banco (Row Level Security em `supabase_rls_rbac.sql`) — a segunda é a
que realmente importa para segurança, a primeira é só experiência de uso.

## Estrutura do projeto

```
src/
├── App.js                    # rotas e a maior parte das telas
├── components/
│   ├── Login.js
│   └── common/SaveStatus.js
├── hooks/
│   ├── useAuth.js            # sessão + perfil/função do usuário logado
│   ├── useMedicoPerfil.js    # autofill de médico/CRM/especialidade nos documentos
│   ├── usePacienteAtual.js   # paciente atual a partir da URL
│   ├── useAnexos.js          # upload de anexos (não usado no app ainda)
│   └── useAutoSave.js        # debounce de autosave (não usado no app ainda)
├── services/                 # um arquivo por entidade, todos falando com o Supabase
└── utils/formatters.js       # formatação de data, CPF, telefone etc.
```

## Convenções

Ver seção 11 do Documento Mestre (código, git, testes). Resumo rápido:
- Não guardar dados clínicos fixos no código, nem logar dados sensíveis no console.
- Mensagens de commit com prefixo (`feat:`, `fix:`, `refactor:`, `security:`, `chore:`).
- Testar sempre em largura de desktop, tablet e celular antes de considerar uma tela pronta.
