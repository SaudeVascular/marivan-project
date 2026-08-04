import { supabase } from './supabase';
import { comTimeout } from '../utils/comTimeout';

const CAMPOS = 'id, tipo, titulo, conteudo, data, hora, created_by, created_at, status, assinado_em, assinado_por_nome, assinado_por_registro, retificacao_de, motivo_retificacao';

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
  // Registros de antes desta coluna existir vêm sem status do banco
  // (default 'Assinado' na migração) — o fallback aqui é só para dados
  // otimistas locais, que nunca passam por fromDb vindos do banco.
  status: c.status || 'Assinado',
  assinadoEm: c.assinado_em || null,
  assinadoPorNome: c.assinado_por_nome || '',
  assinadoPorRegistro: c.assinado_por_registro || '',
  retificacaoDe: c.retificacao_de || null,
  motivoRetificacao: c.motivo_retificacao || '',
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

  // Só é aceita pelo banco enquanto o registro estiver como 'Rascunho'
  // (trigger trg_impedir_edicao_consulta_assinada bloqueia depois de
  // assinado — ver supabase_prontuario_assinatura.sql).
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

  // `status` é opcional — quem não passar nada cria como 'Assinado' de
  // uma vez (comportamento de sempre, usado por atestado/receituário/
  // relatório/laudo/pedido de exames, que ainda não têm um fluxo de
  // rascunho próprio). O atendimento do prontuário passa `status:
  // 'Rascunho'` e só assina depois, via assinar().
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
        status: registro.status || 'Assinado',
        assinado_em: (registro.status || 'Assinado') === 'Assinado' ? agora.toISOString() : null,
        assinado_por_nome: registro.assinadoPorNome || null,
        assinado_por_registro: registro.assinadoPorRegistro || null,
      }])
      .select(CAMPOS)
      .single();
    if (error) throw error;
    return fromDb(data);
  },

  // Rascunho → Assinado: fecha o registro (fica imutável) e grava quem
  // assinou, com quê registro profissional, na hora da assinatura —
  // não depende do perfil atual do usuário, que pode mudar depois.
  async assinar(id, { nome, registroProfissional }) {
    const { data, error } = await supabase
      .from('consultas')
      .update({
        status: 'Assinado',
        assinado_em: new Date().toISOString(),
        assinado_por_nome: nome || null,
        assinado_por_registro: registroProfissional || null,
      })
      .eq('id', id)
      .select(CAMPOS)
      .single();
    if (error) throw error;
    return fromDb(data);
  },

  // Correção de um registro já assinado: nunca sobrescreve a linha
  // original — cria uma nova, vinculada por retificacao_de, já
  // assinada (uma retificação é, ela mesma, um registro definitivo).
  async retificar({ original, conteudo, motivo }, pacienteId, userId, { nome, registroProfissional }) {
    const agora = new Date();
    const { data, error } = await supabase
      .from('consultas')
      .insert([{
        paciente_id: pacienteId,
        tipo: original.tipo,
        titulo: `Retificação — ${original.titulo}`,
        conteudo,
        data: agora.toISOString().split('T')[0],
        hora: agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        created_by: userId,
        status: 'Assinado',
        assinado_em: agora.toISOString(),
        assinado_por_nome: nome || null,
        assinado_por_registro: registroProfissional || null,
        retificacao_de: original.id,
        motivo_retificacao: motivo,
      }])
      .select(CAMPOS)
      .single();
    if (error) throw error;
    return fromDb(data);
  },
};

// Salva um registro no prontuário. NUNCA finge que salvou: se a gravação
// no Supabase falhar, não insere nada no estado local (isso faria o
// registro sumir sem aviso ao recarregar a página, mesmo a tela tendo
// mostrado "salvo"). Quem chamou é responsável por avisar o usuário do
// erro e preservar o texto digitado para nova tentativa.
export async function salvarRegistroComFallback({ registro, paciente, userId, pacientes, setPacientes, contexto }) {
  try {
    const salvoDb = await comTimeout(registrosService.criar(registro, paciente.id, userId));
    setPacientes(pacientes.map((p) =>
      p.id === paciente.id ? { ...p, registros: [salvoDb, ...(p.registros || [])] } : p
    ));
    return { ok: true, registro: salvoDb };
  } catch (err) {
    console.error(`Erro ao salvar ${contexto}:`, err);
    return { ok: false, error: err };
  }
}
