import { supabase } from './supabase';

const CAMPOS = 'id, paciente_id, agendamento_id, procedimento_id, medico_id, convenio_id, descricao, valor, percentual_repasse, valor_repasse, forma_pagamento, status, data_cobranca, data_pagamento, observacoes, created_by, created_at';

const fromDb = (c) => ({
  id: c.id,
  pacienteId: c.paciente_id,
  agendamentoId: c.agendamento_id,
  procedimentoId: c.procedimento_id,
  medicoId: c.medico_id,
  convenioId: c.convenio_id,
  descricao: c.descricao || '',
  valor: c.valor,
  percentualRepasse: c.percentual_repasse,
  valorRepasse: c.valor_repasse,
  formaPagamento: c.forma_pagamento || '',
  status: c.status,
  dataCobranca: c.data_cobranca,
  dataPagamento: c.data_pagamento,
  observacoes: c.observacoes || '',
  createdBy: c.created_by,
  createdAt: c.created_at,
});

export const cobrancasService = {
  // filtros: { de, ate, medicoId } — todos opcionais
  async listar({ de, ate, medicoId } = {}) {
    let query = supabase.from('cobrancas').select(CAMPOS).order('data_cobranca', { ascending: false });
    if (de) query = query.gte('data_cobranca', de);
    if (ate) query = query.lte('data_cobranca', ate);
    if (medicoId) query = query.eq('medico_id', medicoId);
    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map(fromDb);
  },

  async buscarPorId(id) {
    const { data, error } = await supabase.from('cobrancas').select(CAMPOS).eq('id', id).single();
    if (error) throw error;
    return fromDb(data);
  },

  async criar({ pacienteId, procedimentoId, medicoId, convenioId, descricao, valor, percentualRepasse, formaPagamento }, userId) {
    const { data, error } = await supabase
      .from('cobrancas')
      .insert([{
        paciente_id: pacienteId,
        procedimento_id: procedimentoId || null,
        medico_id: medicoId || null,
        convenio_id: convenioId || null,
        descricao: descricao || null,
        valor,
        percentual_repasse: percentualRepasse || 0,
        forma_pagamento: formaPagamento || null,
        created_by: userId,
      }])
      .select(CAMPOS)
      .single();
    if (error) throw error;
    return fromDb(data);
  },

  async atualizarStatus(id, status) {
    const campos = { status };
    if (status === 'Pago') campos.data_pagamento = new Date().toISOString().split('T')[0];
    const { data, error } = await supabase.from('cobrancas').update(campos).eq('id', id).select(CAMPOS).single();
    if (error) throw error;
    return fromDb(data);
  },
};
