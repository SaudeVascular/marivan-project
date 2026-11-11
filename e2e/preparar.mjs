// Contas e pacientes fictícios no Supabase LOCAL (ver scripts/e2e.sh).
import { execFileSync } from 'node:child_process';

export const SENHA = 'TesteE2E-Fictício-2026';
export const CONTAS = {
  medico: { email: 'e2e-medico@example.invalid', funcao: 'Médico', nome: 'Médica E2E', crm: '12345', uf: 'BA', sexo: 'Feminino' },
  recepcao: { email: 'e2e-recepcao@example.invalid', funcao: 'Recepcionista', nome: 'Recepção E2E' },
  financeiro: { email: 'e2e-financeiro@example.invalid', funcao: 'Financeiro', nome: 'Financeiro E2E' },
};

function exigirLocal() {
  const { E2E_API_URL: api, E2E_DB_URL: db } = process.env;
  if (!api?.startsWith('http://127.0.0.1:') || !db?.startsWith('postgresql://postgres:postgres@127.0.0.1:')) {
    throw new Error('Testes de navegador só no Supabase local (rode por scripts/e2e.sh).');
  }
}

export function sql(comando) {
  exigirLocal();
  return execFileSync('psql', [process.env.E2E_DB_URL, '-X', '-At', '-v', 'ON_ERROR_STOP=1', '-c', comando], { encoding: 'utf8' }).trim();
}

const literal = v => (v == null ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`);

async function garantirConta({ email }) {
  const api = process.env.E2E_API_URL;
  const chave = process.env.E2E_SERVICE_ROLE_KEY;
  const cabecalhos = { apikey: chave, Authorization: `Bearer ${chave}`, 'Content-Type': 'application/json' };
  const existente = sql(`SELECT id FROM auth.users WHERE email = ${literal(email)}`);
  if (existente) {
    await fetch(`${api}/auth/v1/admin/users/${existente}`, { method: 'PUT', headers: cabecalhos, body: JSON.stringify({ password: SENHA }) });
    return existente;
  }
  const r = await fetch(`${api}/auth/v1/admin/users`, {
    method: 'POST', headers: cabecalhos, body: JSON.stringify({ email, password: SENHA, email_confirm: true }),
  });
  if (!r.ok) throw new Error(`Não foi possível criar ${email}: ${r.status}`);
  return (await r.json()).id;
}

export default async function preparar() {
  exigirLocal();
  for (const conta of Object.values(CONTAS)) {
    const id = await garantirConta(conta);
    sql(`SET session_replication_role = replica;
      UPDATE public.perfis SET ativo = true, funcao = ${literal(conta.funcao)}, nome = ${literal(conta.nome)},
        crm = ${literal(conta.crm)}, uf = ${literal(conta.uf)}, sexo = ${literal(conta.sexo)} WHERE id = ${literal(id)}`);
  }
  // Pacientes fictícios recriados a cada execução (prefixo E2E).
  sql(`SET session_replication_role = replica;
    DELETE FROM public.cobrancas WHERE paciente_id IN (SELECT id FROM public.pacientes WHERE nome ILIKE 'E2E %');
    DELETE FROM public.agendamentos WHERE paciente_id IN (SELECT id FROM public.pacientes WHERE nome ILIKE 'E2E %');
    DELETE FROM public.acessos WHERE paciente_id IN (SELECT id FROM public.pacientes WHERE nome ILIKE 'E2E %');
    DELETE FROM public.medicamentos_receita WHERE consulta_id IN (SELECT c.id FROM public.consultas c JOIN public.pacientes p ON p.id = c.paciente_id WHERE p.nome LIKE 'E2E %');
    DELETE FROM public.consultas WHERE paciente_id IN (SELECT id FROM public.pacientes WHERE nome ILIKE 'E2E %');
    DELETE FROM public.pacientes WHERE nome ILIKE 'E2E %';
    DELETE FROM public.convenio_valores WHERE procedimento_id IN (SELECT id FROM public.procedimentos WHERE nome ILIKE 'E2E %');
    DELETE FROM public.procedimentos WHERE nome ILIKE 'E2E %';
    DELETE FROM public.convenios WHERE nome ILIKE 'E2E %';
    INSERT INTO public.convenios (nome) VALUES ('E2E Convênio');
    INSERT INTO public.procedimentos (nome, tipo, valor_particular) VALUES ('E2E Consulta', 'Consulta', 300);
    -- Repasse é do profissional (migração 50): a médica fictícia recebe 60% das consultas.
    INSERT INTO public.repasse_profissional (profissional_id, percentual_consulta, percentual_exame, percentual_procedimento)
      SELECT id, 60, 10, 30 FROM auth.users WHERE email = 'e2e-medico@example.invalid'
      ON CONFLICT (profissional_id) DO UPDATE SET percentual_consulta = 60, percentual_exame = 10, percentual_procedimento = 30;
    INSERT INTO public.convenio_valores (convenio_id, procedimento_id, valor)
      SELECT c.id, p.id, 180 FROM public.convenios c, public.procedimentos p WHERE c.nome = 'E2E Convênio' AND p.nome = 'E2E Consulta';
    INSERT INTO public.pacientes (nome, telefone, nascimento, convenio_id) VALUES
      ('E2E Paciente A', '(71) 90000-0001', '1980-01-01', (SELECT id FROM public.convenios WHERE nome = 'E2E Convênio')),
      ('E2E Paciente B', '(71) 90000-0002', '1990-02-02', NULL);`);
}
