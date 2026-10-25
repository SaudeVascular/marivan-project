import { test, expect } from '@playwright/test';
import { entrar, idPaciente, sql } from '../apoio.mjs';

test('atestado: assina, gera o PDF e a 2ª via usa os dados da emissão', async ({ page, context }) => {
  const a = idPaciente('E2E Paciente A');
  await entrar(page);
  await page.goto('/atestados/' + a);
  await expect(page.getByText('Dra. Médica E2E')).toBeVisible();
  const janela = context.waitForEvent('page');
  await page.getByRole('button', { name: /Imprimir/ }).click();
  const pdf = await janela;
  // Com visualizador de PDF (Chrome), a janela abre o blob; sem ele
  // (Chromium sem tela do CI), o mesmo PDF vira download. Os dois provam
  // que o documento foi gerado.
  const gerado = await Promise.any([
    pdf.waitForURL(/^blob:/, { timeout: 20000 }).then(() => 'janela'),
    pdf.waitForEvent('download', { timeout: 20000 }).then(() => 'download'),
  ]);
  expect(['janela', 'download']).toContain(gerado);
  const registro = sql(`SELECT id FROM public.consultas WHERE paciente_id = '${a}' AND tipo = 'Atestado' ORDER BY created_at DESC LIMIT 1`);
  expect(registro).not.toBe('');

  sql(`SET session_replication_role = replica; UPDATE public.pacientes SET nome = 'E2E Paciente A (renomeado)' WHERE id = '${a}'`);
  await page.goto(`/imprimir/${a}/${registro}`);
  await expect(page.getByText(/2ª via do documento original — código de verificação/)).toBeVisible();
  await expect(page.getByText('E2E Paciente A (renomeado)')).toHaveCount(0);
  sql(`SET session_replication_role = replica; UPDATE public.pacientes SET nome = 'E2E Paciente A' WHERE id = '${a}'`);
});

test('reimpressão com o registro de A e o paciente B na URL: não mostra nada', async ({ page }) => {
  const a = idPaciente('E2E Paciente A');
  const b = idPaciente('E2E Paciente B');
  await entrar(page);
  const registro = sql(`SELECT id FROM public.consultas WHERE paciente_id = '${a}' LIMIT 1`);
  test.skip(!registro, 'depende do atestado do teste anterior');
  await page.goto(`/imprimir/${b}/${registro}`);
  await expect(page.getByRole('alert')).toHaveText('Registro não encontrado para este paciente.');
});

test('leitura direta da API com a sessão do médico não devolve registros', async ({ page }) => {
  await entrar(page);
  const resposta = await page.evaluate(async ([api, anon]) => {
    const chave = Object.keys(sessionStorage).find(k => /^sb-.*-auth-token$/.test(k));
    const token = JSON.parse(sessionStorage.getItem(chave)).access_token;
    const r = await fetch(`${api}/rest/v1/consultas?select=id,conteudo`, { headers: { apikey: anon, Authorization: `Bearer ${token}` } });
    return r.json();
  }, [process.env.E2E_API_URL, process.env.E2E_ANON_KEY]);
  expect(resposta).toEqual([]);
});
