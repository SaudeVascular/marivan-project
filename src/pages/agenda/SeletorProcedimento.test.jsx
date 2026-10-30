import { fireEvent, render, screen } from '@testing-library/react';
import { EscolhaProcedimento } from './SeletorProcedimento';

const ITENS = [
  { id: 'c', nome: 'Consulta', codigo: '10101012', valor: 180 },
  { id: 'e', nome: 'Ecocardiograma', codigo: '40901122', valor: 250 },
  { id: 'x', nome: 'Biópsia', codigo: '30101010', valor: null },
];
const opcoes = () => screen.getAllByRole('option').map(o => o.textContent);

test('só o que tem valor na tabela; os sem valor só sob pedido; o escolhido sempre aparece', () => {
  const { rerender } = render(<EscolhaProcedimento itens={ITENS} procedimentoId={null} onChange={() => {}} soComValor />);
  expect(opcoes()).toEqual(['A definir', '10101012 — Consulta', '40901122 — Ecocardiograma']);
  fireEvent.click(screen.getByLabelText(/Mostrar também os sem valor nesta tabela \(1\)/));
  expect(opcoes()).toContain('30101010 — Biópsia');

  rerender(<EscolhaProcedimento key="novo" itens={ITENS} procedimentoId="x" onChange={() => {}} soComValor />);
  expect(opcoes()).toEqual(['A definir', '30101010 — Biópsia', '10101012 — Consulta', '40901122 — Ecocardiograma']);
});

test('tabela sem nenhum valor avisa', () => {
  render(<EscolhaProcedimento itens={[ITENS[2]]} procedimentoId={null} onChange={() => {}} soComValor />);
  expect(screen.getByText('Nenhum procedimento com valor nesta tabela.')).toBeInTheDocument();
});
