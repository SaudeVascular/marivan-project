import { supabase } from './supabase';
import { executarOperacaoClinica } from '../utils/operacaoClinica';
import { dataLocalISO } from '../utils/formatters';

export const PAGINA_HISTORICO = 1000;

const CAMPOS = 'id, tipo, titulo, conteudo, data, hora, created_by, created_at, status, assinado_em, assinado_por_nome, assinado_por_registro, retificacao_de, motivo_retificacao, paciente_id, versao';
// Retrato da emissão (migração 46): só na reimpressão, não no histórico.
const CAMPOS_COM_EMISSAO = `${CAMPOS}, emissao, emissao_hash`;

// DB → React
const fromDb = (c) => ({
  id: c.id,
  pacienteId: c.paciente_id,
  versao: c.versao,
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
  emissao: c.emissao || null,
  emissaoHash: c.emissao_hash || null,
});

export const registrosService = {
  // Histórico completo, em páginas: a API devolve no máximo 1000 linhas
  // por consulta, e um histórico cortado em silêncio esconderia registros
  // antigos (alergias, cirurgias, laudos). O desempate por id deixa a
  // ordem estável entre as páginas — sem pular nem repetir registro.
  async listarPorPaciente(pacienteId) {
    const registros = [];
    for (let inicio = 0; ; inicio += PAGINA_HISTORICO) {
      const { data, error } = await supabase
        .from('consultas')
        .select(CAMPOS)
        .eq('paciente_id', pacienteId)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .range(inicio, inicio + PAGINA_HISTORICO - 1);
      if (error) throw error;
      registros.push(...(data || []));
      if (!data || data.length < PAGINA_HISTORICO) break;
    }
    return registros.map(fromDb);
  },

  // Registro SÓ se for deste paciente (null se não existir, não for visível
  // ou for de outro paciente). Usado onde a URL traz os dois ids: buscar
  // cada um separado permitia montar o cadastro de B com o conteúdo de A.
  async buscarDoPaciente(registroId, pacienteId) {
    const { data, error } = await supabase
      .from('consultas')
      .select(CAMPOS_COM_EMISSAO)
      .eq('id', registroId)
      .eq('paciente_id', pacienteId)
      .maybeSingle();
    if (error) throw error;
    return data ? fromDb(data) : null;
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

  async criar(registro, pacienteId, userId) {
    const dados = {
      tipo: registro.tipo, titulo: registro.titulo, conteudo: registro.conteudo,
      status: registro.status || 'Assinado',
      ...(registro.retificacaoDe ? { retificacao_de: registro.retificacaoDe, motivo_retificacao: registro.motivoRetificacao } : {}),
    };
    const agora = new Date();
    return gravar({
      userId, escopo: `criar:${pacienteId}:${registro.tipo}:${registro.retificacaoDe || ''}`,
      intencao: { dados, hora: registro.hora || null },
      parametros: {
        p_acao: 'criar', p_paciente_id: pacienteId, p_registro_id: null, p_versao_esperada: null,
        p_dados: { ...dados, data: dataLocalISO(agora), hora: registro.hora || agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) },
      },
    });
  },

  async atualizar(id, campos, userId, assinar = false) {
    if (!Number.isInteger(campos.versao) || campos.versao < 1 || !campos.pacienteId) {
      throw new Error('Reabra o rascunho pelo histórico para carregar sua versão antes de editar. Seu texto foi preservado.');
    }
    const parametros = {
      p_acao: assinar ? 'assinar' : 'atualizar', p_paciente_id: campos.pacienteId,
      p_registro_id: id, p_versao_esperada: campos.versao,
      p_dados: { titulo: campos.titulo, conteudo: campos.conteudo },
    };
    return gravar({ userId, escopo: `registro:${id}`, intencao: parametros, parametros });
  },

  async assinar(registro, userId) {
    return registrosService.atualizar(registro.id, registro, userId, true);
  },

  async retificar({ original, conteudo, motivo }, pacienteId, userId) {
    return registrosService.criar({
      tipo: original.tipo, titulo: `Retificação — ${original.titulo}`, conteudo,
      status: 'Assinado', retificacaoDe: original.id, motivoRetificacao: motivo,
    }, pacienteId, userId);
  },
};

// A identidade pendente só é removida depois que a tela incorporou o
// resultado. No atendimento, isso inclui persistir o vínculo do rascunho.
const confirmacoes = new WeakMap();
export function confirmarRecebimentoRegistro(registro) {
  confirmacoes.get(registro)?.();
  confirmacoes.delete(registro);
}

async function gravar(operacao) {
  try {
    const recibo = await executarOperacaoClinica(operacao);
    const registro = fromDb(recibo.dados);
    confirmacoes.set(registro, recibo.confirmar);
    return registro;
  } catch (error) {
    if (error.registroConfirmado) {
      const registro = fromDb(error.registroConfirmado);
      if (error.confirmar) confirmacoes.set(registro, error.confirmar);
      throw Object.assign(new Error(error.message), { code: error.code, registroConfirmado: registro });
    }
    throw error;
  }
}

// Atualização funcional evita perder alterações concorrentes do estado React.
export function aplicarRegistroConfirmado(setPacientes, pacienteId, registro) {
  setPacientes(anteriores => anteriores.map(p => {
    if (p.id !== pacienteId) return p;
    const existente = (p.registros || []).find(r => r.id === registro.id);
    if (existente && existente.versao > registro.versao) return p;
    return { ...p, registros: existente
      ? p.registros.map(r => r.id === registro.id ? registro : r)
      : [registro, ...(p.registros || [])] };
  }));
}

export async function salvarRegistroComFallback({ registro, paciente, userId, setPacientes }) {
  try {
    const salvo = await registrosService.criar(registro, paciente.id, userId);
    aplicarRegistroConfirmado(setPacientes, paciente.id, salvo);
    confirmarRecebimentoRegistro(salvo);
    return { ok: true, registro: salvo };
  } catch (error) {
    if (error.registroConfirmado) {
      aplicarRegistroConfirmado(setPacientes, paciente.id, error.registroConfirmado);
      confirmarRecebimentoRegistro(error.registroConfirmado);
    }
    return { ok: false, error };
  }
}
