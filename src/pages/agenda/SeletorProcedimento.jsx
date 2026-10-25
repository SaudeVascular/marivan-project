import React from 'react';
import { conveniosService } from '../../services/convenios.service';
import { procedimentosService } from '../../services/procedimentos.service';
import { formatarMoeda } from '../../utils/formatters';

// Convênios ativos (todos os perfis leem) — uma vez por tela.
export function useConvenios() {
  const [convenios, setConvenios] = React.useState([]);
  React.useEffect(() => {
    let ativo = true;
    conveniosService.listar().then(l => { if (ativo) setConvenios(l.filter(c => c.ativo)); }).catch(() => {});
    return () => { ativo = false; };
  }, []);
  return convenios;
}

// Procedimentos com o valor da tabela do convênio (migração 49).
export function useCatalogo(convenioId) {
  const [estado, setEstado] = React.useState({ itens: [], erro: false });
  React.useEffect(() => {
    let ativo = true;
    procedimentosService.catalogo(convenioId)
      .then(itens => { if (ativo) setEstado({ itens, erro: false }); })
      .catch(() => { if (ativo) setEstado({ itens: [], erro: true }); });
    return () => { ativo = false; };
  }, [convenioId]);
  return estado;
}

// Convênio + procedimento, com o valor que irá para a cobrança quando o
// atendimento for concluído.
export function SeletorProcedimento({ convenioId, procedimentoId, onChange, convenios }) {
  const { itens, erro } = useCatalogo(convenioId);
  const escolhido = itens.find(p => p.id === procedimentoId);
  const estilo = { width: '100%', padding: '8px' };
  return (
    <div className="form-grid-3col" style={{ marginBottom: '12px' }}>
      <div>
        <label style={{ fontSize: '16px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Convênio</label>
        <select aria-label="Convênio" value={convenioId || ''} onChange={e => onChange({ convenioId: e.target.value || null, procedimentoId })} style={estilo}>
          <option value="">Particular</option>
          {convenios.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
      </div>
      <div>
        <label style={{ fontSize: '16px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Procedimento</label>
        <select aria-label="Procedimento" value={procedimentoId || ''} onChange={e => onChange({ convenioId, procedimentoId: e.target.value || null })} style={estilo}>
          <option value="">A definir</option>
          {itens.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
        </select>
      </div>
      <div>
        <label style={{ fontSize: '16px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Valor da tabela</label>
        <div style={{ padding: '8px 0', fontSize: '16px' }}>
          {erro ? 'Não foi possível carregar a tabela'
            : !escolhido ? '—'
              : escolhido.valor == null ? 'Sem valor neste convênio' : formatarMoeda(escolhido.valor)}
        </div>
      </div>
    </div>
  );
}
