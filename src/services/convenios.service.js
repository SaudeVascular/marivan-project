import { supabase } from './supabase';

const fromDb = (c) => ({ id: c.id, nome: c.nome, ativo: c.ativo });

const valorFromDb = (v) => ({
  id: v.id,
  convenioId: v.convenio_id,
  procedimentoId: v.procedimento_id,
  valor: v.valor,
});

export const conveniosService = {
  async listar() {
    const { data, error } = await supabase.from('convenios').select('*').order('nome');
    if (error) throw error;
    return (data || []).map(fromDb);
  },

  async criar({ nome }) {
    const { data, error } = await supabase.from('convenios').insert([{ nome }]).select().single();
    if (error) throw error;
    return fromDb(data);
  },

  async atualizar(id, { nome, ativo }) {
    const { data, error } = await supabase.from('convenios').update({ nome, ativo }).eq('id', id).select().single();
    if (error) throw error;
    return fromDb(data);
  },

  async listarValores() {
    const { data, error } = await supabase.from('convenio_valores').select('*');
    if (error) throw error;
    return (data || []).map(valorFromDb);
  },

  // Cria ou atualiza o valor de um procedimento para um convênio específico
  // (upsert pela combinação única convenio_id + procedimento_id).
  async definirValor({ convenioId, procedimentoId, valor }) {
    const { data, error } = await supabase
      .from('convenio_valores')
      .upsert(
        { convenio_id: convenioId, procedimento_id: procedimentoId, valor },
        { onConflict: 'convenio_id,procedimento_id' }
      )
      .select()
      .single();
    if (error) throw error;
    return valorFromDb(data);
  },

  async removerValor(id) {
    const { error } = await supabase.from('convenio_valores').delete().eq('id', id);
    if (error) throw error;
  },
};
