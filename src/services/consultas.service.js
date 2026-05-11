// src/services/consultas.service.js
import { supabase } from './supabase';
import { authService } from './authService';

export const consultasService = {
  // Listar consultas com filtros
  async listar({ data, pacienteId, medicoId, status } = {}) {
    let query = supabase
      .from('consultas')
      .select(`
        *,
        paciente:pacientes(nome, cpf),
        medico:usuarios(nome, especialidade)
      `)
      .order('data', { ascending: false })
      .order('hora', { ascending: false });
    
    if (data) {
      query = query.eq('data', data);
    }
    
    if (pacienteId) {
      query = query.eq('paciente_id', pacienteId);
    }
    
    if (medicoId) {
      query = query.eq('medico_id', medicoId);
    }
    
    if (status) {
      query = query.eq('status', status);
    }
    
    const { data: consultas, error } = await query;
    
    if (error) throw error;
    return consultas;
  },

  // Buscar consulta por ID
  async buscarPorId(id) {
    const { data, error } = await supabase
      .from('consultas')
      .select(`
        *,
        paciente:pacientes(*),
        medico:usuarios(nome, crm, especialidade)
      `)
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data;
  },

  // Criar nova consulta
  async criar(consultaData) {
    const user = await authService.getCurrentUser();
    
    const { data, error } = await supabase
      .from('consultas')
      .insert([{
        ...consultaData,
        medico_id: consultaData.medico_id || user?.id,
        created_by: user?.id
      }])
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  // Atualizar consulta
  async atualizar(id, consultaData) {
    const { data, error } = await supabase
      .from('consultas')
      .update(consultaData)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  // Realizar consulta (atualizar status e dados clínicos)
  async realizar(id, dadosClinicos) {
    const { data, error } = await supabase
      .from('consultas')
      .update({
        ...dadosClinicos,
        status: 'Realizada'
      })
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  // Cancelar consulta
  async cancelar(id) {
    const { data, error } = await supabase
      .from('consultas')
      .update({ status: 'Cancelada' })
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  // Buscar consultas do dia
  async consultasDoDia(data = new Date().toISOString().split('T')[0]) {
    const { data: consultas, error } = await supabase
      .from('consultas')
      .select(`
        *,
        paciente:pacientes(nome, cpf, telefone)
      `)
      .eq('data', data)
      .eq('status', 'Agendada')
      .order('hora');
    
    if (error) throw error;
    return consultas;
  }
};