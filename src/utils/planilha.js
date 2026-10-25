// Leitura da tabela de um convênio a partir de planilha (.xls, .xlsx,
// .ods ou .csv). A biblioteca só é baixada quando alguém importa ou pede
// o modelo — não pesa no carregamento do sistema.
//
// Colunas reconhecidas pelo cabeçalho, em qualquer ordem e com qualquer
// texto parecido: Código (ou TUSS), Descrição (ou Procedimento/Nome),
// Valor, e Tipo (opcional: Consulta, Exame ou Procedimento — sem ele, o
// banco deduz pelo código).

const carregarXlsx = () => import('xlsx');

const semAcento = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

const COLUNAS = {
  codigo: (h) => /^(cod|tuss|cbhpm)/.test(h),
  descricao: (h) => /(descri|procedimento|nome|termo)/.test(h),
  valor: (h) => /(valor|preco|honorario|r\$)/.test(h),
  tipo: (h) => /^tipo/.test(h),
};

export const TIPOS_ACEITOS = { consulta: 'Consulta', exame: 'Exame', procedimento: 'Procedimento' };

// "R$ 1.234,56" → "1234.56"; 12,5 → "12.50"; número da célula → texto com 2 casas.
export function lerValor(celula) {
  if (celula === null || celula === undefined || celula === '') return null;
  if (typeof celula === 'number') return Number.isFinite(celula) && celula >= 0 ? celula.toFixed(2) : null;
  let t = String(celula).replace(/r\$/i, '').replace(/\s/g, '');
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  if (!/^\d{1,8}(\.\d+)?$/.test(t)) return null;
  return Number(t).toFixed(2);
}

export const normalizarCodigo = (c) => String(c ?? '').toUpperCase().replace(/[^0-9A-Z]/g, '');

function acharCabecalho(linhas) {
  for (let i = 0; i < Math.min(linhas.length, 15); i++) {
    const mapa = {};
    linhas[i].forEach((celula, coluna) => {
      const h = semAcento(celula);
      if (!h) return;
      for (const [campo, casa] of Object.entries(COLUNAS)) {
        if (mapa[campo] === undefined && casa(h)) { mapa[campo] = coluna; break; }
      }
    });
    if (mapa.valor !== undefined && (mapa.codigo !== undefined || mapa.descricao !== undefined)) return { indice: i, mapa };
  }
  return null;
}

// Linhas da planilha (lista de listas) → itens prontos para o banco, com
// os problemas de cada linha. Puro: testável sem arquivo.
export function interpretarLinhas(linhas) {
  const cabecalho = acharCabecalho(linhas);
  if (!cabecalho) {
    return { itens: [], erros: [{ linha: null, motivo: 'Não encontrei o cabeçalho: a planilha precisa das colunas Código (ou Descrição) e Valor.' }], avisos: [] };
  }
  const { indice, mapa } = cabecalho;
  const itens = [];
  const erros = [];
  const avisos = [];
  const vistos = new Map();
  for (let i = indice + 1; i < linhas.length; i++) {
    const l = linhas[i] || [];
    const numero = i + 1; // como aparece na planilha
    const codigo = mapa.codigo !== undefined ? normalizarCodigo(l[mapa.codigo]) : '';
    const descricao = mapa.descricao !== undefined ? String(l[mapa.descricao] ?? '').replace(/\s+/g, ' ').trim() : '';
    const valorBruto = l[mapa.valor];
    const tipoBruto = mapa.tipo !== undefined ? semAcento(l[mapa.tipo]) : '';
    if (!codigo && !descricao && (valorBruto === undefined || valorBruto === '')) continue; // linha vazia
    if (!codigo && !descricao) { erros.push({ linha: numero, motivo: 'sem código nem descrição' }); continue; }
    if (codigo.length > 20) { erros.push({ linha: numero, motivo: `código com mais de 20 caracteres (${codigo})` }); continue; }
    if (descricao.length > 300) { erros.push({ linha: numero, motivo: 'descrição com mais de 300 caracteres' }); continue; }
    const valor = lerValor(valorBruto);
    if (valor === null) { erros.push({ linha: numero, motivo: `valor inválido (${valorBruto === undefined || valorBruto === '' ? 'vazio' : valorBruto})` }); continue; }
    let tipo = null;
    if (tipoBruto) {
      tipo = TIPOS_ACEITOS[tipoBruto] || null;
      if (!tipo) { erros.push({ linha: numero, motivo: `tipo "${l[mapa.tipo]}" — use Consulta, Exame ou Procedimento` }); continue; }
    }
    const chave = codigo || `nome:${semAcento(descricao)}`;
    if (vistos.has(chave)) {
      avisos.push({ linha: numero, motivo: `repete a linha ${vistos.get(chave)}; vale o valor desta` });
      const anterior = itens.findIndex(it => (it.codigo || `nome:${semAcento(it.descricao)}`) === chave);
      itens.splice(anterior, 1);
    }
    vistos.set(chave, numero);
    itens.push({ codigo: codigo || null, descricao: descricao || null, valor, tipo });
  }
  if (itens.length === 0 && erros.length === 0) erros.push({ linha: null, motivo: 'A planilha não tem nenhuma linha abaixo do cabeçalho.' });
  return { itens, erros, avisos };
}

export async function lerPlanilha(arquivo) {
  const XLSX = await carregarXlsx();
  const dados = await arquivo.arrayBuffer();
  const pasta = XLSX.read(dados, { type: 'array', cellDates: false, dense: true });
  const aba = pasta.Sheets[pasta.SheetNames[0]];
  if (!aba) return { itens: [], erros: [{ linha: null, motivo: 'A planilha está vazia.' }], avisos: [] };
  const linhas = XLSX.utils.sheet_to_json(aba, { header: 1, raw: true, defval: '' });
  return interpretarLinhas(linhas);
}

// Planilha-modelo e exportação da tabela atual, no mesmo formato que a
// importação lê.
export async function baixarPlanilha(nomeArquivo, linhas) {
  const XLSX = await carregarXlsx();
  const aba = XLSX.utils.aoa_to_sheet([['Código', 'Descrição', 'Valor', 'Tipo'], ...linhas]);
  aba['!cols'] = [{ wch: 12 }, { wch: 60 }, { wch: 12 }, { wch: 14 }];
  const pasta = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(pasta, aba, 'Tabela');
  XLSX.writeFile(pasta, nomeArquivo);
}
