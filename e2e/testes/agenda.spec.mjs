import { test, expect } from '@playwright/test';
import { entrar, idPaciente, sql } from '../apoio.mjs';

test('agenda → atendimento → cobrança: a Recepção agenda com o procedimento, a médica assina e o Financeiro vê a cobrança pendente', async ({ page }) => {
  const a = idPaciente('E2E Paciente A');
  const medica = sql("SELECT id FROM auth.users WHERE email = 'e2e-medico@example.invalid'");

  await entrar(page, 'recepcao');
  await page.goto('/recepcao');
  await page.getByRole('button', { name: '+ Novo agendamento' }).click();
  await page.getByPlaceholder(/Buscar paciente já cadastrado/).fill('E2E Paciente A');
  await page.getByText(/E2E Paciente A/i).last().click();
  await expect(page.getByLabel('Convênio')).toHaveValue(sql("SELECT id FROM public.convenios WHERE nome = 'E2E Convênio'"));
  await page.getByLabel('Procedimento').selectOption({ label: 'E2E Consulta' });
  await expect(page.getByText('R$ 180,00')).toBeVisible();
  const hora = new Date(Date.now() + 60 * 60 * 1000).toTimeString().slice(0, 5);
  await page.locator('input[type=time]').fill(hora);
  await page.locator('select').filter({ hasText: 'Não definido' }).selectOption(medica);
  await page.getByRole('button', { name: '✓ Agendar' }).click();
  await expect(page.getByText('E2E Consulta · E2E Convênio')).toBeVisible();
  // Chegada: check-in.
  await page.getByRole('button', { name: 'Aguardando' }).first().click();
  await expect.poll(() => sql(`SELECT status FROM public.agendamentos WHERE paciente_id = '${a}'`)).toBe('Aguardando');
  await page.getByRole('button', { name: 'Sair' }).click();

  await entrar(page, 'medico');
  await page.goto('/prontuario/' + a);
  await page.getByPlaceholder(/História clínica/).fill('Consulta de teste do fluxo agenda → cobrança.');
  await page.getByRole('button', { name: /Finalizar e Assinar/ }).click();
  await expect.poll(() => sql(`SELECT status FROM public.agendamentos WHERE paciente_id = '${a}'`), { timeout: 15000 }).toBe('Realizado');
  await page.getByRole('button', { name: 'Sair' }).click();

  await entrar(page, 'financeiro');
  await page.goto('/financeiro');
  await expect(page.getByText('da agenda')).toBeVisible();
  await expect(page.getByText(/R\$\s*180,00/).first()).toBeVisible();
  expect(sql(`SELECT status || ' ' || valor || ' ' || valor_repasse FROM public.cobrancas WHERE paciente_id = '${a}'`)).toBe('Pendente 180.00 108.00');
});
