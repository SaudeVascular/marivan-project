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

// Procedimentos com o valor da tabela do convênio (migrações 49/50).
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

export const rotuloProcedimento = (p) => (p.codigo ? `${p.codigo} — ${p.nome}` : p.nome);

// Campos de busca: o Safari ignora autoComplete="off" sozinho e cobre a
// lista com contatos e valores salvos (mesma solução da busca de exames,
// em DocumentosPages). Um `name` incomum desliga o preenchimento.
export const SEM_AUTOPREENCHIMENTO = (nome) => ({
  name: nome, autoComplete: 'off', autoCorrect: 'off', autoCapitalize: 'off', spellCheck: false,
});

const semAcento = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const LIMITE_OPCOES = 200;

// Lista de procedimentos com busca por nome ou código: tabelas importadas
// têm milhares de itens. Os que têm valor neste convênio vêm primeiro.
export function EscolhaProcedimento({ itens, procedimentoId, onChange, rotuloVazio = 'A definir', estilo }) {
  const [busca, setBusca] = React.useState('');
  const opcoes = React.useMemo(() => {
    const termo = semAcento(busca.trim());
    const codigo = busca.toUpperCase().replace(/[^0-9A-Z]/g, '');
    const filtrados = !termo ? itens : itens.filter(p => semAcento(p.nome).includes(termo) || (codigo && p.codigo.startsWith(codigo)));
    const ordenados = [...filtrados].sort((a, b) => (a.valor == null) - (b.valor == null) || a.nome.localeCompare(b.nome));
    const visiveis = ordenados.slice(0, LIMITE_OPCOES);
    const escolhido = itens.find(p => p.id === procedimentoId);
    if (escolhido && !visiveis.includes(escolhido)) visiveis.unshift(escolhido);
    return { visiveis, ocultos: ordenados.length - Math.min(ordenados.length, LIMITE_OPCOES) };
  }, [itens, busca, procedimentoId]);
  return (
    <div>
      {itens.length > 15 && (
        <input aria-label="Buscar procedimento" value={busca} onChange={e => setBusca(e.target.value)}
          placeholder="Buscar por nome ou código" style={{ ...estilo, marginBottom: '4px' }} {...SEM_AUTOPREENCHIMENTO('busca-procedimento-pep')} />
      )}
      <select aria-label="Procedimento" value={procedimentoId || ''} onChange={e => onChange(e.target.value || null)} style={estilo}>
        <option value="">{rotuloVazio}</option>
        {opcoes.visiveis.map(p => <option key={p.id} value={p.id}>{rotuloProcedimento(p)}</option>)}
      </select>
      {opcoes.ocultos > 0 && (
        <div style={{ fontSize: '14px', color: '#6b7280', marginTop: '2px' }}>+{opcoes.ocultos} — refine a busca</div>
      )}
    </div>
  );
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
        {/* O convênio "Particular" do cadastro do paciente é a opção vazia. */}
        <select aria-label="Convênio" value={convenios.find(c => c.id === convenioId)?.particular ? '' : (convenioId || '')} onChange={e => onChange({ convenioId: e.target.value || null, procedimentoId })} style={estilo}>
          <option value="">Particular</option>
          {convenios.filter(c => !c.particular).map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
      </div>
      <div>
        <label style={{ fontSize: '16px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Procedimento</label>
        <EscolhaProcedimento itens={itens} procedimentoId={procedimentoId} estilo={estilo}
          onChange={id => onChange({ convenioId, procedimentoId: id })} />
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
