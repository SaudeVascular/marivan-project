import { test, expect } from '@playwright/test';
import * as XLSX from 'xlsx';
import { entrar, idPaciente, limparAtendimentos, sql } from '../apoio.mjs';

// Planilha .xls de verdade (formato antigo do Excel), gerada aqui.
function planilhaXls(linhas) {
  const pasta = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(pasta, XLSX.utils.aoa_to_sheet(linhas), 'Tabela');
  return Buffer.from(XLSX.write(pasta, { type: 'buffer', bookType: 'biff8' }));
}

test('Financeiro cadastra a operadora e importa a tabela do convênio de uma planilha .xls', async ({ page }) => {
  await entrar(page, 'financeiro');
  sql("DELETE FROM public.convenios WHERE nome = 'E2E Operadora'");
  sql("DELETE FROM public.procedimentos WHERE nome = 'E2E Hemograma'");
  sql("UPDATE public.procedimentos SET codigo = NULL WHERE nome = 'E2E Consulta'");
  await page.goto('/financeiro/config');
  await page.getByLabel('Nome do novo convênio').fill('E2E Operadora');
  await page.getByRole('button', { name: '+ Novo' }).click();
  await page.getByLabel('Razão social da operadora').fill('E2E Operadora de Saúde S.A.');
  await page.getByLabel('CNPJ').fill('11222333000181');
  await expect(page.getByLabel('CNPJ')).toHaveValue('11.222.333/0001-81');
  await page.getByLabel('Registro ANS').fill('123456');
  await page.getByRole('button', { name: /Salvar dados/ }).click();
  await expect(page.getByText('Dados do convênio salvos.')).toBeVisible();
  expect(sql("SELECT razao_social || ' ' || cnpj || ' ' || registro_ans FROM public.convenios WHERE nome = 'E2E Operadora'"))
    .toBe('E2E Operadora de Saúde S.A. 11222333000181 123456');

  await page.getByRole('button', { name: /Importar planilha/ }).click();
  await page.getByLabel('Arquivo da tabela').setInputFiles({
    name: 'tabela-e2e.xls',
    mimeType: 'application/vnd.ms-excel',
    buffer: planilhaXls([
      ['Tabela E2E — outubro'],
      ['Código', 'Descrição', 'Valor (R$)'],
      ['E2E0001', 'E2E Consulta', '190,00'],
      ['40399991', 'E2E Hemograma', 25],
    ]),
  });
  await expect(page.getByText(/2 linhas prontas/)).toBeVisible();
  await page.getByRole('button', { name: 'Importar 2 linhas' }).click();
  await expect(page.getByText(/2 valores gravados, 1 procedimentos novos/)).toBeVisible();
  await expect(page.getByRole('row', { name: /E2E Hemograma/ })).toContainText('R$ 25,00');
  await expect(page.getByRole('row', { name: /E2E Consulta/ })).toContainText('R$ 190,00');
  // O procedimento que já existia ganhou o código; o novo veio como exame (código 40…).
  expect(sql("SELECT codigo || ' ' || tipo FROM public.procedimentos WHERE nome = 'E2E Consulta'")).toBe('E2E0001 Consulta');
  expect(sql("SELECT codigo || ' ' || tipo FROM public.procedimentos WHERE nome = 'E2E Hemograma'")).toBe('40399991 Exame');
});

test('relatório de produção: a médica vê e imprime a própria; o Financeiro vê a de todos, com o que fica para a clínica', async ({ page }) => {
  const b = idPaciente('E2E Paciente B');
  limparAtendimentos(b);
  sql(`INSERT INTO public.cobrancas (paciente_id, medico_id, procedimento_id, valor, data_cobranca)
       SELECT '${b}', u.id, p.id, 300, DATE '2026-01-15' FROM auth.users u, public.procedimentos p
        WHERE u.email = 'e2e-medico@example.invalid' AND p.nome = 'E2E Consulta'`);

  await entrar(page, 'medico');
  await page.goto('/financeiro');
  await page.getByRole('link', { name: /Relatório de produção/ }).click();
  await page.getByLabel('Mês do relatório').fill('2026-01');
  const atendimentos = page.getByRole('table', { name: /Atendimentos/ });
  await expect(atendimentos.getByRole('row', { name: /E2E Paciente B/i })).toContainText('R$ 180,00'); // 60% da consulta
  await expect(page.getByRole('group', { name: 'Seu repasse' })).toContainText('R$ 180,00');
  await expect(page.getByRole('group', { name: 'Fica para a clínica' })).toHaveCount(0);
  await page.emulateMedia({ media: 'print' });
  await expect(page.getByText('RELATÓRIO DE PRODUÇÃO', { exact: true })).toBeVisible();
  await expect(page.getByText('Relatório de produção', { exact: true })).toBeHidden();
  await expect(page.getByLabel('Mês do relatório')).toBeHidden();
  await page.emulateMedia({ media: 'screen' });
  await page.getByRole('button', { name: 'Sair' }).click();

  await entrar(page, 'financeiro');
  await page.goto('/financeiro/producao');
  await page.getByLabel('Mês do relatório').fill('2026-01');
  await page.getByLabel('Profissional', { exact: true }).selectOption({ label: 'Médica E2E' });
  await expect(page.getByRole('table', { name: 'Por procedimento' }).getByRole('row', { name: /E2E Consulta/ })).toContainText('R$ 300,00');
  await expect(page.getByRole('group', { name: 'Fica para a clínica' })).toContainText('R$ 120,00');
});
