export const TEMPO_INATIVIDADE_MS = 15 * 60 * 1000;
export const SENHA_MINIMO_CARACTERES = 12;

export function validarSenha(senha) {
  if (senha.length < SENHA_MINIMO_CARACTERES) {
    return `A senha deve ter pelo menos ${SENHA_MINIMO_CARACTERES} caracteres.`;
  }
  if (!/[a-z]/.test(senha) || !/[A-Z]/.test(senha) || !/[0-9]/.test(senha)) {
    return 'A senha deve conter letra maiúscula, letra minúscula e número.';
  }
  return '';
}
