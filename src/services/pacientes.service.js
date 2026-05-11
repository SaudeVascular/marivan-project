// src/services/pacientes.service.js
import { supabase } from './supabase';
import { authService } from './authService';

export const pacientesService = {
  // Listar todos os pacientes
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
    return data;
  },

  // Buscar paciente por ID
  async buscarPorId(id) {
    const { data, error } = await supabase
      .from('pacientes')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data;
  },

  // Criar novo paciente
  async criar(pacienteData) {
    const user = await authService.getCurrentUser();
    
    const { data, error } = await supabase
      .from('pacientes')
      .insert([{
        ...pacienteData,
        created_by: user?.id
      }])
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  // Atualizar paciente
  async atualizar(id, pacienteData) {
    const { data, error } = await supabase
      .from('pacientes')
      .update(pacienteData)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  // Deletar paciente (soft delete)
  async deletar(id) {
    const { error } = await supabase
      .from('pacientes')
      .update({ ativo: false })
      .eq('id', id);
    
    if (error) throw error;
  }
};