import { fireEvent, render, screen } from '@testing-library/react';
import { PasswordInput } from './PasswordInput';

test('mostra e volta a ocultar a senha sem alterar o valor', () => {
  render(<PasswordInput label="Senha atual" value="Segredo123" readOnly autoComplete="current-password" />);
  const campo = screen.getByLabelText('Senha atual');

  expect(campo).toHaveAttribute('type', 'password');
  fireEvent.click(screen.getByRole('button', { name: 'Mostrar senha atual' }));
  expect(campo).toHaveAttribute('type', 'text');
  expect(campo).toHaveValue('Segredo123');
  expect(campo).toHaveAttribute('autocomplete', 'current-password');

  fireEvent.click(screen.getByRole('button', { name: 'Ocultar senha atual' }));
  expect(campo).toHaveAttribute('type', 'password');
});
