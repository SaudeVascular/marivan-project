import { supabase } from './supabase';

// Auditoria de leitura (migração 38): quem abriu cada prontuário e quem
// gerou cada documento. O banco grava o autor a partir da sessão — o app
// só informa o paciente e a ação.
export const acessosService = {
  // Nunca interrompe quem está atendendo: uma falha aqui fica só no
  // console (código e mensagem, sem dados do paciente).
  async registrar(pacienteId, acao, detalhe = null, registroId = null) {
    if (!pacienteId) return;
    try {
      const { error } = await supabase.rpc('registrar_acesso', {
        p_paciente_id: pacienteId, p_acao: acao, p_detalhe: detalhe, p_registro_id: registroId,
      });
      if (error) console.error('Falha ao registrar acesso:', error.code, error.message);
    } catch (err) {
      console.error('Falha ao registrar acesso:', err?.code, err?.message);
    }
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
