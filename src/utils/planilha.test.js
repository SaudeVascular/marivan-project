import { interpretarLinhas, lerValor } from './planilha';

test('valor: formato brasileiro, com R$, e número da célula', () => {
  expect(lerValor('R$ 1.234,56')).toBe('1234.56');
  expect(lerValor('12,5')).toBe('12.50');
  expect(lerValor('180.00')).toBe('180.00');
  expect(lerValor(95)).toBe('95.00');
  expect(lerValor('abc')).toBeNull();
  expect(lerValor('')).toBeNull();
  expect(lerValor(-3)).toBeNull();
});

test('acha o cabeçalho abaixo do título, em qualquer ordem, e normaliza o código', () => {
  const r = interpretarLinhas([
    ['Tabela Unimed 2026'],
    [],
    ['Valor (R$)', 'Descrição do procedimento', 'Cód. TUSS', 'Tipo'],
    ['150,00', 'Consulta em consultório', '1.01.01.01-2', 'consulta'],
    [12.5, 'Hemograma', 40304361, ''],
    ['', '', '', ''],
  ]);
  expect(r.erros).toEqual([]);
  expect(r.itens).toEqual([
    { codigo: '10101012', descricao: 'Consulta em consultório', valor: '150.00', tipo: 'Consulta' },
    { codigo: '40304361', descricao: 'Hemograma', valor: '12.50', tipo: null },
  ]);
});

test('aponta cada linha com problema e o código repetido (vale a última)', () => {
  const r = interpretarLinhas([
    ['Código', 'Descrição', 'Valor', 'Tipo'],
    ['10101012', 'Consulta', '100', ''],
    ['', '', '50', ''],
    ['20101010', 'Fisioterapia', 'grátis', ''],
    ['30101010', 'Biópsia', '200', 'cirurgia'],
    ['10101012', 'Consulta', '120', ''],
  ]);
  expect(r.erros).toEqual([
    { linha: 3, motivo: 'sem código nem descrição' },
    { linha: 4, motivo: 'valor inválido (grátis)' },
    { linha: 5, motivo: 'tipo "cirurgia" — use Consulta, Exame ou Procedimento' },
  ]);
  expect(r.avisos).toEqual([{ linha: 6, motivo: 'repete a linha 2; vale o valor desta' }]);
  expect(r.itens).toEqual([{ codigo: '10101012', descricao: 'Consulta', valor: '120.00', tipo: null }]);
});

test('sem cabeçalho reconhecível', () => {
  const r = interpretarLinhas([['a', 'b'], ['1', '2']]);
  expect(r.itens).toEqual([]);
  expect(r.erros[0].motivo).toMatch(/cabeçalho/);
});
