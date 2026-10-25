import { supabase } from './supabase';
import { todasAsPaginas } from './procedimentos.service';

// Dados da operadora (migração 50). `particular` marca a tabela da própria
// clínica, cujos valores são o valor particular de cada procedimento.
const CAMPOS_OPERADORA = {
  razaoSocial: 'razao_social',
  cnpj: 'cnpj',
  registroAns: 'registro_ans',
  codigoPrestador: 'codigo_prestador',
  telefone: 'telefone',
  email: 'email',
  site: 'site',
  cep: 'cep',
  endereco: 'endereco',
  cidade: 'cidade',
  uf: 'uf',
  contato: 'contato',
  tabelaReferencia: 'tabela_referencia',
  observacoes: 'observacoes',
};

const fromDb = (c) => {
  const convenio = { id: c.id, nome: c.nome, ativo: c.ativo, particular: !!c.particular };
  for (const [app, db] of Object.entries(CAMPOS_OPERADORA)) convenio[app] = c[db] || '';
  convenio.prazoPagamentoDias = c.prazo_pagamento_dias ?? '';
  return convenio;
};

// Só os campos informados vão para o banco: Desativar/Reativar chama sem
// os dados da operadora e não pode apagá-los.
const paraDb = (dados) => {
  const linha = {};
  if (dados.nome !== undefined) linha.nome = dados.nome;
  if (dados.ativo !== undefined) linha.ativo = dados.ativo;
  for (const [app, db] of Object.entries(CAMPOS_OPERADORA)) {
    if (dados[app] !== undefined) linha[db] = String(dados[app]).trim() || null;
  }
  if (dados.cnpj !== undefined) linha.cnpj = String(dados.cnpj).toUpperCase().replace(/[^0-9A-Z]/g, '') || null;
  if (dados.cep !== undefined) linha.cep = String(dados.cep).replace(/\D/g, '') || null;
  if (dados.prazoPagamentoDias !== undefined) {
    linha.prazo_pagamento_dias = dados.prazoPagamentoDias === '' ? null : Number(dados.prazoPagamentoDias);
  }
  return linha;
};

const itemFromDb = (v) => ({
  id: v.id,
  procedimentoId: v.procedimento_id,
  valor: Number(v.valor),
  // Código na tabela deste convênio; sem ele, o do procedimento.
  codigo: v.codigo || v.procedimentos?.codigo || '',
  nome: v.procedimentos?.nome || '',
  tipo: v.procedimentos?.tipo || 'Procedimento',
  ativo: v.procedimentos?.ativo ?? true,
});

export const conveniosService = {
  async listar() {
    const { data, error } = await supabase.from('convenios').select('*').order('nome');
    if (error) throw error;
    return (data || []).map(fromDb);
  },

  async criar(dados) {
    const { data, error } = await supabase.from('convenios').insert([paraDb(dados)]).select().single();
    if (error) throw error;
    return fromDb(data);
  },

  async atualizar(id, dados) {
    const { data, error } = await supabase.from('convenios').update(paraDb(dados)).eq('id', id).select().single();
    if (error) throw error;
    return fromDb(data);
  },

  // Tabela de um convênio: procedimento, código e valor acordado.
  async tabela(convenioId) {
    const linhas = await todasAsPaginas(() => supabase.from('convenio_valores')
      .select('id, procedimento_id, valor, codigo, procedimentos(nome, codigo, tipo, ativo)')
      .eq('convenio_id', convenioId)
      .order('id'));
    return linhas.map(itemFromDb).sort((a, b) => a.nome.localeCompare(b.nome));
  },

  // Cria ou atualiza o valor de um procedimento para um convênio específico
  // (upsert pela combinação única convenio_id + procedimento_id).
  async definirValor({ convenioId, procedimentoId, valor, codigo }) {
    const linha = { convenio_id: convenioId, procedimento_id: procedimentoId, valor };
    if (codigo !== undefined) linha.codigo = codigo || null;
    const { data, error } = await supabase
      .from('convenio_valores')
      .upsert(linha, { onConflict: 'convenio_id,procedimento_id' })
      .select('id, procedimento_id, valor, codigo, procedimentos(nome, codigo, tipo, ativo)')
      .single();
    if (error) throw error;
    return itemFromDb(data);
  },

  async removerValor(id) {
    const { error } = await supabase.from('convenio_valores').delete().eq('id', id);
    if (error) throw error;
  },

  // Tabela lida da planilha, gravada de uma vez no banco (tudo ou nada).
  // substituir: o que não veio no arquivo sai da tabela do convênio.
  async importarTabela(convenioId, itens, substituir) {
    const { data, error } = await supabase.rpc('importar_tabela_convenio', {
      p_convenio_id: convenioId, p_itens: itens, p_substituir: !!substituir,
    });
    if (error) throw error;
    return { gravados: data.gravados, procedimentosNovos: data.procedimentos_novos, removidos: data.removidos };
  },

  // Só apaga de verdade se o convênio nunca foi usado em nenhuma cobrança
  // — senão perderíamos a referência em registros históricos. Os valores
  // por procedimento (convenio_valores) somem junto (ON DELETE CASCADE).
  async excluir(id) {
    const { count, error: countError } = await supabase
      .from('cobrancas')
      .select('id', { count: 'exact', head: true })
      .eq('convenio_id', id);
    if (countError) throw countError;
    if (count > 0) {
      throw new Error('Este convênio já foi usado em cobranças e não pode ser excluído — desative-o em vez disso.');
    }
    const { error } = await supabase.from('convenios').delete().eq('id', id);
    if (error) throw error;
  },
};
