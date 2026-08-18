import { supabase, resetSupabaseMockPadrao } from './supabase';
import { usuariosService } from './usuarios.service';

jest.mock('./supabase');

beforeEach(() => {
  resetSupabaseMockPadrao();
});

test('novo usuário é criado somente pela função backend administrativa', async () => {
  supabase.functions.invoke.mockResolvedValue({
    data: { user: { id: 'novo-user', email: 'maria@example.com' } },
    error: null,
  });

  await usuariosService.criar({
    nome: 'Dra. Maria', email: 'maria@example.com', senha: 'ClinicaSegura2026',
    funcao: 'Médico', crm: '1234', uf: 'BA', especialidade: 'Cardiologia',
  });

  expect(supabase.functions.invoke).toHaveBeenCalledWith('admin-create-user', {
    body: expect.objectContaining({
      nome: 'Dra. Maria', email: 'maria@example.com', senha: 'ClinicaSegura2026',
      funcao: 'Médico', crm: '1234', uf: 'BA',
    }),
  });
  expect(supabase.from).not.toHaveBeenCalled();
});
