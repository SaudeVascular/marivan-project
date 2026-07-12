import { supabase } from './supabase';

const CAMPOS = 'id, paciente_id, medico_id, data, hora, duracao_min, status, observacoes, created_by, created_at';

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
});

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

  async criar({ pacienteId, medicoId, data, hora, duracaoMin, observacoes }, userId) {
    const { data: row, error } = await supabase
      .from('agendamentos')
      .insert([{
        paciente_id: pacienteId,
        medico_id: medicoId || null,
        data,
        hora,
        duracao_min: duracaoMin || 30,
        observacoes: observacoes || null,
        created_by: userId,
      }])
      .select(CAMPOS)
      .single();
    if (error) throw error;
    return fromDb(row);
  },

  async atualizarStatus(id, status) {
    const { data: row, error } = await supabase
      .from('agendamentos')
      .update({ status })
      .eq('id', id)
      .select(CAMPOS)
      .single();
    if (error) throw error;
    return fromDb(row);
  },

  async atualizar(id, { pacienteId, medicoId, data, hora, duracaoMin, observacoes }) {
    const { data: row, error } = await supabase
      .from('agendamentos')
      .update({
        paciente_id: pacienteId,
        medico_id: medicoId || null,
        data,
        hora,
        duracao_min: duracaoMin,
        observacoes: observacoes || null,
      })
      .eq('id', id)
      .select(CAMPOS)
      .single();
    if (error) throw error;
    return fromDb(row);
  },
};
