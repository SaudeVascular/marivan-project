import { supabase } from './supabase';
import { authService } from './authService';
import { capitalizarTexto } from '../utils/formatters';

// Campos + join com convenios (nome), pra não precisar carregar a lista de
// convênios só pra exibir o nome em toda tela que mostra um paciente.
const CAMPOS = '*, convenios(nome)';

// DB (snake_case) → React (camelCase)
const fromDb = (p) => ({
  id: p.id,
  nome: capitalizarTexto(p.nome),
  cpf: p.cpf || '',
  nascimento: p.nascimento || '',
  nomeMae: capitalizarTexto(p.nome_mae),
  telefone: p.telefone || '',
  convenioId: p.convenio_id || '',
  convenio: p.convenios?.nome || '',
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

// React (camelCase) → DB (snake_case)
const toDb = (p) => ({
  nome: capitalizarTexto(p.nome),
  cpf: p.cpf || null,
  nascimento: p.nascimento || null,
  nome_mae: p.nomeMae ? capitalizarTexto(p.nomeMae) : null,
  telefone: p.telefone || null,
  convenio_id: p.convenioId || null,
  cep: p.cep || null,
  endereco: p.endereco ? capitalizarTexto(p.endereco) : null,
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
      .from('pacientes')
      .select(CAMPOS)
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
      .from('pacientes')
      .select(CAMPOS)
      .eq('id', id)
      .single();
    if (error) throw error;
    return fromDb(data);
  },

  async criar(pacienteData) {
    const user = await authService.getCurrentUser();
    const { data, error } = await supabase
      .from('pacientes')
      .insert([{ ...toDb(pacienteData), created_by: user?.id }])
      .select(CAMPOS)
      .single();
    if (error) throw error;
    return fromDb(data);
  },

  async atualizar(id, pacienteData) {
    const { data, error } = await supabase
      .from('pacientes')
      .update(toDb(pacienteData))
      .eq('id', id)
      .select(CAMPOS)
      .single();
    if (error) throw error;
    return fromDb(data);
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
