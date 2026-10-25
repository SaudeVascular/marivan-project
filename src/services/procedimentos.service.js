import { supabase } from './supabase';

export const TIPOS_PROCEDIMENTO = ['Consulta', 'Exame', 'Procedimento'];

const fromDb = (p) => ({
  id: p.id,
  nome: p.nome,
  codigo: p.codigo || '',
  tipo: p.tipo || 'Procedimento',
  // Vazio = sem preço particular (procedimento que só existe na tabela de
  // algum convênio — migração 50), diferente de R$ 0,00.
  valorParticular: p.valor_particular == null ? null : Number(p.valor_particular),
  ativo: p.ativo,
});

// O PostgREST corta cada resposta em 1000 linhas; tabelas importadas
// passam disso.
const TAMANHO_PAGINA = 1000;
async function todasAsPaginas(consultar) {
  const todos = [];
  for (let inicio = 0; ; inicio += TAMANHO_PAGINA) {
    const { data, error } = await consultar().range(inicio, inicio + TAMANHO_PAGINA - 1);
    if (error) throw error;
    todos.push(...(data || []));
    if (!data || data.length < TAMANHO_PAGINA) return todos;
  }
}

const paraDb = ({ nome, codigo, tipo, valorParticular }) => ({
  nome,
  codigo: codigo || null,
  tipo: tipo || 'Procedimento',
  valor_particular: valorParticular === '' || valorParticular == null ? null : Number(valorParticular),
});

export const procedimentosService = {
  // Procedimentos ativos com o valor da tabela do convênio (ou particular),
  // para quem agenda — migração 49/50. A tabela de preços inteira continua
  // só do Financeiro/Administrador.
  async catalogo(convenioId) {
    const linhas = await todasAsPaginas(() => supabase.rpc('catalogo_procedimentos', { p_convenio_id: convenioId || null }).order('nome').order('id'));
    return linhas.map(p => ({
      id: p.id, nome: p.nome, codigo: p.codigo || '', tipo: p.tipo || 'Procedimento',
      valor: p.valor == null ? null : Number(p.valor),
    }));
  },

  async listar() {
    const linhas = await todasAsPaginas(() => supabase.from('procedimentos').select('*').order('nome').order('id'));
    return linhas.map(fromDb);
  },

  async criar(dados) {
    const { data, error } = await supabase.from('procedimentos').insert([paraDb(dados)]).select().single();
    if (error) throw error;
    return fromDb(data);
  },

  async atualizar(id, { ativo, ...dados }) {
    const { data, error } = await supabase
      .from('procedimentos')
      .update({ ...paraDb(dados), ativo })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return fromDb(data);
  },

  // Só apaga de verdade se o procedimento nunca foi usado em nenhuma
  // cobrança — senão perderíamos a referência em registros históricos.
  async excluir(id) {
    const { count, error: countError } = await supabase
      .from('cobrancas')
      .select('id', { count: 'exact', head: true })
      .eq('procedimento_id', id);
    if (countError) throw countError;
    if (count > 0) {
      throw new Error('Este procedimento já foi usado em cobranças e não pode ser excluído — desative-o em vez disso.');
    }
    const { error } = await supabase.from('procedimentos').delete().eq('id', id);
    if (error) throw error;
  },
};

export { todasAsPaginas };
