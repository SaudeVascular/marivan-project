// Rascunho local do atendimento em digitação (ProntuarioPage) — protege
// contra perda de texto se a aba fechar/travar antes de "Salvar
// Atendimento". Guardado só no navegador, nunca é o registro oficial.
//
// O prefixo é compartilhado com useAuth (limparRascunhosAtendimento): um
// rascunho clínico não pode sobreviver ao logout no mesmo navegador —
// outra pessoa pode logar em seguida na mesma máquina.
export const RASCUNHO_ATENDIMENTO_PREFIX = 'pep_rascunho_atendimento_';

export function limparRascunhosAtendimento() {
  Object.keys(localStorage)
    .filter((chave) => chave.startsWith(RASCUNHO_ATENDIMENTO_PREFIX))
    .forEach((chave) => localStorage.removeItem(chave));
}

// Guarda o texto junto do id do registro "Rascunho" já salvo no servidor
// (se houver) — sem isso, sair da tela do prontuário e voltar (ou só
// trocar de aba) perde o vínculo com o rascunho já persistido: o próximo
// "Salvar rascunho"/"Finalizar e Assinar" cria uma linha nova em vez de
// reaproveitar a existente, deixando um rascunho órfão duplicado e
// visível pra equipe toda no histórico do paciente.
export function lerRascunhoAtendimento(pacienteId) {
  const bruto = localStorage.getItem(RASCUNHO_ATENDIMENTO_PREFIX + pacienteId);
  if (!bruto) return { texto: '', registroId: null };
  try {
    const dados = JSON.parse(bruto);
    if (dados && typeof dados === 'object') {
      return { texto: dados.texto || '', registroId: dados.registroId || null };
    }
  } catch {
    // formato antigo (texto puro, salvo antes do campo registroId existir)
  }
  return { texto: bruto, registroId: null };
}

export function salvarRascunhoAtendimento(pacienteId, texto, registroId = null) {
  if (texto && texto.trim()) {
    localStorage.setItem(RASCUNHO_ATENDIMENTO_PREFIX + pacienteId, JSON.stringify({ texto, registroId }));
    return true;
  }
  localStorage.removeItem(RASCUNHO_ATENDIMENTO_PREFIX + pacienteId);
  return false;
}
