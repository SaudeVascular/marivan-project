import { authService } from './authService';
import { obterTipoRedirecionamentoAuth, resetSupabaseMockPadrao, supabase } from './supabase';

jest.mock('./supabase');

beforeEach(() => {
  resetSupabaseMockPadrao();
  supabase.auth.updateUser.mockResolvedValue({ error: null });
});

test('envia a recuperação para a rota autorizada de redefinição', async () => {
  await authService.resetPassword('admin@example.com');

  expect(supabase.auth.resetPasswordForEmail).toHaveBeenCalledWith(
    'admin@example.com',
    { redirectTo: `${window.location.origin}/redefinir-senha` },
  );
});

test('aguarda o token da URL antes de obter a sessão de recuperação', async () => {
  const session = { access_token: 'token-temporario' };
  obterTipoRedirecionamentoAuth.mockReturnValue('recovery');
  supabase.auth.getSession.mockResolvedValue({ data: { session }, error: null });

  await expect(authService.getLinkSession('recovery')).resolves.toBe(session);
  expect(supabase.auth.initialize).toHaveBeenCalledTimes(1);
  expect(supabase.auth.getSession).toHaveBeenCalledTimes(1);
});

test('não aceita link de recuperação sem sessão', async () => {
  obterTipoRedirecionamentoAuth.mockReturnValue('recovery');
  await expect(authService.getLinkSession('recovery')).resolves.toBeNull();
});

test('não aceita uma sessão comum como convite ou recuperação', async () => {
  supabase.auth.getSession.mockResolvedValue({ data: { session: { access_token: 'sessao-comum' } }, error: null });

  await expect(authService.getLinkSession('invite')).resolves.toBeNull();
  expect(supabase.auth.getSession).not.toHaveBeenCalled();
});

test('aceita convite somente quando o callback é do tipo invite', async () => {
  const session = { access_token: 'token-convite' };
  obterTipoRedirecionamentoAuth.mockReturnValue('invite');
  supabase.auth.getSession.mockResolvedValue({ data: { session }, error: null });

  await expect(authService.getLinkSession('invite')).resolves.toBe(session);
});

test('alteração interna exige a senha atual e encerra todas as sessões', async () => {
  supabase.auth.getUser.mockResolvedValue({ data: { user: { email: 'admin@example.com' } }, error: null });
  supabase.auth.signInWithPassword.mockResolvedValue({ data: {}, error: null });

  await authService.changePassword('SenhaAtual2026', 'NovaSenhaSegura2026');

  expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
    email: 'admin@example.com',
    password: 'SenhaAtual2026',
  });
  expect(supabase.auth.updateUser).toHaveBeenCalledWith({ password: 'NovaSenhaSegura2026' });
  expect(supabase.auth.signOut).toHaveBeenCalledWith({ scope: 'global' });
});

test('senha atual incorreta impede a alteração interna', async () => {
  supabase.auth.getUser.mockResolvedValue({ data: { user: { email: 'admin@example.com' } }, error: null });
  supabase.auth.signInWithPassword.mockResolvedValue({ data: null, error: new Error('invalid credentials') });

  await expect(authService.changePassword('incorreta', 'NovaSenhaSegura2026'))
    .rejects.toThrow('A senha atual está incorreta.');
  expect(supabase.auth.updateUser).not.toHaveBeenCalled();
});

test('troca a senha e revoga globalmente as sessões anteriores', async () => {
  await authService.updatePassword('ClinicaSegura2026');

  expect(supabase.auth.updateUser).toHaveBeenCalledWith({ password: 'ClinicaSegura2026' });
  expect(supabase.auth.signOut).toHaveBeenCalledWith({ scope: 'global' });
});

test('não encerra sessões quando a troca de senha falha', async () => {
  supabase.auth.updateUser.mockResolvedValue({ error: new Error('falha') });

  await expect(authService.updatePassword('ClinicaSegura2026')).rejects.toThrow('falha');
  expect(supabase.auth.signOut).not.toHaveBeenCalled();
});
