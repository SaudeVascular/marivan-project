import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Header, CabecalhoImpresso } from '../../components/common/Layout';
import { producaoService } from '../../services/producao.service';
import { usuariosService } from '../../services/usuarios.service';
import { FUNCOES_CLINICAS, FUNCOES_FINANCEIRO } from '../../constants/roles';
import { dataLocalISO, formatarMoeda } from '../../utils/formatters';

const SITUACOES = ['Pago', 'Pendente', 'Glosado'];
const TIPOS = ['Consulta', 'Exame', 'Procedimento'];

const ultimoDiaDoMes = (mes) => {
  const [a, m] = mes.split('-').map(Number);
  return `${mes}-${String(new Date(a, m, 0).getDate()).padStart(2, '0')}`;
};
const dataBr = (iso) => (iso ? new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR') : '');
const nomeMes = (mes) => new Date(mes + '-15T12:00:00').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
const percentual = (parte, todo) => (todo > 0 ? `${((parte / todo) * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%` : '—');

// Chaves de agrupamento: procedimento sem cadastro agrupa pela descrição.
const chaveProcedimento = (l) => l.procedimentoId || `desc:${l.procedimento}`;
const chaveConvenio = (l) => l.convenioId || 'particular';

function somar(linhas) {
  const t = { quantidade: 0, valor: 0, repasse: 0, clinica: 0, pago: 0, pendente: 0, glosado: 0 };
  for (const l of linhas) {
    t.quantidade += 1;
    t.valor += l.valor;
    t.repasse += l.valorRepasse;
    t.clinica += l.valorClinica;
    if (l.status === 'Pago') t.pago += l.valor;
    else if (l.status === 'Pendente') t.pendente += l.valor;
    else if (l.status === 'Glosado') t.glosado += l.valor;
  }
  return t;
}

function agrupar(linhas, chave, descrever) {
  const grupos = new Map();
  for (const l of linhas) {
    const k = chave(l);
    if (!grupos.has(k)) grupos.set(k, { chave: k, ...descrever(l), linhas: [] });
    grupos.get(k).linhas.push(l);
  }
  return [...grupos.values()].map(g => ({ ...g, ...somar(g.linhas) })).sort((a, b) => b.valor - a.valor);
}

const th = { padding: '6px 8px', textAlign: 'left', borderBottom: '2px solid #d1d5db', whiteSpace: 'nowrap' };
const thN = { ...th, textAlign: 'right' };
const td = { padding: '5px 8px', borderBottom: '1px solid #f3f4f6' };
const tdN = { ...td, textAlign: 'right', whiteSpace: 'nowrap' };
const cartao = { backgroundColor: 'white', padding: '16px 20px', borderRadius: '8px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', marginBottom: '16px' };
const filtroRotulo = { fontSize: '16px', display: 'flex', flexDirection: 'column', gap: '4px' };

export function ProducaoPage() {
  const { user, funcao, perfil } = useAuth();
  const gestor = FUNCOES_FINANCEIRO.includes(funcao);
  const hoje = dataLocalISO();

  const [modo, setModo] = React.useState('mes');
  const [mes, setMes] = React.useState(hoje.slice(0, 7));
  const [de, setDe] = React.useState(hoje.slice(0, 8) + '01');
  const [ate, setAte] = React.useState(hoje);
  const [profissionalId, setProfissionalId] = React.useState('');
  const [tipo, setTipo] = React.useState('');
  const [procedimento, setProcedimento] = React.useState('');
  const [convenio, setConvenio] = React.useState('');
  const [situacao, setSituacao] = React.useState('');
  const [mostrarDetalhe, setMostrarDetalhe] = React.useState(true);

  const [linhas, setLinhas] = React.useState([]);
  const [carregando, setCarregando] = React.useState(true);
  const [erro, setErro] = React.useState('');
  const [profissionais, setProfissionais] = React.useState([]);

  const periodo = modo === 'mes' ? { de: `${mes}-01`, ate: ultimoDiaDoMes(mes) } : { de, ate };
  const periodoValido = periodo.de && periodo.ate && periodo.de <= periodo.ate;

  React.useEffect(() => {
    if (!gestor) return;
    usuariosService.listar()
      .then(us => setProfissionais(us.filter(u => FUNCOES_CLINICAS.includes(u.funcao) || (u.funcao === 'Administrador' && u.papel_clinico_administrador))))
      .catch(() => setProfissionais([]));
  }, [gestor]);

  const consulta = React.useRef(0);
  const carregar = React.useCallback(() => {
    if (!periodoValido) { setLinhas([]); setCarregando(false); return; }
    const esta = ++consulta.current;
    setCarregando(true);
    setErro('');
    producaoService.relatorio({ de: periodo.de, ate: periodo.ate, profissionalId: gestor ? profissionalId : null })
      .then(l => { if (esta === consulta.current) setLinhas(l); })
      .catch(err => { if (esta === consulta.current) { setLinhas([]); setErro(err.message || 'Não foi possível gerar o relatório.'); } })
      .finally(() => { if (esta === consulta.current) setCarregando(false); });
  }, [periodo.de, periodo.ate, periodoValido, profissionalId, gestor]);
  React.useEffect(() => { carregar(); }, [carregar]);

  // Opções de procedimento e convênio: as que aparecem no período.
  const opcoesProcedimento = React.useMemo(() => agrupar(linhas, chaveProcedimento, l => ({ codigo: l.codigo, nome: l.procedimento || 'Procedimento a definir' }))
    .sort((a, b) => a.nome.localeCompare(b.nome)), [linhas]);
  const opcoesConvenio = React.useMemo(() => agrupar(linhas, chaveConvenio, l => ({ nome: l.convenio || 'Particular' }))
    .sort((a, b) => a.nome.localeCompare(b.nome)), [linhas]);

  const filtradas = React.useMemo(() => linhas.filter(l =>
    (!tipo || (tipo === 'a-definir' ? !l.tipo : l.tipo === tipo))
    && (!procedimento || chaveProcedimento(l) === procedimento)
    && (!convenio || chaveConvenio(l) === convenio)
    && (!situacao || l.status === situacao)), [linhas, tipo, procedimento, convenio, situacao]);

  const total = somar(filtradas);
  const porProfissional = agrupar(filtradas, l => l.profissionalId || 'sem', l => ({ nome: l.profissional || 'Sem profissional definido' }));
  const porProcedimento = agrupar(filtradas, chaveProcedimento, l => ({ codigo: l.codigo, nome: l.procedimento || 'Procedimento a definir', tipo: l.tipo || '—' }));
  const porConvenio = agrupar(filtradas, chaveConvenio, l => ({ nome: l.convenio || 'Particular' }));
  const variosProfissionais = gestor && !profissionalId;

  const nomeProfissional = gestor
    ? (profissionalId ? (profissionais.find(p => p.id === profissionalId)?.nome || '') : 'Todos os profissionais')
    : (perfil?.nome || user?.email || '');
  const descricaoPeriodo = modo === 'mes' ? nomeMes(mes) : `${dataBr(periodo.de)} a ${dataBr(periodo.ate)}`;
  const filtrosAplicados = [
    tipo && `tipo: ${tipo === 'a-definir' ? 'a definir' : tipo}`,
    procedimento && `procedimento: ${opcoesProcedimento.find(o => o.chave === procedimento)?.nome || ''}`,
    convenio && `convênio: ${opcoesConvenio.find(o => o.chave === convenio)?.nome || ''}`,
    situacao && `situação: ${situacao}`,
  ].filter(Boolean);

  return (
    <div className="relatorio-producao">
      <div className="no-print">
        <Header />
        <Link to={gestor || funcao === 'Médico' ? '/financeiro' : '/pacientes'}>← Voltar</Link>
        <h2 style={{ marginTop: '20px' }}>Relatório de produção</h2>
        {!gestor && <p style={{ color: '#666', marginTop: '-8px' }}>A sua produção: atendimentos, valores e o seu repasse.</p>}

        <div style={{ ...cartao, display: 'flex', gap: '14px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <fieldset style={{ border: 'none', padding: 0, margin: 0, display: 'flex', gap: '10px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <legend style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '4px' }}>Período</legend>
            <label style={{ fontSize: '16px' }}><input type="radio" name="modo-periodo" checked={modo === 'mes'} onChange={() => setModo('mes')} /> Mês</label>
            <label style={{ fontSize: '16px' }}><input type="radio" name="modo-periodo" checked={modo === 'intervalo'} onChange={() => setModo('intervalo')} /> Intervalo de dias</label>
            {modo === 'mes' ? (
              <input aria-label="Mês do relatório" type="month" value={mes} onChange={e => setMes(e.target.value)} style={{ padding: '6px' }} />
            ) : (
              <>
                <label style={{ fontSize: '16px' }}>De <input aria-label="De" type="date" value={de} onChange={e => setDe(e.target.value)} style={{ padding: '6px' }} /></label>
                <label style={{ fontSize: '16px' }}>Até <input aria-label="Até" type="date" value={ate} onChange={e => setAte(e.target.value)} style={{ padding: '6px' }} /></label>
              </>
            )}
          </fieldset>
          {gestor && (
            <label style={filtroRotulo}>Profissional
              <select value={profissionalId} onChange={e => setProfissionalId(e.target.value)} style={{ padding: '6px' }}>
                <option value="">Todos os profissionais</option>
                {profissionais.map(p => <option key={p.id} value={p.id}>{p.nome}{p.ativo ? '' : ' (inativo)'}</option>)}
              </select>
            </label>
          )}
          <label style={filtroRotulo}>Tipo
            <select value={tipo} onChange={e => setTipo(e.target.value)} style={{ padding: '6px' }}>
              <option value="">Todos</option>
              {TIPOS.map(t => <option key={t}>{t}</option>)}
              <option value="a-definir">A definir</option>
            </select>
          </label>
          <label style={filtroRotulo}>Procedimento
            <select value={procedimento} onChange={e => setProcedimento(e.target.value)} style={{ padding: '6px', maxWidth: '320px' }}>
              <option value="">Todos</option>
              {opcoesProcedimento.map(o => <option key={o.chave} value={o.chave}>{o.codigo ? `${o.codigo} — ` : ''}{o.nome}</option>)}
            </select>
          </label>
          <label style={filtroRotulo}>Convênio
            <select value={convenio} onChange={e => setConvenio(e.target.value)} style={{ padding: '6px' }}>
              <option value="">Todos</option>
              {opcoesConvenio.map(o => <option key={o.chave} value={o.chave}>{o.nome}</option>)}
            </select>
          </label>
          <label style={filtroRotulo}>Situação
            <select value={situacao} onChange={e => setSituacao(e.target.value)} style={{ padding: '6px' }}>
              <option value="">Todas (sem as canceladas)</option>
              {SITUACOES.map(s => <option key={s}>{s}</option>)}
            </select>
          </label>
          <label style={{ fontSize: '16px' }}>
            <input type="checkbox" checked={mostrarDetalhe} onChange={e => setMostrarDetalhe(e.target.checked)} /> Listar atendimentos
          </label>
          <button onClick={() => window.print()} disabled={carregando || !!erro}
            style={{ marginLeft: 'auto', padding: '9px 18px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '16px' }}>
            🖨️ Imprimir
          </button>
        </div>
        {!periodoValido && <p role="alert" style={{ color: '#dc2626' }}>A data inicial precisa ser anterior ou igual à final.</p>}
        {erro && (
          <div role="alert" style={{ padding: '10px 14px', backgroundColor: '#fee2e2', color: '#991b1b', borderRadius: '6px', marginBottom: '12px' }}>
            {erro} <button onClick={carregar} style={{ marginLeft: '8px' }}>Tentar de novo</button>
          </div>
        )}
      </div>

      {/* Cabeçalho que só sai no papel */}
      <div className="so-impressao">
        <CabecalhoImpresso />
        <h2 style={{ textAlign: 'center', margin: '0 0 6px', fontSize: '18px' }}>RELATÓRIO DE PRODUÇÃO</h2>
        <p style={{ textAlign: 'center', margin: '0 0 12px' }}>
          {descricaoPeriodo} · {nomeProfissional}{filtrosAplicados.length ? ` · ${filtrosAplicados.join(' · ')}` : ''}
        </p>
      </div>

      {carregando ? <p>Gerando relatório...</p> : !erro && periodoValido && (
        <>
          <div className="cartoes-resumo" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '16px' }}>
            {[
              ['Atendimentos', total.quantidade, false],
              ['Produção', total.valor, true],
              [gestor ? 'Repasse aos profissionais' : 'Seu repasse', total.repasse, true],
              ...(gestor ? [['Fica para a clínica', total.clinica, true]] : []),
              ['Recebido (pago)', total.pago, true],
              ['A receber (pendente)', total.pendente, true],
              ['Glosado', total.glosado, true],
            ].map(([nome, v, dinheiro]) => (
              <div key={nome} role="group" aria-label={nome} style={{ backgroundColor: 'white', padding: '12px 16px', borderRadius: '8px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', minWidth: '150px' }}>
                <div style={{ fontSize: '15px', color: '#666' }}>{nome}</div>
                <div style={{ fontSize: '20px', fontWeight: 'bold' }}>{dinheiro ? formatarMoeda(v) : v}</div>
              </div>
            ))}
          </div>

          {filtradas.length === 0 ? (
            <div style={cartao}><p style={{ margin: 0, color: '#666' }}>Nenhum atendimento neste período{filtrosAplicados.length ? ' com estes filtros' : ''}.</p></div>
          ) : (
            <>
              {variosProfissionais && (
                <Tabela titulo="Por profissional"
                  colunas={['Profissional', 'Atend.', 'Produção', 'Repasse', 'Clínica', '% da produção']}
                  linhas={porProfissional.map(g => [g.nome, g.quantidade, formatarMoeda(g.valor), formatarMoeda(g.repasse), formatarMoeda(g.clinica), percentual(g.valor, total.valor)])}
                  rodape={['Total', total.quantidade, formatarMoeda(total.valor), formatarMoeda(total.repasse), formatarMoeda(total.clinica), '100%']} />
              )}
              <Tabela titulo="Por procedimento"
                colunas={['Código', 'Procedimento', 'Tipo', 'Qtd.', 'Produção', gestor ? 'Repasse' : 'Seu repasse', ...(gestor ? ['Clínica'] : [])]}
                textoAte={3}
                linhas={porProcedimento.map(g => [g.codigo || '—', g.nome, g.tipo, g.quantidade, formatarMoeda(g.valor), formatarMoeda(g.repasse), ...(gestor ? [formatarMoeda(g.clinica)] : [])])}
                rodape={['', 'Total', '', total.quantidade, formatarMoeda(total.valor), formatarMoeda(total.repasse), ...(gestor ? [formatarMoeda(total.clinica)] : [])]} />
              {porConvenio.length > 1 && (
                <Tabela titulo="Por convênio"
                  colunas={['Convênio', 'Atend.', 'Produção', 'Recebido', 'A receber', 'Glosado']}
                  linhas={porConvenio.map(g => [g.nome, g.quantidade, formatarMoeda(g.valor), formatarMoeda(g.pago), formatarMoeda(g.pendente), formatarMoeda(g.glosado)])} />
              )}
              {mostrarDetalhe && (
                <Tabela titulo={`Atendimentos (${filtradas.length})`}
                  colunas={['Data', 'Paciente', ...(variosProfissionais ? ['Profissional'] : []), 'Código', 'Procedimento', 'Convênio', 'Situação', 'Valor', '%', 'Repasse', ...(gestor ? ['Clínica'] : [])]}
                  textoAte={variosProfissionais ? 7 : 6}
                  linhas={filtradas.map(l => [dataBr(l.data), l.paciente, ...(variosProfissionais ? [l.profissional || '—'] : []), l.codigo || '—',
                    l.procedimento || 'A definir', l.convenio || 'Particular', l.status, formatarMoeda(l.valor),
                    `${l.percentualRepasse.toLocaleString('pt-BR')}%`, formatarMoeda(l.valorRepasse), ...(gestor ? [formatarMoeda(l.valorClinica)] : [])])} />
              )}
            </>
          )}
          <p style={{ fontSize: '14px', color: '#6b7280' }}>
            Produção = atendimentos do período, menos os cancelados. O repasse usa o percentual gravado em cada cobrança quando ela foi lançada.
            Emitido em {new Date().toLocaleString('pt-BR')} por {perfil?.nome || user?.email}.
          </p>
        </>
      )}
    </div>
  );
}

// textoAte: quantas colunas do começo são texto (as demais, números à direita).
function Tabela({ titulo, colunas, linhas, rodape, textoAte = 1 }) {
  return (
    <div style={cartao} className="bloco-relatorio">
      <h3 style={{ marginTop: 0 }}>{titulo}</h3>
      <div style={{ overflowX: 'auto' }}>
        <table aria-label={titulo} style={{ width: '100%', borderCollapse: 'collapse', fontSize: '15px' }}>
          <thead><tr>{colunas.map((c, i) => <th key={c} style={i < textoAte ? th : thN}>{c}</th>)}</tr></thead>
          <tbody>
            {linhas.map((l, k) => <tr key={k}>{l.map((v, i) => <td key={i} style={i < textoAte ? td : tdN}>{v}</td>)}</tr>)}
          </tbody>
          {rodape && (
            <tfoot><tr>{rodape.map((v, i) => <td key={i} style={{ ...(i < textoAte ? td : tdN), fontWeight: 'bold', borderTop: '2px solid #d1d5db' }}>{v}</td>)}</tr></tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
