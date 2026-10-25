import { expect } from '@playwright/test';
import { CONTAS, SENHA, sql } from './preparar.mjs';

export { sql };
export const idPaciente = nome => sql(`SELECT id FROM public.pacientes WHERE nome ILIKE '${nome}'`);

export async function entrar(page, conta = 'medico') {
  await page.goto('/login');
  await page.locator('input[type=email]').last().fill(CONTAS[conta].email);
  await page.locator('input[type=password]').fill(SENHA);
  await page.locator('input[type=password]').press('Enter');
  await expect(page).toHaveURL(/\/pacientes$/);
}

export const tokenNoNavegador = page =>
  page.evaluate(() => Object.keys(sessionStorage).filter(k => /^sb-.*-auth-token/.test(k)).length);
