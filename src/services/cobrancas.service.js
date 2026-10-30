import { supabase } from './supabase';
import { criarComOperacao } from '../utils/operacaoCriacao';

const CAMPOS = 'id, paciente_id, agendamento_id, procedimento_id, medico_id, convenio_id, descricao, valor, desconto, valor_glosa, percentual_repasse, valor_repasse, forma_pagamento, status, data_cobranca, data_pagamento, observacoes, created_by, created_at, versao';

const fromDb = (c) => ({
  id: c.id,
  pacienteId: c.paciente_id,
  agendamentoId: c.agendamento_id,
  procedimentoId: c.procedimento_id,
  medicoId: c.medico_id,
  convenioId: c.convenio_id,
  descricao: c.descricao || '',
  valor: c.valor,
  // Migração 54: valor − desconto = pago; pago − glosa = recebido (só
  // quando Pago), dividido entre profissional (repasse) e clínica.
  desconto: Number(c.desconto) || 0,
  glosa: Number(c.valor_glosa) || 0,
  valorPago: (Number(c.valor) || 0) - (Number(c.desconto) || 0),
  recebido: c.status === 'Pago' ? (Number(c.valor) || 0) - (Number(c.desconto) || 0) - (Number(c.valor_glosa) || 0) : 0,
  recebidoProfissional: c.status === 'Pago' ? Number(c.valor_repasse) || 0 : 0,
  recebidoClinica: c.status === 'Pago' ? (Number(c.valor) || 0) - (Number(c.desconto) || 0) - (Number(c.valor_glosa) || 0) - (Number(c.valor_repasse) || 0) : 0,
  percentualRepasse: c.percentual_repasse,
  valorRepasse: c.valor_repasse,
  formaPagamento: c.forma_pagamento || '',
  status: c.status,
  dataCobranca: c.data_cobranca,
  dataPagamento: c.data_pagamento,
  observacoes: c.observacoes || '',
  createdBy: c.created_by,
  createdAt: c.created_at,
  versao: c.versao,
});

