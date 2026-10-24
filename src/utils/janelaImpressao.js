// Abrir uma nova janela/aba só é permitido pelo navegador como resposta
// SÍNCRONA e direta a um clique — qualquer `await` no meio (salvar no
// servidor, baixar o pdfmake por import dinâmico) faz o navegador achar
// que não é mais "gesto do usuário" e bloquear como pop-up. É exatamente
// o que acontecia: `pdfMake...print()` abre a janela internamente, mas só
// depois desses `await`s.
//
// A correção: abrir a janela em branco AQUI, como primeiríssima linha do
// clique (antes de qualquer await), e só depois de o PDF ficar pronto
// (possivelmente segundos depois) navegar essa MESMA janela já aberta
// pra ele — isso não conta como pop-up novo, só como troca de conteúdo
// de uma janela existente.

export function iniciarJanelaImpressao() {
  const janela = window.open('', '_blank');
  if (janela) {
    janela.document.write(
      '<!doctype html><title>Preparando documento…</title>' +
      '<body style="font-family:system-ui,-apple-system,sans-serif;padding:48px;color:#555">' +
      'Preparando o documento para impressão…</body>'
    );
  }
  return janela;
}

// `pdfDocGenerator` é o que `pdfMake.createPdf(docDefinition)` devolve.
//
// `print(win)` e `open(win)` do pdfmake já aceitam a janela pronta como
// parâmetro opcional — é o próprio uso que a documentação descreve como
// "útil para operações assíncronas": abrir a janela cedo, gerar o PDF
// depois, entregar a janela já aberta pra ele carregar. É melhor do que
// montar isso na mão com getBlob (que nesta versão devolve uma Promise,
// não aceita callback — a tentativa anterior nunca disparava por causa
// disso) porque usa o próprio carregamento interno do pdfmake, já testado
// pela biblioteca, em vez de reinventar com URL.createObjectURL.
export function concluirJanelaImpressao(janela, pdfDocGenerator) {
  if (!janela || janela.closed) return; // bloqueada mesmo assim, ou usuário fechou enquanto gerava
  pdfDocGenerator.print(janela);
}
