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
    nome: 'Dra. Maria', email: 'maria@example.com',
    funcao: 'Médico', crm: '1234', uf: 'BA', especialidade: 'Cardiologia',
  });

  expect(supabase.functions.invoke).toHaveBeenCalledWith('admin-create-user', {
    body: expect.objectContaining({
      nome: 'Dra. Maria', email: 'maria@example.com',
      funcao: 'Médico', crm: '1234', uf: 'BA',
    }),
  });
  expect(supabase.functions.invoke.mock.calls[0][1].body).not.toHaveProperty('senha');
  expect(supabase.from).not.toHaveBeenCalled();
});

test('exibe a mensagem segura devolvida pelo backend quando o convite falha', async () => {
  supabase.functions.invoke.mockResolvedValue({
    data: null,
    error: {
      context: { json: jest.fn().mockResolvedValue({ error: 'E-mail já cadastrado ou limite de envio atingido.' }) },
    },
  });

  await expect(usuariosService.criar({
    nome: 'Dra. Maria', email: 'maria@example.com', funcao: 'Médico',
  })).rejects.toThrow('E-mail já cadastrado ou limite de envio atingido.');
});
