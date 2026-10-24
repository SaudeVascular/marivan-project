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

// Registros/documentos que cada papel clínico pode emitir. Espelha a
// função papel_clinico_pode_registrar (migração 39), que é quem de fato
// barra no banco; aqui só decide que botões/telas aparecem. Mantenha as
// duas em sincronia. Médico emite tudo; as demais profissões, só o que é
// ato da profissão (tipo novo nasce bloqueado).
const TIPOS_PERMITIDOS = {
  'Enfermeiro(a)': ['Consulta', 'Evolução de Enfermagem', 'Sinais Vitais'],
  'Psicólogo(a)': ['Consulta', 'Atestado', 'Relatório'],
  'Fisioterapeuta': ['Consulta', 'Atestado', 'Relatório'],
};
export function podeEmitir(papelClinico, tipo) {
  if (papelClinico === 'Médico') return true;
  return (TIPOS_PERMITIDOS[papelClinico] || []).includes(tipo);
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
