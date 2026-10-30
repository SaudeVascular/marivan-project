import { test, expect } from '@playwright/test';
import { entrar, idPaciente, limparAtendimentos, sql } from '../apoio.mjs';

test('agenda → atendimento → cobrança: a Recepção agenda com o procedimento, a médica assina e o Financeiro vê a cobrança pendente', async ({ page }) => {
  const a = idPaciente('E2E Paciente A');
  const medica = sql("SELECT id FROM auth.users WHERE email = 'e2e-medico@example.invalid'");
  limparAtendimentos(a);

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
  const linha = page.getByRole('table', { name: 'Atendimentos do período' }).getByRole('row', { name: /E2E Paciente A/i });
  await expect(linha).toContainText('R$ 180,00');
  await expect(linha).toContainText('Pendente');
  expect(sql(`SELECT status || ' ' || valor || ' ' || valor_repasse FROM public.cobrancas WHERE paciente_id = '${a}'`)).toBe('Pendente 180.00 108.00');
});

test('Recepção recebe o particular com 10% de desconto; o repasse sai do que entrou', async ({ page }) => {
  const b = idPaciente('E2E Paciente B');
  limparAtendimentos(b);
  sql(`INSERT INTO public.agendamentos (paciente_id, medico_id, data, hora, procedimento_id, convenio_id)
       SELECT '${b}', u.id, (now() AT TIME ZONE 'America/Sao_Paulo')::date, '07:30', p.id, NULL
         FROM auth.users u, public.procedimentos p WHERE u.email = 'e2e-medico@example.invalid' AND p.nome = 'E2E Consulta'`);

  await entrar(page, 'recepcao');
  await page.goto('/recepcao');
  await page.getByRole('button', { name: /Receber/ }).click();
  await expect(page.getByText(/Valor da tabela/)).toContainText('R$ 300,00');
  await page.getByLabel('Desconto', { exact: true }).fill('10');
  await page.getByLabel('Tipo do desconto').selectOption('%');
  await expect(page.getByText(/A pagar:/)).toContainText('R$ 270,00');
  await page.getByLabel('Forma de pagamento').selectOption('PIX');
  await page.getByRole('button', { name: 'Confirmar recebimento' }).click();
  await expect(page.getByText(/✓ Recebido R\$\s*270,00/)).toBeVisible();
  expect(sql(`SELECT status || ' ' || valor || ' ' || desconto || ' ' || forma_pagamento || ' ' || valor_repasse FROM public.cobrancas WHERE paciente_id = '${b}'`))
    .toBe('Pago 300.00 30.00 PIX 162.00');
});
