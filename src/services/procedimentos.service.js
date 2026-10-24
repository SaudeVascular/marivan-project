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

  // Só apaga de verdade se o procedimento nunca foi usado em nenhuma
  // cobrança — senão perderíamos a referência em registros históricos.
  async excluir(id) {
    const { count, error: countError } = await supabase
      .from('cobrancas')
      .select('id', { count: 'exact', head: true })
      .eq('procedimento_id', id);
    if (countError) throw countError;
    if (count > 0) {
      throw new Error('Este procedimento já foi usado em cobranças e não pode ser excluído — desative-o em vez disso.');
    }
    const { error } = await supabase.from('procedimentos').delete().eq('id', id);
    if (error) throw error;
  },
};
