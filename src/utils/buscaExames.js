// Busca de exames por nome ou código TUSS — usada no Pedido de Exames
// (autocomplete) e na administração do catálogo.
//
// A nomenclatura oficial da TUSS usa abreviação em vez da palavra por
// extenso ("RM - Crânio", não "Ressonância Magnética - Crânio"), então
// uma busca por substring pura nunca encontra "RM - Crânio" para quem
// digita "ressonância" — mesmo o exame estando cadastrado e ativo.
// Cada grupo abaixo é tratado como equivalente: se o termo digitado
// bate com uma palavra do grupo e o nome do exame bate com outra
// palavra do MESMO grupo, conta como correspondência.
const GRUPOS_SINONIMOS = [
  ['rm', 'ressonancia', 'ressonancia magnetica'],
  ['tc', 'tomografia', 'tomografia computadorizada'],
  ['us', 'usg', 'ultrassom', 'ultrassonografia', 'ecografia'],
  ['rx', 'radiografia', 'raio-x', 'raio x', 'raiox'],
  ['ecg', 'eletrocardiograma'],
  ['eeg', 'eletroencefalograma'],
  ['enmg', 'eletroneuromiografia'],
];

function normalizar(texto) {
  return (texto || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function escapeRegExp(texto) {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Quanto menor, mais relevante. null = não corresponde. Termos curtos
// (ex. "rm", 2 letras) batem como substring solta em muita coisa sem
// relação nenhuma (ex. "rm" dentro de "espeRMa") — por isso correspon-
// dência em início de nome ou como palavra isolada (cercada por espaço,
// hífen, parênteses) vale mais que achar a letra em qualquer posição.
export function pontuarCorrespondencia(exame, termoDigitado) {
  const termoBruto = (termoDigitado || '').trim();
  if (!termoBruto) return null;

  if ((exame.tuss || '') === termoBruto) return 0;
  if ((exame.tuss || '').startsWith(termoBruto)) return 1;

  const nomeNormalizado = normalizar(exame.nome);
  const termoNormalizado = normalizar(termoBruto);

  if (nomeNormalizado === termoNormalizado) return 0;
  if (nomeNormalizado.startsWith(termoNormalizado)) return 2;

  const regexPalavraIsolada = new RegExp(`(^|[^a-z0-9çáéíóúâêôãõü])${escapeRegExp(termoNormalizado)}([^a-z0-9çáéíóúâêôãõü]|$)`);
  if (regexPalavraIsolada.test(nomeNormalizado)) return 3;

  const grupoBate = GRUPOS_SINONIMOS.some(grupo => {
    const termoBate = grupo.some(palavra => termoNormalizado.includes(palavra));
    const nomeBate = grupo.some(palavra => nomeNormalizado.includes(palavra));
    return termoBate && nomeBate;
  });
  if (grupoBate) return 4;

  if (nomeNormalizado.includes(termoNormalizado)) return 5;

  return null;
}

export function correspondeExame(exame, termoDigitado) {
  return pontuarCorrespondencia(exame, termoDigitado) !== null;
}
