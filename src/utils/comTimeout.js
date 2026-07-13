// Evita que uma ação trave a tela pra sempre se a rede cair no meio do
// caminho (ex: um botão de salvar que nunca volta a ficar clicável).
export const comTimeout = (promise, ms = 8000) =>
  Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('A operação demorou demais. Verifique sua conexão e tente novamente.')), ms)),
  ]);
