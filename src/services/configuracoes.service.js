import { supabase } from './supabase';

// DB (snake_case) → React (camelCase)
const fromDb = (c) => ({
  id: c.id,
  nome: c.nome || '',
  nomeFantasia: c.nome_fantasia || '',
  cnpj: c.cnpj || '',
  cep: c.cep || '',
  endereco: c.endereco || '',
  numero: c.numero || '',
  complemento: c.complemento || '',
  cidade: c.cidade || '',
  telefone: c.telefone || '',
  logoUrl: c.logo_url || '',
});

export const configuracoesService = {
  // Tabela de linha única (supabase_configuracoes_clinica.sql) — sempre
  // lê a primeira. Retorna null se a migração ainda não rodou.
  async buscar() {
    const { data, error } = await supabase
      .from('configuracoes_clinica')
      .select('*')
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data ? fromDb(data) : null;
  },

  async atualizar(id, { nome, nomeFantasia, cnpj, cep, endereco, numero, complemento, cidade, telefone, logoUrl }) {
    const { data, error } = await supabase
      .from('configuracoes_clinica')
      .update({
        nome,
        nome_fantasia: nomeFantasia,
        cnpj,
        cep,
        endereco,
        numero,
        complemento,
        cidade,
        telefone,
        logo_url: logoUrl || null,
      })
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return fromDb(data);
  },

  // Bucket público "clinica" (supabase_configuracoes_clinica_extra.sql) —
  // a logomarca precisa aparecer em documento impresso sem autenticação.
  async uploadLogo(file) {
    const fileExt = file.name.split('.').pop();
    const filePath = `logo-${Date.now()}.${fileExt}`;
    const { error: uploadError } = await supabase.storage.from('clinica').upload(filePath, file);
    if (uploadError) throw uploadError;
    const { data: { publicUrl } } = supabase.storage.from('clinica').getPublicUrl(filePath);
    return publicUrl;
  },
};
