import { supabase } from './supabase';
import { authService } from './authService';

// DB (snake_case) → React (camelCase)
const fromDb = (p) => ({
  id: p.id,
  nome: p.nome || '',
  cpf: p.cpf || '',
  nascimento: p.nascimento || '',
  nomeMae: p.nome_mae || '',
  telefone: p.telefone || '',
  convenio: p.convenio || '',
  cep: p.cep || '',
  endereco: p.endereco || '',
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
  nome: p.nome,
  cpf: p.cpf || null,
  nascimento: p.nascimento || null,
  nome_mae: p.nomeMae || null,
  telefone: p.telefone || null,
  convenio: p.convenio || null,
  cep: p.cep || null,
  endereco: p.endereco || null,
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
      .select('*')
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
      .select('*')
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
      .select()
      .single();
    if (error) throw error;
    return fromDb(data);
  },

  async atualizar(id, pacienteData) {
    const { data, error } = await supabase
      .from('pacientes')
      .update(toDb(pacienteData))
      .eq('id', id)
      .select()
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
};
