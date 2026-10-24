import { TEMPO_INATIVIDADE_MS } from '../constants/security';

export const CHAVE_MOTIVO_LOGOUT = 'pep:motivo-logout';
export const MOTIVO_INATIVIDADE = 'inatividade';

export function iniciarMonitorInatividade({ aoExpirar, tempoMs = TEMPO_INATIVIDADE_MS, alvo = window }) {
  let timer;
  let encerrado = false;
  let ultimaAtividade = Date.now();

  const expirar = () => {
    if (encerrado) return;
    encerrado = true;
    aoExpirar();
  };
  const agendar = () => {
    if (encerrado) return;
    clearTimeout(timer);
    const restante = Math.max(0, tempoMs - (Date.now() - ultimaAtividade));
    timer = setTimeout(verificar, restante);
  };
  const verificar = () => {
    if (Date.now() - ultimaAtividade >= tempoMs) expirar();
    else agendar();
  };
  const renovar = () => {
    ultimaAtividade = Date.now();
    agendar();
  };
  const aoMudarVisibilidade = () => {
    if (alvo.document?.visibilityState === 'visible') verificar();
  };
  const eventos = ['pointerdown', 'keydown', 'touchstart', 'scroll'];

  eventos.forEach((evento) => alvo.addEventListener(evento, renovar, { passive: true }));
  alvo.document?.addEventListener('visibilitychange', aoMudarVisibilidade);
  agendar();

  return () => {
    encerrado = true;
    clearTimeout(timer);
    eventos.forEach((evento) => alvo.removeEventListener(evento, renovar));
    alvo.document?.removeEventListener('visibilitychange', aoMudarVisibilidade);
  };
}

export function registrarLogoutPorInatividade() {
  sessionStorage.setItem(CHAVE_MOTIVO_LOGOUT, MOTIVO_INATIVIDADE);
}

export function consumirMotivoLogout() {
  const motivo = sessionStorage.getItem(CHAVE_MOTIVO_LOGOUT);
  sessionStorage.removeItem(CHAVE_MOTIVO_LOGOUT);
  return motivo;
}
