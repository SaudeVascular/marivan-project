import { supabase } from './supabase';

export const usuariosService = {
  // Lê por `perfis_view` (supabase_perfis_equipe.sql), não pela tabela
  // direto: a view mascara cpf/nascimento/sexo de quem não é o dono do
  // perfil nem Administrador, mas mantém nome/função/CRM/especialidade
  // visíveis — é o que Agenda, Recepção e Financeiro precisam pra
  // listar/identificar profissionais que não são o usuário logado.
  async listar() {
    const { data, error } = await supabase
      .from('perfis_view')
      .select('*')
      .order('nome');
    if (error) throw error;
    return data || [];
  },

  async buscarPerfil(userId) {
    const { data, error } = await supabase
      .from('perfis_view')
      .select('nome, crm, uf, funcao, email, sexo, nascimento, cpf, especialidade, area_atuacao, ativo, papel_clinico_administrador, assinatura_imagem, cbo, rqe')
      .eq('id', userId)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  // Assinatura digitalizada (desenhada na tela ou enviada como arquivo):
  // a própria migração 31 garante que só o dono lê a de volta.
  async salvarAssinatura(id, dataUri) {
    const { error } = await supabase.from('perfis').update({ assinatura_imagem: dataUri }).eq('id', id);
    if (error) throw error;
  },

  async removerAssinatura(id) {
    const { error } = await supabase.from('perfis').update({ assinatura_imagem: null }).eq('id', id);
    if (error) throw error;
  },

  // Só outro Administrador ativo pode chamar — RLS/trigger da migração 30
  // recusam autoconcessão mesmo vindo de um Administrador.
  async concederPapelClinico(id, papel) {
    const { error } = await supabase
      .from('perfis')
      .update({ papel_clinico_administrador: papel || null })
      .eq('id', id);
    if (error) throw error;
  },

  async criar({ nome, email, funcao, crm, uf, sexo, nascimento, cpf, especialidade, area_atuacao, rqe }) {
    const { data, error } = await supabase.functions.invoke('admin-create-user', {
      body: {
        nome, email, funcao, crm, uf, sexo, nascimento, cpf,
        especialidade, area_atuacao, rqe,
      },
    });
    if (error) {
      let mensagem;
      try {
        const resposta = await error.context?.json();
        mensagem = resposta?.error;
      } catch {
        // Respostas sem JSON recebem uma mensagem segura e estável abaixo.
      }
      throw new Error(mensagem || 'Não foi possível enviar o convite. Tente novamente mais tarde.');
    }
    if (!data?.user?.id) throw new Error('O backend não devolveu o novo usuário.');
    return data.user;
  },

  async atualizar(id, { nome, funcao, crm, uf, sexo, nascimento, cpf, especialidade, area_atuacao, cbo, rqe }) {
    const { error } = await supabase
      .from('perfis')
      .update({
        nome, funcao,
        crm: crm || '',
        uf: uf || '',
        sexo: sexo || '',
        nascimento: nascimento || null,
        cpf: cpf || '',
        especialidade: especialidade || '',
        area_atuacao: area_atuacao || '',
        cbo: (cbo || '').replace(/\D/g, '') || null,
        // RQE só existe para médico — trocar a função apaga o que sobrou.
        rqe: funcao === 'Médico' ? ((rqe || '').replace(/\D/g, '') || null) : null,
      })
      .eq('id', id);
    if (error) throw error;
  },

  async alterarStatus(id, ativo) {
    const { error } = await supabase.from('perfis').update({ ativo }).eq('id', id);
    if (error) throw error;
  },

};
