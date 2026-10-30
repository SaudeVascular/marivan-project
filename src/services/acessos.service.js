import { supabase } from './supabase';

// Auditoria de leitura (migração 38): quem abriu cada prontuário e quem
// gerou cada documento. O banco grava o autor a partir da sessão — o app
// só informa o paciente e a ação.
// Registros de impressão que falharam (rede) ficam numa fila nesta aba —
// só ids, ação e horário, nada clínico — e são reenviados no próximo
// registro bem-sucedido. Abrir prontuário/registro e exportar são
// registrados pelo próprio banco (migração 48), sem depender daqui.
const FILA = 'pep_acessos_pendentes';
const lerFila = () => { try { return JSON.parse(sessionStorage.getItem(FILA) || '[]'); } catch { return []; } };
const gravarFila = (itens) => { try { sessionStorage.setItem(FILA, JSON.stringify(itens.slice(-50))); } catch { /* sem armazenamento */ } };

async function enviar({ pacienteId, acao, detalhe, registroId, em }) {
  const { error } = await supabase.rpc('registrar_acesso', {
    p_paciente_id: pacienteId, p_acao: acao,
    p_detalhe: em ? `${detalhe || ''} (registrado com atraso; ocorrido em ${em})`.trim() : detalhe,
    p_registro_id: registroId,
  });
  if (error) throw error;
}

export const acessosService = {
  // Nunca interrompe quem está atendendo. Falha de rede: entra na fila e é
  // reenviada depois. Recusa do banco (dados inválidos): só o código no
  // console, sem dados do paciente.
  async registrar(pacienteId, acao, detalhe = null, registroId = null) {
    if (!pacienteId) return false;
    const item = { pacienteId, acao, detalhe, registroId };
    try {
      await enviar(item);
    } catch (err) {
      console.error('Falha ao registrar acesso:', err?.code, err?.message);
      if (!/^(22|23|42)/.test(err?.code || '')) gravarFila([...lerFila(), { ...item, em: new Date().toISOString() }]);
      return false;
    }
    const pendentes = lerFila();
    if (pendentes.length) {
      gravarFila([]);
      const restantes = [];
      for (const p of pendentes) {
        try { await enviar(p); } catch (err) { if (!/^(22|23|42)/.test(err?.code || '')) restantes.push(p); }
      }
      if (restantes.length) gravarFila([...restantes, ...lerFila()]);
    }
    return true;
  },

  async listar({ limite = 200 } = {}) {
    const { data, error } = await supabase
      .from('acessos_view')
      .select('id, em, acao, detalhe, registro_id, usuario_id, usuario_nome, usuario_funcao, paciente_id, paciente_nome')
      .order('em', { ascending: false })
      .limit(limite);
    if (error) throw error;
    return data || [];
  },
};

export const registrarImpressao = (pacienteId, documento, registroId = null) =>
  acessosService.registrar(pacienteId, 'imprimir_documento', documento, registroId);
