import { supabase } from './supabase';

// DB (snake_case) → React (camelCase)
const fromDb = (f) => ({
  id: f.id,
  nome: f.nome || '',
  nomeFantasia: f.nome_fantasia || '',
  cnpj: f.cnpj || '',
  cep: f.cep || '',
  endereco: f.endereco || '',
  numero: f.numero || '',
  complemento: f.complemento || '',
  cidade: f.cidade || '',
  telefone: f.telefone || '',
  logoUrl: f.logo_url || '',
  ativo: f.ativo,
});

const toDb = (f) => ({
  nome: f.nome,
  nome_fantasia: f.nomeFantasia || '',
  cnpj: f.cnpj || '',
  cep: f.cep || '',
  endereco: f.endereco || '',
  numero: f.numero || '',
  complemento: f.complemento || '',
  cidade: f.cidade || '',
  telefone: f.telefone || '',
  logo_url: f.logoUrl || null,
});

export const filiaisService = {
  async listar() {
    const { data, error } = await supabase
      .from('filiais')
      .select('*')
      .order('nome');
    if (error) throw error;
    return (data || []).map(fromDb);
  },

  async criar(filial) {
    const user = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from('filiais')
      .insert([{ ...toDb(filial), created_by: user.data.user?.id }])
      .select('*')
      .single();
    if (error) throw error;
    return fromDb(data);
  },

  async atualizar(id, filial) {
    const { data, error } = await supabase
      .from('filiais')
      .update(toDb(filial))
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return fromDb(data);
  },

  async alterarStatus(id, ativo) {
    const { error } = await supabase.from('filiais').update({ ativo }).eq('id', id);
    if (error) throw error;
  },

  // Mesmo bucket público "clinica" da logomarca da matriz — só muda o
  // prefixo do arquivo.
  async uploadLogo(file) {
    const fileExt = file.name.split('.').pop();
    const filePath = `filial-logo-${Date.now()}.${fileExt}`;
    const { error: uploadError } = await supabase.storage.from('clinica').upload(filePath, file);
    if (uploadError) throw uploadError;
    const { data: { publicUrl } } = supabase.storage.from('clinica').getPublicUrl(filePath);
    return publicUrl;
  },
};
