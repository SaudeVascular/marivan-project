import { extrairTipoLinkAuth } from './authRedirect';

const callback = (tipo) => `#access_token=a&refresh_token=r&expires_in=3600&token_type=bearer&type=${tipo}`;

test('reconhece callbacks completos de convite e recuperação', () => {
  expect(extrairTipoLinkAuth(callback('invite'))).toBe('invite');
  expect(extrairTipoLinkAuth(callback('recovery'))).toBe('recovery');
});

test('não aceita apenas um type acrescentado manualmente a uma sessão comum', () => {
  expect(extrairTipoLinkAuth('#type=invite')).toBeNull();
  expect(extrairTipoLinkAuth('#access_token=a&type=recovery')).toBeNull();
});

test('ignora tipos de callback que não definem senha', () => {
  expect(extrairTipoLinkAuth(callback('signup'))).toBeNull();
});
