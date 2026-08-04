import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useClinica } from '../../hooks/useClinica';
import { usePacienteAtual } from '../../hooks/usePacienteAtual';
import { useMedicoPerfil } from '../../hooks/useMedicoPerfil';
import { Header, LogoClinica, CabecalhoImpresso, RodapeImpresso } from '../../components/common/Layout';
import { useToast } from '../../components/common/Toast';
import { pacientesService } from '../../services/pacientes.service';
import { registrosService, salvarRegistroComFallback } from '../../services/registros.service';
import { modelosService } from '../../services/modelos.service';
import { comTimeout } from '../../utils/comTimeout';
import { formatarData } from '../../utils/mascaras';

const EXAMES_DISPONIVEIS = [
  {
    categoria: 'Laboratório — Rotina',
    exames: [
      { id: 'hemograma',  nome: 'Hemograma completo',               tuss: '40303289' },
      { id: 'glicemia',   nome: 'Glicemia de jejum',                tuss: '40302032' },
      { id: 'hba1c',      nome: 'Hemoglobina glicada (HbA1c)',      tuss: '40302024' },
      { id: 'col',        nome: 'Colesterol total e frações',       tuss: '40302059' },
      { id: 'trig',       nome: 'Triglicerídeos',                   tuss: '40302121' },
      { id: 'creat',      nome: 'Creatinina',                       tuss: '40302067' },
      { id: 'ureia',      nome: 'Ureia',                            tuss: '40302130' },
      { id: 'acur',       nome: 'Ácido úrico',                      tuss: '40302016' },
      { id: 'sodio',      nome: 'Sódio',                            tuss: '40302113' },
      { id: 'potassio',   nome: 'Potássio',                         tuss: '40302091' },
      { id: 'magnesio',   nome: 'Magnésio',                         tuss: '40302075' },
      { id: 'tgo',        nome: 'TGO (AST)',                        tuss: '40302105' },
      { id: 'tgp',        nome: 'TGP (ALT)',                        tuss: '40302113' },
      { id: 'pcr',        nome: 'Proteína C reativa (PCR)',         tuss: '40302091' },
      { id: 'tsh',        nome: 'TSH',                              tuss: '40302210' },
      { id: 't4l',        nome: 'T4 livre',                         tuss: '40302202' },
    ],
  },
  {
    categoria: 'Laboratório — Cardiológico',
    exames: [
      { id: 'troponina',  nome: 'Troponina I ou T',                 tuss: '40302229' },
      { id: 'bnp',        nome: 'BNP / NT-proBNP',                  tuss: '40302350' },
      { id: 'ddi',        nome: 'D-dímero',                         tuss: '40302270' },
      { id: 'coag',       nome: 'Coagulograma (TAP / INR / TTPA)',  tuss: '40303157' },
      { id: 'ferrit',     nome: 'Ferritina',                        tuss: '40302044' },
      { id: 'vitd',       nome: 'Vitamina D (25-OH)',               tuss: '40302563' },
    ],
  },
  {
    categoria: 'Cardiologia',
    exames: [
      { id: 'ecg',        nome: 'Eletrocardiograma (ECG)',          tuss: '40301010' },
      { id: 'eco',        nome: 'Ecocardiograma transtorácico',     tuss: '40901254' },
      { id: 'ergom',      nome: 'Teste ergométrico',                tuss: '40301052' },
      { id: 'holter',     nome: 'Holter 24 horas',                  tuss: '40301036' },
      { id: 'mapa',       nome: 'MAPA 24 horas',                    tuss: '40301028' },
      { id: 'cinti',      nome: 'Cintilografia miocárdica',         tuss: '40801293' },
      { id: 'angiotc',    nome: 'Angiotomografia coronariana',      tuss: '40901122' },
      { id: 'rmcard',     nome: 'Ressonância magnética cardíaca',   tuss: '40914153' },
    ],
  },
  {
    categoria: 'Imagem',
    exames: [
      { id: 'rxtorax',    nome: 'Radiografia de tórax',            tuss: '40901130' },
      { id: 'usgabd',     nome: 'Ultrassom de abdome total',        tuss: '40901041' },
      { id: 'dopcar',     nome: 'Doppler de carótidas e vertebrais',tuss: '40901386' },
      { id: 'dopvein',    nome: 'Doppler venoso de MMII',           tuss: '40901203' },
      { id: 'itb',        nome: 'Índice tornozelo-braquial (ITB)', tuss: '40301079' },
    ],
  },
];

