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
