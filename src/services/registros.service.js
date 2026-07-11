import { supabase } from './supabase';

const CAMPOS = 'id, tipo, titulo, conteudo, data, hora, created_by, created_at';

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
      .select(CAMPOS)
      .eq('paciente_id', pacienteId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(fromDb);
  },

  async buscarPorId(registroId) {
    const { data, error } = await supabase
      .from('consultas')
      .select(CAMPOS)
      .eq('id', registroId)
      .single();
    if (error) throw error;
    return fromDb(data);
  },

  async atualizar(id, campos) {
    const { data, error } = await supabase
      .from('consultas')
      .update({ titulo: campos.titulo, conteudo: campos.conteudo })
      .eq('id', id)
      .select(CAMPOS)
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
      .select(CAMPOS)
      .single();
    if (error) throw error;
    return fromDb(data);
  },
};

// Salva um registro no prontuário; se a chamada ao Supabase falhar (ex: rede
// instável durante o atendimento), insere localmente um registro otimista
// com id temporário para não perder o que o médico digitou.
export async function salvarRegistroComFallback({ registro, paciente, userId, pacientes, setPacientes, contexto }) {
  try {
    const salvoDb = await registrosService.criar(registro, paciente.id, userId);
    setPacientes(pacientes.map((p) =>
      p.id === paciente.id ? { ...p, registros: [salvoDb, ...(p.registros || [])] } : p
    ));
  } catch (err) {
    console.error(`Erro ao salvar ${contexto}:`, err);
    const agora = new Date();
    setPacientes(pacientes.map((p) =>
      p.id === paciente.id ? {
        ...p,
        registros: [{
          id: Date.now(),
          ...registro,
          data: agora.toLocaleDateString('pt-BR'),
          hora: agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        }, ...(p.registros || [])],
      } : p
    ));
  }
}
