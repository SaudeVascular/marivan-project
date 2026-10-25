import { fireEvent, render, screen } from '@testing-library/react';
import { EstadoPaciente } from './EstadoPaciente';

test('erro de conexão: explica que não é ausência do paciente e oferece nova tentativa', () => {
  const recarregar = jest.fn();
  render(<EstadoPaciente estado="erro" recarregar={recarregar} />);
  expect(screen.getByRole('alert')).toHaveTextContent('não significa que ele não exista');
  expect(screen.queryByText('Paciente não encontrado.')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
  expect(recarregar).toHaveBeenCalledTimes(1);
});

test.each([
  ['carregando', 'Carregando paciente...'],
  ['nao-encontrado', 'Paciente não encontrado.'],
  ['sem-permissao', 'Você não tem permissão para abrir este paciente.'],
])('estado %s', (estado, texto) => {
  render(<EstadoPaciente estado={estado} recarregar={() => {}} />);
  expect(screen.getByText(texto)).toBeInTheDocument();
});
