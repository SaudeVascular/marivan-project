import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useClinica } from '../../hooks/useClinica';
import { usePacienteAtual } from '../../hooks/usePacienteAtual';
import { useMedicoPerfil } from '../../hooks/useMedicoPerfil';
import { Header, CabecalhoImpresso, RodapeImpresso } from '../../components/common/Layout';
import { useToast } from '../../components/common/Toast';
import { pacientesService } from '../../services/pacientes.service';
import { registrosService, salvarRegistroComFallback } from '../../services/registros.service';
import { modelosService } from '../../services/modelos.service';
import { examesService } from '../../services/exames.service';
import { pontuarCorrespondencia } from '../../utils/buscaExames';
import { comTimeout } from '../../utils/comTimeout';
import { dataLocalISO } from '../../utils/formatters';
import { iniciarJanelaImpressao, concluirJanelaImpressao } from '../../utils/janelaImpressao';
// Import dinâmico (não estático) de propósito: pdfmake sozinho soma mais
// de 800kB ao pacote inicial (fontes embutidas em base64) — carregado à
// toa em toda tela do app, inclusive quem nunca abre um documento.
// `import()` faz o webpack colocar isso num arquivo separado, baixado só
// quando alguém realmente clica em Imprimir.
const carregarCriarPdfDocumento = () => import('../../utils/documentoPdf')
  .then(async m => { await m.prepararLogoPep(); return m.criarPdfDocumento; });
const carregarCriarPdfGuiaSadt = () => import('../../utils/guiaSadtPdf').then(m => m.criarPdfGuiaSadt);


// Catálogo de exames (laboratoriais/imagem, com código TUSS) agora vem
// do banco — ver services/exames.service.js e Administração → Catálogo
// de Exames — em vez de uma lista fixa aqui, que só um deploy novo
// conseguia alterar. O médico digita o nome/código e escolhe da busca
// (ver PedidoExamesPage); sem agrupamento por categoria na tela nem no
// papel impresso.
const TEXTO_ATESTADO = {
  'Médico': { titulo: 'Atestado Médico', cuidados: 'médicos' },
  'Psicólogo(a)': { titulo: 'Atestado Psicológico', cuidados: 'psicológicos' },
  'Fisioterapeuta': { titulo: 'Atestado Fisioterapêutico', cuidados: 'fisioterapêuticos' },
};

