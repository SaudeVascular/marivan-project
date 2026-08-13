import { supabase } from './supabase';
import { createClient } from '@supabase/supabase-js';

// Cliente isolado: cadastrar alguém não pode substituir a sessão do
// Administrador quando a confirmação de e-mail estiver desabilitada.
const criarClienteCadastro = () => createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_ANON_KEY,
  { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
);

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

  async criar({ nome, email, senha, funcao, crm, uf, sexo, nascimento, cpf, especialidade, area_atuacao }) {
    const clienteCadastro = criarClienteCadastro();
    const { data, error } = await clienteCadastro.auth.signUp({
      email,
      password: senha,
      // A função nunca é aceita de user_metadata. O trigger cria a
      // conta como Pendente/inativa; a sessão Admin abaixo a ativa.
      options: { data: { nome } },
    });

    if (error) throw error;
    if (!data.user) throw new Error('O provedor de autenticação não devolveu o novo usuário.');

    const { error: perfilError } = await supabase
      .from('perfis')
      .update({
        nome, funcao, ativo: true,
        crm: crm || '', uf: uf || '', sexo: sexo || '',
        nascimento: nascimento || null, cpf: cpf || '',
        especialidade: especialidade || '', area_atuacao: area_atuacao || '',
      })
      .eq('id', data.user.id);
    if (perfilError) throw perfilError;

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

};
