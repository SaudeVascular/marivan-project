import { supabase } from './supabase';
import { todasAsPaginas } from './procedimentos.service';

// Relatório de produção (migração 50). O banco decide o alcance:
// Financeiro e Administrador veem todos os profissionais; os demais, só a
// própria produção. Canceladas não entram.
const fromDb = (l) => ({
  id: l.cobranca_id,
  data: l.data,
  status: l.status,
  daAgenda: l.da_agenda,
  pacienteId: l.paciente_id,
  paciente: l.paciente_nome || '',
  profissionalId: l.profissional_id,
  profissional: l.profissional_nome || '',
  procedimentoId: l.procedimento_id,
  codigo: l.codigo || '',
  procedimento: l.procedimento || '',
  tipo: l.tipo || '',
  convenioId: l.convenio_id,
  convenio: l.convenio || '',
  formaPagamento: l.forma_pagamento || '',
  valor: Number(l.valor) || 0,
  percentualRepasse: Number(l.percentual_repasse) || 0,
  valorRepasse: Number(l.valor_repasse) || 0,
  valorClinica: Number(l.valor_clinica) || 0,
});

export const producaoService = {
  async relatorio({ de, ate, profissionalId }) {
    const linhas = await todasAsPaginas(() => supabase.rpc('relatorio_producao', {
      p_de: de, p_ate: ate, p_profissional_id: profissionalId || null,
    }).order('data').order('cobranca_id'));
    return linhas.map(fromDb);
  },
};
