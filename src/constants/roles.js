// Estados do Brasil, usado nos formulários de CRM (perfis) e endereço.
export const UFS = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];

// Mesmo conjunto de funções liberado para consultas/medicamentos_receita
// em supabase_rls_rbac.sql — mantenha os dois em sincronia.
export const FUNCOES_CLINICAS = ['Médico', 'Enfermeiro(a)', 'Administrador'];

// Atos exclusivos de quem tem CRM (seção 2.1 do Documento Mestre: receitas
// e prescrições, atestados — não listados no acesso do Enfermeiro em 2.2).
// Mesmo conjunto liberado para criar esses tipos em supabase_enfermagem.sql
// — mantenha os dois em sincronia.
export const FUNCOES_MEDICO = ['Médico', 'Administrador'];

// Mesmo conjunto liberado para gerenciar procedimentos/convênios/cobranças
// em supabase_financeiro.sql — mantenha os dois em sincronia. Médico entra
// à parte (só leitura das próprias cobranças), por isso não está aqui.
export const FUNCOES_FINANCEIRO = ['Financeiro', 'Administrador'];

// Quem faz check-in de paciente (Recepcionista) e Administrador, que
// precisa conseguir acessar qualquer tela para dar suporte/testar.
export const FUNCOES_RECEPCAO = ['Recepcionista', 'Administrador'];

// Aba própria da enfermagem (seção 2.2 do Documento Mestre), separada do
// Cadastro de Pacientes genérico. Administrador entra pra dar suporte/testar.
export const FUNCOES_ENFERMAGEM = ['Enfermeiro(a)', 'Administrador'];
