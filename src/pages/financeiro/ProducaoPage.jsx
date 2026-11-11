import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Header, CabecalhoImpresso } from '../../components/common/Layout';
import { producaoService } from '../../services/producao.service';
import { usuariosService } from '../../services/usuarios.service';
import { FUNCOES_CLINICAS, FUNCOES_FINANCEIRO } from '../../constants/roles';
import { dataLocalISO, formatarMoeda } from '../../utils/formatters';
import { somarValores, textoDesconto } from './valores';
import { ValorOuPrevisto } from './ValorPrevisto';

const SITUACOES = ['Pago', 'Pendente', 'Glosado'];
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
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

// Mesmas regras do banco (migração 54): valor − desconto = pago;
// pago − glosa = recebido (só Pago); recebido = clínica + profissional.
const somar = somarValores;

function agrupar(linhas, chave, descrever) {
  const grupos = new Map();
  for (const l of linhas) {
    const k = chave(l);
    if (!grupos.has(k)) grupos.set(k, { chave: k, ...descrever(l), linhas: [] });
    grupos.get(k).linhas.push(l);
  }
  return [...grupos.values()].map(g => ({ ...g, ...somar(g.linhas) })).sort((a, b) => b.valorPago - a.valorPago || a.nome.localeCompare(b.nome));
}

// Visões do relatório (pedido de 30/10/2026). O profissional vê só as
// que dizem respeito a ele.
const VISOES_GESTOR = [
  ['completo', 'Completo'],
  ['clinica', 'Só dados da clínica'],
  ['profissional', 'Só dados do profissional'],
  ['por-profissional', 'Por profissional'],
  ['por-especialidade', 'Por especialidade do profissional'],
  ['por-tipo', 'Por tipo de atendimento'],
];
const VISOES_PROFISSIONAL = [
  ['profissional', 'Meus atendimentos'],
  ['por-tipo', 'Por tipo de atendimento'],
];

