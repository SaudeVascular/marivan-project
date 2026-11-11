import { test, expect } from '@playwright/test';
import { entrar, idPaciente, sql } from '../apoio.mjs';

test('receita: trocar de paciente com a tela aberta não leva os medicamentos nem o "salvo"', async ({ page }) => {
  const a = idPaciente('E2E Paciente A');
  const b = idPaciente('E2E Paciente B');
  await entrar(page);
  await page.goto('/receituario/' + a);
  await page.getByPlaceholder('Nome do medicamento *').fill('Remédio só de A');
  await page.getByRole('button', { name: /Salvar no Prontuário/ }).click();
  await expect(page.getByText('✓ Salvo no histórico!')).toBeVisible();
  // Mesma rota, outro paciente, sem recarregar (como um link interno).
  await page.evaluate(rota => { history.pushState({}, '', rota); dispatchEvent(new PopStateEvent('popstate')); }, '/receituario/' + b);
  await expect(page.getByPlaceholder('Nome do medicamento *')).toHaveValue('');
  await expect(page.getByText('✓ Salvo no histórico!')).toHaveCount(0);
  expect(sql(`SELECT count(*) FROM public.consultas WHERE paciente_id = '${b}'`)).toBe('0');
});

test('duas abas no mesmo cadastro: a segunda gravação avisa do conflito e não sobrescreve', async ({ page, context }) => {
  await entrar(page);
  // Cada aba tem a própria sessão (sessionStorage): a segunda entra também.
  const outra = await context.newPage();
  await entrar(outra);
  for (const aba of [page, outra]) {
    await aba.getByPlaceholder(/Buscar por nome/).fill('E2E Paciente A');
    await aba.getByRole('button', { name: 'Editar Cadastro' }).first().click();
  }
  await page.getByPlaceholder('(XX) XXXXX-XXXX').fill('(71) 91111-1111');
  await page.getByRole('button', { name: 'Salvar Alterações' }).click();
  await expect(page.getByText('Editar Paciente')).toHaveCount(0);
  await outra.getByPlaceholder('(XX) XXXXX-XXXX').fill('(71) 92222-2222');
  await outra.getByRole('button', { name: 'Salvar Alterações' }).click();
  await expect(outra.getByText(/Outra pessoa alterou este cadastro/)).toBeVisible();
  expect(sql("SELECT telefone FROM public.pacientes WHERE nome ILIKE 'E2E Paciente A'")).toBe('(71) 91111-1111');
});

test('resposta perdida depois de gravar: o novo cadastro não é duplicado', async ({ page }) => {
  await entrar(page);
  let perdida = false;
  await page.route('**/rest/v1/pacientes?*', async (rota) => {
    if (rota.request().method() === 'POST' && !perdida) {
      perdida = true;
      await rota.fetch();          // chega ao banco e grava...
      return rota.abort('failed'); // ...mas a resposta se perde
    }
    return rota.continue();
  });
  await page.getByPlaceholder('Digite o nome completo').fill('E2E Resposta Perdida');
  await page.getByPlaceholder('(XX) XXXXX-XXXX').fill('71933334444');
  await page.getByPlaceholder('DD/MM/AAAA').fill('01/01/1980');
  await page.getByRole('button', { name: 'Salvar Paciente' }).click();
  await expect.poll(() => sql("SELECT count(*) FROM public.pacientes WHERE nome ILIKE 'E2E Resposta Perdida'")).toBe('1');
  // Salvar de novo (quem achou que deu erro) também não duplica.
  await page.getByRole('button', { name: 'Salvar Paciente' }).click().catch(() => {});
  await page.waitForTimeout(1500);
  expect(sql("SELECT count(*) FROM public.pacientes WHERE nome ILIKE 'E2E Resposta Perdida'")).toBe('1');
});
