import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Os SQLs da raiz existiam antes da adoção do Supabase CLI. As cópias
// abaixo formam o histórico inicial imutável. Este teste impede que alguém
// corrija apenas uma das cópias e deixe bancos novos diferentes do atual.
const pares = [
  ['supabase_schema.sql', '20260710000001_schema_base.sql'],
  ['supabase_usuarios.sql', '20260710000002_perfis_usuarios.sql'],
  ['supabase_fix_trigger.sql', '20260710000003_corrigir_trigger_perfis.sql'],
  ['supabase_perfis_extra.sql', '20260710000004_perfis_campos_extras.sql'],
  ['supabase_crm.sql', '20260710000005_perfis_crm.sql'],
  ['supabase_modelos_receita.sql', '20260710000006_modelos_receita.sql'],
  ['supabase_pedido_exames.sql', '20260710000007_pedidos_exames_laudos.sql'],
  ['supabase_rls_rbac.sql', '20260710000008_rls_rbac.sql'],
  ['supabase_auditoria.sql', '20260710000009_auditoria.sql'],
  ['supabase_perfis_uf.sql', '20260710000010_perfis_uf.sql'],
  ['supabase_agenda.sql', '20260710000011_agenda.sql'],
  ['supabase_financeiro.sql', '20260710000012_financeiro.sql'],
  ['supabase_pacientes_convenio.sql', '20260710000013_pacientes_convenio.sql'],
  ['supabase_pacientes_mascara_clinica.sql', '20260710000014_pacientes_view_mascarada.sql'],
  ['supabase_perfis_equipe.sql', '20260710000015_perfis_view_equipe.sql'],
  ['supabase_enfermagem.sql', '20260710000016_enfermagem.sql'],
  ['supabase_configuracoes_clinica.sql', '20260710000017_configuracoes_clinica.sql'],
  ['supabase_configuracoes_clinica_extra.sql', '20260710000018_configuracoes_clinica_extra.sql'],
  ['supabase_configuracoes_clinica_endereco.sql', '20260710000019_configuracoes_clinica_endereco.sql'],
  ['supabase_filiais.sql', '20260710000020_filiais.sql'],
  ['supabase_prontuario_assinatura.sql', '20260710000021_prontuario_assinatura.sql'],
  ['supabase_security_p0.sql', '20260812000022_security_p0.sql'],
  ['supabase_security_p0_hotfix_recepcao.sql', '20260812000023_security_p0_hotfix_recepcao.sql'],
];

const divergencias = [];
for (const [origem, migracao] of pares) {
  const [a, b] = await Promise.all([
    readFile(resolve(raiz, origem)),
    readFile(resolve(raiz, 'supabase/migrations', migracao)),
  ]);
  if (!a.equals(b)) divergencias.push(`${origem} != supabase/migrations/${migracao}`);
}

if (divergencias.length) {
  console.error('Migrações iniciais divergentes:\n' + divergencias.map((d) => `- ${d}`).join('\n'));
  process.exit(1);
}

console.log(`OK: ${pares.length} migrações iniciais conferidas.`);
