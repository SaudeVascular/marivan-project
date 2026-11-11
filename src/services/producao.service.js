import { supabase } from './supabase';
import { todasAsPaginas } from './procedimentos.service';

// Relatório de produção (migração 50). O banco decide o alcance:
// Financeiro e Administrador veem todos os profissionais; os demais, só a
// própria produção. Canceladas não entram.
// Pendente: divisão prevista pelo percentual atual (migração 55).
const previsto = (l) => {
  if (l.status !== 'Pendente') return { previstoClinica: 0, previstoProfissional: 0 };
  const liquido = (Number(l.valor_pago) || 0) - (Number(l.glosa) || 0);
  const profissional = Math.round(liquido * (Number(l.percentual_repasse) || 0)) / 100;
  return { previstoClinica: Math.round((liquido - profissional) * 100) / 100, previstoProfissional: profissional };
};

const fromDb = (l) => ({
  ...previsto(l),
  id: l.cobranca_id,
  data: l.data,
  status: l.status,
  daAgenda: l.da_agenda,
  pacienteId: l.paciente_id,
  paciente: l.paciente_nome || '',
  profissionalId: l.profissional_id,
  profissional: l.profissional_nome || '',
  especialidade: l.especialidade || '',
  procedimentoId: l.procedimento_id,
  codigo: l.codigo || '',
  procedimento: l.procedimento || '',
  tipo: l.tipo || '',
  convenioId: l.convenio_id,
  convenio: l.convenio || '',
  particular: !!l.particular,
  formaPagamento: l.forma_pagamento || '',
  // Migração 54: valor − desconto = pago; pago − glosa = recebido (só Pago).
  valor: Number(l.valor) || 0,
  desconto: Number(l.desconto) || 0,
  valorPago: Number(l.valor_pago) || 0,
  glosa: Number(l.glosa) || 0,
  percentualRepasse: Number(l.percentual_repasse) || 0,
  recebido: Number(l.recebido) || 0,
  recebidoClinica: Number(l.recebido_clinica) || 0,
  recebidoProfissional: Number(l.recebido_profissional) || 0,
});

export const producaoService = {
  async relatorio({ de, ate, profissionalId }) {
    const linhas = await todasAsPaginas(() => supabase.rpc('relatorio_producao', {
      p_de: de, p_ate: ate, p_profissional_id: profissionalId || null,
    }).order('data').order('cobranca_id'));
    return linhas.map(fromDb);
  },
};
