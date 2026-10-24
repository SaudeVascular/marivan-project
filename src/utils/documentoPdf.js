// Geração de PDF de verdade para documentos clínicos impressos.
//
// Por quê: cabeçalho (nome da clínica + identificação do paciente) e
// rodapé (assinatura do profissional + endereço da clínica) precisam
// aparecer em TODA página do documento, não só na primeira/última. Isso
// não é confiável só com CSS de impressão do navegador — testamos
// `position: fixed` e depois grupos de tabela CSS (`table-header-group`/
// `table-footer-group`); os dois têm suporte inconsistente entre
// navegadores, e no Safari nenhum repete corretamente (o rodapé chega a
// ficar cortado). pdfmake gera o PDF em si no navegador, com controle
// real de cabeçalho/rodapé por página — independe do motor de impressão
// de cada navegador.
import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
import { calcularIdade } from './formatters';
import { carregarLogoPepDataUrl } from './logoPep';

pdfMake.addVirtualFileSystem(pdfFonts);

// Logo do PEP no canto superior direito de todo documento. Carregada uma
// vez, antes de gerar (ver carregarCriarPdfDocumento em DocumentosPages):
// criarPdfDocumento é síncrona porque a janela de impressão já está
// aberta esperando por ela.
let logoPep = null;
export async function prepararLogoPep() {
  logoPep = await carregarLogoPepDataUrl();
}

// Sem o arquivo public/logo-pep.png, sai o nome do sistema em texto.
function marcaPep() {
  if (logoPep) return { image: logoPep, fit: [100, 30], alignment: 'right' };
  return {
    alignment: 'right',
    stack: [
      { text: 'PEP', bold: true, fontSize: 14, color: '#1d4ed8' },
      { text: 'Prontuário Eletrônico', fontSize: 7, color: '#64748b' },
    ],
  };
}

// Margem esquerda maior que a direita (50/30, soma 80 — mesma largura
// útil de antes, então LARGURA_UTIL abaixo não muda).
const MARGEM_ESQUERDA = 50;
const MARGEM_DIREITA = 30;
const LARGURA_UTIL = 515; // A4 (595pt) menos as duas margens (50+30=80)

// Algumas clínicas digitam o CEP dentro do próprio campo "Cidade" das
// Configurações (ex. "São Paulo — SP — CEP 01310-100") em vez de um
// campo à parte — limpa esse trecho onde a cidade aparece no documento.
function semCep(texto) {
  return (texto || '').replace(/[\s—-]*CEP[:\s]*\d{5}-?\d{3}/i, '').trim();
}

/**
 * Monta e devolve um gerador de PDF (pdfMake.createPdf) pronto para
 * `.print()`, `.open()` ou `.download()`.
 *
 * @param {object} clinica - nome, nomeFantasia, endereco, cidade, telefone, cnpj
 * @param {object|null} paciente - nome, cpf, nascimento (null quando o documento não é ligado a um paciente específico na tela, o que hoje não acontece, mas mantém a função genérica)
 * @param {string} tituloDocumento - ex. "ATESTADO MÉDICO"
 * @param {string} [subtitulo] - linha centralizada abaixo do título (ex. finalidade do relatório, "2ª via")
 * @param {Array} corpo - conteúdo pdfmake do corpo do documento (o que varia por tipo)
 * @param {string} medico - nome do profissional que assina
 * @param {string} crm - "CRM 12345/SP" ou "COREN 12345/SP", já formatado
 * @param {string} [especialidade]
 * @param {string} dataTexto - data por extenso exibida acima da assinatura
 * @param {string|null} [assinaturaImagem] - data URI da assinatura digitalizada do profissional (perfis.assinatura_imagem); sem ela, sai a linha em branco de sempre pra assinar no papel
 */
