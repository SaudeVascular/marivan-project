import React from 'react';

// Assinatura digitalizada do profissional: desenhada na tela (dedo,
// caneta ou mouse — eventos de ponteiro cobrem os três) ou enviada como
// arquivo de imagem que a pessoa já tinha pronta no computador. As duas
// formas terminam no mesmo lugar: uma data URI de imagem, salva em
// `perfis.assinatura_imagem` (migração 31) e usada nos documentos
// impressos no lugar da linha em branco.
const LARGURA_TELA = 480;
const ALTURA_TELA = 160;

export function AssinaturaDigital({ valorAtual, salvando, onSalvar, onRemover }) {
  const canvasRef = React.useRef(null);
  const desenhandoRef = React.useRef(false);
  const ultimoPontoRef = React.useRef(null);
  const [temTraco, setTemTraco] = React.useState(false);
  const [modo, setModo] = React.useState('desenhar'); // 'desenhar' | 'arquivo'
  const [preVisualizacaoArquivo, setPreVisualizacaoArquivo] = React.useState('');
  const [erro, setErro] = React.useState('');

  const contexto = () => canvasRef.current?.getContext('2d');

  const posicaoNoCanvas = (evento) => {
    const retangulo = canvasRef.current.getBoundingClientRect();
    return {
      x: (evento.clientX - retangulo.left) * (canvasRef.current.width / retangulo.width),
      y: (evento.clientY - retangulo.top) * (canvasRef.current.height / retangulo.height),
    };
  };

  const iniciarTraco = (evento) => {
    evento.preventDefault();
    canvasRef.current.setPointerCapture(evento.pointerId);
    desenhandoRef.current = true;
    ultimoPontoRef.current = posicaoNoCanvas(evento);
  };

  const continuarTraco = (evento) => {
    if (!desenhandoRef.current) return;
    evento.preventDefault();
    const ctx = contexto();
    const ponto = posicaoNoCanvas(evento);
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#1a1a2e';
    ctx.beginPath();
    ctx.moveTo(ultimoPontoRef.current.x, ultimoPontoRef.current.y);
    ctx.lineTo(ponto.x, ponto.y);
    ctx.stroke();
    ultimoPontoRef.current = ponto;
    setTemTraco(true);
  };

  const encerrarTraco = (evento) => {
    desenhandoRef.current = false;
    try { canvasRef.current.releasePointerCapture(evento.pointerId); } catch { /* já liberado */ }
  };

  const limparTela = () => {
    contexto().clearRect(0, 0, LARGURA_TELA, ALTURA_TELA);
    setTemTraco(false);
  };

  const escolherArquivo = (evento) => {
    const arquivo = evento.target.files?.[0];
    if (!arquivo) return;
    setErro('');
    if (!arquivo.type.startsWith('image/')) {
      setErro('Escolha um arquivo de imagem (PNG, JPG...).');
      return;
    }
    if (arquivo.size > 1024 * 1024) {
      setErro('Imagem grande demais — escolha um arquivo de até 1 MB.');
      return;
    }
    const leitor = new FileReader();
    leitor.onload = () => setPreVisualizacaoArquivo(leitor.result);
    leitor.readAsDataURL(arquivo);
  };

  const salvar = () => {
    setErro('');
    if (modo === 'arquivo') {
      if (!preVisualizacaoArquivo) { setErro('Escolha um arquivo antes de salvar.'); return; }
      onSalvar(preVisualizacaoArquivo);
      return;
    }
    if (!temTraco) { setErro('Assine no espaço acima antes de salvar.'); return; }
    onSalvar(canvasRef.current.toDataURL('image/png'));
  };

  return (
    <div>
      {valorAtual && (
        <div style={{ marginBottom: '14px', padding: '12px', backgroundColor: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '6px' }}>
          <p style={{ margin: '0 0 6px', fontSize: '15px', fontWeight: 'bold', color: '#374151' }}>Assinatura atual</p>
          <img src={valorAtual} alt="Assinatura digitalizada atual" style={{ maxHeight: '70px', maxWidth: '100%' }} />
          <div style={{ marginTop: '8px' }}>
            <button type="button" onClick={onRemover} disabled={salvando} style={{ padding: '6px 12px', fontSize: '15px', backgroundColor: '#fee2e2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: '4px', cursor: salvando ? 'not-allowed' : 'pointer' }}>
              Remover assinatura
            </button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
        <button type="button" onClick={() => setModo('desenhar')} style={{ padding: '7px 14px', fontSize: '15px', backgroundColor: modo === 'desenhar' ? '#1d4ed8' : '#e5e7eb', color: modo === 'desenhar' ? 'white' : '#374151', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: modo === 'desenhar' ? 'bold' : 'normal' }}>
          ✍️ Assinar na tela
        </button>
        <button type="button" onClick={() => setModo('arquivo')} style={{ padding: '7px 14px', fontSize: '15px', backgroundColor: modo === 'arquivo' ? '#1d4ed8' : '#e5e7eb', color: modo === 'arquivo' ? 'white' : '#374151', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: modo === 'arquivo' ? 'bold' : 'normal' }}>
          📁 Enviar imagem
        </button>
      </div>

      {modo === 'desenhar' ? (
        <div>
          <p style={{ margin: '0 0 6px', fontSize: '15px', color: '#6b7280' }}>
            Assine no espaço abaixo com o dedo, a caneta do tablet ou o mouse.
          </p>
          <canvas
            ref={canvasRef}
            width={LARGURA_TELA}
            height={ALTURA_TELA}
            onPointerDown={iniciarTraco}
            onPointerMove={continuarTraco}
            onPointerUp={encerrarTraco}
            onPointerCancel={encerrarTraco}
            style={{ width: '100%', maxWidth: `${LARGURA_TELA}px`, height: `${ALTURA_TELA}px`, touchAction: 'none', border: '2px dashed #cbd5e1', borderRadius: '6px', backgroundColor: 'white', cursor: 'crosshair' }}
          />
          <div style={{ display: 'flex', gap: '8px', marginTop: '8px', alignItems: 'center' }}>
            <button type="button" onClick={limparTela} style={{ padding: '6px 12px', fontSize: '15px', backgroundColor: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db', borderRadius: '4px', cursor: 'pointer' }}>
              Limpar
            </button>
            <button type="button" onClick={salvar} disabled={salvando} style={{ padding: '8px 18px', fontSize: '15px', fontWeight: 'bold', backgroundColor: salvando ? '#9ca3af' : '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: salvando ? 'not-allowed' : 'pointer' }}>
              {salvando ? 'Salvando...' : '✓ Salvar assinatura'}
            </button>
          </div>
        </div>
      ) : (
        <div>
          <p style={{ margin: '0 0 6px', fontSize: '15px', color: '#6b7280' }}>
            Se você já tem uma imagem da sua assinatura no computador, envie aqui (PNG ou JPG, até 1 MB).
          </p>
          <input type="file" accept="image/*" onChange={escolherArquivo} style={{ fontSize: '15px' }} />
          {preVisualizacaoArquivo && (
            <div style={{ marginTop: '10px', padding: '10px', border: '1px solid #e5e7eb', borderRadius: '6px', backgroundColor: '#fafafa' }}>
              <img src={preVisualizacaoArquivo} alt="Pré-visualização da assinatura enviada" style={{ maxHeight: '70px', maxWidth: '100%' }} />
            </div>
          )}
          <div style={{ marginTop: '8px' }}>
            <button type="button" onClick={salvar} disabled={salvando || !preVisualizacaoArquivo} style={{ padding: '8px 18px', fontSize: '15px', fontWeight: 'bold', backgroundColor: (salvando || !preVisualizacaoArquivo) ? '#9ca3af' : '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: (salvando || !preVisualizacaoArquivo) ? 'not-allowed' : 'pointer' }}>
              {salvando ? 'Salvando...' : '✓ Salvar assinatura'}
            </button>
          </div>
        </div>
      )}

      {erro && <p style={{ color: '#dc2626', fontSize: '15px', marginTop: '8px' }}>{erro}</p>}
    </div>
  );
}
