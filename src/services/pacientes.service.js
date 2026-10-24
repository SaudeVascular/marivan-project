import { supabase } from './supabase';
import { authService } from './authService';
import { capitalizarTexto } from '../utils/formatters';

// Leitura vem de `pacientes_view` (supabase_pacientes_mascara_clinica.sql),
// não da tabela `pacientes` direto: a view mascara alergias/antecedentes
// para quem não é perfil clínico, então o join com convênio já vem pronto
// como `convenio_nome` (não dá pra usar o embed `convenios(nome)` do
// PostgREST porque a view não carrega a FK real da tabela).
const CAMPOS_LEITURA = '*';

// DB (snake_case) → React (camelCase)
const fromDb = (p) => ({
  id: p.id,
  nome: capitalizarTexto(p.nome),
  cpf: p.cpf || '',
  nascimento: p.nascimento || '',
  nomeMae: capitalizarTexto(p.nome_mae),
  telefone: p.telefone || '',
  convenioId: p.convenio_id || '',
  convenio: p.convenio_nome || '',
  convenioRegistroAns: p.convenio_registro_ans || '',
  cns: p.cns || '',
  cep: p.cep || '',
  endereco: capitalizarTexto(p.endereco),
  numero: p.numero || '',
  complemento: capitalizarTexto(p.complemento),
  alergias: p.alergias || '',
  has: p.has || '',
  dm: p.dm || '',
  dac: p.dac || '',
  dislipidemia: p.dislipidemia || '',
  tabagismo: p.tabagismo || '',
  etilismo: p.etilismo || '',
  cirurgias: p.cirurgias || '',
  medicamentosUso: p.medicamentos_uso || '',
  outrasComorbidades: p.outras_comorbidades || '',
  ativo: p.ativo,
  // Controle de concorrência (migração 37): enviadas de volta no UPDATE.
  versaoCadastro: p.versao_cadastro ?? null,
  versaoClinica: p.versao_clinica ?? null,
  registros: [],
});

// Escritas administrativas e clínicas ficam separadas de propósito. Uma
// tela administrativa não pode reenviar campos clínicos mascarados como
// string vazia e apagar, sem perceber, antecedentes já registrados.
const cadastroToDb = (p) => ({
  nome: capitalizarTexto(p.nome),
  cpf: p.cpf || null,
  nascimento: p.nascimento || null,
  nome_mae: p.nomeMae ? capitalizarTexto(p.nomeMae) : null,
  telefone: p.telefone || null,
  convenio_id: p.convenioId || null,
  cep: p.cep || null,
  endereco: p.endereco ? capitalizarTexto(p.endereco) : null,
  numero: p.numero || null,
  complemento: p.complemento ? capitalizarTexto(p.complemento) : null,
  cns: (p.cns || '').replace(/\D/g, '') || null,
});

const clinicosToDb = (p) => ({
  alergias: p.alergias || null,
  has: p.has || '',
  dm: p.dm || '',
  dac: p.dac || '',
  dislipidemia: p.dislipidemia || '',
  tabagismo: p.tabagismo || '',
  etilismo: p.etilismo || '',
  cirurgias: p.cirurgias || '',
  medicamentos_uso: p.medicamentosUso || '',
  outras_comorbidades: p.outrasComorbidades || '',
});

