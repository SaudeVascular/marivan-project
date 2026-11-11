import { supabase } from './supabase';
import { comTimeout } from '../utils/comTimeout';

// Encerrar a sessão em duas partes independentes:
//   1. neste navegador — sempre, mesmo sem rede: apaga o token guardado;
//   2. no servidor — revoga o token (signOut global). Pode falhar sem rede.
//
// O signOut do supabase-js só apaga o token local DEPOIS que o servidor
// responde: com a rede fora, ele devolve o erro e a sessão continua
// guardada (e a renovação automática a mantém viva). Por isso a parte 1
// não depende dele.
//
// Se a revogação falhar, o access token fica só em memória (nunca em
// storage) para nova tentativa quando a conexão voltar, até ele expirar.
// A nova tentativa revoga só ESTA sessão (scope local): se a pessoa já
// entrou de novo, aqui ou em outro computador, essas sessões continuam.

let revogacaoPendente = null; // { token, expiraEm, ouvinte }
const assinantes = new Set();

function avisar() {
  const pendente = revogacaoPendente !== null;
  assinantes.forEach(fn => fn(pendente));
}

export function observarRevogacaoPendente(fn) {
  assinantes.add(fn);
  fn(revogacaoPendente !== null);
  return () => assinantes.delete(fn);
}

function apagarSessaoLocal() {
  const chaves = [];
  for (let i = 0; i < window.sessionStorage.length; i++) {
    const chave = window.sessionStorage.key(i);
    if (/^sb-.*-auth-token/.test(chave)) chaves.push(chave);
  }
  chaves.forEach(chave => window.sessionStorage.removeItem(chave));
}

function cancelarRevogacaoPendente() {
  if (!revogacaoPendente) return;
  window.removeEventListener('online', revogacaoPendente.ouvinte);
  revogacaoPendente = null;
  avisar();
}

async function revogarNoServidor(token) {
  try {
    const { error } = await comTimeout(supabase.auth.admin.signOut(token, 'local'), 8000);
    // 401/403/404: o token já não vale no servidor — nada mais a revogar.
    return !error || [401, 403, 404].includes(error.status);
  } catch {
    return false;
  }
}

export async function tentarRevogacaoPendente() {
  const pendente = revogacaoPendente;
  if (!pendente) return true;
  if (Date.now() >= pendente.expiraEm) {
    cancelarRevogacaoPendente(); // expirou sozinho: o servidor já não aceita
    return true;
  }
  const ok = await revogarNoServidor(pendente.token);
  if (ok && revogacaoPendente === pendente) cancelarRevogacaoPendente();
  return ok;
}

function agendarRevogacao(token, expiresAt) {
  cancelarRevogacaoPendente();
  const ouvinte = () => { tentarRevogacaoPendente(); };
  revogacaoPendente = { token, expiraEm: (expiresAt || 0) * 1000, ouvinte };
  window.addEventListener('online', ouvinte);
  avisar();
}

// Devolve { revogado }: false = saiu deste navegador, mas o servidor ainda
// não confirmou a revogação (sem conexão).
export async function encerrarSessaoNoNavegador() {
  let sessao = null;
  try {
    const { data } = await comTimeout(supabase.auth.getSession(), 3000);
    sessao = data?.session ?? null;
  } catch {
    // lock do cliente preso: segue sem o token; a parte local ainda vale
  }

  let revogado = false;
  try {
    const { error } = await comTimeout(supabase.auth.signOut(), 8000);
    revogado = !error;
  } catch {
    // sem resposta no prazo: trata como não revogado
  }
  if (revogado) {
    cancelarRevogacaoPendente();
    return { revogado: true };
  }

  apagarSessaoLocal();
  try {
    // Sem token no storage, o signOut local não precisa de rede: só
    // limpa o estado do cliente e emite SIGNED_OUT.
    await comTimeout(supabase.auth.signOut({ scope: 'local' }), 3000);
  } catch {
    // o token já saiu do storage; o resto é só estado em memória
  }
  if (sessao?.access_token) agendarRevogacao(sessao.access_token, sessao.expires_at);
  return { revogado: false };
}

// Só para testes.
export function _reiniciarSessaoServiceParaTestes() {
  cancelarRevogacaoPendente();
  assinantes.clear();
}