export function criarPdfDocumento({
  clinica,
  paciente,
  tituloDocumento,
  subtitulo,
  corpo,
  medico,
  crm,
  especialidade,
  dataTexto,
  assinaturaImagem,
}) {
  const idade = paciente?.nascimento ? calcularIdade(paciente.nascimento) : null;

  const docDefinition = {
    pageSize: 'A4',
    // Topo/base maiores que o normal: é onde cabeçalho e rodapé (que se
    // repetem sozinhos, por página, via header/footer abaixo) desenham.
    // Base maior que o topo porque o rodapé agora tem mais altura (linha
    // de assinatura com mais respiro antes do endereço) — pdfmake não
    // encolhe o rodapé pra caber sozinho: se a margem for menor que a
    // altura real do conteúdo do footer, o final dele (aqui, cidade/
    // telefone/paginação) é cortado silenciosamente, sem erro nenhum.
    // 205pt (sem imagem de assinatura) ou 250pt (com imagem, que ocupa
    // bem mais altura que a linha fina) testados e confirmados (gerados
    // e lidos de volta com pypdf) — abaixo disso a paginação "Página X
    // de Y" ficava fora da página.
    pageMargins: [MARGEM_ESQUERDA, 112, MARGEM_DIREITA, assinaturaImagem ? 250 : 205],

    header: () => ({
      margin: [MARGEM_ESQUERDA, 24, MARGEM_DIREITA, 0],
      stack: [
        {
          columns: [
            {
              width: '*',
              stack: [
                { text: clinica?.nome || '', style: 'clinicaNome' },
                clinica?.nomeFantasia ? { text: clinica.nomeFantasia, style: 'clinicaSub' } : null,
              ].filter(Boolean),
            },
            { width: 110, ...marcaPep() },
          ],
        },
        paciente ? {
          margin: [0, 6, 0, 0],
          table: {
            widths: ['*'],
            body: [[{
              // Justificado (não mais alinhado à esquerda): Paciente/
              // Idade/CPF espalhados pra ocupar toda a largura da caixa.
              // `alignment: 'justify'` sozinho não fazia nada visível aqui
              // — testamos e confirmamos: justificação de texto nunca
              // estica a ÚLTIMA (ou única) linha de um parágrafo, e essa
              // linha quase sempre é curta o bastante pra não quebrar.
              // Colunas com espaçadores de largura variável entre cada
              // dado alcançam o mesmo efeito visual de "ocupar a largura
              // toda", sempre, independente do tamanho do nome.
              fontSize: 9,
              margin: [8, 4, 8, 4],
              // Espaçador ANTES de cada parte a partir da segunda —
              // funciona com qualquer combinação de campos presentes
              // (ex.: sem idade mas com CPF continua distribuindo os 2).
              columns: [
                { text: [{ text: 'Paciente: ', bold: true }, paciente.nome || ''], width: 'auto' },
                idade != null ? { text: [{ text: 'Idade: ', bold: true }, `${idade} anos`], width: 'auto' } : null,
                paciente.cpf ? { text: [{ text: 'CPF: ', bold: true }, paciente.cpf], width: 'auto' } : null,
              ].filter(Boolean).flatMap((parte, i) => (i === 0 ? [parte] : [{ text: '', width: '*' }, parte])),
            }]],
          },
          layout: { hLineWidth: () => 0, vLineWidth: () => 0, fillColor: () => '#eff6ff' },
        } : null,
        { canvas: [{ type: 'line', x1: 0, y1: 8, x2: LARGURA_UTIL, y2: 8, lineWidth: 1.2, lineColor: '#1d4ed8' }] },
      ].filter(Boolean),
    }),

    footer: (currentPage, pageCount) => ({
      margin: [MARGEM_ESQUERDA, 0, MARGEM_DIREITA, 24],
      stack: [
        // Cidade + data — alinhados à direita (convenção de carta: "São
        // Paulo, 19 de setembro de 2026"), sem o CEP mesmo quando ele vem
        // digitado dentro do campo Cidade. Assinatura abaixo, centralizada:
        // a linha continua sempre aparecendo (pra assinar à mão no papel
        // quando não há assinatura digitalizada); havendo uma salva em
        // Minha conta, a imagem entra ACIMA da linha, como se tivesse
        // assinado ali.
        {
          margin: [0, 14, 0, 0],
          stack: [
            {
              alignment: 'right', fontSize: 9, margin: [0, 0, 0, 28],
              text: [semCep(clinica?.cidade), dataTexto].filter(Boolean).join(', '),
            },
            {
              alignment: 'center',
              stack: [
                assinaturaImagem ? { image: assinaturaImagem, width: 160, alignment: 'center', margin: [0, 0, 0, -8] } : null,
                { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 220, y2: 0, lineWidth: 1, lineColor: '#333' }] },
                { text: medico || '', bold: true, fontSize: 10, margin: [0, 4, 0, 0] },
                { text: crm || '', fontSize: 9, color: '#666' },
                especialidade ? { text: especialidade, fontSize: 8, color: '#888' } : null,
              ].filter(Boolean),
            },
          ],
        },
        // Endereço da clínica — numa caixa com borda própria, separado
        // visualmente da assinatura acima. Só header e footer repetem
        // sozinhos em toda página no pdfmake (não existe uma terceira
        // área "do meio" pra isso), então o endereço continua
        // tecnicamente dentro do footer, mas a borda deixa claro que não
        // é "a mesma coisa" da assinatura.
        {
          margin: [0, 22, 0, 0],
          table: {
            widths: ['*'],
            body: [[{
              alignment: 'center',
              margin: [10, 8, 10, 8],
              stack: [
                clinica?.endereco ? { text: clinica.endereco, fontSize: 8, color: '#666' } : null,
                clinica?.cidade ? { text: semCep(clinica.cidade), fontSize: 8, color: '#666' } : null,
                { text: [clinica?.telefone, clinica?.cnpj ? ` — CNPJ ${clinica.cnpj}` : ''].filter(Boolean).join(''), fontSize: 8, color: '#666' },
              ].filter(Boolean),
            }]],
          },
          layout: {
            hLineWidth: () => 0.75, vLineWidth: () => 0.75,
            hLineColor: () => '#ccc', vLineColor: () => '#ccc',
          },
        },
        pageCount > 1
          ? { alignment: 'center', fontSize: 7, color: '#aaa', margin: [0, 4, 0, 0], text: `Página ${currentPage} de ${pageCount}` }
          : null,
      ].filter(Boolean),
    }),

    content: [
      { text: tituloDocumento, style: 'titulo' },
      subtitulo ? { text: subtitulo, style: 'subtitulo' } : null,
      ...corpo,
    ].filter(Boolean),

    styles: {
      clinicaNome: { fontSize: 14, bold: true, color: '#1d4ed8' },
      clinicaSub: { fontSize: 9, color: '#555' },
      // 40pt ~ 3 linhas de respiro depois do título, em todo documento —
      // se houver um subtítulo, esse espaço vem depois dele (subtitulo
      // já tem sua própria margem abaixo).
      titulo: { fontSize: 13, bold: true, alignment: 'center', characterSpacing: 2, margin: [0, 0, 0, 40] },
      subtitulo: { fontSize: 9, alignment: 'center', color: '#555', margin: [0, 0, 0, 14] },
    },
    defaultStyle: { fontSize: 10.5, lineHeight: 1.3 },
  };

  return pdfMake.createPdf(docDefinition);
}
