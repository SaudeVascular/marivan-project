// Estados do Brasil, usado nos formulários de conselho profissional (perfis) e endereço.
export const UFS = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];

// Funções oferecidas no cadastro de usuários (Administração → Usuários)
// — a mesma lista que a Edge Function admin-create-user aceita.
export const FUNCOES_USUARIO = ['Médico', 'Enfermeiro(a)', 'Psicólogo(a)', 'Fisioterapeuta', 'Recepcionista', 'Financeiro', 'Administrador'];

// Funções que são, por si só, papel clínico (migração 35:
// current_user_papel_clinico). Administrador só com papel concedido.
export const FUNCOES_CLINICAS = ['Médico', 'Enfermeiro(a)', 'Psicólogo(a)', 'Fisioterapeuta'];

// Sigla do conselho profissional de cada função clínica — o número fica
// em perfis.crm (nome histórico da coluna, de quando só havia médico).
// Mesma regra de identidade_profissional_atual (migração 35).
export const CONSELHO_POR_FUNCAO = {
  'Médico': 'CRM',
  'Enfermeiro(a)': 'COREN',
  'Psicólogo(a)': 'CRP',
  'Fisioterapeuta': 'CREFITO',
};

// Documentos que cada papel clínico NÃO emite. Espelha a função
// papel_clinico_pode_registrar (migração 35), que é quem de fato barra
// no banco; aqui só decide que botões/telas aparecem. Mantenha as duas
// em sincronia.
const TIPOS_BLOQUEADOS = {
  'Médico': [],
  'Enfermeiro(a)': ['Receituário', 'Prescrição', 'Atestado'],
  'Psicólogo(a)': ['Receituário', 'Prescrição'],
  'Fisioterapeuta': ['Receituário', 'Prescrição'],
};
export function podeEmitir(papelClinico, tipo) {
  const bloqueados = TIPOS_BLOQUEADOS[papelClinico];
  return Boolean(bloqueados) && !bloqueados.includes(tipo);
}

// Acesso clínico (Médico/Enfermeiro(a), e Administrador só com papel
// concedido por outro administrador — migração 30) não é mais uma lista
// estática: depende de `perfis.papel_clinico_administrador`, então vem de
// `funcaoClinicaEfetiva`/`temAcessoClinico` em useAuth, não de uma
// constante aqui. Ver docs/AUTORIZACAO.md.

// Mesmo conjunto liberado para gerenciar procedimentos/convênios/cobranças
// em supabase_financeiro.sql — mantenha os dois em sincronia. Médico entra
// à parte (só leitura das próprias cobranças), por isso não está aqui.
export const FUNCOES_FINANCEIRO = ['Financeiro', 'Administrador'];

// Quem faz check-in de paciente (Recepcionista) e Administrador, que
// precisa conseguir acessar qualquer tela para dar suporte/testar.
export const FUNCOES_RECEPCAO = ['Recepcionista', 'Administrador'];
