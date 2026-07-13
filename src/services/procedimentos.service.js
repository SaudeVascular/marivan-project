import { supabase } from './supabase';

const fromDb = (p) => ({
  id: p.id,
  nome: p.nome,
  valorParticular: p.valor_particular,
  percentualRepasse: p.percentual_repasse,
  ativo: p.ativo,
});

export const procedimentosService = {
  async listar() {
    const { data, error } = await supabase
      .from('procedimentos')
      .select('*')
      .order('nome');
    if (error) throw error;
    return (data || []).map(fromDb);
  },

  async criar({ nome, valorParticular, percentualRepasse }) {
    const { data, error } = await supabase
      .from('procedimentos')
      .insert([{ nome, valor_particular: valorParticular, percentual_repasse: percentualRepasse || 0 }])
      .select()
      .single();
    if (error) throw error;
    return fromDb(data);
  },

  async atualizar(id, { nome, valorParticular, percentualRepasse, ativo }) {
    const { data, error } = await supabase
      .from('procedimentos')
      .update({ nome, valor_particular: valorParticular, percentual_repasse: percentualRepasse, ativo })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return fromDb(data);
  },
};
