import { act, renderHook } from '@testing-library/react';
import { useAutoSave } from './useAutoSave';

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

test('não anuncia sucesso enquanto a gravação está pendente', async () => {
  let resolver;
  const salvar = jest.fn(() => new Promise(resolve => { resolver = resolve; }));
  const { result } = renderHook(() => useAutoSave('texto', salvar, 100));
  await act(async () => { jest.advanceTimersByTime(100); });
  expect(result.current.isSaving).toBe(true);
  expect(result.current.lastSaved).toBeNull();
  await act(async () => { resolver(true); });
  expect(result.current.lastSaved).toBeInstanceOf(Date);
});

test('falha de armazenamento informa erro sem apresentar texto como salvo', async () => {
  const salvar = jest.fn(() => { throw new Error('QuotaExceededError'); });
  const { result } = renderHook(() => useAutoSave('texto', salvar, 100));
  await act(async () => { jest.advanceTimersByTime(100); });
  expect(result.current.error.message).toBe('QuotaExceededError');
  expect(result.current.lastSaved).toBeNull();
  expect(result.current.isSaving).toBe(false);
});

test('resultado de texto antigo não confirma que uma edição mais recente foi salva', async () => {
  let resolver;
  const salvar = jest.fn(() => new Promise(resolve => { resolver = resolve; }));
  const { result, rerender } = renderHook(({ texto }) => useAutoSave(texto, salvar, 100), { initialProps: { texto: 'antigo' } });
  await act(async () => { jest.advanceTimersByTime(100); });
  rerender({ texto: 'novo' });
  await act(async () => { resolver(true); });
  expect(result.current.lastSaved).toBeNull();
});
