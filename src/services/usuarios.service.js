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

  async buscarPerfil(userId) {
    const { data, error } = await supabase
      .from('perfis')
      .select('nome, crm, funcao, email, sexo, nascimento, cpf')
      .eq('id', userId)
      .single();
    if (error) return null;
    return data;
  },

  async criar({ nome, email, senha, funcao, crm }) {
    const { data: sessaoAtual } = await supabase.auth.getSession();
    const sessaoAdmin = sessaoAtual?.session;

    const { data, error } = await supabase.auth.signUp({
      email,
      password: senha,
      options: { data: { nome, funcao, crm: crm || '' } },
    });

    if (error) throw error;

    if (data.session && sessaoAdmin) {
      await supabase.auth.setSession({
        access_token: sessaoAdmin.access_token,
        refresh_token: sessaoAdmin.refresh_token,
      });
    }

    // Salva o CRM no perfil após criação
    if (data.user && crm) {
      await supabase.from('perfis').update({ crm }).eq('id', data.user.id);
    }

    return data.user;
  },

  async atualizar(id, { nome, funcao, crm, sexo, nascimento, cpf }) {
    const { error } = await supabase
      .from('perfis')
      .update({ nome, funcao, crm: crm || '', sexo: sexo || '', nascimento: nascimento || null, cpf: cpf || '' })
      .eq('id', id);
    if (error) throw error;
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
