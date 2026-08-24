import { authService } from './authService';
import { resetSupabaseMockPadrao, supabase } from './supabase';

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