export function AtestadoPage({ pacientes, setPacientes }) {
  const toast = useToast();
  const { user } = useAuth();
  const { paciente } = usePacienteAtual(pacientes);
  const hojeISO = new Date().toISOString().split('T')[0];

  const { medico, crm, especialidade } = useMedicoPerfil();
  const [dias, setDias] = React.useState('1');
  const [dataAtestado, setDataAtestado] = React.useState(hojeISO);
  const [cid, setCid] = React.useState('');
  const [observacoes, setObservacoes] = React.useState('');
  const [salvo, setSalvo] = React.useState(false);
  const [salvando, setSalvando] = React.useState(false);

  if (!paciente) return <p>Paciente não encontrado.</p>;

  const dataFormatada = new Date(dataAtestado + 'T12:00:00').toLocaleDateString('pt-BR', {
    day: 'numeric', month: 'long', year: 'numeric'
  });

  const salvarNoProntuario = async () => {
    const diasNum = Number(dias);
    if (!dias || !Number.isInteger(diasNum) || diasNum < 1) {
      toast.warning('Informe um número de dias de afastamento válido (1 ou mais).');
      return;
    }

    const conteudo = [
      `Médico: ${medico || 'Não informado'} | ${crm || 'CRM não informado'}`,
      `Afastamento: ${dias} ${Number(dias) === 1 ? 'dia' : 'dias'} a partir de ${dataFormatada}`,
      cid ? `CID: ${cid}` : null,
      observacoes ? `Observações: ${observacoes}` : null,
    ].filter(Boolean).join('\n');

    const registro = {
      tipo: 'Atestado',
      titulo: `Atestado — ${dias} ${Number(dias) === 1 ? 'dia' : 'dias'} de afastamento`,
      conteudo,
    };
    setSalvando(true);
    const resultado = await salvarRegistroComFallback({ registro, paciente, userId: user?.id, pacientes, setPacientes, contexto: 'atestado' });
    setSalvando(false);
    if (!resultado.ok) {
      toast.error('Não foi possível gravar no servidor: ' + resultado.error.message + '. Tente salvar de novo.');
      return;
    }
    setSalvo(true);
  };

  return (
    <div>
      <div className="no-print">
        <Header />
        <Link to={`/prontuario/${paciente.id}`}>← Voltar ao prontuário</Link>
      </div>
      <div style={{ maxWidth: '750px', margin: '20px auto' }}>
        <div className="no-print" style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', marginBottom: '16px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
          <h3 style={{ marginTop: 0 }}>Atestado Médico</h3>
          <div className="form-grid-3col" style={{ marginBottom: '12px' }}>
            <div>
              <label style={{ fontSize: '13px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Data</label>
              <input type="date" value={dataAtestado} onChange={(e) => setDataAtestado(e.target.value)} style={{ width: '100%', padding: '8px' }} />
            </div>
            <div>
              <label style={{ fontSize: '13px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Dias de afastamento</label>
              <input type="number" min="1" value={dias} onChange={(e) => setDias(e.target.value)} style={{ width: '100%', padding: '8px' }} />
            </div>
            <div>
              <label style={{ fontSize: '13px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>CID (opcional)</label>
              <input value={cid} onChange={(e) => setCid(e.target.value)} placeholder="Ex: Z00.0" style={{ width: '100%', padding: '8px' }} />
            </div>
          </div>
          <div style={{ marginBottom: '12px' }}>
            <label style={{ fontSize: '13px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Observações (opcional)</label>
            <textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} style={{ width: '100%', padding: '8px' }} rows={2} />
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button onClick={salvarNoProntuario} disabled={salvando} style={{ padding: '10px 18px', backgroundColor: salvando ? '#9ca3af' : '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: salvando ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}>
              {salvando ? 'Salvando...' : '✓ Salvar no Prontuário'}
            </button>
            <button onClick={() => window.print()} style={{ padding: '10px 18px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
              🖨️ Imprimir
            </button>
            {salvo && <span style={{ color: '#28a745', fontSize: '14px', fontWeight: 'bold' }}>✓ Salvo no histórico!</span>}
          </div>
        </div>

        <div className="doc-preview">
          <CabecalhoImpresso paciente={paciente} />
          <h2 style={{ textAlign: 'center', letterSpacing: '5px', fontSize: '18px', margin: '0 0 30px' }}>ATESTADO MÉDICO</h2>
          <p style={{ fontSize: '15px', lineHeight: '2.2', textAlign: 'justify' }}>
            Atesto que o(a) paciente <strong>{paciente.nome}</strong>
            {paciente.cpf ? `, portador(a) do CPF ${paciente.cpf},` : ','} esteve sob meus cuidados médicos
            e necessita afastar-se de suas atividades por{' '}
            <strong>{dias} {Number(dias) === 1 ? 'dia' : 'dias'}</strong>, a contar de {dataFormatada}.
            {cid && ` CID: ${cid}.`}
          </p>
          {observacoes && <p style={{ fontSize: '15px', lineHeight: '2', textAlign: 'justify' }}>{observacoes}</p>}
          <div style={{ marginTop: '60px', textAlign: 'right' }}>
            <p style={{ marginBottom: '50px', fontSize: '14px' }}>{dataFormatada}</p>
            <div style={{ display: 'inline-block', textAlign: 'center', minWidth: '280px' }}>
              <div style={{ borderTop: '1px solid #333', paddingTop: '8px' }}>
                <p style={{ margin: '0', fontWeight: 'bold' }}>{medico || '_______________________________'}</p>
                <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#666' }}>{crm || 'CRM _______________'}</p>
                {especialidade && <p style={{ margin: '3px 0 0', fontSize: '11px', color: '#888' }}>{especialidade}</p>}
              </div>
            </div>
          </div>
          <RodapeImpresso />
        </div>
      </div>
    </div>
  );
}

export function ReceituarioPage({ pacientes, setPacientes }) {
  const toast = useToast();
  const { user } = useAuth();
  const { paciente } = usePacienteAtual(pacientes);
  const hojeISO = new Date().toISOString().split('T')[0];

  const { medico, crm, especialidade } = useMedicoPerfil();
  const [dataReceita]                   = React.useState(hojeISO);
  const [salvo, setSalvo]               = React.useState(false);
  const [textoLivre, setTextoLivre]     = React.useState('');
  const [modelos, setModelos]           = React.useState([]);
  const [salvandoModelo, setSalvandoModelo] = React.useState(false);
  const [gravandoModelo, setGravandoModelo] = React.useState(false);
  const [salvandoReceituario, setSalvandoReceituario] = React.useState(false);
  const [nomeModelo, setNomeModelo]     = React.useState('');
  const [medicamentos, setMedicamentos] = React.useState([
    { id: 1, nome: '', dose: '', quantidade: '', via: '', frequencia: '', duracao: '', instrucoes: '' }
  ]);

  React.useEffect(() => {
    if (!user?.id) return;
    modelosService.listar(user.id)
      .then(setModelos)
      .catch(() => {});
  }, [user?.id]);

  const salvarModelo = async () => {
    if (!nomeModelo.trim() || !textoLivre.trim()) return;
    setGravandoModelo(true);
    try {
      const novo = await comTimeout(modelosService.criar(user.id, nomeModelo.trim(), textoLivre));
      setModelos(prev => [...prev, novo]);
      setNomeModelo('');
      setSalvandoModelo(false);
    } catch (err) {
      toast.error('Erro ao salvar modelo: ' + err.message);
    } finally {
      setGravandoModelo(false);
    }
  };

  const excluirModelo = async (id) => {
    try {
      await modelosService.excluir(id);
      setModelos(prev => prev.filter(m => m.id !== id));
    } catch (err) {
      toast.error('Erro ao excluir modelo: ' + err.message);
    }
  };

  if (!paciente) return <p>Paciente não encontrado.</p>;

  const adicionarMed = () => setMedicamentos([...medicamentos, {
    id: Date.now(), nome: '', dose: '', quantidade: '', via: '', frequencia: '', duracao: '', instrucoes: ''
  }]);

  const removerMed = (medId) => {
    if (medicamentos.length > 1) setMedicamentos(medicamentos.filter(m => m.id !== medId));
  };

  const atualizarMed = (medId, campo, valor) => {
    setMedicamentos(medicamentos.map(m => m.id === medId ? { ...m, [campo]: valor } : m));
  };

  const dataFormatada = new Date(dataReceita + 'T12:00:00').toLocaleDateString('pt-BR', {
    day: 'numeric', month: 'long', year: 'numeric'
  });

  const salvarNoProntuario = async () => {
    const temMedicamento = medicamentos.some(m => m.nome.trim());
    if (!temMedicamento && !textoLivre.trim()) {
      toast.warning('Adicione pelo menos um medicamento ou preencha o texto livre da prescrição.');
      return;
    }

    const medsTexto = medicamentos
      .filter(m => m.nome)
      .map((m, idx) => {
        const linhas = [`${idx + 1}. ${m.nome}${m.dose ? ' ' + m.dose : ''}`];
        if (m.frequencia || m.duracao) linhas.push(`   ${m.frequencia}${m.duracao ? ' por ' + m.duracao : ''}`);
        if (m.instrucoes) linhas.push(`   ${m.instrucoes}`);
        return linhas.join('\n');
      })
      .join('\n\n');

    const conteudo = [
      `Médico: ${medico || 'Não informado'} | ${crm || 'CRM não informado'}`,
      medsTexto || null,
      textoLivre ? `---\n${textoLivre}` : null,
    ].filter(Boolean).join('\n\n');
    const qtd = medicamentos.filter(m => m.nome).length;
    const registro = {
      tipo: 'Receituário',
      titulo: `Receituário — ${qtd} medicamento${qtd !== 1 ? 's' : ''}`,
      conteudo,
    };
    setSalvandoReceituario(true);
    const resultado = await salvarRegistroComFallback({ registro, paciente, userId: user?.id, pacientes, setPacientes, contexto: 'receituário' });
    setSalvandoReceituario(false);
    if (!resultado.ok) {
      toast.error('Não foi possível gravar no servidor: ' + resultado.error.message + '. Tente salvar de novo.');
      return;
    }
    setSalvo(true);
  };

  return (
    <div>
      <div className="no-print">
        <Header />
        <Link to={`/prontuario/${paciente.id}`}>← Voltar ao prontuário</Link>
      </div>
      <div style={{ maxWidth: '780px', margin: '20px auto' }}>
        <div className="no-print" style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', marginBottom: '16px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
          <h3 style={{ marginTop: 0 }}>Receituário</h3>
          <h4 style={{ margin: '0 0 10px' }}>Medicamentos</h4>
          {medicamentos.map((med, idx) => (
            <div key={med.id} style={{ border: '1px solid #e5e7eb', borderRadius: '6px', padding: '12px', marginBottom: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <strong style={{ fontSize: '13px', color: '#374151' }}>Medicamento {idx + 1}</strong>
                {medicamentos.length > 1 && (
                  <button onClick={() => removerMed(med.id)} style={{ padding: '2px 8px', backgroundColor: '#fee2e2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>Remover</button>
                )}
              </div>
              <div className="med-campos-principais" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '6px', marginBottom: '6px' }}>
                <input placeholder="Nome do medicamento *" value={med.nome} onChange={(e) => atualizarMed(med.id, 'nome', e.target.value)} style={{ padding: '7px', fontSize: '13px' }} />
                <input placeholder="Apresentação (ex: 50mg)" value={med.dose} onChange={(e) => atualizarMed(med.id, 'dose', e.target.value)} style={{ padding: '7px', fontSize: '13px' }} />
                <input placeholder="Quantidade (ex: 2 caixas)" value={med.quantidade} onChange={(e) => atualizarMed(med.id, 'quantidade', e.target.value)} style={{ padding: '7px', fontSize: '13px' }} />
              </div>
              <div className="med-campos-secundarios" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px', marginBottom: '6px' }}>
                <input placeholder="Administração (ex: via oral)" value={med.via} onChange={(e) => atualizarMed(med.id, 'via', e.target.value)} list="lista-vias" style={{ padding: '7px', fontSize: '13px' }} />
                <input placeholder="Frequência (ex: 1x ao dia)" value={med.frequencia} onChange={(e) => atualizarMed(med.id, 'frequencia', e.target.value)} style={{ padding: '7px', fontSize: '13px' }} />
                <input placeholder="Duração (ex: 30 dias)" value={med.duracao} onChange={(e) => atualizarMed(med.id, 'duracao', e.target.value)} style={{ padding: '7px', fontSize: '13px' }} />
              </div>
              <datalist id="lista-vias">
                <option value="via oral" />
                <option value="uso tópico" />
                <option value="via sublingual" />
                <option value="via inalatória" />
                <option value="via injetável (IM)" />
                <option value="via injetável (IV)" />
                <option value="via nasal" />
                <option value="via oftálmica" />
                <option value="via retal" />
                <option value="via transdérmica" />
              </datalist>
              <input placeholder="Instruções (ex: tomar após as refeições)" value={med.instrucoes} onChange={(e) => atualizarMed(med.id, 'instrucoes', e.target.value)} style={{ width: '100%', padding: '7px', fontSize: '13px' }} />
            </div>
          ))}
          <div style={{ display: 'flex', gap: '10px', marginTop: '12px', marginBottom: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button onClick={adicionarMed} style={{ padding: '9px 16px', backgroundColor: '#e8f5e9', color: '#28a745', border: '1px solid #c8e6c9', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>+ Medicamento</button>
            <button onClick={salvarNoProntuario} disabled={salvandoReceituario} style={{ padding: '9px 16px', backgroundColor: salvandoReceituario ? '#9ca3af' : '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: salvandoReceituario ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}>{salvandoReceituario ? 'Salvando...' : '✓ Salvar no Prontuário'}</button>
            <button onClick={() => window.print()} style={{ padding: '9px 16px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>🖨️ Imprimir</button>
            {salvo && <span style={{ color: '#28a745', fontSize: '14px', fontWeight: 'bold' }}>✓ Salvo no histórico!</span>}
          </div>

          {/* Texto livre */}
          <div style={{ borderTop: '1px dashed #d1d5db', paddingTop: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', flexWrap: 'wrap', gap: '8px' }}>
              <label style={{ fontSize: '13px', fontWeight: 'bold', color: '#374151' }}>
                Texto livre <span style={{ fontWeight: 'normal', color: '#9ca3af' }}>— escreva livremente ou cole uma prescrição</span>
              </label>
              {textoLivre.trim() && !salvandoModelo && (
                <button onClick={() => setSalvandoModelo(true)} style={{ fontSize: '12px', padding: '4px 10px', backgroundColor: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0', borderRadius: '4px', cursor: 'pointer' }}>
                  💾 Salvar como modelo
                </button>
              )}
            </div>

            {/* Modelos salvos */}
            {modelos.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
                {modelos.map(m => (
                  <div key={m.id} style={{ display: 'flex', alignItems: 'center', backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '16px', overflow: 'hidden' }}>
                    <button
                      onClick={() => setTextoLivre(m.conteudo)}
                      title="Clique para carregar este modelo"
                      style={{ padding: '3px 10px', fontSize: '12px', color: '#1d4ed8', background: 'none', border: 'none', cursor: 'pointer', fontWeight: '500' }}
                    >
                      📋 {m.nome}
                    </button>
                    <button
                      onClick={() => excluirModelo(m.id)}
                      title="Excluir modelo"
                      style={{ padding: '3px 6px', fontSize: '11px', color: '#dc2626', background: 'none', border: 'none', borderLeft: '1px solid #bfdbfe', cursor: 'pointer' }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Input para nomear o modelo */}
            {salvandoModelo && (
              <div style={{ display: 'flex', gap: '6px', marginBottom: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                <input
                  autoFocus
                  value={nomeModelo}
                  onChange={e => setNomeModelo(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') salvarModelo(); if (e.key === 'Escape') setSalvandoModelo(false); }}
                  placeholder="Nome do modelo (ex: HAS básico)"
                  disabled={gravandoModelo}
                  style={{ flex: 1, minWidth: '180px', padding: '6px 10px', fontSize: '13px', border: '1px solid #86efac', borderRadius: '4px', outline: 'none' }}
                />
                <button onClick={salvarModelo} disabled={gravandoModelo} style={{ padding: '6px 12px', backgroundColor: gravandoModelo ? '#9ca3af' : '#16a34a', color: 'white', border: 'none', borderRadius: '4px', cursor: gravandoModelo ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: 'bold' }}>
                  {gravandoModelo ? 'Salvando...' : 'Salvar'}
                </button>
                <button onClick={() => { setSalvandoModelo(false); setNomeModelo(''); }} disabled={gravandoModelo} style={{ padding: '6px 10px', backgroundColor: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' }}>
                  Cancelar
                </button>
              </div>
            )}

            <textarea
              value={textoLivre}
              onChange={e => setTextoLivre(e.target.value)}
              rows={6}
              placeholder="Digite ou cole aqui medicamentos em formato livre..."
              style={{ width: '100%', padding: '10px', fontSize: '13px', border: '1px solid #d1d5db', borderRadius: '6px', resize: 'vertical', fontFamily: 'inherit', lineHeight: '1.6' }}
            />
          </div>
        </div>

        <div className="doc-preview">
          <CabecalhoImpresso paciente={paciente} />
          <h2 style={{ textAlign: 'center', letterSpacing: '5px', fontSize: '18px', margin: '0 0 20px' }}>RECEITUÁRIO</h2>
          <hr style={{ margin: '0 0 20px', borderColor: '#ddd' }} />

          {medicamentos.filter(m => m.nome).length === 0 && !textoLivre && (
            <p style={{ color: '#999', textAlign: 'center', fontStyle: 'italic' }}>Preencha os medicamentos acima</p>
          )}

          {medicamentos.filter(m => m.nome).map((med, idx) => (
            <div key={med.id} style={{ marginBottom: '22px' }}>
              {/* Linha principal: nome (apresentação) ......... quantidade */}
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '4px' }}>
                <span style={{ fontWeight: 'bold', fontSize: '15px', whiteSpace: 'nowrap' }}>
                  {idx + 1}. {med.nome}{med.dose ? ` (${med.dose})` : ''}
                </span>
                <span style={{ flex: 1, borderBottom: '1px dotted #555', marginBottom: '3px', minWidth: '20px' }} />
                <span style={{ fontSize: '14px', whiteSpace: 'nowrap', fontWeight: '500' }}>
                  {med.quantidade || '_____________'}
                </span>
              </div>
              {/* Posologia */}
              {(med.via || med.frequencia || med.duracao) && (
                <p style={{ margin: '0 0 2px', paddingLeft: '18px', fontSize: '13.5px', color: '#333' }}>
                  <strong>Uso: </strong>
                  {[med.via, med.frequencia, med.duracao].filter(Boolean).join(' — ')}
                </p>
              )}
              {med.instrucoes && (
                <p style={{ margin: 0, paddingLeft: '18px', fontSize: '13px', color: '#555', fontStyle: 'italic' }}>
                  {med.instrucoes}
                </p>
              )}
            </div>
          ))}

          {/* Texto livre no impresso */}
          {textoLivre && (
            <div style={{ marginTop: medicamentos.filter(m => m.nome).length > 0 ? '16px' : '0', paddingTop: medicamentos.filter(m => m.nome).length > 0 ? '16px' : '0', borderTop: medicamentos.filter(m => m.nome).length > 0 ? '1px dashed #ccc' : 'none' }}>
              <p style={{ whiteSpace: 'pre-wrap', fontSize: '14px', lineHeight: '1.8', margin: 0 }}>{textoLivre}</p>
            </div>
          )}

          <div style={{ marginTop: '60px', textAlign: 'right' }}>
            <p style={{ marginBottom: '50px', fontSize: '13px' }}>{dataFormatada}</p>
            <div style={{ display: 'inline-block', textAlign: 'center', minWidth: '280px' }}>
              <div style={{ borderTop: '1px solid #333', paddingTop: '8px' }}>
                <p style={{ margin: '0', fontWeight: 'bold' }}>{medico || '_______________________________'}</p>
                <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#666' }}>{crm || 'CRM _______________'}</p>
                {especialidade && <p style={{ margin: '3px 0 0', fontSize: '11px', color: '#888' }}>{especialidade}</p>}
              </div>
            </div>
          </div>
          <RodapeImpresso />
        </div>
      </div>
    </div>
  );
}

export function RelatorioPage({ pacientes, setPacientes }) {
  const toast = useToast();
  const { user } = useAuth();
  const { paciente } = usePacienteAtual(pacientes);
  const hojeISO = new Date().toISOString().split('T')[0];

  const { medico, crm, especialidade } = useMedicoPerfil();
  const [dataRelatorio, setDataRelatorio] = React.useState(hojeISO);
  const [finalidade, setFinalidade] = React.useState('');
  const [diagnostico, setDiagnostico] = React.useState('');
  const [historico, setHistorico] = React.useState('');
  const [exames, setExames] = React.useState('');
  const [conduta, setConduta] = React.useState('');
  const [conclusao, setConclusao] = React.useState('');
  const [salvo, setSalvo] = React.useState(false);
  const [salvando, setSalvando] = React.useState(false);

  if (!paciente) return <p>Paciente não encontrado.</p>;

  const dataFormatada = new Date(dataRelatorio + 'T12:00:00').toLocaleDateString('pt-BR', {
    day: 'numeric', month: 'long', year: 'numeric'
  });

  const salvarNoProntuario = async () => {
    const temConteudo = [finalidade, diagnostico, historico, exames, conduta, conclusao].some(c => c && c.trim());
    if (!temConteudo) {
      toast.warning('Preencha pelo menos um campo do relatório antes de salvar.');
      return;
    }

    const conteudo = [
      `Médico: ${medico || 'Não informado'} | ${crm || 'CRM não informado'}`,
      finalidade ? `Finalidade: ${finalidade}` : null,
      diagnostico ? `\nDIAGNÓSTICO:\n${diagnostico}` : null,
      historico ? `\nHISTÓRICO CLÍNICO E EVOLUÇÃO:\n${historico}` : null,
      exames ? `\nEXAMES COMPLEMENTARES:\n${exames}` : null,
      conduta ? `\nCONDUTA TERAPÊUTICA:\n${conduta}` : null,
      conclusao ? `\nCONCLUSÃO E PARECER:\n${conclusao}` : null,
    ].filter(Boolean).join('\n');

    const registro = {
      tipo: 'Relatório',
      titulo: `Relatório Médico${finalidade ? ' — ' + finalidade : ''}`,
      conteudo,
    };
    setSalvando(true);
    const resultado = await salvarRegistroComFallback({ registro, paciente, userId: user?.id, pacientes, setPacientes, contexto: 'relatório' });
    setSalvando(false);
    if (!resultado.ok) {
      toast.error('Não foi possível gravar no servidor: ' + resultado.error.message + '. Tente salvar de novo.');
      return;
    }
    setSalvo(true);
  };

  const campo = (label, value, setter, rows = 3, placeholder = '') => (
    <div style={{ marginBottom: '14px' }}>
      <label style={{ fontSize: '13px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>{label}</label>
      <textarea
        value={value}
        onChange={(e) => setter(e.target.value)}
        rows={rows}
        placeholder={placeholder}
        style={{ width: '100%', padding: '8px', fontSize: '14px', borderRadius: '4px', border: '1px solid #d1d5db', resize: 'vertical' }}
      />
    </div>
  );

  return (
    <div>
      <div className="no-print">
        <Header />
        <Link to={`/prontuario/${paciente.id}`}>← Voltar ao prontuário</Link>
      </div>
      <div style={{ maxWidth: '800px', margin: '20px auto' }}>

        {/* Formulário */}
        <div className="no-print" style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', marginBottom: '16px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
          <h3 style={{ marginTop: 0 }}>Relatório Médico</h3>
          <div style={{ marginBottom: '14px' }}>
            <label style={{ fontSize: '13px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Data</label>
            <input type="date" value={dataRelatorio} onChange={(e) => setDataRelatorio(e.target.value)} style={{ padding: '8px', fontSize: '14px' }} />
          </div>

          <div style={{ marginBottom: '14px' }}>
            <label style={{ fontSize: '13px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Finalidade do Relatório</label>
            <select value={finalidade} onChange={(e) => setFinalidade(e.target.value)} style={{ width: '100%', padding: '8px', fontSize: '14px' }}>
              <option value="">Selecione ou deixe em branco</option>
              <option value="Perícia médica">Perícia médica</option>
              <option value="Encaminhamento médico">Encaminhamento médico</option>
              <option value="Solicitação de benefício INSS">Solicitação de benefício INSS</option>
              <option value="Afastamento do trabalho">Afastamento do trabalho</option>
              <option value="Seguro de vida / plano de saúde">Seguro de vida / plano de saúde</option>
              <option value="Uso particular">Uso particular</option>
            </select>
          </div>

          {campo('Diagnóstico(s)', diagnostico, setDiagnostico, 2, 'Ex: Hipertensão arterial sistêmica (I10), Diabetes mellitus tipo 2 (E11)')}
          {campo('Histórico clínico e evolução', historico, setHistorico, 6, 'Descreva o quadro clínico, evolução da doença e tratamentos realizados...')}
          {campo('Exames complementares (opcional)', exames, setExames, 3, 'Resultados de exames laboratoriais, imagens, etc.')}
          {campo('Conduta terapêutica atual', conduta, setConduta, 2, 'Medicamentos em uso, terapias, restrições...')}
          {campo('Conclusão e parecer médico', conclusao, setConclusao, 3, 'Parecer final do médico sobre o caso...')}

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button onClick={salvarNoProntuario} disabled={salvando} style={{ padding: '10px 18px', backgroundColor: salvando ? '#9ca3af' : '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: salvando ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}>
              {salvando ? 'Salvando...' : '✓ Salvar no Prontuário'}
            </button>
            <button onClick={() => window.print()} style={{ padding: '10px 18px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
              🖨️ Imprimir
            </button>
            {salvo && <span style={{ color: '#28a745', fontSize: '14px', fontWeight: 'bold' }}>✓ Salvo no histórico!</span>}
          </div>
        </div>

        {/* Documento para impressão */}
        <div className="doc-preview">
          <CabecalhoImpresso paciente={paciente} />
          <h2 style={{ textAlign: 'center', letterSpacing: '4px', fontSize: '18px', margin: '0 0 6px' }}>RELATÓRIO MÉDICO</h2>
          {finalidade && <p style={{ textAlign: 'center', color: '#555', fontSize: '14px', margin: '0 0 24px' }}>{finalidade}</p>}

          <div style={{ borderTop: '1px solid #ddd', paddingTop: '16px', marginBottom: '16px' }}>
            <p style={{ margin: '0 0 4px', fontSize: '14px' }}><strong>Paciente:</strong> {paciente.nome}</p>
            {paciente.cpf && <p style={{ margin: '0 0 4px', fontSize: '14px' }}><strong>CPF:</strong> {paciente.cpf}</p>}
            {paciente.nascimento && <p style={{ margin: '0', fontSize: '14px' }}><strong>Data de nascimento:</strong> {formatarData(paciente.nascimento)}</p>}
          </div>

          {diagnostico && (
            <div style={{ marginBottom: '20px' }}>
              <h3 style={{ fontSize: '14px', textTransform: 'uppercase', borderBottom: '1px solid #eee', paddingBottom: '4px', margin: '0 0 8px' }}>Diagnóstico</h3>
              <p style={{ fontSize: '14px', lineHeight: '1.7', margin: 0, whiteSpace: 'pre-wrap' }}>{diagnostico}</p>
            </div>
          )}

          {historico && (
            <div style={{ marginBottom: '20px' }}>
              <h3 style={{ fontSize: '14px', textTransform: 'uppercase', borderBottom: '1px solid #eee', paddingBottom: '4px', margin: '0 0 8px' }}>Histórico Clínico e Evolução</h3>
              <p style={{ fontSize: '14px', lineHeight: '1.7', margin: 0, textAlign: 'justify', whiteSpace: 'pre-wrap' }}>{historico}</p>
            </div>
          )}

          {exames && (
            <div style={{ marginBottom: '20px' }}>
              <h3 style={{ fontSize: '14px', textTransform: 'uppercase', borderBottom: '1px solid #eee', paddingBottom: '4px', margin: '0 0 8px' }}>Exames Complementares</h3>
              <p style={{ fontSize: '14px', lineHeight: '1.7', margin: 0, whiteSpace: 'pre-wrap' }}>{exames}</p>
            </div>
          )}

          {conduta && (
            <div style={{ marginBottom: '20px' }}>
              <h3 style={{ fontSize: '14px', textTransform: 'uppercase', borderBottom: '1px solid #eee', paddingBottom: '4px', margin: '0 0 8px' }}>Conduta Terapêutica Atual</h3>
              <p style={{ fontSize: '14px', lineHeight: '1.7', margin: 0, whiteSpace: 'pre-wrap' }}>{conduta}</p>
            </div>
          )}

          {conclusao && (
            <div style={{ marginBottom: '20px' }}>
              <h3 style={{ fontSize: '14px', textTransform: 'uppercase', borderBottom: '1px solid #eee', paddingBottom: '4px', margin: '0 0 8px' }}>Conclusão e Parecer Médico</h3>
              <p style={{ fontSize: '14px', lineHeight: '1.7', margin: 0, textAlign: 'justify', whiteSpace: 'pre-wrap' }}>{conclusao}</p>
            </div>
          )}

          {!diagnostico && !historico && !conduta && !conclusao && (
            <p style={{ color: '#bbb', textAlign: 'center', fontStyle: 'italic', margin: '40px 0' }}>Preencha os campos acima para visualizar o relatório</p>
          )}

          <div style={{ marginTop: '50px', textAlign: 'right' }}>
            <p style={{ marginBottom: '50px', fontSize: '14px' }}>{dataFormatada}</p>
            <div style={{ display: 'inline-block', textAlign: 'center', minWidth: '280px' }}>
              <div style={{ borderTop: '1px solid #333', paddingTop: '8px' }}>
                <p style={{ margin: '0', fontWeight: 'bold' }}>{medico || '_______________________________'}</p>
                <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#666' }}>{crm || 'CRM _______________'}</p>
                {especialidade && <p style={{ margin: '3px 0 0', fontSize: '11px', color: '#888' }}>{especialidade}</p>}
              </div>
            </div>
          </div>
          <RodapeImpresso />
        </div>
      </div>
    </div>
  );
}

export function ImprimirAtendimentoPage() {
  const { pacienteId, registroId } = useParams();
  const [paciente, setPaciente] = React.useState(null);
  const [registro, setRegistro] = React.useState(null);
  const [carregando, setCarregando] = React.useState(true);

  React.useEffect(() => {
    Promise.all([
      pacientesService.buscarPorId(pacienteId),
      registrosService.buscarPorId(registroId),
    ])
      .then(([p, r]) => { setPaciente(p); setRegistro(r); })
      .catch(console.error)
      .finally(() => setCarregando(false));
  }, [pacienteId, registroId]);

  if (carregando) return <div style={{ padding: '40px', textAlign: 'center' }}>Carregando...</div>;
  if (!paciente || !registro) return <div style={{ padding: '40px' }}>Registro não encontrado.</div>;

  const comorbidades = [
    { label: 'HAS',          valor: paciente.has },
    { label: 'DM',           valor: paciente.dm },
    { label: 'DAC',          valor: paciente.dac },
    { label: 'Dislipidemia', valor: paciente.dislipidemia },
    { label: 'Tabagismo',    valor: paciente.tabagismo },
    { label: 'Etilismo',     valor: paciente.etilismo },
  ].filter(c => c.valor && c.valor !== 'Não' && c.valor !== '');

  return (
    <div>
      {/* Barra de ações — oculta na impressão */}
      <div className="no-print" style={{ padding: '12px 24px', backgroundColor: '#f3f4f6', borderBottom: '1px solid #ddd', display: 'flex', gap: '12px', alignItems: 'center' }}>
        <button onClick={() => window.print()} style={{ padding: '9px 20px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' }}>
          🖨️ Imprimir
        </button>
        <button onClick={() => window.close()} style={{ padding: '9px 16px', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '14px' }}>
          Fechar
        </button>
        <span style={{ fontSize: '13px', color: '#555' }}>
          {paciente.nome} — {registro.data} às {registro.hora}
        </span>
      </div>

      {/* Documento */}
      <div className="doc-preview" style={{ maxWidth: '800px', margin: '20px auto', fontFamily: 'Arial, sans-serif', fontSize: '14px', lineHeight: '1.6' }}>
        <CabecalhoImpresso paciente={paciente} />

        {/* Título e data */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
          <h2 style={{ margin: 0, fontSize: '16px', letterSpacing: '2px', textTransform: 'uppercase' }}>
            {registro.retificacaoDe ? 'Retificação de Registro' : 'Registro de Atendimento'}
          </h2>
          <span style={{ fontSize: '13px', color: '#555' }}>{registro.data} às {registro.hora}</span>
        </div>
        <p style={{ margin: '0 0 20px', fontSize: '12px', color: registro.status === 'Rascunho' ? '#b45309' : '#555' }}>
          {registro.status === 'Rascunho' ? '⚠ Rascunho — ainda não assinado' : '🔒 Assinado'}
        </p>
        {registro.retificacaoDe && registro.motivoRetificacao && (
          <p style={{ margin: '0 0 20px', fontSize: '13px', color: '#92400e', backgroundColor: '#fffbeb', border: '1px solid #fde68a', borderRadius: '4px', padding: '8px 10px' }}>
            <strong>Motivo da retificação:</strong> {registro.motivoRetificacao}
          </p>
        )}

        {/* Antecedentes médicos */}
        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ fontSize: '13px', textTransform: 'uppercase', letterSpacing: '1px', borderBottom: '1px solid #ddd', paddingBottom: '6px', margin: '0 0 12px', color: '#333' }}>
            Antecedentes Médicos
          </h3>
          {comorbidades.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
              {comorbidades.map(c => (
                <span key={c.label} style={{ padding: '3px 12px', backgroundColor: '#fee2e2', color: '#991b1b', border: '1px solid #fecaca', borderRadius: '12px', fontSize: '13px', fontWeight: 'bold' }}>
                  {c.label}{c.valor !== 'Sim' ? `: ${c.valor}` : ''}
                </span>
              ))}
            </div>
          )}
          {!comorbidades.length && <p style={{ color: '#999', margin: '0 0 8px' }}>Sem comorbidades registradas.</p>}
          {paciente.cirurgias && <p style={{ margin: '4px 0' }}><strong>Cirurgias prévias:</strong> {paciente.cirurgias}</p>}
          {paciente.medicamentosUso && <p style={{ margin: '4px 0' }}><strong>Medicamentos em uso:</strong> {paciente.medicamentosUso}</p>}
          {paciente.alergias && <p style={{ margin: '4px 0', color: '#dc2626', fontWeight: 'bold' }}>⚠ Alergias: {paciente.alergias}</p>}
        </div>

        {/* História clínica */}
        <div style={{ marginBottom: '50px' }}>
          <h3 style={{ fontSize: '13px', textTransform: 'uppercase', letterSpacing: '1px', borderBottom: '1px solid #ddd', paddingBottom: '6px', margin: '0 0 12px', color: '#333' }}>
            {registro.tipo === 'Consulta' ? 'História Clínica' : registro.titulo}
          </h3>
          <p style={{ margin: 0, whiteSpace: 'pre-wrap', lineHeight: '1.9', textAlign: 'justify' }}>{registro.conteudo}</p>
        </div>

        {/* Assinatura */}
        <div style={{ marginTop: '50px', textAlign: 'right' }}>
          <p style={{ marginBottom: '50px', fontSize: '13px' }}>{registro.data}</p>
          <div style={{ display: 'inline-block', textAlign: 'center', minWidth: '280px' }}>
            <div style={{ borderTop: '1px solid #333', paddingTop: '8px' }}>
              {registro.assinadoPorNome ? (
                <>
                  <p style={{ margin: 0, fontWeight: 'bold', fontSize: '13px' }}>{registro.assinadoPorNome}</p>
                  {registro.assinadoPorRegistro && <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#666' }}>{registro.assinadoPorRegistro}</p>}
                  {registro.assinadoEm && (
                    <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#888' }}>
                      Assinado em {new Date(registro.assinadoEm).toLocaleString('pt-BR')}
                    </p>
                  )}
                </>
              ) : (
                <p style={{ margin: 0, fontSize: '13px' }}>Assinatura e carimbo do profissional</p>
              )}
            </div>
          </div>
        </div>
        <RodapeImpresso />
      </div>
    </div>
  );
}

const TIPOS_EXAME = [
  'Eletrocardiograma (ECG)',
  'Ecocardiograma transtorácico',
  'Ecocardiograma transesofágico',
  'Teste ergométrico',
  'Holter 24 horas',
  'MAPA 24 horas',
  'Cintilografia miocárdica',
  'Angiotomografia coronariana',
  'Ressonância magnética cardíaca',
  'Radiografia de tórax',
  'Ultrassom de abdome',
  'Doppler de carótidas',
  'Doppler venoso de MMII',
  'Espirometria',
  'Outro',
];

export function LaudoPage({ pacientes, setPacientes }) {
  const toast = useToast();
  const { user } = useAuth();
  const { paciente } = usePacienteAtual(pacientes);
  const hojeISO = new Date().toISOString().split('T')[0];

  const { medico, crm, especialidade } = useMedicoPerfil();
  const [dataExame, setDataExame]         = React.useState(hojeISO);
  const [tipoExame, setTipoExame]         = React.useState('');
  const [tipoOutro, setTipoOutro]         = React.useState('');
  const [achados, setAchados]             = React.useState('');
  const [conclusao, setConclusao]         = React.useState('');
  const [salvo, setSalvo]                 = React.useState(false);
  const [salvando, setSalvando]           = React.useState(false);

  if (!paciente) return <p>Paciente não encontrado.</p>;

  const nomeExame = tipoExame === 'Outro' ? tipoOutro : tipoExame;
  const dataFormatada = new Date(dataExame + 'T12:00:00').toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });

  const salvarNoProntuario = async () => {
    if (!achados && !conclusao) return;
    setSalvando(true);
    const conteudo = [
      `Exame: ${nomeExame || 'Não informado'}`,
      achados   ? `\nACHADOS:\n${achados}`   : null,
      conclusao ? `\nCONCLUSÃO:\n${conclusao}` : null,
    ].filter(Boolean).join('\n');
    const registro = {
      tipo: 'Laudo',
      titulo: `Laudo — ${nomeExame || 'Exame'}`,
      conteudo,
    };
    try {
      const salvoDb = await comTimeout(registrosService.criar(registro, paciente.id, user?.id));
      setPacientes(pacientes.map(p =>
        p.id === paciente.id ? { ...p, registros: [salvoDb, ...(p.registros || [])] } : p
      ));
      setSalvo(true);
    } catch (err) {
      toast.error('Erro ao salvar: ' + err.message);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div>
      <div className="no-print">
        <Header />
        <Link to={`/prontuario/${paciente.id}`}>← Voltar ao prontuário</Link>
      </div>

      {/* Formulário */}
      <div className="no-print" style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', margin: '16px 0', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
        <h3 style={{ marginTop: 0 }}>Laudo — {paciente.nome}</h3>
        <div style={{ marginBottom: '14px' }}>
          <label style={{ fontSize: '13px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Data do exame</label>
          <input type="date" value={dataExame} onChange={e => setDataExame(e.target.value)} style={{ padding: '8px', fontSize: '14px' }} />
        </div>

        <div style={{ marginBottom: '14px' }}>
          <label style={{ fontSize: '13px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Tipo de exame</label>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <select value={tipoExame} onChange={e => setTipoExame(e.target.value)} style={{ padding: '8px', fontSize: '14px', flex: '1', minWidth: '200px' }}>
              <option value="">Selecione o exame...</option>
              {TIPOS_EXAME.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            {tipoExame === 'Outro' && (
              <input value={tipoOutro} onChange={e => setTipoOutro(e.target.value)} placeholder="Descreva o exame" style={{ padding: '8px', fontSize: '14px', flex: '2', minWidth: '200px' }} />
            )}
          </div>
        </div>

        <div style={{ marginBottom: '14px' }}>
          <label style={{ fontSize: '13px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Achados / Descrição</label>
          <textarea value={achados} onChange={e => setAchados(e.target.value)} rows={7} placeholder="Descreva os achados do exame..." style={{ width: '100%', padding: '8px', fontSize: '14px', borderRadius: '4px', border: '1px solid #d1d5db', resize: 'vertical' }} />
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={{ fontSize: '13px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Conclusão / Impressão diagnóstica</label>
          <textarea value={conclusao} onChange={e => setConclusao(e.target.value)} rows={4} placeholder="Conclusão do laudo..." style={{ width: '100%', padding: '8px', fontSize: '14px', borderRadius: '4px', border: '1px solid #d1d5db', resize: 'vertical' }} />
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button onClick={salvarNoProntuario} disabled={salvando || (!achados && !conclusao)} style={{ padding: '10px 18px', backgroundColor: salvando || (!achados && !conclusao) ? '#9ca3af' : '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
            {salvando ? 'Salvando...' : '✓ Salvar no Prontuário'}
          </button>
          <button onClick={() => window.print()} disabled={!achados && !conclusao} style={{ padding: '10px 18px', backgroundColor: !achados && !conclusao ? '#9ca3af' : '#7c3aed', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
            🖨️ Imprimir
          </button>
          {salvo && <span style={{ color: '#28a745', fontSize: '14px', fontWeight: 'bold' }}>✓ Salvo no histórico!</span>}
        </div>
      </div>

      {/* Documento para impressão */}
      <div className="doc-preview">
        <CabecalhoImpresso paciente={paciente} />
        <h2 style={{ textAlign: 'center', letterSpacing: '4px', fontSize: '18px', margin: '0 0 6px' }}>LAUDO</h2>
        {nomeExame && <p style={{ textAlign: 'center', color: '#555', fontSize: '14px', margin: '0 0 20px' }}>{nomeExame}</p>}

        <div style={{ borderTop: '1px solid #ddd', paddingTop: '14px', marginBottom: '14px', fontSize: '13px' }}>
          <span><strong>Data do exame:</strong> {dataFormatada}</span>
        </div>

        {achados && (
          <div style={{ marginBottom: '20px' }}>
            <h3 style={{ fontSize: '13px', textTransform: 'uppercase', letterSpacing: '1px', borderBottom: '1px solid #eee', paddingBottom: '4px', margin: '0 0 10px' }}>Achados</h3>
            <p style={{ fontSize: '14px', lineHeight: '1.9', margin: 0, whiteSpace: 'pre-wrap', textAlign: 'justify' }}>{achados}</p>
          </div>
        )}

        {conclusao && (
          <div style={{ marginBottom: '20px' }}>
            <h3 style={{ fontSize: '13px', textTransform: 'uppercase', letterSpacing: '1px', borderBottom: '1px solid #eee', paddingBottom: '4px', margin: '0 0 10px' }}>Conclusão</h3>
            <p style={{ fontSize: '14px', lineHeight: '1.9', margin: 0, whiteSpace: 'pre-wrap', textAlign: 'justify' }}>{conclusao}</p>
          </div>
        )}

        {!achados && !conclusao && (
          <p style={{ color: '#bbb', textAlign: 'center', fontStyle: 'italic', margin: '40px 0' }}>Preencha os campos acima para visualizar o laudo</p>
        )}

        <div style={{ marginTop: '60px', textAlign: 'right' }}>
          <p style={{ marginBottom: '50px', fontSize: '13px' }}>{dataFormatada}</p>
          <div style={{ display: 'inline-block', textAlign: 'center', minWidth: '280px' }}>
            <div style={{ borderTop: '1px solid #333', paddingTop: '8px' }}>
              <p style={{ margin: 0, fontWeight: 'bold' }}>{medico || '_______________________________'}</p>
              <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#666' }}>{crm || 'CRM _______________'}</p>
              {especialidade && <p style={{ margin: '3px 0 0', fontSize: '11px', color: '#888' }}>{especialidade}</p>}
            </div>
          </div>
        </div>
        <RodapeImpresso />
      </div>
    </div>
  );
}

export function PedidoExamesPage({ pacientes, setPacientes }) {
  const toast = useToast();
  const { user } = useAuth();
  const { clinica } = useClinica();
  const { paciente } = usePacienteAtual(pacientes);
  const hojeISO = new Date().toISOString().split('T')[0];

  const { medico, crm, especialidade } = useMedicoPerfil();
  const [dataExame, setDataExame]         = React.useState(hojeISO);
  const [indicacao, setIndicacao]         = React.useState('');
  const [cid, setCid]                     = React.useState('');
  const [numeroBenef, setNumeroBenef]     = React.useState('');
  const [validadeCart, setValidadeCart]   = React.useState('');
  const [examesSel, setExamesSel]         = React.useState(new Set());
  const [modo, setModo]                   = React.useState('receituario');
  const [salvo, setSalvo]                 = React.useState(false);
  const [salvando, setSalvando]           = React.useState(false);

  if (!paciente) return <p>Paciente não encontrado.</p>;

  const toggle = (exId) => setExamesSel(prev => {
    const n = new Set(prev);
    n.has(exId) ? n.delete(exId) : n.add(exId);
    return n;
  });

  const examsPorCategoria = EXAMES_DISPONIVEIS
    .map(cat => ({ ...cat, exames: cat.exames.filter(e => examesSel.has(e.id)) }))
    .filter(cat => cat.exames.length > 0);

  const todosExamesSel = EXAMES_DISPONIVEIS.flatMap(c => c.exames).filter(e => examesSel.has(e.id));

  const dataFormatada = new Date(dataExame + 'T12:00:00').toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });

  const salvarNoProntuario = async () => {
    if (todosExamesSel.length === 0) {
      toast.warning('Selecione pelo menos um exame antes de salvar.');
      return;
    }

    const conteudo = examsPorCategoria.map(cat =>
      `${cat.categoria}:\n` + cat.exames.map(e => `  • ${e.nome}`).join('\n')
    ).join('\n\n') + (indicacao ? `\n\nIndicação: ${indicacao}` : '') + (cid ? `  CID: ${cid}` : '');

    const registro = { tipo: 'Pedido de Exames', titulo: `Pedido de Exames — ${todosExamesSel.length} exame(s)`, conteudo };
    setSalvando(true);
    const resultado = await salvarRegistroComFallback({ registro, paciente, userId: user?.id, pacientes, setPacientes, contexto: 'pedido de exames' });
    setSalvando(false);
    if (!resultado.ok) {
      toast.error('Não foi possível gravar no servidor: ' + resultado.error.message + '. Tente salvar de novo.');
      return;
    }
    setSalvo(true);
  };

  const btnModo = (m, label) => (
    <button onClick={() => setModo(m)} style={{ padding: '7px 16px', backgroundColor: modo === m ? '#1d4ed8' : '#e5e7eb', color: modo === m ? 'white' : '#374151', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: modo === m ? 'bold' : 'normal', fontSize: '13px' }}>
      {label}
    </button>
  );

  return (
    <div>
      <div className="no-print">
        <Header />
        <Link to={`/prontuario/${paciente.id}`}>← Voltar ao prontuário</Link>
      </div>

      {/* Formulário */}
      <div className="no-print" style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', margin: '16px 0', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
        <h3 style={{ marginTop: 0 }}>Pedido de Exames — {paciente.nome}</h3>
        <div style={{ marginBottom: '14px' }}>
          <label style={{ fontSize: '13px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Data</label>
          <input type="date" value={dataExame} onChange={e => setDataExame(e.target.value)} style={{ padding: '8px', fontSize: '14px' }} />
        </div>

        {/* Dados TISS (só mostram quando modo TISS) */}
        {modo === 'tiss' && (
          <div className="form-grid-3col" style={{ marginBottom: '14px', padding: '12px', backgroundColor: '#eff6ff', borderRadius: '6px' }}>
            <div>
              <label style={{ fontSize: '13px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Convênio</label>
              <input value={paciente.convenio || ''} readOnly style={{ width: '100%', padding: '8px', backgroundColor: '#f8fafc' }} />
            </div>
            <div>
              <label style={{ fontSize: '13px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Nº Carteira do Beneficiário</label>
              <input value={numeroBenef} onChange={e => setNumeroBenef(e.target.value)} placeholder="000000000000000" style={{ width: '100%', padding: '8px' }} />
            </div>
            <div>
              <label style={{ fontSize: '13px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Validade da Carteira</label>
              <input type="date" value={validadeCart} onChange={e => setValidadeCart(e.target.value)} style={{ width: '100%', padding: '8px' }} />
            </div>
          </div>
        )}

        {/* Indicação e CID */}
        <div className="form-grid-3col" style={{ marginBottom: '16px' }}>
          <div style={{ gridColumn: 'span 2' }}>
            <label style={{ fontSize: '13px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Indicação clínica</label>
            <input value={indicacao} onChange={e => setIndicacao(e.target.value)} placeholder="Ex: Hipertensão arterial, investigação de dislipidemia..." style={{ width: '100%', padding: '8px' }} />
          </div>
          <div>
            <label style={{ fontSize: '13px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>CID</label>
            <input value={cid} onChange={e => setCid(e.target.value)} placeholder="Ex: I10" style={{ width: '100%', padding: '8px' }} />
          </div>
        </div>

        {/* Seleção de exames */}
        <div style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '14px', marginBottom: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <strong style={{ fontSize: '14px' }}>Selecione os exames</strong>
            <span style={{ fontSize: '12px', backgroundColor: examesSel.size > 0 ? '#dbeafe' : '#f3f4f6', color: examesSel.size > 0 ? '#1d4ed8' : '#6b7280', padding: '3px 10px', borderRadius: '10px', fontWeight: 'bold' }}>
              {examesSel.size} selecionado(s)
            </span>
          </div>
          {EXAMES_DISPONIVEIS.map(cat => (
            <div key={cat.categoria} style={{ marginBottom: '12px' }}>
              <div style={{ fontSize: '12px', fontWeight: '700', color: '#374151', borderBottom: '1px solid #f3f4f6', paddingBottom: '4px', marginBottom: '6px' }}>
                {cat.categoria}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                {cat.exames.map(ex => {
                  const sel = examesSel.has(ex.id);
                  return (
                    <button key={ex.id} onClick={() => toggle(ex.id)} style={{ padding: '4px 10px', fontSize: '12px', backgroundColor: sel ? '#dbeafe' : '#f9fafb', color: sel ? '#1d4ed8' : '#374151', border: `1px solid ${sel ? '#93c5fd' : '#e5e7eb'}`, borderRadius: '4px', cursor: 'pointer', fontWeight: sel ? '700' : '400' }}>
                      {sel ? '✓ ' : ''}{ex.nome}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Ações */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button onClick={salvarNoProntuario} disabled={examesSel.size === 0 || salvando} style={{ padding: '9px 16px', backgroundColor: (examesSel.size === 0 || salvando) ? '#9ca3af' : '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: (examesSel.size === 0 || salvando) ? 'not-allowed' : 'pointer', fontWeight: 'bold', fontSize: '13px' }}>
            {salvando ? 'Salvando...' : '✓ Salvar no Prontuário'}
          </button>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', color: '#6b7280' }}>Visualizar como:</span>
            {btnModo('receituario', '📋 Receituário')}
            {btnModo('tiss', '📄 Guia TISS')}
          </div>
          <button onClick={() => window.print()} disabled={examesSel.size === 0} style={{ padding: '9px 16px', backgroundColor: examesSel.size === 0 ? '#9ca3af' : '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: examesSel.size === 0 ? 'not-allowed' : 'pointer', fontWeight: 'bold', fontSize: '13px' }}>
            🖨️ Imprimir
          </button>
          {salvo && <span style={{ color: '#28a745', fontSize: '13px', fontWeight: 'bold' }}>✓ Salvo!</span>}
        </div>
      </div>

      {/* ===== PREVIEW RECEITUÁRIO ===== */}
      {modo === 'receituario' && (
        <div className="doc-preview">
          <CabecalhoImpresso paciente={paciente} />
          <h2 style={{ textAlign: 'center', letterSpacing: '4px', fontSize: '17px', margin: '0 0 24px' }}>PEDIDO DE EXAMES</h2>

          {examsPorCategoria.length === 0
            ? <p style={{ color: '#bbb', textAlign: 'center', fontStyle: 'italic' }}>Nenhum exame selecionado</p>
            : examsPorCategoria.map(cat => (
              <div key={cat.categoria} style={{ marginBottom: '16px' }}>
                <p style={{ margin: '0 0 6px', fontWeight: 'bold', fontSize: '13px', textTransform: 'uppercase', color: '#374151', borderBottom: '1px solid #eee', paddingBottom: '3px' }}>{cat.categoria}</p>
                {cat.exames.map(e => <p key={e.id} style={{ margin: '3px 0 3px 12px', fontSize: '14px' }}>• {e.nome}</p>)}
              </div>
            ))
          }

          {(indicacao || cid) && (
            <div style={{ marginTop: '16px', padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '4px', fontSize: '13px' }}>
              {indicacao && <p style={{ margin: '2px 0' }}><strong>Indicação:</strong> {indicacao}</p>}
              {cid && <p style={{ margin: '2px 0' }}><strong>CID:</strong> {cid}</p>}
            </div>
          )}

          <div style={{ marginTop: '50px', textAlign: 'right' }}>
            <p style={{ marginBottom: '50px', fontSize: '13px' }}>{dataFormatada}</p>
            <div style={{ display: 'inline-block', textAlign: 'center', minWidth: '280px' }}>
              <div style={{ borderTop: '1px solid #333', paddingTop: '8px' }}>
                <p style={{ margin: 0, fontWeight: 'bold' }}>{medico || '_______________________________'}</p>
                <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#666' }}>{crm || 'CRM _______________'}</p>
                {especialidade && <p style={{ margin: '3px 0 0', fontSize: '11px', color: '#888' }}>{especialidade}</p>}
              </div>
            </div>
          </div>
          <RodapeImpresso />
        </div>
      )}

      {/* ===== PREVIEW GUIA TISS ===== */}
      {modo === 'tiss' && (
        <div style={{ backgroundColor: 'white', padding: '24px 28px', borderRadius: '8px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', fontFamily: 'Arial, sans-serif', fontSize: '11px' }}>
          {/* Cabeçalho TISS */}
          <div style={{ border: '2px solid #222', marginBottom: '0' }}>
            <div style={{ backgroundColor: '#1d4ed8', color: 'white', padding: '6px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <LogoClinica size={28} />
                <div>
                  <div style={{ fontWeight: 'bold', fontSize: '13px' }}>{clinica.nome}</div>
                  <div style={{ fontSize: '10px', opacity: 0.85 }}>{clinica.nomeFantasia}</div>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 'bold', fontSize: '12px' }}>GUIA DE SOLICITAÇÃO DE EXAME</div>
                <div style={{ fontSize: '10px' }}>Padrão TISS — ANS</div>
              </div>
            </div>

            {/* Linha 1: Nº guia / Operadora / Data */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', borderBottom: '1px solid #aaa' }}>
              {[['Nº Guia do Prestador', ''], ['Nº Guia Operadora', ''], ['Data de Emissão', dataFormatada]].map(([l, v], i) => (
                <div key={i} style={{ padding: '4px 8px', borderRight: i < 2 ? '1px solid #aaa' : 'none' }}>
                  <div style={{ fontSize: '9px', color: '#555', marginBottom: '2px' }}>{l}</div>
                  <div style={{ fontWeight: 'bold', minHeight: '14px' }}>{v}</div>
                </div>
              ))}
            </div>

            {/* Dados do beneficiário */}
            <div style={{ borderBottom: '1px solid #aaa' }}>
              <div style={{ backgroundColor: '#f3f4f6', padding: '3px 8px', fontSize: '10px', fontWeight: 'bold', borderBottom: '1px solid #ddd' }}>DADOS DO BENEFICIÁRIO</div>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', padding: '4px 0' }}>
                {[['Nome do Beneficiário', paciente.nome], ['Nº Carteira', numeroBenef || '_______________'], ['Validade', validadeCart ? new Date(validadeCart + 'T12:00:00').toLocaleDateString('pt-BR') : '__/__/____']].map(([l, v], i) => (
                  <div key={i} style={{ padding: '3px 8px', borderRight: i < 2 ? '1px solid #ddd' : 'none' }}>
                    <div style={{ fontSize: '9px', color: '#555', marginBottom: '2px' }}>{l}</div>
                    <div style={{ fontWeight: 'bold' }}>{v}</div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', padding: '0', borderTop: '1px solid #ddd' }}>
                {[['Plano / Produto', paciente.convenio || '_______________'], ['CPF', paciente.cpf || '___.___.___-__']].map(([l, v], i) => (
                  <div key={i} style={{ padding: '3px 8px', borderRight: i === 0 ? '1px solid #ddd' : 'none' }}>
                    <div style={{ fontSize: '9px', color: '#555', marginBottom: '2px' }}>{l}</div>
                    <div style={{ fontWeight: 'bold' }}>{v}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Dados do prestador */}
            <div style={{ borderBottom: '1px solid #aaa' }}>
              <div style={{ backgroundColor: '#f3f4f6', padding: '3px 8px', fontSize: '10px', fontWeight: 'bold', borderBottom: '1px solid #ddd' }}>DADOS DO PRESTADOR SOLICITANTE</div>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', padding: '4px 0' }}>
                {[['Nome do Prestador', clinica.nome], ['Código CNES', '0000000'], ['CRM Médico', crm || '___________']].map(([l, v], i) => (
                  <div key={i} style={{ padding: '3px 8px', borderRight: i < 2 ? '1px solid #ddd' : 'none' }}>
                    <div style={{ fontSize: '9px', color: '#555', marginBottom: '2px' }}>{l}</div>
                    <div style={{ fontWeight: 'bold' }}>{v}</div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', borderTop: '1px solid #ddd' }}>
                <div style={{ padding: '3px 8px', borderRight: '1px solid #ddd' }}>
                  <div style={{ fontSize: '9px', color: '#555', marginBottom: '2px' }}>Nome do Médico Solicitante</div>
                  <div style={{ fontWeight: 'bold' }}>{medico || '_______________________________'}</div>
                </div>
                <div style={{ padding: '3px 8px' }}>
                  <div style={{ fontSize: '9px', color: '#555', marginBottom: '2px' }}>CID Principal</div>
                  <div style={{ fontWeight: 'bold' }}>{cid || '______'}</div>
                </div>
              </div>
            </div>

            {/* Indicação */}
            {indicacao && (
              <div style={{ borderBottom: '1px solid #aaa', padding: '4px 8px' }}>
                <span style={{ fontSize: '9px', color: '#555' }}>Indicação clínica: </span>
                <span style={{ fontWeight: 'bold' }}>{indicacao}</span>
              </div>
            )}

            {/* Tabela de exames */}
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#f3f4f6' }}>
                  {['Cód. TUSS', 'Descrição do Procedimento', 'Qtd.', 'Tp. Atend.', 'Autorizado', 'Qtd. Aut.'].map((h, i) => (
                    <th key={i} style={{ padding: '4px 6px', textAlign: 'left', fontSize: '9px', borderBottom: '1px solid #aaa', borderRight: '1px solid #ddd', fontWeight: 'bold' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {todosExamesSel.length === 0
                  ? <tr><td colSpan={6} style={{ padding: '8px', textAlign: 'center', color: '#aaa', fontStyle: 'italic' }}>Nenhum exame selecionado</td></tr>
                  : todosExamesSel.map((ex, i) => (
                    <tr key={ex.id} style={{ backgroundColor: i % 2 === 0 ? 'white' : '#fafafa' }}>
                      <td style={{ padding: '4px 6px', borderBottom: '1px solid #eee', borderRight: '1px solid #ddd', fontWeight: 'bold' }}>{ex.tuss}</td>
                      <td style={{ padding: '4px 6px', borderBottom: '1px solid #eee', borderRight: '1px solid #ddd' }}>{ex.nome}</td>
                      <td style={{ padding: '4px 6px', borderBottom: '1px solid #eee', borderRight: '1px solid #ddd', textAlign: 'center' }}>1</td>
                      <td style={{ padding: '4px 6px', borderBottom: '1px solid #eee', borderRight: '1px solid #ddd', textAlign: 'center' }}>AMB</td>
                      <td style={{ padding: '4px 6px', borderBottom: '1px solid #eee', borderRight: '1px solid #ddd', minWidth: '60px' }}>&nbsp;</td>
                      <td style={{ padding: '4px 6px', borderBottom: '1px solid #eee', minWidth: '50px' }}>&nbsp;</td>
                    </tr>
                  ))
                }
              </tbody>
            </table>

            {/* Assinaturas */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderTop: '1px solid #aaa' }}>
              <div style={{ padding: '8px', borderRight: '1px solid #aaa', minHeight: '55px' }}>
                <div style={{ fontSize: '9px', color: '#555', marginBottom: '4px' }}>Assinatura e carimbo do médico solicitante</div>
                <div style={{ borderTop: '1px solid #333', marginTop: '30px', paddingTop: '4px', fontSize: '9px', textAlign: 'center' }}>
                  {medico || '_______________________________'}{crm ? ` — ${crm}` : ''}{especialidade ? ` — ${especialidade}` : ''}
                </div>
              </div>
              <div style={{ padding: '8px', minHeight: '55px' }}>
                <div style={{ fontSize: '9px', color: '#555', marginBottom: '4px' }}>Assinatura do beneficiário / responsável</div>
                <div style={{ borderTop: '1px solid #333', marginTop: '30px', paddingTop: '4px', fontSize: '9px', textAlign: 'center' }}>
                  {paciente.nome}
                </div>
              </div>
            </div>
          </div>

          <div style={{ marginTop: '8px', fontSize: '9px', color: '#888', textAlign: 'center' }}>
            {clinica.endereco} — {clinica.cidade} — {clinica.telefone}
          </div>
        </div>
      )}
    </div>
  );
}

export function DocumentoPage({ titulo, pacientes }) {
  const { paciente } = usePacienteAtual(pacientes);

  if (!paciente) {
    return <p>Paciente não encontrado.</p>;
  }

  return (
    <div>
      <Header />

      <Link to={`/prontuario/${paciente.id}`}>← Voltar ao prontuário</Link>

      <div style={{
        backgroundColor: 'white',
        padding: '25px',
        borderRadius: '8px',
        marginTop: '20px'
      }}>
        <h2>{titulo}</h2>
        <p><strong>Paciente:</strong> {paciente.nome}</p>
        <p><strong>CPF:</strong> {paciente.cpf}</p>

        <textarea
          placeholder={`Digite aqui o conteúdo de ${titulo.toLowerCase()}...`}
          rows={12}
          style={{
            width: '100%',
            padding: '12px',
            marginTop: '15px',
            fontSize: '16px'
          }}
        />

        <button style={{
          marginTop: '12px',
          padding: '12px 20px',
          backgroundColor: '#007bff',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer'
        }}>
          Salvar {titulo}
        </button>
      </div>
    </div>
  );
}
