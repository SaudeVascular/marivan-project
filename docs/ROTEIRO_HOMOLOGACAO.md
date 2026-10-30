# Roteiro de homologação acompanhada

Para fazer com a equipe antes de ampliar o uso do PEP, de preferência num
link de teste da Vercel (banco de homologação, só contas e pacientes
fictícios). Anote em cada item: data, quem fez, resultado (OK/falhou) e
o que apareceu na tela.

Para "tirar a rede": desligar o Wi-Fi do computador, ou, no Chrome,
Ferramentas do desenvolvedor → Rede → "Off-line".

## 1. Sessão

| # | Passo | Esperado |
|---|---|---|
| 1.1 | Entrar, abrir um paciente, clicar em **Sair** | Tela de login na hora |
| 1.2 | Entrar, tirar a rede, clicar em **Sair** | Tela de login na hora, com o aviso amarelo "Você saiu deste computador…" |
| 1.3 | Continuando 1.2: voltar a rede, sem recarregar a aba | O aviso amarelo some em alguns segundos |
| 1.4 | Continuando: tentar voltar para `/pacientes` pelo endereço | Volta para o login |
| 1.5 | Entrar e não mexer por 15 minutos | Sai sozinho; o login avisa "encerrada após 15 minutos de inatividade" |
| 1.6 | Repetir 1.5 com a rede tirada aos 10 minutos | Sai sozinho mesmo assim |
| 1.7 | Entrar como Médico, sair, entrar como Recepção no mesmo computador | Nenhum dado do Médico aparece (pacientes, histórico, rascunho) |
| 1.8 | Desativar uma conta (Administrador) com ela logada em outro computador | Ela não lê nem grava mais nada (o banco recusa); ao recarregar a página, vai para o login |

## 2. Senha e convite

| # | Passo | Esperado |
|---|---|---|
| 2.1 | "Esqueci minha senha" com um e-mail de teste | E-mail chega; o link abre "Redefinir senha" |
| 2.2 | Definir senha nova | Login com a senha nova funciona; a antiga não |
| 2.3 | Administrador cria um usuário novo | Convite chega; "Ativar conta" define a senha |
| 2.4 | Trocar a senha em **Minha conta** | Outras sessões abertas do mesmo usuário são encerradas |

## 3. Prontuário e rede interrompida

| # | Passo | Esperado |
|---|---|---|
| 3.1 | Digitar num atendimento e esperar 10 s | "Salvo no prontuário às…" |
| 3.2 | Tirar a rede, digitar mais, esperar | Aviso de falha; o texto continua na tela |
| 3.3 | Voltar a rede | Salva sozinho em até 30 s |
| 3.4 | Abrir o mesmo paciente em duas abas, editar o cadastro nas duas | A segunda gravação avisa do conflito, não sobrescreve |
| 3.5 | Tirar a rede e abrir um paciente pelo endereço | "Não foi possível carregar o paciente…" com **Tentar novamente** — não "Paciente não encontrado" |
| 3.6 | Finalizar e assinar | Registro fica assinado; não dá para editar, só retificar |

## 4. Documentos e impressão

| # | Passo | Esperado |
|---|---|---|
| 4.1 | Abrir Atestado com a rede tirada antes da tela carregar | Aviso de dados profissionais; Salvar e Imprimir bloqueados |
| 4.2 | Voltar a rede, **Tentar novamente** | Botões liberados; nome e registro no rodapé |
| 4.3 | Conta sem número do conselho abre um documento | Aviso pedindo para completar o cadastro; bloqueado |
| 4.4 | Imprimir receita, atestado, pedido de exames e guia SP/SADT | PDF com paciente, profissional, registro e assinatura certos |

## 5. Financeiro

| # | Passo | Esperado |
|---|---|---|
| 5.1 | Período com cobranças | Totais conferem com a soma da lista |
| 5.2 | Tirar a rede e trocar o período | "Indisponível" e o aviso, nunca R$ 0,00 |
| 5.3 | Voltar a rede, **Recarregar totais** | Totais aparecem |
| 5.4 | Financeiro → Convênios e tabelas: preencher os dados de uma operadora com CNPJ errado | Aviso "CNPJ inválido"; nada salvo |
| 5.5 | Importar a planilha da tabela do convênio (.xls ou .xlsx) com uma linha de valor errado | Prévia aponta a linha; só importa marcando "só as linhas certas" |
| 5.6 | Importar de novo com "Substituir a tabela inteira" | Pede confirmação; o que não estava no arquivo sai da tabela |
| 5.7 | Administração → Usuários: definir o repasse de dois profissionais com percentuais diferentes | Cada um mostra as próprias regras |
| 5.8 | Agendar e atender um paciente de cada profissional | A cobrança pendente traz o repasse do profissional e do tipo do procedimento |
| 5.9 | Como profissional, Relatório de produção do mês; trocar para intervalo de dias; imprimir | Só a própria produção; o papel traz o cabeçalho da clínica e o período |
| 5.10 | Como Administrador, relatório de todos e depois de um profissional e de um procedimento | Totais por profissional e por procedimento conferem com a lista; "Fica para a clínica" = produção − repasse |
| 5.11 | Recepção: paciente particular do dia → **Receber**, desconto de 10% e PIX | Mostra "Recebido R$ …"; no Financeiro, desconto R$ e %, valor pago e as partes da clínica e do profissional |
| 5.12 | Financeiro: cobrança de convênio → **Receber** com glosa parcial | Recebido = valor − glosa; repasse calculado sobre o recebido |
| 5.13 | Relatório de produção: trocar a visão (completo, só clínica, só profissional, por profissional, por especialidade, por tipo) | Cada visão traz as colunas certas e a soma no fim |

## 6. Backup e restauração (com quem administra a Supabase)

| # | Passo | Esperado |
|---|---|---|
| 6.1 | Conferir no painel da Supabase (produção) os backups automáticos e a retenção | Backups diários listados |
| 6.2 | Restaurar um backup num projeto de teste separado (nunca sobre a produção) | Projeto sobe; contagens de pacientes e registros conferem |
| 6.3 | Registrar data, duração da restauração e quem fez | Vira a evidência de RPO/RTO do Documento Mestre |
