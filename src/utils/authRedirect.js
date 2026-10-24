const TIPOS_DE_LINK_ACEITOS = new Set(['invite', 'recovery']);
const CAMPOS_CALLBACK_IMPLICITO = ['access_token', 'refresh_token', 'expires_in', 'token_type'];

export function extrairTipoLinkAuth(hash = '') {
  const parametros = new URLSearchParams(hash.replace(/^#/, ''));
  const callbackCompleto = CAMPOS_CALLBACK_IMPLICITO.every((campo) => parametros.has(campo));
  const tipo = parametros.get('type');
  return callbackCompleto && TIPOS_DE_LINK_ACEITOS.has(tipo) ? tipo : null;
}