// Filtro de busca do PostgREST montado a partir do texto digitado. Cada
// valor vai entre aspas duplas — sem isso, uma vírgula ou um parêntese no
// campo de busca quebrava a sintaxe do `or=(...)` (a busca falhava ou
// virava outro filtro). Aspas, barra invertida e curingas (% *) digitados
// são removidos; "_" casa qualquer caractere, o que é inofensivo.
export function montarFiltroBusca(termo) {
  const texto = String(termo || '').replace(/["\\%*]/g, '').replace(/\s+/g, ' ').trim();
  if (!texto) return null;
  const condicoes = [`nome.ilike."%${texto}%"`, `nome_mae.ilike."%${texto}%"`, `cpf.ilike."%${texto}%"`];
  // CPF digitado só com números também encontra o CPF salvo com máscara.
  if (/^\d{4,11}$/.test(texto)) {
    const comMascara = texto.replace(/^(\d{3})(\d{0,3})(\d{0,3})(\d{0,2})$/, (_, a, b, c, d) =>
      a + (b && `.${b}`) + (c && `.${c}`) + (d && `-${d}`));
    condicoes.push(`cpf.ilike."%${comMascara}%"`);
  }
  const data = texto.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (data) condicoes.push(`nascimento.eq.${data[3]}-${data[2]}-${data[1]}`);
  return condicoes.join(',');
}

export const TAMANHO_PAGINA_PACIENTES = 50;

async function atualizar(id, grupo, versaoEsperada, dados) {
  if (!Number.isInteger(versaoEsperada) || versaoEsperada < 1) {
    throw new Error('Recarregue o paciente antes de editar: a versão que estava na tela não foi carregada.');
  }
  const { error } = await supabase.rpc('atualizar_paciente', {
    p_id: id, p_grupo: grupo, p_versao_esperada: versaoEsperada, p_dados: dados,
  });
  if (error) throw error;
}

export const pacientesService = {
  // Busca paginada no servidor (o banco limita cada resposta a 1000
  // linhas — carregar todos de uma vez deixava pacientes de fora sem
  // aviso). Sem termo, lista em ordem alfabética.
  async buscar({ termo = '', limite = TAMANHO_PAGINA_PACIENTES, offset = 0 } = {}) {
    let query = supabase
      .from('pacientes_view')
      .select(CAMPOS_LEITURA, { count: 'exact' })
      .eq('ativo', true)
      .order('nome')
      .order('id')
      .range(offset, offset + limite - 1);

    const filtro = montarFiltroBusca(termo);
    if (filtro) query = query.or(filtro);

    const { data, error, count } = await query;
    if (error) throw error;
    return { itens: (data || []).map(fromDb), total: count ?? (data || []).length };
  },

  // Nomes para listas que só têm o id (agenda, recepção, cobranças) —
  // inclui desativados, que continuam aparecendo no histórico.
  async buscarPorIds(ids) {
    const unicos = [...new Set((ids || []).filter(Boolean).map(String))];
    const resultado = [];
    for (let i = 0; i < unicos.length; i += 100) {
      const { data, error } = await supabase
        .from('pacientes_view')
        .select(CAMPOS_LEITURA)
        .in('id', unicos.slice(i, i + 100));
      if (error) throw error;
      resultado.push(...(data || []).map(fromDb));
    }
    return resultado;
  },

  async buscarPorId(id) {
    const { data, error } = await supabase
      .from('pacientes_view')
      .select(CAMPOS_LEITURA)
      .eq('id', id)
      .single();
    if (error) throw error;
    return fromDb(data);
  },

  // Escreve na tabela (a view mascarada não é atualizável por causa do
  // CASE) e relê pela view, pra devolver ao chamador o mesmo formato
  // mascarado que listar()/buscarPorId() usam.
  async criar(pacienteData) {
    const user = await authService.getCurrentUser();
    const { data, error } = await supabase
      .from('pacientes')
      .insert([{ ...cadastroToDb(pacienteData), created_by: user?.id }])
      .select('id')
      .single();
    if (error) throw error;
    return pacientesService.buscarPorId(data.id);
  },

  // Edição só pela função atualizar_paciente (migrações 41/42), sempre com
  // a versão que estava na tela: se outra pessoa gravou antes, o banco
  // recusa com P4090. Sem versão, nem tenta — o banco recusaria também.
  async atualizarCadastro(id, pacienteData, versaoEsperada) {
    await atualizar(id, 'cadastro', versaoEsperada, cadastroToDb(pacienteData));
    return pacientesService.buscarPorId(id);
  },

  async atualizarClinicos(id, pacienteData, versaoEsperada) {
    await atualizar(id, 'clinico', versaoEsperada, clinicosToDb(pacienteData));
    return pacientesService.buscarPorId(id);
  },

  async deletar(id, versaoEsperada) {
    await atualizar(id, 'ativo', versaoEsperada, { ativo: false });
  },

  // Reverte a exclusão lógica. Sem tela própria ainda; lê a versão atual
  // antes, porque quem reativa não estava com o cadastro aberto.
  async reativar(id) {
    const { data, error } = await supabase.from('pacientes_view').select('versao_cadastro').eq('id', id).single();
    if (error) throw error;
    await atualizar(id, 'ativo', data.versao_cadastro, { ativo: true });
  },
};
