import { supabase } from './supabase';

export const usuariosService = {
  // Lê por `perfis_view` (supabase_perfis_equipe.sql), não pela tabela
  // direto: a view mascara cpf/nascimento/sexo de quem não é o dono do
  // perfil nem Administrador, mas mantém nome/função/CRM/especialidade
  // visíveis — é o que Agenda, Recepção e Financeiro precisam pra
  // listar/identificar profissionais que não são o usuário logado.
  async listar() {
    const { data, error } = await supabase
      .from('perfis_view')
      .select('*')
      .order('nome');
    if (error) throw error;
    return data || [];
  },

  async buscarPerfil(userId) {
    const { data, error } = await supabase
      .from('perfis_view')
      .select('nome, crm, uf, funcao, email, sexo, nascimento, cpf, especialidade, area_atuacao, ativo')
      .eq('id', userId)
      .single();
    if (error) return null;
    return data;
  },

  async criar({ nome, email, senha, funcao, crm, uf }) {
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

    // Salva CRM/UF no perfil após criação
    if (data.user && (crm || uf)) {
      await supabase.from('perfis').update({ crm: crm || '', uf: uf || '' }).eq('id', data.user.id);
    }

    return data.user;
  },

  async atualizar(id, { nome, funcao, crm, uf, sexo, nascimento, cpf, especialidade, area_atuacao }) {
    const { error } = await supabase
      .from('perfis')
      .update({
        nome, funcao,
        crm: crm || '',
        uf: uf || '',
        sexo: sexo || '',
        nascimento: nascimento || null,
        cpf: cpf || '',
        especialidade: especialidade || '',
        area_atuacao: area_atuacao || '',
      })
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
