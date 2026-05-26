import { supabase } from './supabase';

export const modelosService = {
  async listar(userId) {
    const { data, error } = await supabase
      .from('modelos_receita')
      .select('id, nome, conteudo')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data || [];
  },

  async criar(userId, nome, conteudo) {
    const { data, error } = await supabase
      .from('modelos_receita')
      .insert([{ user_id: userId, nome, conteudo }])
      .select('id, nome, conteudo')
      .single();
    if (error) throw error;
    return data;
  },

  async excluir(id) {
    const { error } = await supabase
      .from('modelos_receita')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },
};
