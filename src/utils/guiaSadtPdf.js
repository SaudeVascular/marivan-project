// Guia SP/SADT (padrão TISS/ANS) em PDF — mesma grade do modelo oficial
// (A4 paisagem, campos numerados 1 a 68), gerada pelo pdfmake como os
// demais documentos (ver utils/documentoPdf.js). Campos sem valor saem
// como caixinhas em branco "|__|__|" para preenchimento à mão, igual ao
// formulário impresso das operadoras.
//
// Larguras abaixo vêm medidas do PDF de referência em pixels de uma
// página renderizada a 1300px de largura (conteúdo útil = 1205px) e são
// convertidas pra pontos por `px()` — mantém as proporções do modelo sem
// precisar recalcular cada coluna se a margem mudar.
import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';

pdfMake.addVirtualFileSystem(pdfFonts);

const MARGEM = 28;
const LARGURA_UTIL = 842 - 2 * MARGEM; // A4 paisagem
const px = (v) => (v * LARGURA_UTIL) / 1205;
const GAP = 2; // espaço entre caixas vizinhas (as "linhas duplas" do modelo)

// Procedimentos por guia: o modelo tem 5 linhas no campo 24-28. Pedido
// com mais itens sai em várias guias (uma página cada), com os mesmos
// dados de cabeçalho.
export const ITENS_POR_GUIA = 5;

const caixas = (n) => '|' + '__|'.repeat(n);
const DATA_VAZIA = `${caixas(2)}/${caixas(2)}/${caixas(4)}`;
const HORA_VAZIA = `${caixas(2)}:${caixas(2)}`;
const VALOR_VAZIO = (n) => `${caixas(n)},${caixas(2)}`;

const TAM_ROTULO = 5.5;
const TAM_VALOR = 6.5;

// Uma caixa com borda: rótulo em cima, valor embaixo. `vazio` é o texto
// de caixinhas mostrado quando não há valor.
function campo(rotulo, valor, { vazio = '', altura = 18, extra } = {}) {
  const temValor = valor !== undefined && valor !== null && String(valor).trim() !== '';
  return {
    table: {
      widths: ['*'],
      heights: [altura],
      body: [[{
        stack: [
          { text: rotulo, fontSize: TAM_ROTULO },
          extra || { text: temValor ? String(valor) : vazio, fontSize: TAM_VALOR, margin: [0, altura - 13, 0, 0] },
        ],
        margin: [1, 0, 1, 0],
      }]],
    },
    layout: bordaFina,
  };
}

const bordaFina = {
  hLineWidth: () => 0.6, vLineWidth: () => 0.6,
  hLineColor: () => '#000', vLineColor: () => '#000',
  paddingLeft: () => 2, paddingRight: () => 2, paddingTop: () => 2, paddingBottom: () => 1,
};

// Linha de caixas lado a lado; `larguras` em px do modelo.
function linha(larguras, celulas, margemTopo = 2) {
  return {
    margin: [0, margemTopo, 0, 0],
    columnGap: GAP,
    columns: celulas.map((c, i) => ({ width: px(larguras[i]) - GAP, ...c })),
  };
}

function secao(titulo) {
  return {
    margin: [0, 1.5, 0, 0],
    table: { widths: ['*'], body: [[{ text: titulo, bold: true, fontSize: 6.5 }]] },
    layout: {
      hLineWidth: () => 0, vLineWidth: () => 0, fillColor: () => '#d9d9d9',
      paddingLeft: () => 2, paddingRight: () => 2, paddingTop: () => 0.5, paddingBottom: () => 0.5,
    },
  };
}

// Tabela de várias linhas dentro de uma única caixa (campos 24-28,
// 36-47 e 48-55): cabeçalho de rótulos, linhas separadas por traço fino.
function grade(larguras, cabecalho, linhas) {
  const total = larguras.reduce((a, b) => a + b, 0);
  const escala = LARGURA_UTIL / total;
  return {
    margin: [0, 3, 0, 0],
    table: {
      widths: larguras.map(l => l * escala - 4),
      body: [
        cabecalho.map(t => ({ text: t, fontSize: TAM_ROTULO, noWrap: true })),
        ...linhas.map(l => l.map(t => (typeof t === 'object' ? t : { text: t, fontSize: TAM_VALOR - 0.5 }))),
      ],
    },
    layout: {
      hLineWidth: (i, node) => (i === 0 || i === node.table.body.length ? 0.6 : i === 1 ? 0 : 0.4),
      vLineWidth: (i, node) => (i === 0 || i === node.table.widths.length ? 0.6 : 0),
      paddingLeft: () => 2, paddingRight: () => 2, paddingTop: () => 0.2, paddingBottom: () => 0.2,
    },
  };
}

const formatarData = (iso) => {
  if (!iso) return '';
  const [a, m, d] = String(iso).slice(0, 10).split('-');
  return a && m && d ? `${d}/${m}/${a}` : '';
};

