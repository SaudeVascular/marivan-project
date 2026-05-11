// src/services/anexos.service.js
import { supabase } from './supabase';

export const anexosService = {
  // Upload de arquivo
  async upload(file, metadata) {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random()}.${fileExt}`;
    const filePath = `${metadata.paciente_id}/${fileName}`;
    
    // Upload para o Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('anexos')
      .upload(filePath, file);
    
    if (uploadError) throw uploadError;
    
    // Pegar URL pública
    const { data: { publicUrl } } = supabase.storage
      .from('anexos')
      .getPublicUrl(filePath);
    
    // Salvar metadados no banco
    const { data, error } = await supabase
      .from('anexos')
      .insert([{
        ...metadata,
        nome_arquivo: file.name,
        url: publicUrl
      }])
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  // Listar anexos
  async listar(pacienteId, consultaId) {
    let query = supabase
      .from('anexos')
      .select('*')
      .order('uploaded_at', { ascending: false });
    
    if (pacienteId) {
      query = query.eq('paciente_id', pacienteId);
    }
    
    if (consultaId) {
      query = query.eq('consulta_id', consultaId);
    }
    
    const { data, error } = await query;
    
    if (error) throw error;
    return data;
  },

  // Deletar anexo
  async deletar(id, url) {
    // Extrair caminho do arquivo da URL
    const urlParts = url.split('/');
    const filePath = urlParts.slice(-2).join('/');
    
    // Deletar do Storage
    const { error: storageError } = await supabase.storage
      .from('anexos')
      .remove([filePath]);
    
    if (storageError) throw storageError;
    
    // Deletar do banco
    const { error } = await supabase
      .from('anexos')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  }
};