export function AtestadoPage({ pacientes, setPacientes }) {
  const toast = useToast();
  const { user, funcaoClinicaEfetiva } = useAuth();
  const { clinica } = useClinica();
  const { paciente } = usePacienteAtual(pacientes);
  const hojeISO = dataLocalISO();

  const { medico, crm, especialidade, assinaturaImagem } = useMedicoPerfil();
  const [dias, setDias] = React.useState('1');
  const [dataAtestado, setDataAtestado] = React.useState(hojeISO);
  const [cid, setCid] = React.useState('');
  // Psicólogo(a)/Fisioterapeuta também emitem atestado (migração 35) —
  // título e texto acompanham a profissão de quem assina.
  const { titulo: tituloAtestado, cuidados } = TEXTO_ATESTADO[funcaoClinicaEfetiva] || TEXTO_ATESTADO['Médico'];
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
      return false;
    }

    const conteudo = [
      `Profissional: ${medico || 'Não informado'} | ${crm || 'Registro não informado'}`,
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
      return false;
    }
    setSalvo(true);
    return true;
  };

  // Documento clínico impresso sem estar gravado é o pior caso possível
  // (uma receita ou atestado entregue de verdade, sem existir no
  // prontuário) — por isso imprimir sempre garante o salvamento primeiro.
  // Se já estava salvo e nada mudou desde então (`salvo` continua true),
  // não grava de novo — evitaria duplicar o registro. A impressão em si
  // vira um PDF de verdade (ver utils/documentoPdf) — CSS de impressão do
  // navegador não repete cabeçalho/rodapé de forma confiável entre
  // navegadores (Safari em especial).
  const imprimirDocumento = async () => {
    // Precisa abrir a janela ANTES de qualquer await (ver
    // utils/janelaImpressao) — senão o navegador bloqueia como pop-up.
    const janela = iniciarJanelaImpressao();
    if (!salvo) {
      const ok = await salvarNoProntuario();
      if (!ok) { janela?.close(); return; }
    }
    const criarPdfDocumento = await carregarCriarPdfDocumento();
    concluirJanelaImpressao(janela, criarPdfDocumento({
      clinica,
      paciente,
      tituloDocumento: tituloAtestado.toUpperCase(),
      corpo: [
        {
          text: [
            'Atesto que o(a) paciente ', { text: paciente.nome, bold: true },
            paciente.cpf ? `, portador(a) do CPF ${paciente.cpf},` : ',',
            ` esteve sob meus cuidados ${cuidados} e necessita afastar-se de suas atividades por `,
            { text: `${dias} ${Number(dias) === 1 ? 'dia' : 'dias'}`, bold: true },
            `, a contar de ${dataFormatada}.`,
            cid ? ` CID: ${cid}.` : '',
          ],
          alignment: 'justify', lineHeight: 1.6, margin: [0, 0, 0, 12],
        },
        observacoes ? { text: observacoes, alignment: 'justify', lineHeight: 1.6 } : null,
      ].filter(Boolean),
      medico, crm, especialidade, assinaturaImagem,
      dataTexto: dataFormatada,
    }));
  };

  return (
    <fieldset disabled={salvando} onChange={() => setSalvo(false)} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
      <div className="no-print">
        <Header />
        <Link to={`/prontuario/${paciente.id}`}>← Voltar ao prontuário</Link>
      </div>
      <div style={{ maxWidth: '750px', margin: '20px auto' }}>
        <div className="no-print" style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', marginBottom: '16px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
          <h3 style={{ marginTop: 0 }}>{tituloAtestado}</h3>
          <div className="form-grid-3col" style={{ marginBottom: '12px' }}>
            <div>
              <label style={{ fontSize: '16px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Data</label>
              <input type="date" value={dataAtestado} onChange={(e) => setDataAtestado(e.target.value)} style={{ width: '100%', padding: '8px' }} />
            </div>
            <div>
              <label style={{ fontSize: '16px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Dias de afastamento</label>
              <input type="number" min="1" value={dias} onChange={(e) => setDias(e.target.value)} style={{ width: '100%', padding: '8px' }} />
            </div>
            <div>
              <label style={{ fontSize: '16px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>CID (opcional)</label>
              <input value={cid} onChange={(e) => setCid(e.target.value)} placeholder="Ex: Z00.0" style={{ width: '100%', padding: '8px' }} />
            </div>
          </div>
          <div style={{ marginBottom: '12px' }}>
            <label style={{ fontSize: '16px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Observações (opcional)</label>
            <textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} style={{ width: '100%', padding: '8px' }} rows={2} />
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button onClick={salvarNoProntuario} disabled={salvando} style={{ padding: '10px 18px', backgroundColor: salvando ? '#9ca3af' : '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: salvando ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}>
              {salvando ? 'Salvando...' : '✓ Salvar no Prontuário'}
            </button>
            <button onClick={imprimirDocumento} disabled={salvando} style={{ padding: '10px 18px', backgroundColor: salvando ? '#9ca3af' : '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: salvando ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}>
              🖨️ Imprimir
            </button>
            {salvo && <span style={{ color: '#28a745', fontSize: '16px', fontWeight: 'bold' }}>✓ Salvo no histórico!</span>}
          </div>
        </div>

        <div className="doc-preview">
          <div className="doc-cabecalho-grupo">
            <CabecalhoImpresso paciente={paciente} />
            <h2 style={{ textAlign: 'center', letterSpacing: '5px', fontSize: '18px', margin: '0 0 30px' }}>{tituloAtestado.toUpperCase()}</h2>
          </div>
          <div className="doc-corpo-grupo">
            <p style={{ fontSize: '16px', lineHeight: '2.2', textAlign: 'justify' }}>
              Atesto que o(a) paciente <strong>{paciente.nome}</strong>
              {paciente.cpf ? `, portador(a) do CPF ${paciente.cpf},` : ','} esteve sob meus cuidados {cuidados}
              e necessita afastar-se de suas atividades por{' '}
              <strong>{dias} {Number(dias) === 1 ? 'dia' : 'dias'}</strong>, a contar de {dataFormatada}.
              {cid && ` CID: ${cid}.`}
            </p>
            {observacoes && <p style={{ fontSize: '16px', lineHeight: '2', textAlign: 'justify' }}>{observacoes}</p>}
          </div>
          <div className="doc-rodape-grupo">
            <div className="assinatura-documento" style={{ marginTop: '60px', textAlign: 'right' }}>
              <p style={{ marginBottom: '50px', fontSize: '16px' }}>{dataFormatada}</p>
              <div style={{ display: 'inline-block', textAlign: 'center', minWidth: '280px' }}>
                <div style={{ borderTop: '1px solid #333', paddingTop: '8px' }}>
                  <p style={{ margin: '0', fontWeight: 'bold' }}>{medico || '_______________________________'}</p>
                  <p style={{ margin: '4px 0 0', fontSize: '16px', color: '#666' }}>{crm || 'CRM _______________'}</p>
                  {especialidade && <p style={{ margin: '3px 0 0', fontSize: '11px', color: '#888' }}>{especialidade}</p>}
                </div>
              </div>
            </div>
            <RodapeImpresso />
          </div>
        </div>
      </div>
    </fieldset>
  );
}

export function ReceituarioPage({ pacientes, setPacientes }) {
  const toast = useToast();
  const { user } = useAuth();
  const { clinica } = useClinica();
  const { paciente } = usePacienteAtual(pacientes);
  const hojeISO = dataLocalISO();

  const { medico, crm, especialidade, assinaturaImagem } = useMedicoPerfil();
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
      .catch(() => toast.error('Não foi possível carregar os modelos de receita. Recarregue a página para tentar novamente.'));
  }, [user?.id, toast]);

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
      return false;
    }

    const medsTexto = medicamentos
      .filter(m => m.nome)
      .map((m, idx) => {
        const linhas = [`${idx + 1}. ${m.nome}${m.dose ? ' ' + m.dose : ''}`];
        if (m.quantidade) linhas.push(`   Quantidade: ${m.quantidade}`);
        if (m.via) linhas.push(`   Administração: ${m.via}`);
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
      return false;
    }
    setSalvo(true);
    return true;
  };

  // Ver comentário equivalente em AtestadoPage: imprimir sempre grava
  // antes, para nunca existir uma receita entregue que não está no
  // prontuário. Vira PDF de verdade (utils/documentoPdf) pelo mesmo
  // motivo do Atestado — repetir cabeçalho/rodapé em toda página não é
  // confiável só com CSS de impressão do navegador.
  const imprimirDocumento = async () => {
    // Precisa abrir a janela ANTES de qualquer await (ver
    // utils/janelaImpressao) — senão o navegador bloqueia como pop-up.
    const janela = iniciarJanelaImpressao();
    if (!salvo) {
      const ok = await salvarNoProntuario();
      if (!ok) { janela?.close(); return; }
    }
    const medicamentosPreenchidos = medicamentos.filter(m => m.nome);

    // Nome e quantidade em texto simples, sem numeração nem traço
    // tracejado entre os dois.
    const linhaReceituario = (nomeDose, quantidadeTexto, extra) => ({
      margin: [0, 0, 0, 14],
      stack: [
        {
          text: quantidadeTexto
            ? [{ text: nomeDose, bold: true }, { text: `  —  ${quantidadeTexto}` }]
            : [{ text: nomeDose, bold: true }],
        },
        ...(extra || []),
      ],
    });

    const criarPdfDocumento = await carregarCriarPdfDocumento();
    concluirJanelaImpressao(janela, criarPdfDocumento({
      clinica,
      paciente,
      tituloDocumento: 'RECEITUÁRIO',
      corpo: [
        { text: 'R//', bold: true, fontSize: 11, margin: [0, 0, 0, 10] },
        ...medicamentosPreenchidos.map((med) => linhaReceituario(
          `${med.nome}${med.dose ? ' (' + med.dose + ')' : ''}`,
          med.quantidade,
          [
            (med.via || med.frequencia || med.duracao)
              ? { text: [{ text: 'Uso: ', bold: true }, [med.via, med.frequencia, med.duracao].filter(Boolean).join(' — ')], fontSize: 9, color: '#333', margin: [10, 2, 0, 0] }
              : null,
            med.instrucoes ? { text: med.instrucoes, italics: true, color: '#555', margin: [10, 2, 0, 0] } : null,
          ].filter(Boolean),
        )),
        textoLivre ? {
          text: textoLivre,
          margin: [0, medicamentosPreenchidos.length > 0 ? 10 : 0, 0, 0],
          lineHeight: 1.6,
        } : null,
      ].filter(Boolean),
      medico, crm, especialidade, assinaturaImagem,
      dataTexto: dataFormatada,
    }));
  };

  return (
    <fieldset disabled={salvandoReceituario} onChange={() => setSalvo(false)} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
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
                <strong style={{ fontSize: '16px', color: '#374151' }}>Medicamento {idx + 1}</strong>
                {medicamentos.length > 1 && (
                  <button onClick={() => removerMed(med.id)} style={{ padding: '2px 8px', backgroundColor: '#fee2e2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: '4px', cursor: 'pointer', fontSize: '16px' }}>Remover</button>
                )}
              </div>
              <div className="med-campos-principais" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '6px', marginBottom: '6px' }}>
                <input placeholder="Nome do medicamento *" value={med.nome} onChange={(e) => atualizarMed(med.id, 'nome', e.target.value)} style={{ padding: '7px', fontSize: '16px' }} />
                <input placeholder="Apresentação (ex: 50mg)" value={med.dose} onChange={(e) => atualizarMed(med.id, 'dose', e.target.value)} style={{ padding: '7px', fontSize: '16px' }} />
                <input placeholder="Quantidade (ex: 2 caixas)" value={med.quantidade} onChange={(e) => atualizarMed(med.id, 'quantidade', e.target.value)} style={{ padding: '7px', fontSize: '16px' }} />
              </div>
              <div className="med-campos-secundarios" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px', marginBottom: '6px' }}>
                <input placeholder="Administração (ex: via oral)" value={med.via} onChange={(e) => atualizarMed(med.id, 'via', e.target.value)} list="lista-vias" style={{ padding: '7px', fontSize: '16px' }} />
                <input placeholder="Frequência (ex: 1x ao dia)" value={med.frequencia} onChange={(e) => atualizarMed(med.id, 'frequencia', e.target.value)} style={{ padding: '7px', fontSize: '16px' }} />
                <input placeholder="Duração (ex: 30 dias)" value={med.duracao} onChange={(e) => atualizarMed(med.id, 'duracao', e.target.value)} style={{ padding: '7px', fontSize: '16px' }} />
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
              <input placeholder="Instruções (ex: tomar após as refeições)" value={med.instrucoes} onChange={(e) => atualizarMed(med.id, 'instrucoes', e.target.value)} style={{ width: '100%', padding: '7px', fontSize: '16px' }} />
            </div>
          ))}
          <div style={{ display: 'flex', gap: '10px', marginTop: '12px', marginBottom: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button onClick={adicionarMed} style={{ padding: '9px 16px', backgroundColor: '#e8f5e9', color: '#28a745', border: '1px solid #c8e6c9', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>+ Medicamento</button>
            <button onClick={salvarNoProntuario} disabled={salvandoReceituario} style={{ padding: '9px 16px', backgroundColor: salvandoReceituario ? '#9ca3af' : '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: salvandoReceituario ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}>{salvandoReceituario ? 'Salvando...' : '✓ Salvar no Prontuário'}</button>
            <button onClick={imprimirDocumento} disabled={salvandoReceituario} style={{ padding: '9px 16px', backgroundColor: salvandoReceituario ? '#9ca3af' : '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: salvandoReceituario ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}>🖨️ Imprimir</button>
            {salvo && <span style={{ color: '#28a745', fontSize: '16px', fontWeight: 'bold' }}>✓ Salvo no histórico!</span>}
          </div>

          {/* Texto livre */}
          <div style={{ borderTop: '1px dashed #d1d5db', paddingTop: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', flexWrap: 'wrap', gap: '8px' }}>
              <label style={{ fontSize: '16px', fontWeight: 'bold', color: '#374151' }}>
                Texto livre <span style={{ fontWeight: 'normal', color: '#9ca3af' }}>— escreva livremente ou cole uma prescrição</span>
              </label>
              {textoLivre.trim() && !salvandoModelo && (
                <button onClick={() => setSalvandoModelo(true)} style={{ fontSize: '16px', padding: '4px 10px', backgroundColor: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0', borderRadius: '4px', cursor: 'pointer' }}>
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
                      style={{ padding: '3px 10px', fontSize: '16px', color: '#1d4ed8', background: 'none', border: 'none', cursor: 'pointer', fontWeight: '500' }}
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
                  style={{ flex: 1, minWidth: '180px', padding: '6px 10px', fontSize: '16px', border: '1px solid #86efac', borderRadius: '4px', outline: 'none' }}
                />
                <button onClick={salvarModelo} disabled={gravandoModelo} style={{ padding: '6px 12px', backgroundColor: gravandoModelo ? '#9ca3af' : '#16a34a', color: 'white', border: 'none', borderRadius: '4px', cursor: gravandoModelo ? 'not-allowed' : 'pointer', fontSize: '16px', fontWeight: 'bold' }}>
                  {gravandoModelo ? 'Salvando...' : 'Salvar'}
                </button>
                <button onClick={() => { setSalvandoModelo(false); setNomeModelo(''); }} disabled={gravandoModelo} style={{ padding: '6px 10px', backgroundColor: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db', borderRadius: '4px', cursor: 'pointer', fontSize: '16px' }}>
                  Cancelar
                </button>
              </div>
            )}

            <textarea
              value={textoLivre}
              onChange={e => setTextoLivre(e.target.value)}
              rows={6}
              placeholder="Digite ou cole aqui medicamentos em formato livre..."
              style={{ width: '100%', padding: '10px', fontSize: '16px', border: '1px solid #d1d5db', borderRadius: '6px', resize: 'vertical', fontFamily: 'inherit', lineHeight: '1.6' }}
            />
          </div>
        </div>

        <div className="doc-preview">
          <div className="doc-cabecalho-grupo">
            <CabecalhoImpresso paciente={paciente} />
            <h2 style={{ textAlign: 'center', letterSpacing: '5px', fontSize: '18px', margin: '0 0 20px' }}>RECEITUÁRIO</h2>
            <hr style={{ margin: '0 0 20px', borderColor: '#ddd' }} />
          </div>
          <div className="doc-corpo-grupo">
          {medicamentos.filter(m => m.nome).length === 0 && !textoLivre && (
            <p style={{ color: '#999', textAlign: 'center', fontStyle: 'italic' }}>Preencha os medicamentos acima</p>
          )}

          {medicamentos.filter(m => m.nome).map((med, idx) => (
            <div key={med.id} style={{ marginBottom: '22px' }}>
              {/* Linha principal: nome (apresentação) ......... quantidade */}
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '4px' }}>
                <span style={{ fontWeight: 'bold', fontSize: '16px', whiteSpace: 'nowrap' }}>
                  {idx + 1}. {med.nome}{med.dose ? ` (${med.dose})` : ''}
                </span>
                <span style={{ flex: 1, borderBottom: '1px dotted #555', marginBottom: '3px', minWidth: '20px' }} />
                <span style={{ fontSize: '16px', whiteSpace: 'nowrap', fontWeight: '500' }}>
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
                <p style={{ margin: 0, paddingLeft: '18px', fontSize: '16px', color: '#555', fontStyle: 'italic' }}>
                  {med.instrucoes}
                </p>
              )}
            </div>
          ))}

          {/* Texto livre no impresso */}
          {textoLivre && (
            <div style={{ marginTop: medicamentos.filter(m => m.nome).length > 0 ? '16px' : '0', paddingTop: medicamentos.filter(m => m.nome).length > 0 ? '16px' : '0', borderTop: medicamentos.filter(m => m.nome).length > 0 ? '1px dashed #ccc' : 'none' }}>
              <p style={{ whiteSpace: 'pre-wrap', fontSize: '16px', lineHeight: '1.8', margin: 0 }}>{textoLivre}</p>
            </div>
          )}
          </div>
          <div className="doc-rodape-grupo">
            <div className="assinatura-documento" style={{ marginTop: '60px', textAlign: 'right' }}>
              <p style={{ marginBottom: '50px', fontSize: '16px' }}>{dataFormatada}</p>
              <div style={{ display: 'inline-block', textAlign: 'center', minWidth: '280px' }}>
                <div style={{ borderTop: '1px solid #333', paddingTop: '8px' }}>
                  <p style={{ margin: '0', fontWeight: 'bold' }}>{medico || '_______________________________'}</p>
                  <p style={{ margin: '4px 0 0', fontSize: '16px', color: '#666' }}>{crm || 'CRM _______________'}</p>
                  {especialidade && <p style={{ margin: '3px 0 0', fontSize: '11px', color: '#888' }}>{especialidade}</p>}
                </div>
              </div>
            </div>
            <RodapeImpresso />
          </div>
        </div>
      </div>
    </fieldset>
  );
}

export function RelatorioPage({ pacientes, setPacientes }) {
  const toast = useToast();
  const { user } = useAuth();
  const { clinica } = useClinica();
  const { paciente } = usePacienteAtual(pacientes);
  const hojeISO = dataLocalISO();

  const { medico, crm, especialidade, assinaturaImagem } = useMedicoPerfil();
  const [dataRelatorio, setDataRelatorio] = React.useState(hojeISO);
  const [finalidade, setFinalidade] = React.useState('');
  const [modo, setModo] = React.useState('estruturado'); // 'estruturado' | 'livre'
  const [diagnostico, setDiagnostico] = React.useState('');
  const [historico, setHistorico] = React.useState('');
  const [exames, setExames] = React.useState('');
  const [conduta, setConduta] = React.useState('');
  const [conclusao, setConclusao] = React.useState('');
  const [textoLivre, setTextoLivre] = React.useState('');
  const [salvo, setSalvo] = React.useState(false);
  const [salvando, setSalvando] = React.useState(false);

  if (!paciente) return <p>Paciente não encontrado.</p>;

  const dataFormatada = new Date(dataRelatorio + 'T12:00:00').toLocaleDateString('pt-BR', {
    day: 'numeric', month: 'long', year: 'numeric'
  });

  const salvarNoProntuario = async () => {
    const temConteudo = modo === 'livre'
      ? textoLivre.trim()
      : [finalidade, diagnostico, historico, exames, conduta, conclusao].some(c => c && c.trim());
    if (!temConteudo) {
      toast.warning(modo === 'livre' ? 'Escreva o relatório antes de salvar.' : 'Preencha pelo menos um campo do relatório antes de salvar.');
      return false;
    }

    const conteudo = modo === 'livre'
      ? [
        `Médico: ${medico || 'Não informado'} | ${crm || 'CRM não informado'}`,
        finalidade ? `Finalidade: ${finalidade}` : null,
        `\n${textoLivre}`,
      ].filter(Boolean).join('\n')
      : [
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
      return false;
    }
    setSalvo(true);
    return true;
  };

  // Ver comentário equivalente em AtestadoPage: imprimir sempre grava
  // antes, para nunca existir um relatório entregue que não está no
  // prontuário. Vira PDF de verdade (utils/documentoPdf) pelo mesmo
  // motivo do Atestado.
  const imprimirDocumento = async () => {
    // Precisa abrir a janela ANTES de qualquer await (ver
    // utils/janelaImpressao) — senão o navegador bloqueia como pop-up.
    const janela = iniciarJanelaImpressao();
    if (!salvo) {
      const ok = await salvarNoProntuario();
      if (!ok) { janela?.close(); return; }
    }
    const secao = (titulo, texto) => texto ? {
      margin: [0, 0, 0, 16],
      stack: [
        { text: titulo, bold: true, fontSize: 9.5, color: '#333', margin: [0, 0, 0, 4] },
        { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.5, lineColor: '#eee' }], margin: [0, 0, 0, 6] },
        { text: texto, alignment: 'justify', lineHeight: 1.5 },
      ],
    } : null;
    const criarPdfDocumento = await carregarCriarPdfDocumento();
    concluirJanelaImpressao(janela, criarPdfDocumento({
      clinica,
      paciente,
      tituloDocumento: 'RELATÓRIO MÉDICO',
      subtitulo: finalidade || null,
      corpo: modo === 'livre'
        ? [{ text: textoLivre, alignment: 'justify', lineHeight: 1.6 }]
        : [
          secao('DIAGNÓSTICO', diagnostico),
          secao('HISTÓRICO CLÍNICO E EVOLUÇÃO', historico),
          secao('EXAMES COMPLEMENTARES', exames),
          secao('CONDUTA TERAPÊUTICA ATUAL', conduta),
          secao('CONCLUSÃO E PARECER MÉDICO', conclusao),
        ].filter(Boolean),
      medico, crm, especialidade, assinaturaImagem,
      dataTexto: dataFormatada,
    }));
  };

  const campo = (label, value, setter, rows = 3, placeholder = '') => (
    <div style={{ marginBottom: '14px' }}>
      <label style={{ fontSize: '16px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>{label}</label>
      <textarea
        value={value}
        onChange={(e) => setter(e.target.value)}
        rows={rows}
        placeholder={placeholder}
        style={{ width: '100%', padding: '8px', fontSize: '16px', borderRadius: '4px', border: '1px solid #d1d5db', resize: 'vertical' }}
      />
    </div>
  );

  return (
    <fieldset disabled={salvando} onChange={() => setSalvo(false)} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
      <div className="no-print">
        <Header />
        <Link to={`/prontuario/${paciente.id}`}>← Voltar ao prontuário</Link>
      </div>
      <div style={{ maxWidth: '800px', margin: '20px auto' }}>

        {/* Formulário */}
        <div className="no-print" style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', marginBottom: '16px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
          <h3 style={{ marginTop: 0 }}>Relatório Médico</h3>
          <div style={{ marginBottom: '14px' }}>
            <label style={{ fontSize: '16px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Data</label>
            <input type="date" value={dataRelatorio} onChange={(e) => setDataRelatorio(e.target.value)} style={{ padding: '8px', fontSize: '16px' }} />
          </div>

          <div style={{ marginBottom: '14px' }}>
            <label style={{ fontSize: '16px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Finalidade do Relatório</label>
            <select value={finalidade} onChange={(e) => setFinalidade(e.target.value)} style={{ width: '100%', padding: '8px', fontSize: '16px' }}>
              <option value="">Selecione ou deixe em branco</option>
              <option value="Perícia médica">Perícia médica</option>
              <option value="Encaminhamento médico">Encaminhamento médico</option>
              <option value="Solicitação de benefício INSS">Solicitação de benefício INSS</option>
              <option value="Afastamento do trabalho">Afastamento do trabalho</option>
              <option value="Seguro de vida / plano de saúde">Seguro de vida / plano de saúde</option>
              <option value="Uso particular">Uso particular</option>
            </select>
          </div>

          <div style={{ marginBottom: '14px' }}>
            <label style={{ fontSize: '16px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Formato</label>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button type="button" onClick={() => setModo('estruturado')} style={{ padding: '7px 16px', backgroundColor: modo === 'estruturado' ? '#1d4ed8' : '#e5e7eb', color: modo === 'estruturado' ? 'white' : '#374151', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: modo === 'estruturado' ? 'bold' : 'normal', fontSize: '16px' }}>
                📋 Estruturado
              </button>
              <button type="button" onClick={() => setModo('livre')} style={{ padding: '7px 16px', backgroundColor: modo === 'livre' ? '#1d4ed8' : '#e5e7eb', color: modo === 'livre' ? 'white' : '#374151', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: modo === 'livre' ? 'bold' : 'normal', fontSize: '16px' }}>
                ✍️ Texto livre
              </button>
            </div>
          </div>

          {modo === 'estruturado' ? (
            <>
              {campo('Diagnóstico(s)', diagnostico, setDiagnostico, 2, 'Ex: Hipertensão arterial sistêmica (I10), Diabetes mellitus tipo 2 (E11)')}
              {campo('Histórico clínico e evolução', historico, setHistorico, 6, 'Descreva o quadro clínico, evolução da doença e tratamentos realizados...')}
              {campo('Exames complementares (opcional)', exames, setExames, 3, 'Resultados de exames laboratoriais, imagens, etc.')}
              {campo('Conduta terapêutica atual', conduta, setConduta, 2, 'Medicamentos em uso, terapias, restrições...')}
              {campo('Conclusão e parecer médico', conclusao, setConclusao, 3, 'Parecer final do médico sobre o caso...')}
            </>
          ) : (
            campo('Relatório (texto livre)', textoLivre, setTextoLivre, 14, 'Escreva o relatório médico livremente...')
          )}

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button onClick={salvarNoProntuario} disabled={salvando} style={{ padding: '10px 18px', backgroundColor: salvando ? '#9ca3af' : '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: salvando ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}>
              {salvando ? 'Salvando...' : '✓ Salvar no Prontuário'}
            </button>
            <button onClick={imprimirDocumento} disabled={salvando} style={{ padding: '10px 18px', backgroundColor: salvando ? '#9ca3af' : '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: salvando ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}>
              🖨️ Imprimir
            </button>
            {salvo && <span style={{ color: '#28a745', fontSize: '16px', fontWeight: 'bold' }}>✓ Salvo no histórico!</span>}
          </div>
        </div>

        {/* Documento para impressão */}
        <div className="doc-preview">
          <div className="doc-cabecalho-grupo">
            <CabecalhoImpresso paciente={paciente} />
            <h2 style={{ textAlign: 'center', letterSpacing: '4px', fontSize: '18px', margin: '0 0 6px' }}>RELATÓRIO MÉDICO</h2>
            {/* Dados do paciente já aparecem no CabecalhoImpresso acima —
                repeti-los aqui duplicava a informação no documento impresso. */}
            {finalidade && <p style={{ textAlign: 'center', color: '#555', fontSize: '16px', margin: '0 0 24px' }}>{finalidade}</p>}
          </div>
          <div className="doc-corpo-grupo">
          {modo === 'livre' ? (
            textoLivre ? (
              <div style={{ borderTop: '1px solid #ddd', paddingTop: '16px' }}>
                <p style={{ fontSize: '16px', lineHeight: '1.8', margin: 0, textAlign: 'justify', whiteSpace: 'pre-wrap' }}>{textoLivre}</p>
              </div>
            ) : (
              <p style={{ color: '#bbb', textAlign: 'center', fontStyle: 'italic', margin: '40px 0' }}>Escreva o relatório acima para visualizar</p>
            )
          ) : (
          <>
          {diagnostico && (
            <div style={{ marginBottom: '20px' }}>
              <h3 style={{ fontSize: '16px', textTransform: 'uppercase', borderBottom: '1px solid #eee', paddingBottom: '4px', margin: '0 0 8px' }}>Diagnóstico</h3>
              <p style={{ fontSize: '16px', lineHeight: '1.7', margin: 0, whiteSpace: 'pre-wrap' }}>{diagnostico}</p>
            </div>
          )}

          {historico && (
            <div style={{ marginBottom: '20px' }}>
              <h3 style={{ fontSize: '16px', textTransform: 'uppercase', borderBottom: '1px solid #eee', paddingBottom: '4px', margin: '0 0 8px' }}>Histórico Clínico e Evolução</h3>
              <p style={{ fontSize: '16px', lineHeight: '1.7', margin: 0, textAlign: 'justify', whiteSpace: 'pre-wrap' }}>{historico}</p>
            </div>
          )}

          {exames && (
            <div style={{ marginBottom: '20px' }}>
              <h3 style={{ fontSize: '16px', textTransform: 'uppercase', borderBottom: '1px solid #eee', paddingBottom: '4px', margin: '0 0 8px' }}>Exames Complementares</h3>
              <p style={{ fontSize: '16px', lineHeight: '1.7', margin: 0, whiteSpace: 'pre-wrap' }}>{exames}</p>
            </div>
          )}

          {conduta && (
            <div style={{ marginBottom: '20px' }}>
              <h3 style={{ fontSize: '16px', textTransform: 'uppercase', borderBottom: '1px solid #eee', paddingBottom: '4px', margin: '0 0 8px' }}>Conduta Terapêutica Atual</h3>
              <p style={{ fontSize: '16px', lineHeight: '1.7', margin: 0, whiteSpace: 'pre-wrap' }}>{conduta}</p>
            </div>
          )}

          {conclusao && (
            <div style={{ marginBottom: '20px' }}>
              <h3 style={{ fontSize: '16px', textTransform: 'uppercase', borderBottom: '1px solid #eee', paddingBottom: '4px', margin: '0 0 8px' }}>Conclusão e Parecer Médico</h3>
              <p style={{ fontSize: '16px', lineHeight: '1.7', margin: 0, textAlign: 'justify', whiteSpace: 'pre-wrap' }}>{conclusao}</p>
            </div>
          )}

          {!diagnostico && !historico && !conduta && !conclusao && (
            <p style={{ color: '#bbb', textAlign: 'center', fontStyle: 'italic', margin: '40px 0' }}>Preencha os campos acima para visualizar o relatório</p>
          )}
          </>
          )}
          </div>
          <div className="doc-rodape-grupo">
          <div className="assinatura-documento" style={{ marginTop: '50px', textAlign: 'right' }}>
            <p style={{ marginBottom: '50px', fontSize: '16px' }}>{dataFormatada}</p>
            <div style={{ display: 'inline-block', textAlign: 'center', minWidth: '280px' }}>
              <div style={{ borderTop: '1px solid #333', paddingTop: '8px' }}>
                <p style={{ margin: '0', fontWeight: 'bold' }}>{medico || '_______________________________'}</p>
                <p style={{ margin: '4px 0 0', fontSize: '16px', color: '#666' }}>{crm || 'CRM _______________'}</p>
                {especialidade && <p style={{ margin: '3px 0 0', fontSize: '11px', color: '#888' }}>{especialidade}</p>}
              </div>
            </div>
          </div>
          <RodapeImpresso />
          </div>
        </div>
      </div>
    </fieldset>
  );
}

export function ImprimirAtendimentoPage() {
  const { clinica } = useClinica();
  const [erro, setErro] = React.useState('');
  const { pacienteId, registroId } = useParams();
  const [paciente, setPaciente] = React.useState(null);
  const [registro, setRegistro] = React.useState(null);
  const [carregando, setCarregando] = React.useState(true);

  React.useEffect(() => {
    let cancelado = false;
    setCarregando(true);
    setErro('');
    setPaciente(null);
    setRegistro(null);
    Promise.all([
      pacientesService.buscarPorId(pacienteId),
      registrosService.buscarPorId(registroId),
    ])
      .then(([p, r]) => { if (!cancelado) { setPaciente(p); setRegistro(r); } })
      .catch(() => { if (!cancelado) setErro('Não foi possível carregar o atendimento para impressão. Recarregue a página para tentar novamente.'); })
      .finally(() => { if (!cancelado) setCarregando(false); });
    return () => { cancelado = true; };
  }, [pacienteId, registroId]);

  if (carregando) return <div style={{ padding: '40px', textAlign: 'center' }}>Carregando...</div>;
  if (erro) return <div role="alert" style={{ padding: '40px' }}>{erro}</div>;
  if (!paciente || !registro) return <div style={{ padding: '40px' }}>Registro não encontrado.</div>;

  // Antecedentes médicos (comorbidades, alergias etc.) fazem sentido junto
  // de um registro de atendimento — não fazem sentido "vazando" para
  // dentro da reimpressão de um atestado, receituário, relatório, laudo
  // ou pedido de exames, que são documentos fechados por si só. Antes
  // disto, reimprimir qualquer tipo de registro sempre trazia essa seção,
  // dando a impressão de estar imprimindo o prontuário inteiro em vez de
  // só o documento pedido.
  const TIPOS_ATENDIMENTO = ['Consulta', 'Evolução de Enfermagem', 'Sinais Vitais'];
  const ehAtendimento = TIPOS_ATENDIMENTO.includes(registro.tipo);

  // Mesmo título usado na tela onde o documento foi criado (Atestado,
  // ReceituarioPage etc.) — reimprimir deve parecer uma 2ª via do próprio
  // documento, não um "registro de atendimento" genérico.
  const TITULO_DOCUMENTO = {
    'Atestado': 'ATESTADO MÉDICO',
    'Receituário': 'RECEITUÁRIO',
    'Prescrição': 'RECEITUÁRIO',
    'Relatório': 'RELATÓRIO MÉDICO',
    'Laudo': 'LAUDO',
    'Pedido de Exames': 'PEDIDO DE EXAMES',
  };
  const titulo = ehAtendimento
    ? (registro.retificacaoDe ? 'RETIFICAÇÃO DE REGISTRO' : 'REGISTRO DE ATENDIMENTO')
    : (TITULO_DOCUMENTO[registro.tipo] || registro.tipo.toUpperCase());

  const comorbidades = [
    { label: 'HAS',          valor: paciente.has },
    { label: 'DM',           valor: paciente.dm },
    { label: 'DAC',          valor: paciente.dac },
    { label: 'Dislipidemia', valor: paciente.dislipidemia },
    { label: 'Tabagismo',    valor: paciente.tabagismo },
    { label: 'Etilismo',     valor: paciente.etilismo },
  ].filter(c => c.valor && c.valor !== 'Não' && c.valor !== '');
  const temComorbidades = comorbidades.length > 0 || !!paciente.outrasComorbidades;

  // Reimpressão vira PDF de verdade, igual às telas de criação — mesmo
  // motivo (ver utils/documentoPdf): repetir cabeçalho/rodapé em toda
  // página não é confiável só com CSS de impressão do navegador. Usa a
  // identidade de quem REALMENTE assinou o original guardada no banco
  // (assinadoPorNome/assinadoPorRegistro), não o médico logado agora.
  const imprimir = async () => {
    // Precisa abrir a janela ANTES de qualquer await (ver
    // utils/janelaImpressao) — senão o navegador bloqueia como pop-up.
    const janela = iniciarJanelaImpressao();
    const antecedentes = ehAtendimento ? [
      { text: 'ANTECEDENTES MÉDICOS', bold: true, fontSize: 9.5, color: '#333', margin: [0, 0, 0, 4] },
      { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.5, lineColor: '#eee' }], margin: [0, 0, 0, 6] },
      !temComorbidades ? { text: 'Sem comorbidades registradas.', color: '#999', margin: [0, 0, 0, 4] } : null,
      comorbidades.length > 0 ? { text: comorbidades.map(c => c.label + (c.valor !== 'Sim' ? `: ${c.valor}` : '')).join('   •   '), margin: [0, 0, 0, 4] } : null,
      paciente.outrasComorbidades ? { text: [{ text: 'Outras comorbidades: ', bold: true }, paciente.outrasComorbidades], margin: [0, 2, 0, 0] } : null,
      paciente.cirurgias ? { text: [{ text: 'Cirurgias prévias: ', bold: true }, paciente.cirurgias], margin: [0, 2, 0, 0] } : null,
      paciente.medicamentosUso ? { text: [{ text: 'Medicamentos em uso: ', bold: true }, paciente.medicamentosUso], margin: [0, 2, 0, 0] } : null,
      paciente.alergias ? { text: `⚠ Alergias: ${paciente.alergias}`, color: '#dc2626', bold: true, margin: [0, 2, 0, 0] } : null,
      { text: '', margin: [0, 0, 0, 10] },
    ].filter(Boolean) : [];

    const criarPdfDocumento = await carregarCriarPdfDocumento();
    concluirJanelaImpressao(janela, criarPdfDocumento({
      clinica,
      paciente,
      tituloDocumento: titulo,
      subtitulo: [
        `${registro.data} às ${registro.hora}`,
        !ehAtendimento ? '2ª via' : null,
        registro.status === 'Rascunho' ? 'Rascunho — ainda não assinado' : null,
      ].filter(Boolean).join('   —   '),
      corpo: [
        ...antecedentes,
        registro.retificacaoDe && registro.motivoRetificacao
          ? { text: [{ text: 'Motivo da retificação: ', bold: true }, registro.motivoRetificacao], margin: [0, 0, 0, 12], color: '#92400e' }
          : null,
        ehAtendimento ? { text: registro.tipo === 'Consulta' ? 'História Clínica' : registro.titulo, bold: true, fontSize: 9.5, color: '#333', margin: [0, 0, 0, 4] } : null,
        { text: registro.conteudo, alignment: 'justify', lineHeight: ehAtendimento ? 1.6 : 1.7 },
      ].filter(Boolean),
      medico: registro.assinadoPorNome,
      crm: registro.assinadoPorRegistro,
      dataTexto: registro.data,
    }));
  };

  return (
    <div>
      {/* Barra de ações — oculta na impressão */}
      <div className="no-print" style={{ padding: '12px 24px', backgroundColor: '#f3f4f6', borderBottom: '1px solid #ddd', display: 'flex', gap: '12px', alignItems: 'center' }}>
        <button onClick={imprimir} style={{ padding: '9px 20px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '16px' }}>
          🖨️ Imprimir
        </button>
        <button onClick={() => window.close()} style={{ padding: '9px 16px', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '16px' }}>
          Fechar
        </button>
        <span style={{ fontSize: '16px', color: '#555' }}>
          {paciente.nome} — {registro.data} às {registro.hora}
        </span>
      </div>

      {/* Documento */}
      <div className="doc-preview" style={{ maxWidth: '800px', margin: '20px auto', fontFamily: 'Arial, sans-serif', fontSize: '16px', lineHeight: '1.6' }}>
        <div className="doc-cabecalho-grupo">
          <CabecalhoImpresso paciente={paciente} />

          {/* Mesmo estilo de título centralizado e espaçado das telas de
              criação (Atestado, Receituário...) — reimpressão de um
              documento fechado deve parecer uma 2ª via dele, não um
              "registro de atendimento" genérico. */}
          <h2 style={{ textAlign: 'center', letterSpacing: '4px', fontSize: '18px', margin: '0 0 6px' }}>{titulo}</h2>
          <p style={{ textAlign: 'center', color: '#555', fontSize: '16px', margin: '0 0 4px' }}>
            {registro.data} às {registro.hora}
            {!ehAtendimento && ' — 2ª via'}
          </p>
          <p style={{ textAlign: 'center', margin: '0 0 20px', fontSize: '16px', color: registro.status === 'Rascunho' ? '#b45309' : '#555' }}>
            {registro.status === 'Rascunho' ? '⚠ Rascunho — ainda não assinado' : '🔒 Assinado'}
          </p>
          {registro.retificacaoDe && registro.motivoRetificacao && (
            <p style={{ margin: '0 0 20px', fontSize: '16px', color: '#92400e', backgroundColor: '#fffbeb', border: '1px solid #fde68a', borderRadius: '4px', padding: '8px 10px' }}>
              <strong>Motivo da retificação:</strong> {registro.motivoRetificacao}
            </p>
          )}
        </div>

        <div className="doc-corpo-grupo">
          {/* Antecedentes médicos — só em registro de atendimento de verdade,
              não em documentos fechados (atestado, receituário, relatório,
              laudo, pedido de exames): ver comentário acima de `ehAtendimento`. */}
          {ehAtendimento && (
            <div style={{ marginBottom: '24px' }}>
              <h3 style={{ fontSize: '16px', textTransform: 'uppercase', letterSpacing: '1px', borderBottom: '1px solid #ddd', paddingBottom: '6px', margin: '0 0 12px', color: '#333' }}>
                Antecedentes Médicos
              </h3>
              {comorbidades.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
                  {comorbidades.map(c => (
                    <span key={c.label} style={{ padding: '3px 12px', backgroundColor: '#fee2e2', color: '#991b1b', border: '1px solid #fecaca', borderRadius: '12px', fontSize: '16px', fontWeight: 'bold' }}>
                      {c.label}{c.valor !== 'Sim' ? `: ${c.valor}` : ''}
                    </span>
                  ))}
                </div>
              )}
              {!temComorbidades && <p style={{ color: '#999', margin: '0 0 8px' }}>Sem comorbidades registradas.</p>}
              {paciente.outrasComorbidades && <p style={{ margin: '4px 0' }}><strong>Outras comorbidades:</strong> {paciente.outrasComorbidades}</p>}
              {paciente.cirurgias && <p style={{ margin: '4px 0' }}><strong>Cirurgias prévias:</strong> {paciente.cirurgias}</p>}
              {paciente.medicamentosUso && <p style={{ margin: '4px 0' }}><strong>Medicamentos em uso:</strong> {paciente.medicamentosUso}</p>}
              {paciente.alergias && <p style={{ margin: '4px 0', color: '#dc2626', fontWeight: 'bold' }}>⚠ Alergias: {paciente.alergias}</p>}
            </div>
          )}

          {/* Corpo do documento — só ganha um subtítulo em caixa quando é
              atendimento de verdade (Consulta etc.); um atestado/receita
              reimpresso já tem o próprio título acima e não precisa de
              outro cabeçalho de seção repetindo o assunto. */}
          <div style={{ marginBottom: '50px' }}>
            {ehAtendimento && (
              <h3 style={{ fontSize: '16px', textTransform: 'uppercase', letterSpacing: '1px', borderBottom: '1px solid #ddd', paddingBottom: '6px', margin: '0 0 12px', color: '#333' }}>
                {registro.tipo === 'Consulta' ? 'História Clínica' : registro.titulo}
              </h3>
            )}
            <p style={{ margin: 0, whiteSpace: 'pre-wrap', lineHeight: ehAtendimento ? '1.9' : '2', textAlign: 'justify' }}>{registro.conteudo}</p>
          </div>
        </div>

        <div className="doc-rodape-grupo">
          {/* Assinatura */}
          <div className="assinatura-documento" style={{ marginTop: '50px', textAlign: 'right' }}>
            <p style={{ marginBottom: '50px', fontSize: '16px' }}>{registro.data}</p>
            <div style={{ display: 'inline-block', textAlign: 'center', minWidth: '280px' }}>
              <div style={{ borderTop: '1px solid #333', paddingTop: '8px' }}>
                {registro.assinadoPorNome ? (
                  <>
                    <p style={{ margin: 0, fontWeight: 'bold', fontSize: '16px' }}>{registro.assinadoPorNome}</p>
                    {registro.assinadoPorRegistro && <p style={{ margin: '4px 0 0', fontSize: '16px', color: '#666' }}>{registro.assinadoPorRegistro}</p>}
                    {registro.assinadoEm && (
                      <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#888' }}>
                        Assinado em {new Date(registro.assinadoEm).toLocaleString('pt-BR')}
                      </p>
                    )}
                  </>
                ) : (
                  <p style={{ margin: 0, fontSize: '16px' }}>Assinatura e carimbo do profissional</p>
                )}
              </div>
            </div>
          </div>
          <RodapeImpresso />
        </div>
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
  const { clinica } = useClinica();
  const { paciente } = usePacienteAtual(pacientes);
  const hojeISO = dataLocalISO();

  const { medico, crm, especialidade, assinaturaImagem } = useMedicoPerfil();
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
    if (!achados && !conclusao) return false;
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
    const resultado = await salvarRegistroComFallback({ registro, paciente, userId: user?.id, setPacientes });
    setSalvando(false);
    if (!resultado.ok) {
      toast.error(resultado.error.message);
      return false;
    }
    setSalvo(true);
    return true;
  };

  // Ver comentário equivalente em AtestadoPage: imprimir sempre grava
  // antes, para nunca existir um laudo entregue que não está no
  // prontuário. Vira PDF de verdade (utils/documentoPdf) pelo mesmo
  // motivo do Atestado.
  const imprimirDocumento = async () => {
    // Precisa abrir a janela ANTES de qualquer await (ver
    // utils/janelaImpressao) — senão o navegador bloqueia como pop-up.
    const janela = iniciarJanelaImpressao();
    if (!salvo) {
      const ok = await salvarNoProntuario();
      if (!ok) { janela?.close(); return; }
    }
    const secao = (titulo, texto) => texto ? {
      margin: [0, 0, 0, 16],
      stack: [
        { text: titulo, bold: true, fontSize: 9.5, color: '#333', margin: [0, 0, 0, 4] },
        { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.5, lineColor: '#eee' }], margin: [0, 0, 0, 6] },
        { text: texto, alignment: 'justify', lineHeight: 1.5 },
      ],
    } : null;
    const criarPdfDocumento = await carregarCriarPdfDocumento();
    concluirJanelaImpressao(janela, criarPdfDocumento({
      clinica,
      paciente,
      tituloDocumento: 'LAUDO',
      subtitulo: nomeExame || null,
      corpo: [
        { text: [{ text: 'Data do exame: ', bold: true }, dataFormatada], margin: [0, 0, 0, 14] },
        secao('ACHADOS', achados),
        secao('CONCLUSÃO', conclusao),
      ].filter(Boolean),
      medico, crm, especialidade, assinaturaImagem,
      dataTexto: dataFormatada,
    }));
  };

  return (
    <fieldset disabled={salvando} onChange={() => setSalvo(false)} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
      <div className="no-print">
        <Header />
        <Link to={`/prontuario/${paciente.id}`}>← Voltar ao prontuário</Link>
      </div>

      {/* Formulário */}
      <div className="no-print" style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', margin: '16px 0', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
        <h3 style={{ marginTop: 0 }}>Laudo — {paciente.nome}</h3>
        <div style={{ marginBottom: '14px' }}>
          <label style={{ fontSize: '16px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Data do exame</label>
          <input type="date" value={dataExame} onChange={e => setDataExame(e.target.value)} style={{ padding: '8px', fontSize: '16px' }} />
        </div>

        <div style={{ marginBottom: '14px' }}>
          <label style={{ fontSize: '16px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Tipo de exame</label>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <select value={tipoExame} onChange={e => setTipoExame(e.target.value)} style={{ padding: '8px', fontSize: '16px', flex: '1', minWidth: '200px' }}>
              <option value="">Selecione o exame...</option>
              {TIPOS_EXAME.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            {tipoExame === 'Outro' && (
              <input value={tipoOutro} onChange={e => setTipoOutro(e.target.value)} placeholder="Descreva o exame" style={{ padding: '8px', fontSize: '16px', flex: '2', minWidth: '200px' }} />
            )}
          </div>
        </div>

        <div style={{ marginBottom: '14px' }}>
          <label style={{ fontSize: '16px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Achados / Descrição</label>
          <textarea value={achados} onChange={e => setAchados(e.target.value)} rows={7} placeholder="Descreva os achados do exame..." style={{ width: '100%', padding: '8px', fontSize: '16px', borderRadius: '4px', border: '1px solid #d1d5db', resize: 'vertical' }} />
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={{ fontSize: '16px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Conclusão / Impressão diagnóstica</label>
          <textarea value={conclusao} onChange={e => setConclusao(e.target.value)} rows={4} placeholder="Conclusão do laudo..." style={{ width: '100%', padding: '8px', fontSize: '16px', borderRadius: '4px', border: '1px solid #d1d5db', resize: 'vertical' }} />
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button onClick={salvarNoProntuario} disabled={salvando || (!achados && !conclusao)} style={{ padding: '10px 18px', backgroundColor: salvando || (!achados && !conclusao) ? '#9ca3af' : '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
            {salvando ? 'Salvando...' : '✓ Salvar no Prontuário'}
          </button>
          <button onClick={imprimirDocumento} disabled={salvando || (!achados && !conclusao)} style={{ padding: '10px 18px', backgroundColor: salvando || (!achados && !conclusao) ? '#9ca3af' : '#7c3aed', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
            🖨️ Imprimir
          </button>
          {salvo && <span style={{ color: '#28a745', fontSize: '16px', fontWeight: 'bold' }}>✓ Salvo no histórico!</span>}
        </div>
      </div>

      {/* Documento para impressão */}
      <div className="doc-preview">
        <div className="doc-cabecalho-grupo">
          <CabecalhoImpresso paciente={paciente} />
          <h2 style={{ textAlign: 'center', letterSpacing: '4px', fontSize: '18px', margin: '0 0 6px' }}>LAUDO</h2>
          {nomeExame && <p style={{ textAlign: 'center', color: '#555', fontSize: '16px', margin: '0 0 20px' }}>{nomeExame}</p>}
        </div>
        <div className="doc-corpo-grupo">
        <div style={{ borderTop: '1px solid #ddd', paddingTop: '14px', marginBottom: '14px', fontSize: '16px' }}>
          <span><strong>Data do exame:</strong> {dataFormatada}</span>
        </div>

        {achados && (
          <div style={{ marginBottom: '20px' }}>
            <h3 style={{ fontSize: '16px', textTransform: 'uppercase', letterSpacing: '1px', borderBottom: '1px solid #eee', paddingBottom: '4px', margin: '0 0 10px' }}>Achados</h3>
            <p style={{ fontSize: '16px', lineHeight: '1.9', margin: 0, whiteSpace: 'pre-wrap', textAlign: 'justify' }}>{achados}</p>
          </div>
        )}

        {conclusao && (
          <div style={{ marginBottom: '20px' }}>
            <h3 style={{ fontSize: '16px', textTransform: 'uppercase', letterSpacing: '1px', borderBottom: '1px solid #eee', paddingBottom: '4px', margin: '0 0 10px' }}>Conclusão</h3>
            <p style={{ fontSize: '16px', lineHeight: '1.9', margin: 0, whiteSpace: 'pre-wrap', textAlign: 'justify' }}>{conclusao}</p>
          </div>
        )}

        {!achados && !conclusao && (
          <p style={{ color: '#bbb', textAlign: 'center', fontStyle: 'italic', margin: '40px 0' }}>Preencha os campos acima para visualizar o laudo</p>
        )}
        </div>
        <div className="doc-rodape-grupo">
        <div className="assinatura-documento" style={{ marginTop: '60px', textAlign: 'right' }}>
          <p style={{ marginBottom: '50px', fontSize: '16px' }}>{dataFormatada}</p>
          <div style={{ display: 'inline-block', textAlign: 'center', minWidth: '280px' }}>
            <div style={{ borderTop: '1px solid #333', paddingTop: '8px' }}>
              <p style={{ margin: 0, fontWeight: 'bold' }}>{medico || '_______________________________'}</p>
              <p style={{ margin: '4px 0 0', fontSize: '16px', color: '#666' }}>{crm || 'CRM _______________'}</p>
              {especialidade && <p style={{ margin: '3px 0 0', fontSize: '11px', color: '#888' }}>{especialidade}</p>}
            </div>
          </div>
        </div>
        <RodapeImpresso />
        </div>
      </div>
    </fieldset>
  );
}

export function PedidoExamesPage({ pacientes, setPacientes }) {
  const toast = useToast();
  const { user } = useAuth();
  const { clinica } = useClinica();
  const { paciente } = usePacienteAtual(pacientes);
  const hojeISO = dataLocalISO();

  const { medico, crm, especialidade, assinaturaImagem, registroConselho = {} } = useMedicoPerfil();
  const [dataExame, setDataExame]         = React.useState(hojeISO);
  // CNS, Registro ANS e CBO vêm do cadastro (paciente, convênio e perfil
  // — migração 34). null = sem ajuste nesta guia, usa o do cadastro;
  // editar aqui vale só para esta guia, não altera o cadastro.
  const [cboAjuste, setCbo]               = React.useState(null);
  const [ansAjuste, setRegistroAns]       = React.useState(null);
  const [cnsAjuste, setCns]               = React.useState(null);
  const cbo = cboAjuste ?? (registroConselho.cbo || '');
  const registroAns = ansAjuste ?? (paciente?.convenioRegistroAns || '');
  const cns = cnsAjuste ?? (paciente?.cns || '');
  const [carater, setCarater]             = React.useState('');
  const [urlPreviaGuia, setUrlPreviaGuia] = React.useState(null);
  const [indicacao, setIndicacao]         = React.useState('');
  const [cid, setCid]                     = React.useState('');
  const [justificativa, setJustificativa] = React.useState('');
  const [observacoes, setObservacoes]     = React.useState('');
  const [numeroBenef, setNumeroBenef]     = React.useState('');
  const [validadeCart, setValidadeCart]   = React.useState('');
  const [itens, setItens]                 = React.useState([]); // [{id, nome, tuss, quantidade, tipo}]
  const [buscaExame, setBuscaExame]       = React.useState('');
  const [modo, setModo]                   = React.useState('receituario');
  const [salvo, setSalvo]                 = React.useState(false);
  const [salvando, setSalvando]           = React.useState(false);
  const [catalogo, setCatalogo]           = React.useState([]);
  const [carregandoCatalogo, setCarregandoCatalogo] = React.useState(true);

  React.useEffect(() => {
    examesService.listar()
      .then(setCatalogo)
      .catch(err => toast.error('Erro ao carregar catálogo de exames: ' + err.message))
      .finally(() => setCarregandoCatalogo(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Campos da guia SP/SADT (utils/guiaSadtPdf.js). CID vai junto da
  // indicação clínica (23): a guia não tem campo próprio de CID.
  const dadosGuia = paciente && {
    operadora: paciente.convenio,
    registroAns,
    numeroCarteira: numeroBenef,
    validadeCarteira: validadeCart,
    nomeBeneficiario: paciente.nome,
    cns,
    nomeContratado: clinica?.nome,
    nomeProfissional: registroConselho.nome,
    conselho: registroConselho.conselho,
    numeroConselho: registroConselho.numero,
    ufConselho: registroConselho.uf,
    cbo,
    assinaturaImagem,
    caraterAtendimento: carater,
    dataSolicitacao: dataExame,
    indicacaoClinica: [indicacao, cid && `CID: ${cid}`].filter(Boolean).join(' — '),
    observacao: [justificativa, observacoes].filter(Boolean).join(' — '),
  };
  const chavePreviaGuia = modo === 'tiss' ? JSON.stringify([dadosGuia, itens]) : null;

  // Pré-visualização = o próprio PDF da guia (não uma imitação em HTML),
  // regerado ~0,5s depois da última digitação.
  React.useEffect(() => {
    if (!chavePreviaGuia || typeof URL.createObjectURL !== 'function') return undefined;
    let cancelado = false;
    let url = null;
    const timer = setTimeout(async () => {
      try {
        const criarPdfGuiaSadt = await carregarCriarPdfGuiaSadt();
        const [dados, lista] = JSON.parse(chavePreviaGuia);
        const blob = await criarPdfGuiaSadt(dados, lista).getBlob();
        if (cancelado) return;
        url = URL.createObjectURL(blob);
        setUrlPreviaGuia(url);
      } catch (err) {
        if (!cancelado) toast.error('Erro ao gerar a pré-visualização da guia: ' + err.message);
      }
    }, 500);
    return () => {
      cancelado = true;
      clearTimeout(timer);
      if (url) URL.revokeObjectURL(url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chavePreviaGuia]);

  if (!paciente) return <p>Paciente não encontrado.</p>;

  const catalogoAtivo = catalogo.filter(e => e.ativo);
  const idsNaLista = new Set(itens.map(i => i.id));
  // Busca por nome OU código TUSS — contra o catálogo cadastrado em
  // Administração → Catálogo de Exames (ver services/exames.service.js).
  // pontuarCorrespondencia reconhece sinônimos de abreviação da TUSS
  // (RM/TC/US/RX) pra "ressonância" encontrar "RM - Crânio" mesmo sem a
  // palavra aparecer por extenso no nome oficial, e ordena por
  // relevância — senão um termo curto como "rm" aparece como substring
  // solta em qualquer nome que contenha essas duas letras, enterrando
  // os exames de RM de verdade entre os primeiros da lista.
  const LIMITE_SUGESTOES = 30;
  const sugestoes = buscaExame.trim().length < 2 ? [] : catalogoAtivo
    .filter(e => !idsNaLista.has(e.id))
    .map(e => ({ exame: e, pontuacao: pontuarCorrespondencia(e, buscaExame) }))
    .filter(x => x.pontuacao !== null)
    .sort((a, b) => a.pontuacao - b.pontuacao || a.exame.nome.localeCompare(b.exame.nome))
    .slice(0, LIMITE_SUGESTOES)
    .map(x => x.exame);

  const adicionarExame = (exame) => {
    setItens(prev => [...prev, { id: exame.id, nome: exame.nome, tuss: exame.tuss || '', quantidade: '1', tipo: exame.tipo }]);
    setBuscaExame('');
  };

  // Exame fora do catálogo (não cadastrado em Administração → Catálogo
  // de Exames): entra sem código TUSS — id próprio (não é uma linha da
  // tabela exames) só pra existir uma chave de React/edição na lista.
  // Sem tipo de catálogo, cai no grupo "Outros" na impressão.
  const adicionarExameAvulso = () => {
    const nome = buscaExame.trim();
    if (!nome) return;
    setItens(prev => [...prev, { id: `avulso-${Date.now()}`, nome, tuss: '', quantidade: '1', avulso: true, tipo: 'Outros' }]);
    setBuscaExame('');
  };

  const removerItem = (id) => setItens(prev => prev.filter(i => i.id !== id));
  const alterarQuantidade = (id, quantidade) => setItens(prev => prev.map(i => i.id === id ? { ...i, quantidade } : i));

  // Cada tipo do catálogo vira uma página separada na impressão (pedido
  // explícito: laboratório numa página, imagem em outra). Ordem fixa pra
  // não depender da ordem em que os exames foram adicionados; "Outros"
  // (itens avulsos, sem tipo de catálogo) sempre por último.
  const ORDEM_TIPOS_IMPRESSAO = ['Laboratorial', 'Imagem', 'Diagnóstico', 'Consulta', 'Terapia', 'Cirurgia', 'Atendimento', 'Odontologia', 'Outros'];
  const agruparPorTipo = (lista) => {
    const porTipo = new Map();
    lista.forEach(item => {
      const tipo = item.tipo || 'Outros';
      if (!porTipo.has(tipo)) porTipo.set(tipo, []);
      porTipo.get(tipo).push(item);
    });
    return ORDEM_TIPOS_IMPRESSAO
      .filter(tipo => porTipo.has(tipo))
      .map(tipo => ({ tipo, itens: porTipo.get(tipo) }));
  };

  const dataFormatada = new Date(dataExame + 'T12:00:00').toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });

  const salvarNoProntuario = async () => {
    if (itens.length === 0) {
      toast.warning('Adicione pelo menos um exame antes de salvar.');
      return false;
    }

    const conteudo = itens.map(i => `• ${i.nome}${i.tuss ? ` (TUSS ${i.tuss})` : ''} — Qtd: ${i.quantidade || '1'}`).join('\n')
      + (indicacao ? `\n\nIndicação: ${indicacao}` : '') + (cid ? `  CID: ${cid}` : '')
      + (justificativa ? `\n\nJustificativa: ${justificativa}` : '')
      + (observacoes ? `\n\nObservações: ${observacoes}` : '');

    const registro = { tipo: 'Pedido de Exames', titulo: `Pedido de Exames — ${itens.length} exame(s)`, conteudo };
    setSalvando(true);
    const resultado = await salvarRegistroComFallback({ registro, paciente, userId: user?.id, pacientes, setPacientes, contexto: 'pedido de exames' });
    setSalvando(false);
    if (!resultado.ok) {
      toast.error('Não foi possível gravar no servidor: ' + resultado.error.message + '. Tente salvar de novo.');
      return false;
    }
    setSalvo(true);
    return true;
  };

  // Ver comentário equivalente em AtestadoPage: imprimir sempre grava
  // antes, para nunca existir um pedido de exames entregue que não está
  // no prontuário. Os dois modos viram PDF: receituário (documentoPdf) e
  // guia SP/SADT no modelo ANS (guiaSadtPdf).
  const imprimirDocumento = async () => {
    // Precisa abrir a janela ANTES de qualquer await (ver
    // utils/janelaImpressao) — senão o navegador bloqueia como pop-up.
    const janela = iniciarJanelaImpressao();
    if (!salvo) {
      const ok = await salvarNoProntuario();
      if (!ok) { janela?.close(); return; }
    }
    if (modo === 'tiss') {
      const criarPdfGuiaSadt = await carregarCriarPdfGuiaSadt();
      concluirJanelaImpressao(janela, criarPdfGuiaSadt(dadosGuia, itens));
      return;
    }
    const criarPdfDocumento = await carregarCriarPdfDocumento();
    const gruposImpressao = agruparPorTipo(itens);
    concluirJanelaImpressao(janela, criarPdfDocumento({
      clinica,
      paciente,
      tituloDocumento: 'PEDIDO DE EXAMES',
      // Cada tipo (laboratório, imagem...) em página própria — pedido
      // explícito. pageBreak só no 2º grupo em diante: o 1º já começa
      // logo após o título, não precisa forçar quebra antes dele.
      corpo: [
        ...gruposImpressao.map((grupo, i) => ({
          pageBreak: i > 0 ? 'before' : undefined,
          stack: [
            { text: grupo.tipo, bold: true, fontSize: 10, color: '#374151', margin: [0, 0, 0, 6] },
            {
              table: {
                headerRows: 1,
                widths: [70, '*', 50],
                body: [
                  [
                    { text: 'Código', bold: true, fontSize: 9, color: '#374151' },
                    { text: 'Exame', bold: true, fontSize: 9, color: '#374151' },
                    { text: 'Qtd.', bold: true, fontSize: 9, color: '#374151' },
                  ],
                  ...grupo.itens.map(it => [
                    { text: it.tuss || '—', fontSize: 10 },
                    { text: it.nome, fontSize: 10 },
                    { text: it.quantidade || '1', fontSize: 10 },
                  ]),
                ],
              },
              layout: 'lightHorizontalLines',
            },
          ],
        })),
        (indicacao || cid || justificativa || observacoes) ? {
          margin: [0, 14, 0, 0],
          table: {
            widths: ['*'],
            body: [[{
              stack: [
                indicacao ? { text: [{ text: 'Indicação: ', bold: true }, indicacao], fontSize: 10 } : null,
                cid ? { text: [{ text: 'CID: ', bold: true }, cid], fontSize: 10 } : null,
                justificativa ? { text: [{ text: 'Justificativa: ', bold: true }, justificativa], fontSize: 10 } : null,
                observacoes ? { text: [{ text: 'Observações: ', bold: true }, observacoes], fontSize: 10 } : null,
              ].filter(Boolean),
              margin: [8, 6, 8, 6],
            }]],
          },
          layout: { hLineWidth: () => 0, vLineWidth: () => 0, fillColor: () => '#f8f9fa' },
        } : null,
      ].filter(Boolean),
      medico, crm, especialidade, assinaturaImagem,
      dataTexto: dataFormatada,
    }));
  };

  const btnModo = (m, label) => (
    <button onClick={() => setModo(m)} style={{ padding: '7px 16px', backgroundColor: modo === m ? '#1d4ed8' : '#e5e7eb', color: modo === m ? 'white' : '#374151', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: modo === m ? 'bold' : 'normal', fontSize: '16px' }}>
      {label}
    </button>
  );

  return (
    <fieldset disabled={salvando} onChange={() => setSalvo(false)} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
      <div className="no-print">
        <Header />
        <Link to={`/prontuario/${paciente.id}`}>← Voltar ao prontuário</Link>
      </div>

      {/* Formulário */}
      <div className="no-print" style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', margin: '16px 0', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
        <h3 style={{ marginTop: 0 }}>Pedido de Exames — {paciente.nome}</h3>
        <div style={{ marginBottom: '14px' }}>
          <label style={{ fontSize: '16px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Data</label>
          <input type="date" value={dataExame} onChange={e => setDataExame(e.target.value)} style={{ padding: '8px', fontSize: '16px' }} />
        </div>

        {/* Dados TISS (só mostram quando modo TISS) */}
        {modo === 'tiss' && (
          <div className="form-grid-3col" style={{ marginBottom: '14px', padding: '12px', backgroundColor: '#eff6ff', borderRadius: '6px' }}>
            <div>
              <label style={{ fontSize: '16px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Convênio</label>
              <input value={paciente.convenio || ''} readOnly style={{ width: '100%', padding: '8px', backgroundColor: '#f8fafc' }} />
            </div>
            <div>
              <label style={{ fontSize: '16px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Nº Carteira do Beneficiário</label>
              <input value={numeroBenef} onChange={e => setNumeroBenef(e.target.value)} placeholder="000000000000000" style={{ width: '100%', padding: '8px' }} />
            </div>
            <div>
              <label style={{ fontSize: '16px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Validade da Carteira</label>
              <input type="date" value={validadeCart} onChange={e => setValidadeCart(e.target.value)} style={{ width: '100%', padding: '8px' }} />
            </div>
            <div>
              <label style={{ fontSize: '16px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Registro ANS da operadora</label>
              <input value={registroAns} onChange={e => setRegistroAns(e.target.value.replace(/\D/g, ''))} placeholder="000000" inputMode="numeric" style={{ width: '100%', padding: '8px' }} />
            </div>
            <div>
              <label style={{ fontSize: '16px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Cartão Nacional de Saúde</label>
              <input value={cns} onChange={e => setCns(e.target.value.replace(/\D/g, ''))} placeholder="000000000000000" inputMode="numeric" style={{ width: '100%', padding: '8px' }} />
            </div>
            <div>
              <label style={{ fontSize: '16px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Código CBO do solicitante</label>
              <input value={cbo} onChange={e => setCbo(e.target.value.replace(/\D/g, ''))} placeholder="Ex: 225125" inputMode="numeric" style={{ width: '100%', padding: '8px' }} />
            </div>
            <div>
              <label style={{ fontSize: '16px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Caráter do atendimento</label>
              <select value={carater} onChange={e => setCarater(e.target.value)} style={{ width: '100%', padding: '8px' }}>
                <option value="">Não informar</option>
                <option value="1">1 — Eletivo</option>
                <option value="2">2 — Urgência/Emergência</option>
              </select>
            </div>
          </div>
        )}

        {/* Indicação e CID */}
        <div className="form-grid-3col" style={{ marginBottom: '16px' }}>
          <div style={{ gridColumn: 'span 2' }}>
            <label style={{ fontSize: '16px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Indicação clínica</label>
            <input value={indicacao} onChange={e => setIndicacao(e.target.value)} placeholder="Ex: Hipertensão arterial, investigação de dislipidemia..." style={{ width: '100%', padding: '8px' }} />
          </div>
          <div>
            <label style={{ fontSize: '16px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>CID</label>
            <input value={cid} onChange={e => setCid(e.target.value)} placeholder="Ex: I10" style={{ width: '100%', padding: '8px' }} />
          </div>
        </div>

        {/* Justificativa e observações — ficam no prontuário, igual
            indicação/CID, não aparecem na folha impressa */}
        <div className="form-grid-3col" style={{ marginBottom: '16px' }}>
          <div style={{ gridColumn: 'span 2' }}>
            <label style={{ fontSize: '16px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Justificativa</label>
            <input value={justificativa} onChange={e => setJustificativa(e.target.value)} placeholder="Ex: Necessário para liberação pelo convênio..." style={{ width: '100%', padding: '8px' }} />
          </div>
          <div>
            <label style={{ fontSize: '16px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Observações</label>
            <input value={observacoes} onChange={e => setObservacoes(e.target.value)} placeholder="Opcional" style={{ width: '100%', padding: '8px' }} />
          </div>
        </div>

        {/* Busca e adição de exames */}
        <div style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '14px', marginBottom: '14px' }}>
          <label style={{ fontSize: '16px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Exame</label>
          <div style={{ position: 'relative' }}>
            <input
              value={buscaExame}
              onChange={e => setBuscaExame(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && sugestoes.length === 0 && buscaExame.trim().length >= 2) { e.preventDefault(); adicionarExameAvulso(); } }}
              placeholder={carregandoCatalogo ? 'Carregando catálogo...' : 'Digite o nome ou código TUSS do exame...'}
              disabled={carregandoCatalogo}
              // name incomum + autoComplete="off": o Safari ignora
              // autoComplete="off" sozinho em muitos campos de busca e
              // insiste em sugerir valores salvos anteriormente, que
              // cobrem a lista de sugestões do catálogo por cima.
              name="busca-exame-catalogo-tuss"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck="false"
              style={{ width: '100%', padding: '9px', fontSize: '16px', boxSizing: 'border-box' }}
            />
            {(sugestoes.length > 0 || buscaExame.trim().length >= 2) && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, backgroundColor: 'white', border: '1px solid #d1d5db', borderRadius: '0 0 6px 6px', boxShadow: '0 4px 10px rgba(0,0,0,0.1)', maxHeight: '420px', overflowY: 'auto' }}>
                {sugestoes.map(ex => (
                  // onMouseDown (não onClick) evita que o input perca o
                  // foco e esconda a lista ANTES do clique ser registrado.
                  <div key={ex.id} onMouseDown={e => { e.preventDefault(); adicionarExame(ex); }} style={{ padding: '8px 10px', cursor: 'pointer', fontSize: '16px', borderBottom: '1px solid #f3f4f6' }}>
                    <strong>{ex.nome}</strong>
                    {ex.tuss && <span style={{ color: '#6b7280', marginLeft: '8px', fontSize: '16px' }}>TUSS {ex.tuss}</span>}
                  </div>
                ))}
                {buscaExame.trim().length >= 2 && (
                  // Sempre disponível, mesmo havendo sugestões do catálogo
                  // — cobre o exame que o médico quer pedir mas que ainda
                  // não foi cadastrado (sem código TUSS, só o nome digitado).
                  <div onMouseDown={e => { e.preventDefault(); adicionarExameAvulso(); }} style={{ padding: '8px 10px', cursor: 'pointer', fontSize: '16px', color: '#1d4ed8', backgroundColor: '#f8fafc' }}>
                    + Adicionar "{buscaExame.trim()}" como exame avulso (sem código TUSS)
                  </div>
                )}
              </div>
            )}
          </div>
          {!carregandoCatalogo && catalogoAtivo.length === 0 && (
            <p style={{ color: '#666', fontSize: '16px', marginTop: '8px' }}>
              Nenhum exame cadastrado. Peça a um Administrador para cadastrar em Administração → Catálogo de Exames.
            </p>
          )}

          {itens.length > 0 && (
            <div style={{ marginTop: '14px', display: 'grid', gap: '6px' }}>
              {itens.map(item => (
                <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '8px 10px' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <strong style={{ fontSize: '16px' }}>{item.nome}</strong>
                    {item.tuss
                      ? <span style={{ color: '#6b7280', fontSize: '16px', marginLeft: '8px' }}>TUSS {item.tuss}</span>
                      : <span style={{ color: '#b45309', fontSize: '16px', marginLeft: '8px' }}>sem código TUSS</span>}
                  </div>
                  <label style={{ fontSize: '16px', color: '#6b7280' }}>Qtd.</label>
                  <input
                    value={item.quantidade}
                    onChange={e => alterarQuantidade(item.id, e.target.value)}
                    style={{ width: '70px', padding: '6px', fontSize: '16px' }}
                  />
                  <button onClick={() => removerItem(item.id)} title="Remover" style={{ border: 'none', background: 'transparent', color: '#dc2626', cursor: 'pointer', fontSize: '18px', fontWeight: 'bold', padding: '0 4px' }}>×</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Ações */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button onClick={salvarNoProntuario} disabled={itens.length === 0 || salvando} style={{ padding: '9px 16px', backgroundColor: (itens.length === 0 || salvando) ? '#9ca3af' : '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: (itens.length === 0 || salvando) ? 'not-allowed' : 'pointer', fontWeight: 'bold', fontSize: '16px' }}>
            {salvando ? 'Salvando...' : '✓ Salvar no Prontuário'}
          </button>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <span style={{ fontSize: '16px', color: '#6b7280' }}>Visualizar como:</span>
            {btnModo('receituario', '📋 Receituário')}
            {btnModo('tiss', '📄 Guia TISS')}
          </div>
          <button onClick={imprimirDocumento} disabled={itens.length === 0 || salvando} style={{ padding: '9px 16px', backgroundColor: (itens.length === 0 || salvando) ? '#9ca3af' : '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: (itens.length === 0 || salvando) ? 'not-allowed' : 'pointer', fontWeight: 'bold', fontSize: '16px' }}>
            🖨️ Imprimir
          </button>
          {salvo && <span style={{ color: '#28a745', fontSize: '16px', fontWeight: 'bold' }}>✓ Salvo!</span>}
        </div>
      </div>

      {/* ===== PREVIEW RECEITUÁRIO ===== */}
      {modo === 'receituario' && (
        <div className="doc-preview">
          <div className="doc-cabecalho-grupo">
            <CabecalhoImpresso paciente={paciente} />
            <h2 style={{ textAlign: 'center', letterSpacing: '4px', fontSize: '17px', margin: '0 0 24px' }}>PEDIDO DE EXAMES</h2>
          </div>
          <div className="doc-corpo-grupo">
          {/* Igual ao PDF gerado na impressão (ver imprimirDocumento
              acima): um grupo por tipo — cada um vira página própria no
              PDF —, depois indicação/CID/justificativa/observações
              quando preenchidos. */}
          {itens.length === 0
            ? <p style={{ color: '#bbb', textAlign: 'center', fontStyle: 'italic' }}>Nenhum exame adicionado</p>
            : agruparPorTipo(itens).map((grupo, i) => (
              <div key={grupo.tipo} style={{ marginBottom: '18px', paddingTop: i > 0 ? '14px' : 0, borderTop: i > 0 ? '1px dashed #ccc' : 'none' }}>
                <p style={{ margin: '0 0 6px', fontWeight: 'bold', fontSize: '16px', color: '#374151' }}>
                  {grupo.tipo}{i > 0 && <span style={{ fontWeight: 'normal', color: '#9ca3af', fontSize: '11px' }}> — nova página na impressão</span>}
                </p>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '16px' }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left', borderBottom: '2px solid #333', padding: '6px 4px', width: '110px' }}>Código</th>
                      <th style={{ textAlign: 'left', borderBottom: '2px solid #333', padding: '6px 4px' }}>Exame</th>
                      <th style={{ textAlign: 'left', borderBottom: '2px solid #333', padding: '6px 4px', width: '80px' }}>Qtd.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {grupo.itens.map(it => (
                      <tr key={it.id}>
                        <td style={{ padding: '6px 4px', borderBottom: '1px solid #eee' }}>{it.tuss || '—'}</td>
                        <td style={{ padding: '6px 4px', borderBottom: '1px solid #eee' }}>{it.nome}</td>
                        <td style={{ padding: '6px 4px', borderBottom: '1px solid #eee' }}>{it.quantidade || '1'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))
          }

          {(indicacao || cid || justificativa || observacoes) && (
            <div style={{ marginTop: '16px', padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '4px', fontSize: '16px' }}>
              {indicacao && <p style={{ margin: '2px 0' }}><strong>Indicação:</strong> {indicacao}</p>}
              {cid && <p style={{ margin: '2px 0' }}><strong>CID:</strong> {cid}</p>}
              {justificativa && <p style={{ margin: '2px 0' }}><strong>Justificativa:</strong> {justificativa}</p>}
              {observacoes && <p style={{ margin: '2px 0' }}><strong>Observações:</strong> {observacoes}</p>}
            </div>
          )}
          </div>
          <div className="doc-rodape-grupo">
          <div className="assinatura-documento" style={{ marginTop: '50px', textAlign: 'right' }}>
            <p style={{ marginBottom: '50px', fontSize: '16px' }}>{dataFormatada}</p>
            <div style={{ display: 'inline-block', textAlign: 'center', minWidth: '280px' }}>
              <div style={{ borderTop: '1px solid #333', paddingTop: '8px' }}>
                <p style={{ margin: 0, fontWeight: 'bold' }}>{medico || '_______________________________'}</p>
                <p style={{ margin: '4px 0 0', fontSize: '16px', color: '#666' }}>{crm || 'CRM _______________'}</p>
                {especialidade && <p style={{ margin: '3px 0 0', fontSize: '11px', color: '#888' }}>{especialidade}</p>}
              </div>
            </div>
          </div>
          <RodapeImpresso />
          </div>
        </div>
      )}

      {/* ===== PREVIEW GUIA TISS ===== */}
      {/* O PDF da guia em si (o mesmo que sai na impressão), gerado pelo
          efeito de pré-visualização lá em cima. */}
      {modo === 'tiss' && (
        <div className="no-print" style={{ backgroundColor: 'white', padding: '12px', borderRadius: '8px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
          {urlPreviaGuia
            ? <iframe title="Pré-visualização da guia SP/SADT" src={urlPreviaGuia} style={{ width: '100%', height: '720px', border: 'none' }} />
            : <p style={{ color: '#888', textAlign: 'center', margin: '40px 0' }}>Gerando pré-visualização da guia…</p>}
        </div>
      )}
    </fieldset>
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
            fontSize: '18px'
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
