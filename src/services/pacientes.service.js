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
  cep: p.cep || '',
  endereco: capitalizarTexto(p.endereco),
  alergias: p.alergias || '',
  has: p.has || '',
  dm: p.dm || '',
  dac: p.dac || '',
  dislipidemia: p.dislipidemia || '',
  tabagismo: p.tabagismo || '',
  etilismo: p.etilismo || '',
  cirurgias: p.cirurgias || '',
  medicamentosUso: p.medicamentos_uso || '',
  ativo: p.ativo,
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
});

export const pacientesService = {
  async listar(filtro = '') {
    let query = supabase
      .from('pacientes_view')
      .select(CAMPOS_LEITURA)
      .eq('ativo', true)
      .order('nome');

    if (filtro) {
      query = query.or(`nome.ilike.%${filtro}%,cpf.ilike.%${filtro}%`);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map(fromDb);
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
      .insert([{ ...cadastroToDb(pacienteData), ...clinicosToDb(pacienteData), created_by: user?.id }])
      .select('id')
      .single();
    if (error) throw error;
    return pacientesService.buscarPorId(data.id);
  },

  async atualizarCadastro(id, pacienteData) {
    const { error } = await supabase
      .from('pacientes')
      .update(cadastroToDb(pacienteData))
      .eq('id', id);
    if (error) throw error;
    return pacientesService.buscarPorId(id);
  },

  async atualizarClinicos(id, pacienteData) {
    const { error } = await supabase
      .from('pacientes')
      .update(clinicosToDb(pacienteData))
      .eq('id', id);
    if (error) throw error;
    return pacientesService.buscarPorId(id);
  },

  async deletar(id) {
    const { error } = await supabase
      .from('pacientes')
      .update({ ativo: false })
      .eq('id', id);
    if (error) throw error;
  },

  // Reverte a exclusão lógica. Sem tela própria ainda — reative rodando
  // `update pacientes set ativo = true where id = '...'` no SQL Editor,
  // ou chame este método diretamente se/quando houver uma tela de
  // "pacientes desativados".
  async reativar(id) {
    const { error } = await supabase
      .from('pacientes')
      .update({ ativo: true })
      .eq('id', id);
    if (error) throw error;
  },
};
