import { supabase } from './supabase';
import { criarComOperacao } from '../utils/operacaoCriacao';

const CAMPOS = 'id, paciente_id, medico_id, data, hora, duracao_min, status, observacoes, created_by, created_at, versao, procedimento_id, convenio_id';

// DB (snake_case) → React (camelCase)
const fromDb = (a) => ({
  id: a.id,
  pacienteId: a.paciente_id,
  medicoId: a.medico_id,
  data: a.data,
  hora: a.hora,
  duracaoMin: a.duracao_min,
  status: a.status,
  observacoes: a.observacoes || '',
  createdBy: a.created_by,
  createdAt: a.created_at,
  versao: a.versao,
  procedimentoId: a.procedimento_id || null,
  convenioId: a.convenio_id || null,
});

// Alteração só se a versão for a da tela (migração 47). Nenhuma linha =
// alguém mudou antes (ou o agendamento sumiu): avisa em vez de sobrescrever.
async function alterar(id, versaoEsperada, campos) {
  if (!Number.isInteger(versaoEsperada)) throw new Error('Recarregue a agenda antes de alterar este agendamento.');
  const { data: row, error } = await supabase
    .from('agendamentos')
    .update(campos)
    .eq('id', id)
    .eq('versao', versaoEsperada)
    .select(CAMPOS)
    .maybeSingle();
  if (error) throw error;
  if (!row) {
    throw Object.assign(new Error('Este agendamento foi alterado por outra pessoa. A agenda foi recarregada; confira e tente de novo.'), { code: 'P4090' });
  }
  return fromDb(row);
}

export const agendamentosService = {
  async listarPorData(data) {
    const { data: rows, error } = await supabase
      .from('agendamentos')
      .select(CAMPOS)
      .eq('data', data)
      .order('hora');
    if (error) throw error;
    return (rows || []).map(fromDb);
  },

  // Idempotente (migração 47): repetir não cria outro agendamento.
  async criar({ pacienteId, medicoId, data, hora, duracaoMin, observacoes, procedimentoId, convenioId }, userId) {
    const dados = {
      paciente_id: pacienteId,
      procedimento_id: procedimentoId || null,
      convenio_id: convenioId || null,
      medico_id: medicoId || null,
      data,
      hora,
      duracao_min: duracaoMin || 30,
      observacoes: observacoes || null,
      created_by: userId,
    };
    const { resultado, recuperado } = await criarComOperacao({
      userId,
      escopo: 'agendamento:novo',
      intencao: dados,
      inserir: async (operacaoId) => {
        const { data: row, error } = await supabase
          .from('agendamentos').insert([{ ...dados, operacao_id: operacaoId }]).select(CAMPOS).single();
        if (error) throw error;
        return row;
      },
      recuperar: async (operacaoId) => {
        const { data: row, error } = await supabase
          .from('agendamentos').select(CAMPOS).eq('operacao_id', operacaoId).maybeSingle();
        if (error) throw error;
        return row;
      },
    });
    return { ...fromDb(resultado), recuperado };
  },

  // Recepção confirma/ajusta na chegada (migração 49).
  async ajustarProcedimento(id, { procedimentoId, convenioId }, versaoEsperada) {
    return alterar(id, versaoEsperada, { procedimento_id: procedimentoId || null, convenio_id: convenioId || null });
  },

  async atualizarStatus(id, status, versaoEsperada) {
    return alterar(id, versaoEsperada, { status });
  },

  async atualizar(id, { pacienteId, medicoId, data, hora, duracaoMin, observacoes }, versaoEsperada) {
    return alterar(id, versaoEsperada, {
      paciente_id: pacienteId,
      medico_id: medicoId || null,
      data,
      hora,
      duracao_min: duracaoMin,
      observacoes: observacoes || null,
    });
  },
};
