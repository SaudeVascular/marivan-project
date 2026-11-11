import React from 'react';
import { pacientesService } from '../../services/pacientes.service';
import { useToast } from '../../components/common/Toast';
import { comTimeout } from '../../utils/comTimeout';
import { formatarData } from '../../utils/mascaras';

// Localizar e reativar pacientes desativados (exclusão lógica). Fechado por
// padrão: só busca quando alguém abre a seção.
export function PacientesDesativados({ aoReativar }) {
  const toast = useToast();
  const [aberto, setAberto] = React.useState(false);
  const [termo, setTermo] = React.useState('');
  const [estado, setEstado] = React.useState({ itens: [], total: 0, carregando: false, erro: false });
  const [reativandoId, setReativandoId] = React.useState(null);
  const requisicao = React.useRef(0);

  const buscar = React.useCallback(async (texto) => {
    const id = ++requisicao.current;
    setEstado(e => ({ ...e, carregando: true, erro: false }));
    try {
      const r = await comTimeout(pacientesService.buscar({ termo: texto, ativos: false, limite: 50 }));
      if (id === requisicao.current) setEstado({ itens: r.itens, total: r.total, carregando: false, erro: false });
    } catch {
      if (id === requisicao.current) setEstado({ itens: [], total: 0, carregando: false, erro: true });
    }
  }, []);

  React.useEffect(() => {
    if (!aberto) return undefined;
    const timer = setTimeout(() => buscar(termo), 300);
    return () => clearTimeout(timer);
  }, [aberto, termo, buscar]);

  const reativar = async (paciente) => {
    setReativandoId(paciente.id);
    try {
      await comTimeout(pacientesService.reativar(paciente.id));
      toast.success(`${paciente.nome} voltou para a lista de pacientes.`);
      setEstado(e => ({ ...e, itens: e.itens.filter(p => p.id !== paciente.id), total: Math.max(0, e.total - 1) }));
      aoReativar?.();
    } catch (err) {
      toast.error('Não foi possível reativar: ' + (err?.message || 'erro de conexão'));
    } finally {
      setReativandoId(null);
    }
  };

  return (
    <div style={{ backgroundColor: 'white', padding: '16px 20px', borderRadius: '8px', marginTop: '16px' }}>
      <button type="button" onClick={() => setAberto(a => !a)} aria-expanded={aberto}
        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: '17px', fontWeight: 'bold' }}>
        {aberto ? '▼' : '▶'} Pacientes desativados
      </button>
      {aberto && (
        <div style={{ marginTop: '12px' }}>
          <input placeholder="Buscar desativado por nome, CPF, data de nascimento ou nome da mãe..." value={termo}
            onChange={e => setTermo(e.target.value)} style={{ width: '100%', padding: '10px', boxSizing: 'border-box', marginBottom: '10px' }} />
          {estado.erro && (
            <div role="alert" style={{ color: '#991b1b', marginBottom: '8px' }}>
              Não foi possível carregar os desativados (conexão ou servidor).{' '}
              <button type="button" onClick={() => buscar(termo)}>Tentar novamente</button>
            </div>
          )}
          {estado.carregando && <p>Carregando...</p>}
          {!estado.carregando && !estado.erro && estado.itens.length === 0 && <p style={{ color: '#666' }}>Nenhum paciente desativado encontrado.</p>}
          {estado.itens.map(p => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', padding: '8px 0', borderTop: '1px solid #eee', flexWrap: 'wrap' }}>
              <span>
                <strong>{p.nome}</strong>
                {p.cpf ? ` — CPF ${p.cpf}` : ''}
                {p.nascimento ? ` — nasc. ${formatarData(p.nascimento)}` : ''}
              </span>
              <button type="button" onClick={() => reativar(p)} disabled={reativandoId === p.id}
                style={{ padding: '6px 12px', cursor: reativandoId === p.id ? 'not-allowed' : 'pointer' }}>
                {reativandoId === p.id ? 'Reativando...' : 'Reativar'}
              </button>
            </div>
          ))}
          {estado.total > estado.itens.length && (
            <p style={{ color: '#666', fontSize: '15px' }}>Mostrando {estado.itens.length} de {estado.total}. Refine a busca para encontrar outros.</p>
          )}
        </div>
      )}
    </div>
  );
}