function paginaGuia(dados, itens, indice) {
  const {
    operadora, registroAns, numeroCarteira, validadeCarteira, nomeBeneficiario, cns,
    nomeContratado, nomeProfissional, conselho, numeroConselho, ufConselho, cbo,
    assinaturaImagem, caraterAtendimento, dataSolicitacao, indicacaoClinica, observacao,
  } = dados;

  const linhasProcedimentos = Array.from({ length: ITENS_POR_GUIA }, (_, i) => {
    const it = itens[i];
    if (!it) return [caixas(2), caixas(10), '', caixas(3), caixas(3)];
    return [
      it.tuss ? '22' : caixas(2),
      it.tuss || caixas(10),
      it.nome,
      String(it.quantidade || '1'),
      caixas(3),
    ];
  });

  const linhaExecucao = [DATA_VAZIA, `${HORA_VAZIA}  a`, HORA_VAZIA, caixas(2), caixas(10), '_'.repeat(57), caixas(3), caixas(1), caixas(1), `${caixas(1)}:${caixas(2)}`, VALOR_VAZIO(6), VALOR_VAZIO(6)];
  const linhaExecutante = [caixas(2), caixas(2), caixas(14), '_'.repeat(90), caixas(2), caixas(15), caixas(2), caixas(6)];

  const serie = (n) => ({ text: `${n}-${DATA_VAZIA} ___________________`, fontSize: TAM_VALOR - 0.5 });

  return [
    // Cabeçalho: nome da operadora à esquerda, título ao centro, campo 2 à direita.
    {
      pageBreak: indice > 0 ? 'before' : undefined,
      columns: [
        { width: 170, text: operadora || '', fontSize: 11, margin: [0, 8, 0, 0] },
        { width: '*', text: 'GUIA DE SERVIÇO PROFISSIONAL / SERVIÇO AUXILIAR DE\nDIAGNÓSTICO E TERAPIA-SP/SADT', bold: true, fontSize: 8.5, alignment: 'center' },
        { width: 170, text: '2-Nº Guia no Prestador:', fontSize: TAM_ROTULO, alignment: 'right', margin: [0, 6, 0, 0] },
      ],
    },
    linha([283, 922], [
      campo('1-Registro ANS', registroAns, { vazio: caixas(6) }),
      campo('3-Número da Guia Principal', '', { vazio: caixas(20) }),
    ], 4),
    linha([190, 397, 221, 397], [
      campo('4-Data da Autorização', '', { vazio: DATA_VAZIA }),
      campo('5-Senha', '', { vazio: caixas(20) }),
      campo('6-Data de Validade da Senha', '', { vazio: DATA_VAZIA }),
      campo('7-Número da Guia Atribuído pela Operadora', '', { vazio: caixas(20) }),
    ]),

    secao('Dados do Beneficiário'),
    linha([165, 170, 481, 214, 175], [
      campo('8-Número da Carteira', numeroCarteira, { vazio: caixas(20) }),
      campo('9-Validade da Carteira', formatarData(validadeCarteira), { vazio: DATA_VAZIA }),
      campo('10-Nome', nomeBeneficiario),
      campo('11-Cartão Nacional de Saúde', cns, { vazio: caixas(15) }),
      campo('12-Atendimento ao RN', '', { vazio: caixas(1) }),
    ], 2),

    secao('Dados do Solicitante'),
    linha([723, 482], [
      campo('13-Código na Operadora', '', { vazio: caixas(14) }),
      campo('14-Nome do Contratado', nomeContratado),
    ], 2),
    linha([260, 182, 296, 54, 123, 290], [
      campo('15-Nome do Profissional Solicitante', nomeProfissional),
      campo('16-Conselho Profissional', conselho, { vazio: caixas(2) }),
      campo('17-Número no Conselho', numeroConselho, { vazio: caixas(15) }),
      campo('18-UF', ufConselho, { vazio: caixas(2) }),
      campo('19-Código CBO', cbo, { vazio: caixas(6) }),
      campo('20-Assinatura do Profissional Solicitante', '', {
        extra: assinaturaImagem ? { image: assinaturaImagem, fit: [110, 18], alignment: 'center' } : undefined,
      }),
    ]),

    secao('Dados da Solicitação / Procedimentos ou Itens Assistenciais Solicitados'),
    linha([337, 280, 588], [
      campo('21-Caráter do Atendimento', caraterAtendimento, { vazio: caixas(1) }),
      campo('22-Data da Solicitação', formatarData(dataSolicitacao), { vazio: DATA_VAZIA }),
      campo('23-Indicação Clínica', indicacaoClinica),
    ], 2),
    grade(
      [145, 253, 372, 223, 212],
      ['24-Tabela', '25-Código do Procedimento ou Item Assistencial', '26-Descrição', '27-Qtde. Solic.', '28-Qtde. Aut.'],
      linhasProcedimentos,
    ),

    secao('Dado do Contratado Executante'),
    linha([232, 818, 155], [
      campo('29-Código na Operadora', '', { vazio: caixas(14) }),
      campo('30-Nome do Contratado', ''),
      campo('31-Código CNES', '', { vazio: caixas(7) }),
    ], 2),

    secao('Dados do Atendimento'),
    linha([200, 475, 165, 365], [
      campo('32-Tipo de Atendimento', '', { vazio: caixas(2) }),
      campo('33-Indicação de Acidente (acidente ou doença relacionada)', '', { vazio: caixas(1) }),
      campo('34-Tipo de Consulta', '', { vazio: caixas(1) }),
      campo('35-Motivo de Encerramento do Atendimento', '', { vazio: caixas(2) }),
    ], 2),

    secao('Dados da Execução / Procedimentos e Exames Realizados'),
    grade(
      [133, 80, 65, 45, 140, 288, 42, 30, 36, 107, 117, 122],
      ['36-Data', '37-Hora Inicial', '38-Hora Final', '39-Tabela', '40-Código do Procedimento', '41-Descrição', '42-Qtde.', '43-Via', '44-Tec.', '45-Fator Red./Acresc.', '46-Valor Unitário (R$)', '47-Valor Total (R$)'],
      Array.from({ length: 5 }, () => linhaExecucao),
    ),

    secao('Identificação do(s) Profissional(is) Executante(s)'),
    grade(
      [55, 73, 190, 445, 120, 170, 30, 122],
      ['48-Seq. Ref', '49-Grau Part.', '50-Código na Operadora/CPF', '51-Nome do Profissional', '52-Conselho Profissional', '53-Número no Conselho', '54-UF', '55-Código CBO'],
      Array.from({ length: 5 }, () => linhaExecutante),
    ),

    {
      margin: [0, 3, 0, 0],
      table: {
        widths: ['*'],
        body: [[{
          stack: [
            { text: '56-Data de Realização de Procedimentos em Série  57-Assinatura do Beneficiário ou Responsável', fontSize: TAM_ROTULO, margin: [0, 0, 0, 3] },
            { columns: [1, 3, 5, 7, 9].map(serie), columnGap: 6 },
            { columns: [2, 4, 6, 8, 10].map(serie), columnGap: 6, margin: [0, 2, 0, 0] },
          ],
        }]],
      },
      layout: bordaFina,
    },

    {
      margin: [0, 3, 0, 0],
      table: {
        widths: ['*'],
        heights: [17],
        body: [[{ stack: [{ text: '58-Observação / Justificativa', fontSize: TAM_ROTULO }, { text: observacao || '', fontSize: TAM_VALOR, margin: [0, 2, 0, 0] }] }]],
      },
      layout: { ...bordaFina, fillColor: () => '#d9d9d9' },
    },

    linha([172, 193, 160, 158, 174, 173, 175], [
      campo('59-Total de Procedimentos (R$)', '', { vazio: VALOR_VAZIO(8) }),
      campo('60-Total de Taxas e Aluguéis (R$)', '', { vazio: VALOR_VAZIO(8) }),
      campo('61-Total de Materiais (R$)', '', { vazio: VALOR_VAZIO(8) }),
      campo('62-Total de OPME (R$)', '', { vazio: VALOR_VAZIO(8) }),
      campo('63-Total de Medicamentos (R$)', '', { vazio: VALOR_VAZIO(8) }),
      campo('64-Total de Gases Medicinais (R$)', '', { vazio: VALOR_VAZIO(8) }),
      campo('65-Total Geral (R$)', '', { vazio: VALOR_VAZIO(8) }),
    ], 3),
    linha([467, 448, 290], [
      campo('66-Assinatura do Responsável pela Autorização', '', { altura: 22 }),
      campo('67-Assinatura do Beneficiário ou Responsável', '', { altura: 22 }),
      campo('68-Assinatura do Contratado', '', { altura: 22 }),
    ]),
  ];
}

/**
 * Monta a(s) guia(s) SP/SADT do pedido — uma página por grupo de
 * ITENS_POR_GUIA procedimentos — e devolve o gerador do pdfmake (pronto
 * para `.print()`, `.open()`, `.getBlob()`).
 *
 * @param {object} dados - campos da guia (ver desestruturação em paginaGuia)
 * @param {Array} itens - [{ nome, tuss, quantidade }]
 */
export function criarPdfGuiaSadt(dados, itens) {
  const grupos = [];
  for (let i = 0; i < Math.max(itens.length, 1); i += ITENS_POR_GUIA) {
    grupos.push(itens.slice(i, i + ITENS_POR_GUIA));
  }

  return pdfMake.createPdf({
    pageSize: 'A4',
    pageOrientation: 'landscape',
    pageMargins: [MARGEM, 12, MARGEM, 8],
    content: grupos.flatMap((grupo, i) => paginaGuia(dados, grupo, i)),
    defaultStyle: { fontSize: TAM_VALOR, lineHeight: 1 },
  });
}
