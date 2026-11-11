import { supabase } from './supabase';

// Regras de repasse por profissional (migração 50): percentual sobre
// consultas, exames e procedimentos. Só o Administrador grava; o próprio
// profissional, o Financeiro e o Administrador leem.
const fromDb = (r) => ({
  profissionalId: r.profissional_id,
  consulta: Number(r.percentual_consulta),
  exame: Number(r.percentual_exame),
  procedimento: Number(r.percentual_procedimento),
  atualizadoEm: r.updated_at,
});

export const repasseService = {
  async listar() {
    const { data, error } = await supabase.from('repasse_profissional').select('*');
    if (error) throw error;
    return (data || []).map(fromDb);
  },

  async salvar(profissionalId, { consulta, exame, procedimento }) {
    const { data, error } = await supabase
      .from('repasse_profissional')
      .upsert({
        profissional_id: profissionalId,
        percentual_consulta: Number(consulta) || 0,
        percentual_exame: Number(exame) || 0,
        percentual_procedimento: Number(procedimento) || 0,
      }, { onConflict: 'profissional_id' })
      .select()
      .single();
    if (error) throw error;
    return fromDb(data);
  },
};
