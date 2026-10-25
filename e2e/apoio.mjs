import { expect } from '@playwright/test';
import { CONTAS, SENHA, sql } from './preparar.mjs';

export { sql };
export const idPaciente = nome => sql(`SELECT id FROM public.pacientes WHERE nome ILIKE '${nome}'`);

export async function entrar(page, conta = 'medico') {
  await page.goto('/login');
  await page.locator('input[type=email]').last().fill(CONTAS[conta].email);
  await page.locator('input[type=password]').fill(SENHA);
  await page.locator('input[type=password]').press('Enter');
  // Folga para o CI: o Auth local às vezes demora no primeiro login de cada conta.
  await expect(page).toHaveURL(/\/(pacientes|financeiro)$/, { timeout: 15000 });
}

// Cada teste começa sem o que uma tentativa anterior (retry) deixou.
export function limparAtendimentos(paciente) {
  sql(`SET session_replication_role = replica;
    DELETE FROM public.cobrancas WHERE paciente_id = '${paciente}';
    DELETE FROM public.agendamentos WHERE paciente_id = '${paciente}';`);
}

export const tokenNoNavegador = page =>
  page.evaluate(() => Object.keys(sessionStorage).filter(k => /^sb-.*-auth-token/.test(k)).length);
