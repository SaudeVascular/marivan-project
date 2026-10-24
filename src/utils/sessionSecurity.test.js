import {
  CHAVE_MOTIVO_LOGOUT,
  MOTIVO_INATIVIDADE,
  consumirMotivoLogout,
  iniciarMonitorInatividade,
  registrarLogoutPorInatividade,
} from './sessionSecurity';

beforeEach(() => {
  jest.useFakeTimers();
  sessionStorage.clear();
});

afterEach(() => {
  jest.useRealTimers();
});

test('expira uma sessão depois do período sem atividade', () => {
  const aoExpirar = jest.fn();
  const parar = iniciarMonitorInatividade({ aoExpirar, tempoMs: 1000 });

  jest.advanceTimersByTime(999);
  expect(aoExpirar).not.toHaveBeenCalled();
  jest.advanceTimersByTime(1);
  expect(aoExpirar).toHaveBeenCalledTimes(1);

  parar();
});

test('atividade renova o prazo da sessão', () => {
  const aoExpirar = jest.fn();
  const parar = iniciarMonitorInatividade({ aoExpirar, tempoMs: 1000 });

  jest.advanceTimersByTime(700);
  window.dispatchEvent(new Event('keydown'));
  jest.advanceTimersByTime(700);
  expect(aoExpirar).not.toHaveBeenCalled();
  jest.advanceTimersByTime(300);
  expect(aoExpirar).toHaveBeenCalledTimes(1);

  parar();
});

test('motivo de logout é consumido uma única vez', () => {
  registrarLogoutPorInatividade();
  expect(sessionStorage.getItem(CHAVE_MOTIVO_LOGOUT)).toBe(MOTIVO_INATIVIDADE);
  expect(consumirMotivoLogout()).toBe(MOTIVO_INATIVIDADE);
  expect(consumirMotivoLogout()).toBeNull();
});
