// Rascunhos temporários pertencem ao usuário e à aba. O registro durável
// continua sendo o salvo no servidor pelo botão "Salvar rascunho".
export const RASCUNHO_ATENDIMENTO_PREFIX = 'pep_rascunho_atendimento_';

function limparStorage(storage) {
  Object.keys(storage)
    .filter(chave => (chave.startsWith(RASCUNHO_ATENDIMENTO_PREFIX) || chave.startsWith('pep_operacao_clinica_')))
    .forEach(chave => storage.removeItem(chave));
}

export function limparRascunhosLegados() {
  // O formato antigo não identificava o autor: nunca atribuí-lo a quem
  // entrar depois na estação compartilhada.
  limparStorage(localStorage);
}

export function limparRascunhosAtendimento() {
  limparRascunhosLegados();
  limparStorage(sessionStorage);
}

function chaveRascunho(pacienteId, userId) {
  if (!pacienteId || !userId) throw new Error('Rascunho exige paciente e usuário autenticado.');
  return RASCUNHO_ATENDIMENTO_PREFIX + JSON.stringify([userId, pacienteId]);
}

export function lerRascunhoAtendimento(pacienteId, userId) {
  const bruto = sessionStorage.getItem(chaveRascunho(pacienteId, userId));
  if (!bruto) return { texto: '', registroId: null, versao: null };
  const dados = JSON.parse(bruto);
  if (typeof dados?.texto !== 'string' || (dados.registroId !== null && typeof dados.registroId !== 'string')) {
    throw new Error('O rascunho temporário está inválido.');
  }
  return { texto: dados.texto, registroId: dados.registroId, versao: Number.isInteger(dados.versao) ? dados.versao : null };
}

export function salvarRascunhoAtendimento(pacienteId, texto, registroId = null, userId, versao = null) {
  const chave = chaveRascunho(pacienteId, userId);
  if (texto && texto.trim()) {
    sessionStorage.setItem(chave, JSON.stringify({ texto, registroId, versao }));
    return true;
  }
  sessionStorage.removeItem(chave);
  return false;
}