export const cobrancasService = {
  // filtros: { de, ate, medicoId } — todos opcionais. Paginado: a API
  // corta em 1000 linhas, e a lista de um período longo passaria disso.
  async listar({ de, ate, medicoId, limite = 100, offset = 0 } = {}) {
    let query = supabase.from('cobrancas').select(CAMPOS, { count: 'exact' })
      .order('data_cobranca', { ascending: false })
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(offset, offset + limite - 1);
    if (de) query = query.gte('data_cobranca', de);
    if (ate) query = query.lte('data_cobranca', ate);
    if (medicoId) query = query.eq('medico_id', medicoId);
    const { data, error, count } = await query;
    if (error) throw error;
    return { itens: (data || []).map(fromDb), total: count ?? (data || []).length };
  },

  // Totais do período somados no banco (migração 40), sob a mesma RLS da
  // lista — não dependem de quantas cobranças a tela já carregou.
  async resumo({ de, ate, medicoId } = {}) {
    const { data, error } = await supabase.rpc('resumo_cobrancas', {
      p_de: de || null, p_ate: ate || null, p_medico_id: medicoId || null,
    });
    if (error) throw error;
    const linha = Array.isArray(data) ? data[0] : data;
    return {
      quantidade: Number(linha?.quantidade || 0),
      total: Number(linha?.total || 0),
      totalRepasse: Number(linha?.total_repasse || 0),
    };
  },

  // Totais de todas as colunas do Financeiro (migração 54), sob a RLS.
  async resumoFinanceiro({ de, ate, medicoId } = {}) {
    const { data, error } = await supabase.rpc('resumo_financeiro', {
      p_de: de || null, p_ate: ate || null, p_medico_id: medicoId || null,
    });
    if (error) throw error;
    const l = (Array.isArray(data) ? data[0] : data) || {};
    const n = (v) => Number(v || 0);
    return {
      quantidade: n(l.quantidade), valor: n(l.valor), desconto: n(l.desconto), valorPago: n(l.valor_pago),
      glosa: n(l.glosa), recebido: n(l.recebido), recebidoClinica: n(l.recebido_clinica), recebidoProfissional: n(l.recebido_profissional),
    };
  },

  // Recepção recebe o particular do dia, com desconto (migração 54).
  async receber(agendamentoId, { desconto, formaPagamento }) {
    const { data, error } = await supabase.rpc('receber_atendimento', {
      p_agendamento_id: agendamentoId, p_desconto: Number(desconto) || 0, p_forma_pagamento: formaPagamento,
    });
    if (error) throw error;
    return { cobrancaId: data.cobranca_id, valor: Number(data.valor), desconto: Number(data.desconto), valorPago: Number(data.valor_pago), formaPagamento: data.forma_pagamento };
  },

  async pagamentosDoDia(dataISO) {
    const { data, error } = await supabase.rpc('pagamentos_do_dia', { p_data: dataISO });
    if (error) throw error;
    return (data || []).map(p => ({
      agendamentoId: p.agendamento_id, cobrancaId: p.cobranca_id, status: p.status,
      valor: Number(p.valor), desconto: Number(p.desconto), formaPagamento: p.forma_pagamento || '',
    }));
  },

  // Financeiro registra o pagamento: particular com desconto; convênio com
  // a glosa (parcial). Glosa igual ao valor pago = Glosado (glosa total).
  async registrarPagamento(id, { desconto = 0, glosa = 0, formaPagamento }, versaoEsperada) {
    if (!Number.isInteger(versaoEsperada)) throw new Error('Recarregue a lista antes de alterar esta cobrança.');
    const campos = { status: 'Pago', desconto: Number(desconto) || 0, valor_glosa: Number(glosa) || 0 };
    if (formaPagamento) campos.forma_pagamento = formaPagamento;
    const { data, error } = await supabase.from('cobrancas').update(campos)
      .eq('id', id).eq('versao', versaoEsperada).select(CAMPOS).maybeSingle();
    if (error) throw error;
    if (!data) {
      throw Object.assign(new Error('Esta cobrança foi alterada por outra pessoa. A lista foi recarregada; confira e tente de novo.'), { code: 'P4090' });
    }
    return fromDb(data);
  },

  async buscarPorId(id) {
    const { data, error } = await supabase.from('cobrancas').select(CAMPOS).eq('id', id).single();
    if (error) throw error;
    return fromDb(data);
  },

  // Idempotente (migração 47): repetir não cria outra cobrança.
  // O percentual de repasse é do banco (migração 50): vem da regra do
  // profissional para o tipo do procedimento.
  async criar({ pacienteId, procedimentoId, medicoId, convenioId, descricao, valor, formaPagamento }, userId) {
    const dados = {
      paciente_id: pacienteId,
      procedimento_id: procedimentoId || null,
      medico_id: medicoId || null,
      convenio_id: convenioId || null,
      descricao: descricao || null,
      valor,
      forma_pagamento: formaPagamento || null,
      created_by: userId,
    };
    const { resultado, recuperado } = await criarComOperacao({
      userId,
      escopo: 'cobranca:nova',
      intencao: dados,
      inserir: async (operacaoId) => {
        const { data, error } = await supabase.from('cobrancas').insert([{ ...dados, operacao_id: operacaoId }]).select(CAMPOS).single();
        if (error) throw error;
        return data;
      },
      recuperar: async (operacaoId) => {
        const { data, error } = await supabase.from('cobrancas').select(CAMPOS).eq('operacao_id', operacaoId).maybeSingle();
        if (error) throw error;
        return data;
      },
    });
    return { ...fromDb(resultado), recuperado };
  },

  // Financeiro completa uma cobrança pendente (ex.: gerada pela agenda sem
  // procedimento) — só na versão da tela. Trocar o procedimento recalcula
  // o repasse no banco.
  async ajustar(id, { valor, descricao, procedimentoId }, versaoEsperada) {
    if (!Number.isInteger(versaoEsperada)) throw new Error('Recarregue a lista antes de alterar esta cobrança.');
    const campos = { valor, descricao: descricao || null };
    if (procedimentoId !== undefined) campos.procedimento_id = procedimentoId || null;
    const { data, error } = await supabase.from('cobrancas').update(campos)
      .eq('id', id).eq('versao', versaoEsperada).select(CAMPOS).maybeSingle();
    if (error) throw error;
    if (!data) {
      throw Object.assign(new Error('Esta cobrança foi alterada por outra pessoa. A lista foi recarregada; confira e tente de novo.'), { code: 'P4090' });
    }
    return fromDb(data);
  },

  // Só com a versão da tela (migração 47). A data de pagamento é do banco:
  // entra ao marcar Pago e sai ao desfazer.
  async atualizarStatus(id, status, versaoEsperada) {
    if (!Number.isInteger(versaoEsperada)) throw new Error('Recarregue a lista antes de alterar esta cobrança.');
    const { data, error } = await supabase.from('cobrancas').update({ status })
      .eq('id', id).eq('versao', versaoEsperada).select(CAMPOS).maybeSingle();
    if (error) throw error;
    if (!data) {
      throw Object.assign(new Error('Esta cobrança foi alterada por outra pessoa. A lista foi recarregada; confira e tente de novo.'), { code: 'P4090' });
    }
    return fromDb(data);
  },
};
