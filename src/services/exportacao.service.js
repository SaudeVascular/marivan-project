import { supabase } from './supabase';
import { comTimeout } from '../utils/comTimeout';

// Exportação (migração 48). O banco confere a permissão e registra quem
// exportou; o arquivo é montado aqui, no navegador — não fica cópia no
// servidor.
export const exportacaoService = {
  async prontuario(pacienteId) {
    const { data, error } = await comTimeout(supabase.rpc('exportar_prontuario', { p_paciente_id: pacienteId }), 30000);
    if (error) throw error;
    return data;
  },

  // Em lotes: uma clínica grande não cabe numa resposta só.
  async clinica({ lote = 50, aoProgredir } = {}) {
    const primeira = await pagina(lote, 0);
    const pacientes = [...primeira.pacientes];
    const total = primeira.total_pacientes || 0;
    aoProgredir?.(pacientes.length, total);
    while (pacientes.length < total) {
      const proxima = await pagina(lote, pacientes.length);
      if (!proxima.pacientes?.length) break;
      pacientes.push(...proxima.pacientes);
      aoProgredir?.(pacientes.length, total);
    }
    return { ...primeira, pacientes };
  },
};

async function pagina(lote, offset) {
  const { data, error } = await comTimeout(supabase.rpc('exportar_clinica', { p_limite: lote, p_offset: offset }), 60000);
  if (error) throw error;
  return data;
}

export function baixarJson(nomeArquivo, dados) {
  const blob = new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomeArquivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function nomeArquivoExportacao(prefixo, nome) {
  const data = new Date().toISOString().slice(0, 10);
  const slug = String(nome || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase();
  return `${prefixo}${slug ? '-' + slug : ''}-${data}.json`;
}
