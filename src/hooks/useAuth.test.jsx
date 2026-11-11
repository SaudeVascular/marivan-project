import { act, render, screen, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from './useAuth';
import { supabase, resetSupabaseMockPadrao } from '../services/supabase';
import { usuariosService } from '../services/usuarios.service';
import { _reiniciarSessaoServiceParaTestes } from '../services/sessao.service';
import { TEMPO_INATIVIDADE_MS } from '../constants/security';

jest.mock('../services/supabase');
jest.mock('../services/usuarios.service');

const CHAVE_TOKEN = 'sb-teste-auth-token';
const SESSAO = { user: { id: 'u1' }, access_token: 'jwt-u1', expires_at: Math.floor(Date.now() / 1000) + 3600 };
const ERRO_REDE = { name: 'AuthRetryableFetchError', message: 'Failed to fetch', status: 0 };

let emitirAuth;
let saida;

function Sonda() {
  const auth = useAuth();
  saida = auth;
  return (
    <div>
      <span data-testid="usuario">{auth.user?.id ?? 'nenhum'}</span>
      <span data-testid="pendente">{auth.revogacaoPendente ? 'sim' : 'nao'}</span>
    </div>
  );
}

async function montarLogado() {
  render(<AuthProvider><Sonda /></AuthProvider>);
  await waitFor(() => expect(screen.getByTestId('usuario')).toHaveTextContent('u1'));
}

beforeEach(() => {
  resetSupabaseMockPadrao();
  _reiniciarSessaoServiceParaTestes();
  window.sessionStorage.clear();
  window.sessionStorage.setItem(CHAVE_TOKEN, JSON.stringify(SESSAO));
  supabase.auth.getSession.mockResolvedValue({ data: { session: SESSAO } });
  supabase.auth.onAuthStateChange.mockImplementation((cb) => {
    emitirAuth = cb;
    return { data: { subscription: { unsubscribe: jest.fn() } } };
  });
  usuariosService.buscarPerfil.mockResolvedValue({ id: 'u1', funcao: 'Médico', ativo: true });
});

afterEach(() => {
  jest.useRealTimers();
});

test('sair fecha a sessão na tela na hora, antes de o servidor responder', async () => {
  await montarLogado();
  supabase.auth.signOut.mockImplementation(() => new Promise(() => {}));
  act(() => { saida.logout(); });
  expect(screen.getByTestId('usuario')).toHaveTextContent('nenhum');
});

test('sem rede: sai deste navegador mesmo assim e avisa que a revogação está pendente', async () => {
  await montarLogado();
  supabase.auth.signOut.mockImplementation(async (opcoes) => (
    opcoes?.scope === 'local' ? { error: null } : { error: ERRO_REDE }
  ));
  let resultado;
  await act(async () => { resultado = await saida.logout(); });
  expect(resultado).toEqual({ revogado: false });
  expect(window.sessionStorage.getItem(CHAVE_TOKEN)).toBeNull();
  expect(supabase.auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
  expect(screen.getByTestId('usuario')).toHaveTextContent('nenhum');
  expect(screen.getByTestId('pendente')).toHaveTextContent('sim');

  // A renovação automática que já estava a caminho não reabre a sessão.
  act(() => { emitirAuth('TOKEN_REFRESHED', SESSAO); });
  expect(screen.getByTestId('usuario')).toHaveTextContent('nenhum');

  // Conexão volta: revoga só esta sessão no servidor e tira o aviso.
  await act(async () => { window.dispatchEvent(new Event('online')); });
  expect(supabase.auth.admin.signOut).toHaveBeenCalledWith('jwt-u1', 'local');
  expect(screen.getByTestId('pendente')).toHaveTextContent('nao');
});

test('servidor travado: depois do prazo, apaga o token local mesmo assim', async () => {
  await montarLogado();
  jest.useFakeTimers();
  supabase.auth.signOut.mockImplementation((opcoes) => (
    opcoes?.scope === 'local' ? Promise.resolve({ error: null }) : new Promise(() => {})
  ));
  let promessa;
  act(() => { promessa = saida.logout(); });
  await act(async () => { await jest.advanceTimersByTimeAsync(9000); });
  const resultado = await promessa;
  expect(resultado).toEqual({ revogado: false });
  expect(window.sessionStorage.getItem(CHAVE_TOKEN)).toBeNull();
});

test('a revogação continua pendente se a conexão volta e o servidor ainda falha', async () => {
  await montarLogado();
  supabase.auth.signOut.mockImplementation(async (opcoes) => (
    opcoes?.scope === 'local' ? { error: null } : { error: ERRO_REDE }
  ));
  await act(async () => { await saida.logout(); });
  supabase.auth.admin.signOut.mockResolvedValueOnce({ data: null, error: ERRO_REDE });
  await act(async () => { window.dispatchEvent(new Event('online')); });
  expect(screen.getByTestId('pendente')).toHaveTextContent('sim');
});

test('com rede: revoga no servidor e não deixa aviso', async () => {
  await montarLogado();
  let resultado;
  await act(async () => { resultado = await saida.logout(); });
  expect(resultado).toEqual({ revogado: true });
  expect(supabase.auth.signOut).toHaveBeenCalledTimes(1);
  expect(screen.getByTestId('pendente')).toHaveTextContent('nao');
});

test('inatividade sem rede: a sessão fecha na tela e o token sai do navegador', async () => {
  jest.useFakeTimers();
  await montarLogado();
  supabase.auth.signOut.mockImplementation(async (opcoes) => (
    opcoes?.scope === 'local' ? { error: null } : { error: ERRO_REDE }
  ));
  await act(async () => { await jest.advanceTimersByTimeAsync(TEMPO_INATIVIDADE_MS + 1000); });
  expect(screen.getByTestId('usuario')).toHaveTextContent('nenhum');
  expect(window.sessionStorage.getItem(CHAVE_TOKEN)).toBeNull();
  expect(window.sessionStorage.getItem('pep:motivo-logout')).toBe('inatividade');
});

test('depois de sair, um login novo volta a aceitar a sessão', async () => {
  await montarLogado();
  await act(async () => { await saida.logout(); });
  supabase.auth.signInWithPassword.mockResolvedValue({ data: { session: SESSAO }, error: null });
  await act(async () => { await saida.login('a@b.c', 'senha'); });
  act(() => { emitirAuth('SIGNED_IN', SESSAO); });
  await waitFor(() => expect(screen.getByTestId('usuario')).toHaveTextContent('u1'));
});
