import { supabase } from './supabase';

const fromDb = (e) => ({
  id: e.id,
  nome: e.nome,
  tuss: e.tuss || '',
  tipo: e.tipo,
  categoria: e.categoria || '',
  ativo: e.ativo,
});

// O PostgREST limita cada resposta a 1000 linhas por padrão
// (db-max-rows) — com ~5970 itens da TUSS, uma chamada sem paginação só
// traz os primeiros 1000. Busca em páginas de 1000 até não vir mais
// nada, em vez de depender desse limite ser maior em todo ambiente
// (local, homologação, produção).
const TAMANHO_PAGINA = 1000;

export const examesService = {
  async listar() {
    const todos = [];
    for (let pagina = 0; ; pagina++) {
      const inicio = pagina * TAMANHO_PAGINA;
      const { data, error } = await supabase
        .from('exames')
        .select('*')
        .order('tipo')
        .order('categoria')
        .order('nome')
        .range(inicio, inicio + TAMANHO_PAGINA - 1);
      if (error) throw error;
      todos.push(...(data || []));
      if (!data || data.length < TAMANHO_PAGINA) break;
    }
    return todos.map(fromDb);
  },

  async criar({ nome, tuss, tipo, categoria }) {
    const { data, error } = await supabase
      .from('exames')
      .insert([{ nome, tuss: tuss || null, tipo, categoria: categoria || '' }])
      .select()
      .single();
    if (error) throw error;
    return fromDb(data);
  },

  async atualizar(id, { nome, tuss, tipo, categoria, ativo }) {
    const { data, error } = await supabase
      .from('exames')
      .update({ nome, tuss: tuss || null, tipo, categoria: categoria || '', ativo })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return fromDb(data);
  },

  async alterarStatus(id, ativo) {
    const { error } = await supabase.from('exames').update({ ativo }).eq('id', id);
    if (error) throw error;
  },
};
