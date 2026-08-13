import { createClient } from '@supabase/supabase-js';
import { supabase, criarQueryBuilder, resetSupabaseMockPadrao } from './supabase';
import { usuariosService } from './usuarios.service';

jest.mock('@supabase/supabase-js', () => ({ createClient: jest.fn() }));
jest.mock('./supabase');

beforeEach(() => {
  resetSupabaseMockPadrao();
  createClient.mockReset();
});

test('novo usuário não envia função em metadata e só é ativado pela sessão Admin', async () => {
  const signUp = jest.fn().mockResolvedValue({
    data: { user: { id: 'novo-user' }, session: { access_token: 'isolado' } },
    error: null,
  });
  createClient.mockReturnValue({ auth: { signUp } });

  const builder = criarQueryBuilder({ data: null, error: null });
  const update = jest.fn(() => builder);
  supabase.from.mockReturnValue({ update });

  await usuariosService.criar({
    nome: 'Dra. Maria', email: 'maria@example.com', senha: 'senha-segura',
    funcao: 'Médico', crm: '1234', uf: 'BA', especialidade: 'Cardiologia',
  });

  expect(signUp).toHaveBeenCalledWith({
    email: 'maria@example.com',
    password: 'senha-segura',
    options: { data: { nome: 'Dra. Maria' } },
  });
  expect(update).toHaveBeenCalledWith(expect.objectContaining({
    nome: 'Dra. Maria', funcao: 'Médico', ativo: true, crm: '1234', uf: 'BA',
  }));
  expect(supabase.auth.setSession).toBeUndefined();
});
