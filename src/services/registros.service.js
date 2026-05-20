import { supabase } from './supabase';

// DB → React
const fromDb = (c) => ({
  id: c.id,
  tipo: c.tipo || 'Consulta',
  titulo: c.titulo || '',
  conteudo: c.conteudo || '',
  data: c.data
    ? c.data.split('-').reverse().join('/')
    : new Date().toLocaleDateString('pt-BR'),
  hora: c.hora || '',
  createdBy: c.created_by || null,
  createdAt: c.created_at || null,
});

export const registrosService = {
  async listarPorPaciente(pacienteId) {
    const { data, error } = await supabase
      .from('consultas')
      .select('id, tipo, titulo, conteudo, data, hora, created_by, created_at')
      .eq('paciente_id', pacienteId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(fromDb);
  },

  async atualizar(id, campos) {
    const { data, error } = await supabase
      .from('consultas')
      .update({ titulo: campos.titulo, conteudo: campos.conteudo })
      .eq('id', id)
      .select('id, tipo, titulo, conteudo, data, hora')
      .single();
    if (error) throw error;
    return fromDb(data);
  },

  async criar(registro, pacienteId, userId) {
    const agora = new Date();
    const { data, error } = await supabase
      .from('consultas')
      .insert([{
        paciente_id: pacienteId,
        tipo: registro.tipo,
        titulo: registro.titulo,
        conteudo: registro.conteudo,
        data: agora.toISOString().split('T')[0],
        hora: registro.hora || agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        created_by: userId,
      }])
      .select('id, tipo, titulo, conteudo, data, hora')
      .single();
    if (error) throw error;
    return fromDb(data);
  },
};
