// Logomarca do PEP (sistema), servida de public/logo-pep.png. Usada no
// cabeçalho da tela (components/common/Layout) e no canto superior
// direito dos documentos impressos (utils/documentoPdf) — a Guia SP/SADT
// segue o modelo da ANS e não leva logo.
export const URL_LOGO_PEP = `${process.env.PUBLIC_URL || ''}/logo-pep.png`;

let promessa = null;

// pdfmake precisa da imagem como data URI. Devolve null enquanto o
// arquivo não existir — o servidor de desenvolvimento responde 200 com o
// index.html para caminhos inexistentes, por isso confere o tipo.
export function carregarLogoPepDataUrl() {
  if (!promessa) {
    promessa = fetch(URL_LOGO_PEP)
      .then(r => (r.ok && (r.headers.get('content-type') || '').startsWith('image/') ? r.blob() : null))
      .then(blob => blob && new Promise((resolve) => {
        const leitor = new FileReader();
        leitor.onload = () => resolve(leitor.result);
        leitor.onerror = () => resolve(null);
        leitor.readAsDataURL(blob);
      }))
      .catch(() => null)
      .then(dataUrl => {
        if (!dataUrl) promessa = null; // tenta de novo na próxima impressão (arquivo pode ter sido adicionado)
        return dataUrl;
      });
  }
  return promessa;
}
