// O que mostrar no lugar da tela enquanto o paciente da URL não está
// disponível (ver usePacienteAtual).
export function EstadoPaciente({ estado, recarregar }) {
  if (estado === 'carregando') return <p>Carregando paciente...</p>;
  if (estado === 'sem-permissao') {
    return <p role="alert">Você não tem permissão para abrir este paciente.</p>;
  }
  if (estado === 'erro') {
    return (
      <div role="alert" style={{ padding: '12px 16px', backgroundColor: '#fee2e2', border: '1px solid #fecaca', borderRadius: '6px', color: '#991b1b', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <span>Não foi possível carregar o paciente — problema de conexão ou do servidor, não significa que ele não exista.</span>
        <button type="button" onClick={recarregar} style={{ padding: '6px 12px', border: '1px solid #991b1b', borderRadius: '4px', background: 'white', color: '#991b1b', cursor: 'pointer' }}>
          Tentar novamente
        </button>
      </div>
    );
  }
  return <p>Paciente não encontrado.</p>;
}
