// Contas e pacientes fictícios no Supabase LOCAL (ver scripts/e2e.sh).
import { execFileSync } from 'node:child_process';

export const SENHA = 'TesteE2E-Fictício-2026';
export const CONTAS = {
  medico: { email: 'e2e-medico@example.invalid', funcao: 'Médico', nome: 'Médica E2E', crm: '12345', uf: 'BA', sexo: 'Feminino' },
  recepcao: { email: 'e2e-recepcao@example.invalid', funcao: 'Recepcionista', nome: 'Recepção E2E' },
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
    DELETE FROM public.acessos WHERE paciente_id IN (SELECT id FROM public.pacientes WHERE nome ILIKE 'E2E %');
    DELETE FROM public.medicamentos_receita WHERE consulta_id IN (SELECT c.id FROM public.consultas c JOIN public.pacientes p ON p.id = c.paciente_id WHERE p.nome LIKE 'E2E %');
    DELETE FROM public.consultas WHERE paciente_id IN (SELECT id FROM public.pacientes WHERE nome ILIKE 'E2E %');
    DELETE FROM public.pacientes WHERE nome ILIKE 'E2E %';
    INSERT INTO public.pacientes (nome, telefone, nascimento) VALUES ('E2E Paciente A', '(71) 90000-0001', '1980-01-01'), ('E2E Paciente B', '(71) 90000-0002', '1990-02-02');`);
}
