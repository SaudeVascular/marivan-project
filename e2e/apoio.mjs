import { expect } from '@playwright/test';
import { CONTAS, SENHA, sql } from './preparar.mjs';

export { sql };
export const idPaciente = nome => sql(`SELECT id FROM public.pacientes WHERE nome ILIKE '${nome}'`);

export async function entrar(page, conta = 'medico') {
  await page.goto('/login');
  const email = page.locator('input[type=email]').last();
  const senha = page.locator('input[type=password]');
  // A tela de login pode se redesenhar logo depois de abrir (o Auth termina
  // de restaurar/encerrar a sessão anterior) e apagar o que já foi digitado
  // — no CI isso deixou o e-mail vazio. Confere os campos antes de enviar e
  // repete o passo inteiro se a tela ainda não tiver saído do login.
  await expect(async () => {
    await email.fill(CONTAS[conta].email);
    await senha.fill(SENHA);
    await expect(email).toHaveValue(CONTAS[conta].email, { timeout: 500 });
    await senha.press('Enter');
    await expect(page).toHaveURL(/\/(pacientes|financeiro)$/, { timeout: 5000 });
  }).toPass({ timeout: 20000 });
}

// Cada teste começa sem o que uma tentativa anterior (retry) deixou.
export function limparAtendimentos(paciente) {
  sql(`SET session_replication_role = replica;
    DELETE FROM public.cobrancas WHERE paciente_id = '${paciente}';
    DELETE FROM public.agendamentos WHERE paciente_id = '${paciente}';`);
}

export const tokenNoNavegador = page =>
  page.evaluate(() => Object.keys(sessionStorage).filter(k => /^sb-.*-auth-token/.test(k)).length);
