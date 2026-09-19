// Limita a espera, não cancela a operação remota. Escritas precisam de uma
// identidade idempotente para reconciliar resultado desconhecido.
export async function comTimeout(promise, ms = 8000) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(Object.assign(
          new Error('A operação demorou demais. Verifique sua conexão e tente novamente.'),
          { code: 'TIMEOUT' },
        )), ms);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
