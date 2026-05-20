import { supabase } from './supabase';

export const usuariosService = {
  async listar() {
    const { data, error } = await supabase
      .from('perfis')
      .select('*')
      .order('nome');
    if (error) throw error;
    return data || [];
  },

  async criar({ nome, email, senha, funcao }) {
    // Salva sessão atual do admin antes de criar o novo usuário
    const { data: sessaoAtual } = await supabase.auth.getSession();
    const sessaoAdmin = sessaoAtual?.session;

    const { data, error } = await supabase.auth.signUp({
      email,
      password: senha,
      options: { data: { nome, funcao } },
    });

    if (error) throw error;

    // Se o Supabase criou sessão para o novo usuário (confirmação de e-mail desabilitada),
    // restaura a sessão do admin para não deslogá-lo.
    if (data.session && sessaoAdmin) {
      await supabase.auth.setSession({
        access_token: sessaoAdmin.access_token,
        refresh_token: sessaoAdmin.refresh_token,
      });
    }

    return data.user;
  },

  async alterarStatus(id, ativo) {
    const { error } = await supabase.from('perfis').update({ ativo }).eq('id', id);
    if (error) throw error;
  },

  async garantirPerfil(user) {
    if (!user) return;
    await supabase.from('perfis').upsert({
      id: user.id,
      email: user.email,
      nome: user.user_metadata?.nome || user.email?.split('@')[0] || '',
      funcao: user.user_metadata?.funcao || 'Médico',
    }, { onConflict: 'id', ignoreDuplicates: true });
  },
};
