import { supabase } from './supabase';

export const auditoriaService = {
  async listar({ limite = 200 } = {}) {
    const { data, error } = await supabase
      .from('auditoria')
      .select('id, tabela, registro_id, operacao, dados_antigos, dados_novos, alterado_por, alterado_em')
      .order('alterado_em', { ascending: false })
      .limit(limite);
    if (error) throw error;
    return data || [];
  },
};