// Colunas de valor de cada visão (chave em somarValores / na linha).
const VALORES = {
  valor: 'Valor do procedimento', desconto: 'Desconto', valorPago: 'Valor pago', glosa: 'Glosa',
  recebido: 'Valor recebido', recebidoClinica: 'Recebido pela clínica', recebidoProfissional: 'Recebido pelo profissional',
};
const VALORES_DA_VISAO = {
  completo: ['valor', 'desconto', 'valorPago', 'glosa', 'recebido', 'recebidoClinica', 'recebidoProfissional'],
  clinica: ['valor', 'desconto', 'valorPago', 'glosa', 'recebido', 'recebidoClinica'],
  profissional: ['valor', 'desconto', 'valorPago', 'glosa', 'recebido', 'recebidoProfissional'],
  agrupado: ['valor', 'desconto', 'valorPago', 'glosa', 'recebido', 'recebidoClinica', 'recebidoProfissional'],
  agrupadoProfissional: ['valor', 'desconto', 'valorPago', 'glosa', 'recebido', 'recebidoProfissional'],
};
const PREVISTO_DE = { recebidoClinica: 'previstoClinica', recebidoProfissional: 'previstoProfissional' };
const formatarValor = (chave, objeto) => {
  if (chave === 'desconto') return textoDesconto(objeto.desconto, objeto.valor);
  if (chave === 'glosa' && !(objeto.glosa > 0)) return '—';
  // Linha pendente: a divisão prevista, em cinza (migração 55).
  if (PREVISTO_DE[chave] && objeto.status === 'Pendente') {
    return <ValorOuPrevisto recebido={objeto[chave]} previsto={objeto[PREVISTO_DE[chave]]} pendente />;
  }
  return formatarMoeda(objeto[chave]);
};

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
  const [visao, setVisao] = React.useState(gestor ? 'completo' : 'profissional');
  const visoes = gestor ? VISOES_GESTOR : VISOES_PROFISSIONAL;

  const [linhas, setLinhas] = React.useState([]);
  const [carregando, setCarregando] = React.useState(true);
  const [erro, setErro] = React.useState('');
  const [profissionais, setProfissionais] = React.useState([]);

  // Do ano corrente até 5 anos antes (e o próximo, para agendas futuras).
  const anoAtual = Number(hoje.slice(0, 4));
  const anos = Array.from({ length: 7 }, (_, i) => String(anoAtual + 1 - i));
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
  const variosProfissionais = gestor && !profissionalId;
  const agrupamentos = {
    'por-profissional': ['Profissional', l => l.profissionalId || 'sem', l => ({ nome: l.profissional || 'Sem profissional definido' })],
    'por-especialidade': ['Especialidade', l => l.especialidade || 'sem', l => ({ nome: l.especialidade || 'Sem especialidade informada' })],
    'por-tipo': ['Tipo de atendimento', l => l.tipo || 'a-definir', l => ({ nome: l.tipo || 'A definir' })],
  };
  const agrupada = agrupamentos[visao];
  const grupos = agrupada ? agrupar(filtradas, agrupada[1], agrupada[2]) : [];

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
  const nomeVisao = visoes.find(([k]) => k === visao)?.[1] || '';

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
            {/* Mês e ano em listas: o Safari não tem seletor de mês (o campo
                type="month" vira texto livre). Datas com o calendário do navegador. */}
            {modo === 'mes' ? (
              <>
                <select aria-label="Mês do relatório" value={mes.slice(5, 7)} onChange={e => setMes(`${mes.slice(0, 4)}-${e.target.value}`)} style={{ padding: '6px', fontSize: '16px' }}>
                  {MESES.map((nome, i) => <option key={nome} value={String(i + 1).padStart(2, '0')}>{nome}</option>)}
                </select>
                <select aria-label="Ano do relatório" value={mes.slice(0, 4)} onChange={e => setMes(`${e.target.value}-${mes.slice(5, 7)}`)} style={{ padding: '6px', fontSize: '16px' }}>
                  {anos.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </>
            ) : (
              <>
                <label style={{ fontSize: '16px', display: 'flex', flexDirection: 'column', gap: '2px' }}>De
                  <input aria-label="De" type="date" value={de} max={ate || undefined} onChange={e => setDe(e.target.value)} style={{ padding: '6px', fontSize: '16px' }} />
                </label>
                <label style={{ fontSize: '16px', display: 'flex', flexDirection: 'column', gap: '2px' }}>Até
                  <input aria-label="Até" type="date" value={ate} min={de || undefined} onChange={e => setAte(e.target.value)} style={{ padding: '6px', fontSize: '16px' }} />
                </label>
              </>
            )}
          </fieldset>
          {gestor && (
            <label style={filtroRotulo}>Profissional
              <select aria-label="Profissional" value={profissionalId} onChange={e => setProfissionalId(e.target.value)} style={{ padding: '6px' }}>
                <option value="">Todos os profissionais</option>
                {profissionais.map(p => <option key={p.id} value={p.id}>{p.nome}{p.ativo ? '' : ' (inativo)'}</option>)}
              </select>
            </label>
          )}
          <label style={filtroRotulo}>Tipo
            <select aria-label="Tipo" value={tipo} onChange={e => setTipo(e.target.value)} style={{ padding: '6px' }}>
              <option value="">Todos</option>
              {TIPOS.map(t => <option key={t}>{t}</option>)}
              <option value="a-definir">A definir</option>
            </select>
          </label>
          <label style={filtroRotulo}>Procedimento
            <select aria-label="Procedimento" value={procedimento} onChange={e => setProcedimento(e.target.value)} style={{ padding: '6px', maxWidth: '320px' }}>
              <option value="">Todos</option>
              {opcoesProcedimento.map(o => <option key={o.chave} value={o.chave}>{o.codigo ? `${o.codigo} — ` : ''}{o.nome}</option>)}
            </select>
          </label>
          <label style={filtroRotulo}>Convênio
            <select aria-label="Convênio" value={convenio} onChange={e => setConvenio(e.target.value)} style={{ padding: '6px' }}>
              <option value="">Todos</option>
              {opcoesConvenio.map(o => <option key={o.chave} value={o.chave}>{o.nome}</option>)}
            </select>
          </label>
          <label style={filtroRotulo}>Situação
            <select aria-label="Situação" value={situacao} onChange={e => setSituacao(e.target.value)} style={{ padding: '6px' }}>
              <option value="">Todas (sem as canceladas)</option>
              {SITUACOES.map(s => <option key={s}>{s}</option>)}
            </select>
          </label>
          <label style={filtroRotulo}>Relatório
            <select aria-label="Visão do relatório" value={visao} onChange={e => setVisao(e.target.value)} style={{ padding: '6px', fontWeight: 'bold' }}>
              {visoes.map(([k, nome]) => <option key={k} value={k}>{nome}</option>)}
            </select>
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
          {nomeVisao} · {descricaoPeriodo} · {nomeProfissional}{filtrosAplicados.length ? ` · ${filtrosAplicados.join(' · ')}` : ''}
        </p>
      </div>

      {carregando ? <p>Gerando relatório...</p> : !erro && periodoValido && (
        <>
          <div className="cartoes-resumo" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '16px' }}>
            {[
              ['Atendimentos', String(total.quantidade)],
              ['Valor pago', formatarMoeda(total.valorPago)],
              ['Glosa', formatarMoeda(total.glosa)],
              ['Valor recebido', formatarMoeda(total.recebido)],
              ...(gestor && visao !== 'profissional' ? [['Recebido pela clínica', formatarMoeda(total.recebidoClinica)]] : []),
              ...(visao !== 'clinica' ? [[gestor ? 'Recebido pelos profissionais' : 'Seu repasse', formatarMoeda(total.recebidoProfissional)]] : []),
              ...(gestor && visao !== 'profissional' && total.previstoClinica > 0 ? [['Previsto para a clínica (pendentes)', formatarMoeda(total.previstoClinica)]] : []),
              ...(visao !== 'clinica' && total.previstoProfissional > 0 ? [[gestor ? 'Previsto para os profissionais (pendentes)' : 'Seu repasse previsto (pendentes)', formatarMoeda(total.previstoProfissional)]] : []),
            ].map(([nome, v]) => (
              <div key={nome} role="group" aria-label={nome} style={{ backgroundColor: 'white', padding: '12px 16px', borderRadius: '8px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', minWidth: '150px' }}>
                <div style={{ fontSize: '15px', color: '#666' }}>{nome}</div>
                <div style={{ fontSize: '20px', fontWeight: 'bold' }}>{v}</div>
              </div>
            ))}
          </div>

          {filtradas.length === 0 ? (
            <div style={cartao}><p style={{ margin: 0, color: '#666' }}>Nenhum atendimento neste período{filtrosAplicados.length ? ' com estes filtros' : ''}.</p></div>
          ) : agrupada ? (() => {
            const chaves = gestor ? VALORES_DA_VISAO.agrupado : VALORES_DA_VISAO.agrupadoProfissional;
            return (
              <Tabela titulo={nomeVisao}
                colunas={[agrupada[0], 'Atendimentos', ...chaves.map(k => VALORES[k]), '% do recebido']}
                linhas={grupos.map(g => [g.nome, g.quantidade, ...chaves.map(k => formatarValor(k, g)), percentual(g.recebido, total.recebido)])}
                rodape={[`Total`, total.quantidade, ...chaves.map(k => formatarValor(k, total)), total.recebido > 0 ? '100%' : '—']} />
            );
          })() : (() => {
            const chaves = VALORES_DA_VISAO[visao];
            const texto = ['Paciente', 'Data do atendimento',
              ...(visao === 'completo' ? ['Procedimento', 'Convênio'] : []),
              ...(variosProfissionais && visao !== 'clinica' ? ['Profissional'] : [])];
            return (
              <Tabela titulo={`${nomeVisao} — ${filtradas.length} atendimento${filtradas.length === 1 ? '' : 's'}`}
                colunas={[...texto, ...chaves.map(k => VALORES[k]), 'Situação']}
                textoAte={texto.length}
                linhas={filtradas.map(l => [l.paciente, dataBr(l.data),
                  ...(visao === 'completo' ? [l.procedimento || 'A definir', l.convenio || 'Particular'] : []),
                  ...(variosProfissionais && visao !== 'clinica' ? [l.profissional || '—'] : []),
                  ...chaves.map(k => formatarValor(k, l)), l.status])}
                rodape={[`Total — ${total.quantidade} atendimento${total.quantidade === 1 ? '' : 's'}`, ...texto.slice(1).map(() => ''),
                  ...chaves.map(k => formatarValor(k, total)), '']} />
            );
          })()}
          <p style={{ fontSize: '14px', color: '#6b7280' }}>
            Atendimentos do período, menos os cancelados. Valor pago = procedimento − desconto; recebido = pago − glosa, só depois de pago;
            o recebido é dividido pelo percentual do profissional gravado em cada cobrança.
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
