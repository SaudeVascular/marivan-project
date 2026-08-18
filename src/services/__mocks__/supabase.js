// Mock manual do cliente Supabase para testes (jest.mock('./services/supabase')).
//
// react-scripts configura resetMocks:true por padrão — isso apaga a
// implementação de qualquer jest.fn() (inclusive as definidas aqui, uma
// única vez, no carregamento do módulo) antes de CADA teste. Por isso a
// implementação-padrão não fica presa ao jest.fn() na criação: cada
// arquivo de teste precisa chamar resetSupabaseMockPadrao() num
// beforeEach para reaplicá-la.
export function criarQueryBuilder(resultado = { data: [], error: null }) {
  const builder = {
    select: () => builder,
    insert: () => builder,
    update: () => builder,
    delete: () => builder,
    upsert: () => builder,
    eq: () => builder,
    neq: () => builder,
    in: () => builder,
    is: () => builder,
    order: () => builder,
    limit: () => builder,
    range: () => builder,
    single: () => Promise.resolve(resultado.single || { data: null, error: null }),
    maybeSingle: () => Promise.resolve(resultado.single || { data: null, error: null }),
    then: (resolve) => resolve(resultado),
  };
  return builder;
}

export const supabase = {
  auth: {
    getSession: jest.fn(),
    onAuthStateChange: jest.fn(),
    signInWithPassword: jest.fn(),
    updateUser: jest.fn(),
    resetPasswordForEmail: jest.fn(),
    signOut: jest.fn(),
  },
  from: jest.fn(),
  functions: {
    invoke: jest.fn(),
  },
  storage: {
    from: jest.fn(),
  },
};

// Sem sessão nenhuma, todo .from() devolve uma lista vazia — cobre o
// caso mais comum (tela de login, sem nenhum dado clínico carregado).
// Testes que precisam de um usuário logado ou de dados específicos
// sobrescrevem com mockResolvedValueOnce/mockReturnValueOnce depois de
// chamar isso.
export function resetSupabaseMockPadrao() {
  supabase.auth.getSession.mockResolvedValue({ data: { session: null } });
  supabase.auth.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: jest.fn() } } });
  supabase.auth.signInWithPassword.mockResolvedValue({ data: null, error: null });
  supabase.auth.updateUser.mockResolvedValue({ data: null, error: null });
  supabase.auth.resetPasswordForEmail.mockResolvedValue({ data: null, error: null });
  supabase.auth.signOut.mockResolvedValue({ error: null });
  supabase.from.mockImplementation(() => criarQueryBuilder());
  supabase.functions.invoke.mockResolvedValue({ data: null, error: null });
  supabase.storage.from.mockReturnValue({
    upload: jest.fn(() => Promise.resolve({ data: null, error: null })),
    getPublicUrl: jest.fn(() => ({ data: { publicUrl: '' } })),
  });
}
