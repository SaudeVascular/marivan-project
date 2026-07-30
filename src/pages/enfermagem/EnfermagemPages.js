import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { usePacienteAtual } from '../../hooks/usePacienteAtual';
import { Header, painelStyle } from '../../components/common/Layout';
import { salvarRegistroComFallback } from '../../services/registros.service';
import { calcularIdade } from '../../utils/formatters';

// Aferição rápida (seção 2.2 do Documento Mestre: triagem, sinais vitais),
// aberta a qualquer perfil clínico — não é um documento formal como
// atestado/receituário, por isso não tem preview de impressão.
export function SinaisVitaisPage({ pacientes, setPacientes }) {
  const { user } = useAuth();
  const { paciente } = usePacienteAtual(pacientes);
  const [pressaoArterial, setPressaoArterial] = React.useState('');
  const [frequenciaCardiaca, setFrequenciaCardiaca] = React.useState('');
  const [temperatura, setTemperatura] = React.useState('');
  const [peso, setPeso] = React.useState('');
  const [altura, setAltura] = React.useState('');
  const [saturacao, setSaturacao] = React.useState('');
  const [glicemia, setGlicemia] = React.useState('');
  const [observacoes, setObservacoes] = React.useState('');
  const [salvando, setSalvando] = React.useState(false);
  const [salvo, setSalvo] = React.useState(false);

  if (!paciente) return <p>Paciente não encontrado.</p>;

  const pesoNum = Number(peso.replace(',', '.'));
  const alturaNum = Number(altura.replace(',', '.'));
  const imc = pesoNum > 0 && alturaNum > 0 ? pesoNum / (alturaNum / 100) ** 2 : null;

  const salvarNoProntuario = async () => {
    const preenchido = [pressaoArterial, frequenciaCardiaca, temperatura, peso, altura, saturacao, glicemia].some(v => v.trim());
    if (!preenchido) {
      alert('Preencha pelo menos um sinal vital.');
      return;
    }

    const conteudo = [
      pressaoArterial ? `PA: ${pressaoArterial} mmHg` : null,
      frequenciaCardiaca ? `FC: ${frequenciaCardiaca} bpm` : null,
      temperatura ? `Temperatura: ${temperatura} °C` : null,
      peso ? `Peso: ${peso} kg` : null,
      altura ? `Altura: ${altura} cm` : null,
      imc ? `IMC: ${imc.toFixed(1)} kg/m²` : null,
      saturacao ? `SatO2: ${saturacao}%` : null,
      glicemia ? `Glicemia: ${glicemia} mg/dL` : null,
      observacoes ? `Observações: ${observacoes}` : null,
    ].filter(Boolean).join('\n');

    const registro = { tipo: 'Sinais Vitais', titulo: 'Sinais Vitais / Triagem', conteudo };
    setSalvando(true);
    const resultado = await salvarRegistroComFallback({ registro, paciente, userId: user?.id, pacientes, setPacientes, contexto: 'sinais vitais' });
    setSalvando(false);
    if (!resultado.ok) {
      alert('Não foi possível gravar no servidor: ' + resultado.error.message + '. Os dados digitados continuam no formulário — tente salvar de novo.');
      return;
    }
    setSalvo(true);
    setPressaoArterial(''); setFrequenciaCardiaca(''); setTemperatura('');
    setPeso(''); setAltura(''); setSaturacao(''); setGlicemia(''); setObservacoes('');
  };

  const campoStyle = { width: '100%', padding: '8px' };
  const labelStyle = { fontSize: '13px', fontWeight: 'bold', display: 'block', marginBottom: '4px' };

  return (
    <div>
      <Header />
      <Link to={`/prontuario/${paciente.id}`}>← Voltar ao prontuário</Link>
      <div style={{ maxWidth: '620px', margin: '20px auto' }}>
        <div style={{ ...painelStyle, marginBottom: '16px' }}>
          <h3 style={{ marginTop: 0 }}>Sinais Vitais / Triagem — {paciente.nome}</h3>

          <div className="form-grid-3col" style={{ marginBottom: '12px' }}>
            <div>
              <label style={labelStyle}>Pressão arterial</label>
              <input placeholder="Ex: 120/80" value={pressaoArterial} onChange={(e) => setPressaoArterial(e.target.value)} style={campoStyle} />
            </div>
            <div>
              <label style={labelStyle}>Freq. cardíaca (bpm)</label>
              <input type="number" min="0" value={frequenciaCardiaca} onChange={(e) => setFrequenciaCardiaca(e.target.value)} style={campoStyle} />
            </div>
            <div>
              <label style={labelStyle}>Saturação O2 (%)</label>
              <input type="number" min="0" max="100" value={saturacao} onChange={(e) => setSaturacao(e.target.value)} style={campoStyle} />
            </div>
            <div>
              <label style={labelStyle}>Temperatura (°C)</label>
              <input type="number" step="0.1" min="30" max="43" value={temperatura} onChange={(e) => setTemperatura(e.target.value)} style={campoStyle} />
            </div>
            <div>
              <label style={labelStyle}>Glicemia (mg/dL)</label>
              <input type="number" min="0" value={glicemia} onChange={(e) => setGlicemia(e.target.value)} style={campoStyle} />
            </div>
            <div />
            <div>
              <label style={labelStyle}>Peso (kg)</label>
              <input type="number" step="0.1" min="0" value={peso} onChange={(e) => setPeso(e.target.value)} style={campoStyle} />
            </div>
            <div>
              <label style={labelStyle}>Altura (cm)</label>
              <input type="number" step="1" min="0" value={altura} onChange={(e) => setAltura(e.target.value)} style={campoStyle} />
            </div>
            <div>
              <label style={labelStyle}>IMC (calculado)</label>
              <input value={imc ? `${imc.toFixed(1)} kg/m²` : '—'} disabled style={{ ...campoStyle, backgroundColor: '#f3f4f6', color: '#555' }} />
            </div>
          </div>

          <div style={{ marginBottom: '14px' }}>
            <label style={labelStyle}>Observações da triagem (opcional)</label>
            <textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} rows={3} style={campoStyle} />
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button onClick={salvarNoProntuario} disabled={salvando} style={{ padding: '10px 18px', backgroundColor: salvando ? '#9ca3af' : '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: salvando ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}>
              {salvando ? 'Salvando...' : '✓ Salvar no Prontuário'}
            </button>
            {salvo && <span style={{ color: '#28a745', fontSize: '14px', fontWeight: 'bold' }}>✓ Salvo no histórico!</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

// Aba própria da enfermagem (seção 2.2 do Documento Mestre) — busca de
// paciente com atalho direto pra Sinais Vitais e Prontuário, sem passar
// pelo Cadastro de Pacientes genérico (que é o fluxo administrativo).
export function EnfermagemPage({ pacientes }) {
  const [busca, setBusca] = React.useState('');

  const pacientesFiltrados = pacientes
    .filter((paciente) =>
      (paciente.nome || '').toLowerCase().includes(busca.toLowerCase()) ||
      (paciente.cpf || '').includes(busca)
    )
    .sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));

  return (
    <div>
      <Header />
      <h2>Enfermagem</h2>

      <div style={{ ...painelStyle, marginBottom: '16px' }}>
        <input
          placeholder="Buscar paciente por nome ou CPF..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          style={{ width: '100%', padding: '12px', borderRadius: '6px', border: '1px solid #ccc', fontSize: '16px', boxSizing: 'border-box' }}
        />
      </div>

      <div style={{ ...painelStyle, display: 'grid', gap: '8px' }}>
        {pacientesFiltrados.length === 0 ? (
          <p style={{ color: '#666' }}>Nenhum paciente encontrado.</p>
        ) : (
          pacientesFiltrados.map((paciente) => (
            <div key={paciente.id} style={{ border: '1px solid #ddd', padding: '10px 12px', borderRadius: '8px', backgroundColor: '#f8f9fa', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <strong>{paciente.nome}</strong>
                <div style={{ fontSize: '13px', color: '#666' }}>
                  {paciente.cpf ? `CPF: ${paciente.cpf}` : 'CPF não informado'}
                  {paciente.nascimento && <> · {calcularIdade(paciente.nascimento)} anos</>}
                  {paciente.telefone && <> · {paciente.telefone}</>}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <Link to={`/sinais-vitais/${paciente.id}`} style={{ padding: '8px 12px', backgroundColor: '#16a34a', color: 'white', borderRadius: '4px', textDecoration: 'none', fontSize: '13px', fontWeight: 'bold' }}>
                  🩺 Sinais Vitais
                </Link>
                <Link to={`/prontuario/${paciente.id}`} style={{ padding: '8px 12px', backgroundColor: '#007bff', color: 'white', borderRadius: '4px', textDecoration: 'none', fontSize: '13px', fontWeight: 'bold' }}>
                  📋 Prontuário
                </Link>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
