import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

// Nunca executar fixtures em um projeto remoto. CI usa Supabase descartável.
const connection = process.env.CLINICAL_TEST_DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
const url = new URL(connection);
if (!['postgres:', 'postgresql:'].includes(url.protocol) || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || url.search) {
  throw new Error('Testes clínicos exigem PostgreSQL local descartável, sem parâmetros extras na URL.');
}
const quote = value => `'${String(value).replaceAll("'", "''")}'`;

function iniciar(sql) {
  const child = spawn('psql', [connection, '-X', '-A', '-t', '-q', '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=verbose'], {
    stdio: ['pipe', 'pipe', 'pipe'], env: { ...process.env, PGCONNECT_TIMEOUT: '5' },
  });
  let stdout = '';
  let stderr = '';
  let sinalizar;
  const locked = new Promise(resolve => { sinalizar = resolve; });
  const timer = setTimeout(() => child.kill('SIGTERM'), 20000);
  child.stdout.on('data', chunk => {
    stdout += chunk.toString();
    if (stdout.includes('LOCKED')) sinalizar(true);
  });
  child.stderr.on('data', chunk => { stderr += chunk.toString(); });
  const done = new Promise((resolve, reject) => {
    child.on('error', error => { clearTimeout(timer); sinalizar(false); reject(error); });
    child.on('close', code => { clearTimeout(timer); sinalizar(false); resolve({ code, stdout, stderr }); });
  });
  child.stdin.end(sql);
  return { done, locked };
}
async function executar(sql) {
  const result = await iniciar(sql).done;
  assert.equal(result.code, 0, result.stderr);
  return result.stdout;
}
const registro = output => JSON.parse(output.split('\n').find(line => line.startsWith('{')));
const autor = randomUUID();
const paciente = randomUUID();
const auth = `BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = ${quote(autor)};
SET LOCAL "request.jwt.claim.role" = 'authenticated';
SET LOCAL "request.jwt.claims" = ${quote(JSON.stringify({ sub: autor, role: 'authenticated' }))};`;
const transacao = (sql, hold = false) => `${auth}\n${sql}\n${hold ? "SELECT 'LOCKED'; SELECT pg_sleep(0.5);" : ''}\nCOMMIT;`;
const rpc = (op, acao, id, versao, dados) => `SELECT public.salvar_registro_clinico(${quote(op)}, ${quote(acao)}, ${quote(paciente)}, ${id ? quote(id) : 'NULL'}, ${versao ?? 'NULL'}, ${quote(JSON.stringify(dados))}::jsonb);`;

await executar(await readFile(new URL('../supabase/tests/clinical_writes.sql', import.meta.url), 'utf8'));
console.log('OK: testes transacionais de integridade e autorização.');
try {
  await executar(`BEGIN;
    INSERT INTO auth.users(id, email) VALUES (${quote(autor)}, ${quote(`estabilidade-${autor}@example.invalid`)});
    SET LOCAL session_replication_role = replica;
    UPDATE public.perfis SET ativo = true, funcao = 'Médico', nome = 'Médico fictício', crm = '123', uf = 'BA' WHERE id = ${quote(autor)};
    SET LOCAL session_replication_role = origin;
    INSERT INTO public.pacientes(id, nome) VALUES (${quote(paciente)}, 'Paciente fictício de concorrência');
    COMMIT;`);

  const criar = rpc(randomUUID(), 'criar', null, null, { tipo: 'Consulta', conteudo: 'Inicial', status: 'Rascunho' });
  const primeira = iniciar(transacao(criar, true));
  assert.equal(await primeira.locked, true, 'Primeira transação não obteve o lock');
  const segunda = iniciar(transacao(criar));
  const [a, b] = await Promise.all([primeira.done, segunda.done]);
  assert.equal(a.code, 0, a.stderr);
  assert.equal(b.code, 0, b.stderr);
  assert.deepEqual(registro(a.stdout), registro(b.stdout));
  const id = registro(a.stdout).id;
  assert.equal((await executar(`SELECT count(*) FROM public.consultas WHERE paciente_id = ${quote(paciente)};`)).trim(), '1');
  console.log('OK: duas conexões repetindo a mesma criação produzem um registro e o mesmo recibo.');

  const edicaoA = iniciar(transacao(rpc(randomUUID(), 'atualizar', id, 1, { conteudo: 'Edição A' }), true));
  assert.equal(await edicaoA.locked, true);
  const edicaoB = iniciar(transacao(rpc(randomUUID(), 'atualizar', id, 1, { conteudo: 'Edição B obsoleta' })));
  const [ea, eb] = await Promise.all([edicaoA.done, edicaoB.done]);
  assert.equal(ea.code, 0, ea.stderr);
  assert.notEqual(eb.code, 0);
  assert.match(eb.stderr, /P4090/);
  assert.equal(registro(ea.stdout).versao, 2);
  console.log('OK: duas edições na mesma versão não sobrescrevem uma à outra.');

  const assinatura = iniciar(transacao(rpc(randomUUID(), 'assinar', id, 2, { conteudo: 'Texto final assinado' }), true));
  assert.equal(await assinatura.locked, true);
  const edicaoTardia = iniciar(transacao(rpc(randomUUID(), 'atualizar', id, 2, { conteudo: 'Edição concorrente à assinatura' })));
  const [sa, st] = await Promise.all([assinatura.done, edicaoTardia.done]);
  assert.equal(sa.code, 0, sa.stderr);
  assert.notEqual(st.code, 0);
  assert.match(st.stderr, /P4090/);
  const final = registro(await executar(`SELECT to_jsonb(c) FROM public.consultas c WHERE id = ${quote(id)};`));
  assert.equal(final.status, 'Assinado');
  assert.equal(final.conteudo, 'Texto final assinado');
  assert.equal(final.versao, 3);
  assert.equal((await executar(`SELECT count(*) FROM public.auditoria WHERE tabela = 'consultas' AND registro_id = ${quote(id)};`)).trim(), '3');
  console.log('OK: assinatura atômica vence edição obsoleta; auditoria contém somente três gravações efetivas.');
} finally {
  await executar(`BEGIN;
    DELETE FROM public.operacoes_registro WHERE autor_id = ${quote(autor)};
    DELETE FROM public.consultas WHERE paciente_id = ${quote(paciente)};
    DELETE FROM public.pacientes WHERE id = ${quote(paciente)};
    DELETE FROM public.auditoria WHERE alterado_por = ${quote(autor)} OR registro_id IN (${quote(autor)}, ${quote(paciente)});
    DELETE FROM auth.users WHERE id = ${quote(autor)};
    DELETE FROM public.auditoria WHERE registro_id IN (${quote(autor)}, ${quote(paciente)})
      OR dados_antigos->>'paciente_id' = ${quote(paciente)} OR dados_novos->>'paciente_id' = ${quote(paciente)};
    COMMIT;`);
}
