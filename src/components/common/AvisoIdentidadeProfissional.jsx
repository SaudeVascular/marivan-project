// Aviso das telas de documento enquanto a identidade do profissional
// (useMedicoPerfil) não está pronta — salvar e imprimir ficam bloqueados.
export function AvisoIdentidadeProfissional({ identidade }) {
  if (identidade.pronto) return null;
  const base = { borderRadius: '6px', padding: '10px 14px', marginBottom: '14px', fontSize: '15px' };
  if (identidade.estado === 'carregando') {
    return (
      <div role="status" style={{ ...base, backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', color: '#1e40af' }}>
        Carregando seus dados profissionais (nome e registro no conselho)…
      </div>
    );
  }
  if (identidade.estado === 'erro') {
    return (
      <div role="alert" style={{ ...base, backgroundColor: '#fee2e2', border: '1px solid #fecaca', color: '#991b1b', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <span>Não foi possível carregar seus dados profissionais. Verifique a conexão. O documento só pode ser salvo ou impresso com sua identificação completa.</span>
        <button type="button" onClick={identidade.recarregar} style={{ padding: '6px 12px', border: '1px solid #991b1b', borderRadius: '4px', background: 'white', color: '#991b1b', cursor: 'pointer' }}>
          Tentar novamente
        </button>
      </div>
    );
  }
  return (
    <div role="alert" style={{ ...base, backgroundColor: '#fef3c7', border: '1px solid #fde68a', color: '#92400e' }}>
      Seu cadastro está sem nome, número do registro no conselho ou UF. Peça ao Administrador que complete seu cadastro em Usuários — o documento só pode ser salvo ou impresso com sua identificação completa.
    </div>
  );
}
