import { test, expect } from '@playwright/test';
import { entrar, idPaciente, tokenNoNavegador } from '../apoio.mjs';

test('sair sem rede: login na hora, token apagado e aviso de revogação pendente', async ({ page, context }) => {
  await entrar(page);
  expect(await tokenNoNavegador(page)).toBe(1);
  await context.setOffline(true);
  await page.getByRole('button', { name: 'Sair' }).click({ noWaitAfter: true });
  await expect(page.getByText('Faça login para continuar')).toBeVisible({ timeout: 2000 });
  await expect(page.getByRole('status')).toContainText('Você saiu deste computador', { timeout: 15000 });
  expect(await tokenNoNavegador(page)).toBe(0);
  await context.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect(page.getByRole('status')).toHaveCount(0, { timeout: 10000 });
});

test('15 minutos sem atividade: sai sozinho e avisa', async ({ page }) => {
  await page.clock.install();
  await entrar(page);
  await page.clock.fastForward('16:00');
  await page.clock.resume();
  await expect(page.getByText('Sua sessão foi encerrada após 15 minutos de inatividade.')).toBeVisible();
  await expect.poll(() => tokenNoNavegador(page)).toBe(0);
});

test('troca de usuário: a Recepção não vê o que o Médico abriu', async ({ page }) => {
  const a = idPaciente('E2E Paciente A');
  await entrar(page, 'medico');
  await page.goto('/prontuario/' + a);
  await expect(page.getByRole('button', { name: 'Atualizar histórico' })).toBeVisible();
  await page.getByPlaceholder(/História clínica/).fill('Rascunho do médico que não pode vazar');
  await page.getByRole('button', { name: 'Sair' }).click();
  await entrar(page, 'recepcao');
  expect(await page.evaluate(() => Object.keys(sessionStorage).filter(k => k.startsWith('pep_rascunho')).length)).toBe(0);
  await page.goto('/prontuario/' + a);
  await expect(page).toHaveURL(/\/pacientes$/);
  await expect(page.getByText('Rascunho do médico que não pode vazar')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Atualizar histórico' })).toHaveCount(0);
});
