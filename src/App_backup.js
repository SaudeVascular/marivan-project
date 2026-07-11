import React, { useState, useEffect } from 'react';
import { Search, Plus, User, Calendar, FileText, Activity, Phone, Mail, Save, X, Eye, Edit, Trash2, Clock, Stethoscope } from 'lucide-react';

const ProntuarioEletronico = () => {
  const [activeTab, setActiveTab] = useState('pacientes');
  const [pacientes, setPacientes] = useState([]);
  const [consultas, setConsultas] = useState([]);
  const [selectedPaciente, setSelectedPaciente] = useState(null);
  const [selectedConsulta, setSelectedConsulta] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [showConsultaForm, setShowConsultaForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [consultaSearchTerm, setConsultaSearchTerm] = useState('');
  const [editingPaciente, setEditingPaciente] = useState(null);
  const [editingConsulta, setEditingConsulta] = useState(null);
  const [isMobile, setIsMobile] = useState(false);
  const [consultaFilter, setConsultaFilter] = useState('todas');

  // Detectar se é mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Dados de exemplo
  useEffect(() => {
    const pacientesIniciais = [
      {
        id: 1,
        nome: 'Maria Silva Santos',
        cpf: '123.456.789-00',
        dataNascimento: '1985-03-15',
        telefone: '(11) 99999-9999',
        email: 'maria@email.com',
        endereco: 'Rua das Flores, 123 - São Paulo, SP',
        convenio: 'Unimed',
        numeroConvenio: '123456789',
        contatoEmergencia: 'João Silva - (11) 88888-8888',
        alergias: 'Penicilina, Dipirona',
        medicamentosUso: 'Losartana 50mg - 1x/dia',
        historicoFamiliar: 'Hipertensão (pai), Diabetes (mãe)',
        observacoes: 'Paciente hipertensa controlada'
      },
      {
        id: 2,
        nome: 'José Oliveira Lima',
        cpf: '987.654.321-00',
        dataNascimento: '1970-08-22',
        telefone: '(11) 77777-7777',
        email: 'jose@email.com',
        endereco: 'Av. Principal, 456 - São Paulo, SP',
        convenio: 'Bradesco Saúde',
        numeroConvenio: '987654321',
        contatoEmergencia: 'Ana Oliveira - (11) 66666-6666',
        alergias: 'Nenhuma conhecida',
        medicamentosUso: 'Metformina 850mg - 2x/dia',
        historicoFamiliar: 'Diabetes (pai e mãe)',
        observacoes: 'Diabético tipo 2'
      },
      {
        id: 3,
        nome: 'Ana Paula Costa',
        cpf: '456.789.123-00',
        dataNascimento: '1992-12-10',
        telefone: '(11) 55555-5555',
        email: 'ana@email.com',
        endereco: 'Rua Central, 789 - São Paulo, SP',
        convenio: 'Particular',
        numeroConvenio: '',
        contatoEmergencia: 'Carlos Costa - (11) 44444-4444',
        alergias: 'Alergia a frutos do mar',
        medicamentosUso: 'Nenhum',
        historicoFamiliar: 'Sem histórico relevante',
        observacoes: 'Paciente jovem e saudável'
      }
    ];

    const hoje = new Date();
    const consultasIniciais = [
      {
        id: 1,
        pacienteId: 1,
        data: hoje.toISOString().split('T')[0],
        hora: '09:00',
        status: 'agendada',
        medico: 'Dr. Carlos Mendes',
        especialidade: 'Clínica Geral',
        tipo: 'Consulta',
        queixaPrincipal: 'Dor de cabeça frequente',
        exameFisico: 'PA: 140/90 mmHg, FC: 80 bpm, Temp: 36.5°C, Peso: 65kg, Altura: 1.65m',
        sinaisVitais: {
          pressaoArterial: '140/90',
          frequenciaCardiaca: '80',
          temperatura: '36.5',
          peso: '65',
          altura: '1.65'
        },
        hipoteseDiagnostica: 'Cefaleia tensional secundária à hipertensão',
        cid10: 'G44.2',
        conduta: 'Prescrição de analgésico, ajuste medicação anti-hipertensiva, retorno em 15 dias',
        prescricoes: 'Paracetamol 750mg - 8/8h por 3 dias se dor\nLosartana 100mg - 1x/dia pela manhã',
        exameSolicitado: 'Hemograma completo, Urina tipo 1',
        proximaConsulta: '2025-02-15',
        observacoes: 'Orientado sobre controle da pressão arterial, dieta hipossódica e atividade física regular'
      },
      {
        id: 2,
        pacienteId: 2,
        data: '2025-01-30',
        hora: '14:30',
        status: 'agendada',
        medico: 'Dra. Ana Rodrigues',
        especialidade: 'Endocrinologia',
        tipo: 'Retorno',
        queixaPrincipal: 'Controle do diabetes',
        exameFisico: 'PA: 130/80 mmHg, FC: 75 bpm, Temp: 36.2°C, Peso: 78kg, IMC: 25.2',
        sinaisVitais: {
          pressaoArterial: '130/80',
          frequenciaCardiaca: '75',
          temperatura: '36.2',
          peso: '78',
          altura: '1.75'
        },
        hipoteseDiagnostica: 'Diabetes mellitus tipo 2 controlado',
        cid10: 'E11.9',
        conduta: 'Manter medicação atual, solicitação de exames de controle',
        prescricoes: 'Metformina 850mg - 2x/dia (manhã e noite)\nGlibenclamida 5mg - 1x/dia antes do café',
        exameSolicitado: 'Glicemia de jejum, HbA1c, Perfil lipídico, Microalbuminúria',
        proximaConsulta: '2025-04-30',
        observacoes: 'Paciente aderente ao tratamento, glicemias domiciliares em bom controle'
      },
      {
        id: 3,
        pacienteId: 1,
        data: '2025-01-15',
        hora: '16:00',
        status: 'realizada',
        medico: 'Dr. Carlos Mendes',
        especialidade: 'Clínica Geral',
        tipo: 'Consulta',
        queixaPrincipal: 'Consulta de rotina',
        exameFisico: 'PA: 135/85 mmHg, FC: 78 bpm, Temp: 36.3°C',
        sinaisVitais: {
          pressaoArterial: '135/85',
          frequenciaCardiaca: '78',
          temperatura: '36.3',
          peso: '64',
          altura: '1.65'
        },
        hipoteseDiagnostica: 'Hipertensão arterial sistêmica em tratamento',
        cid10: 'I10',
        conduta: 'Manter medicação, orientações gerais',
        prescricoes: 'Losartana 50mg - 1x/dia',
        exameSolicitado: '',
        proximaConsulta: '',
        observacoes: 'Pressão controlada, paciente assintomática'
      },
      {
        id: 4,
        pacienteId: 3,
        data: hoje.toISOString().split('T')[0],
        hora: '11:00',
        status: 'agendada',
        medico: 'Dra. Marina Santos',
        especialidade: 'Ginecologia',
        tipo: 'Consulta',
        queixaPrincipal: 'Consulta preventiva',
        exameFisico: '',
        sinaisVitais: {},
        hipoteseDiagnostica: '',
        cid10: '',
        conduta: '',
        prescricoes: '',
        exameSolicitado: '',
        proximaConsulta: '',
        observacoes: ''
      }
    ];

    setPacientes(pacientesIniciais);
    setConsultas(consultasIniciais);
  }, []);

  const formatCPF = (cpf) => {
    return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  };

  const calcularIdade = (dataNascimento) => {
    const hoje = new Date();
    const nascimento = new Date(dataNascimento);
    let idade = hoje.getFullYear() - nascimento.getFullYear();
    const m = hoje.getMonth() - nascimento.getMonth();
    if (m < 0 || (m === 0 && hoje.getDate() < nascimento.getDate())) {
      idade--;
    }
    return idade;
  };

  const filteredPacientes = pacientes.filter(paciente =>
    paciente.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    paciente.cpf.includes(searchTerm)
  );

  const getConsultasPaciente = (pacienteId) => {
    return consultas.filter(consulta => consulta.pacienteId === pacienteId);
  };

  const getPacienteById = (id) => {
    return pacientes.find(p => p.id === id);
  };

  const formatarData = (data) => {
    return new Date(data).toLocaleDateString('pt-BR');
  };

  const formatarDataHora = (data, hora) => {
    return `${formatarData(data)} às ${hora}`;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'agendada': return '#3b82f6';
      case 'realizada': return '#10b981';
      case 'cancelada': return '#ef4444';
      case 'falta': return '#f59e0b';
      default: return '#6b7280';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'agendada': return 'Agendada';
      case 'realizada': return 'Realizada';
      case 'cancelada': return 'Cancelada';
      case 'falta': return 'Falta';
      default: return 'Indefinido';
    }
  };

  const filtrarConsultas = (consultas) => {
    let filtered = consultas;

    if (consultaSearchTerm) {
      filtered = filtered.filter(consulta => {
        const paciente = getPacienteById(consulta.pacienteId);
        return paciente?.nome.toLowerCase().includes(consultaSearchTerm.toLowerCase()) ||
               consulta.medico.toLowerCase().includes(consultaSearchTerm.toLowerCase()) ||
               consulta.especialidade.toLowerCase().includes(consultaSearchTerm.toLowerCase());
      });
    }

    const hoje = new Date();
    const inicioSemana = new Date(hoje);
    inicioSemana.setDate(hoje.getDate() - hoje.getDay());
    const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);

    switch (consultaFilter) {
      case 'hoje':
        filtered = filtered.filter(consulta => 
          consulta.data === hoje.toISOString().split('T')[0]
        );
        break;
      case 'semana':
        filtered = filtered.filter(consulta => 
          new Date(consulta.data) >= inicioSemana
        );
        break;
      case 'mes':
        filtered = filtered.filter(consulta => 
          new Date(consulta.data) >= inicioMes
        );
        break;
    }

    return filtered.sort((a, b) => {
      const dataA = new Date(`${a.data} ${a.hora}`);
      const dataB = new Date(`${b.data} ${b.hora}`);
      return dataB - dataA;
    });
  };
const handleSavePaciente = (dadosPaciente) => {
    if (editingPaciente) {
      setPacientes(prev => prev.map(p => 
        p.id === editingPaciente.id ? { ...dadosPaciente, id: editingPaciente.id } : p
      ));
      setEditingPaciente(null);
    } else {
      const novoPaciente = {
        ...dadosPaciente,
        id: Date.now()
      };
      setPacientes(prev => [...prev, novoPaciente]);
    }
    setShowForm(false);
  };

  const handleSaveConsulta = (dadosConsulta) => {
    if (editingConsulta) {
      setConsultas(prev => prev.map(c => 
        c.id === editingConsulta.id ? { ...dadosConsulta, id: editingConsulta.id } : c
      ));
      setEditingConsulta(null);
    } else {
      const novaConsulta = {
        ...dadosConsulta,
        id: Date.now()
      };
      setConsultas(prev => [...prev, novaConsulta]);
    }
    setShowConsultaForm(false);
  };

  const handleDeletePaciente = (id) => {
    if (window.confirm('Tem certeza que deseja excluir este paciente?')) {
      setPacientes(prev => prev.filter(p => p.id !== id));
      setConsultas(prev => prev.filter(c => c.pacienteId !== id));
    }
  };

  const handleDeleteConsulta = (id) => {
    if (window.confirm('Tem certeza que deseja excluir esta consulta?')) {
      setConsultas(prev => prev.filter(c => c.id !== id));
    }
  };

  // Formulário de Consulta
  const FormularioConsulta = ({ consulta, onSave, onCancel }) => {
    const [formData, setFormData] = useState(consulta || {
      pacienteId: '',
      data: new Date().toISOString().split('T')[0],
      hora: '',
      status: 'agendada',
      medico: '',
      especialidade: '',
      tipo: 'Consulta',
      queixaPrincipal: '',
      exameFisico: '',
      sinaisVitais: {
        pressaoArterial: '',
        frequenciaCardiaca: '',
        temperatura: '',
        peso: '',
        altura: ''
      },
      hipoteseDiagnostica: '',
      cid10: '',
      conduta: '',
      prescricoes: '',
      exameSolicitado: '',
      proximaConsulta: '',
      observacoes: ''
    });

    const handleSubmit = (e) => {
      e.preventDefault();
      onSave(formData);
    };

    const updateSinaisVitais = (campo, valor) => {
      setFormData(prev => ({
        ...prev,
        sinaisVitais: {
          ...prev.sinaisVitais,
          [campo]: valor
        }
      }));
    };

    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: isMobile ? 'flex-start' : 'center',
        justifyContent: 'center',
        padding: isMobile ? '0' : '20px',
        zIndex: 1000,
        overflowY: 'auto'
      }}>
        <div style={{
          backgroundColor: 'white',
          borderRadius: isMobile ? '0' : '12px',
          padding: isMobile ? '16px' : '30px',
          width: '100%',
          maxWidth: isMobile ? '100%' : '900px',
          minHeight: isMobile ? '100vh' : 'auto',
          maxHeight: isMobile ? '100vh' : '90vh',
          overflowY: 'auto',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: isMobile ? '20px' : '30px',
            borderBottom: '1px solid #e5e7eb',
            paddingBottom: '20px'
          }}>
            <h2 style={{
              fontSize: isMobile ? '20px' : '24px',
              fontWeight: 'bold',
              color: '#1f2937',
              margin: 0
            }}>
              {consulta ? '✏️ Editar' : '➕ Nova'} Consulta
            </h2>
            <button 
              onClick={onCancel} 
              style={{
                background: 'none',
                border: 'none',
                color: '#6b7280',
                cursor: 'pointer',
                padding: '8px',
                borderRadius: '6px'
              }}
            >
              <X size={isMobile ? 28 : 24} />
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(250px, 1fr))',
              gap: isMobile ? '16px' : '20px',
              marginBottom: '20px'
            }}>
              <div>
                <label style={{
                  display: 'block',
                  fontSize: isMobile ? '16px' : '14px',
                  fontWeight: '500',
                  color: '#374151',
                  marginBottom: '8px'
                }}>Paciente*</label>
                <select
                  required
                  value={formData.pacienteId}
                  onChange={(e) => setFormData(prev => ({...prev, pacienteId: parseInt(e.target.value)}))}
                  style={{
                    width: '100%',
                    padding: isMobile ? '16px 12px' : '12px',
                    border: '2px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: isMobile ? '18px' : '16px',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                >
                  <option value="">Selecione um paciente</option>
                  {pacientes.map(paciente => (
                    <option key={paciente.id} value={paciente.id}>
                      {paciente.nome}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{
                  display: 'block',
                  fontSize: isMobile ? '16px' : '14px',
                  fontWeight: '500',
                  color: '#374151',
                  marginBottom: '8px'
                }}>Data*</label>
                <input
                  type="date"
                  required
                  value={formData.data}
                  onChange={(e) => setFormData(prev => ({...prev, data: e.target.value}))}
                  style={{
                    width: '100%',
                    padding: isMobile ? '16px 12px' : '12px',
                    border: '2px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: isMobile ? '18px' : '16px',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{
                  display: 'block',
                  fontSize: isMobile ? '16px' : '14px',
                  fontWeight: '500',
                  color: '#374151',
                  marginBottom: '8px'
                }}>Horário*</label>
                <input
                  type="time"
                  required
                  value={formData.hora}
                  onChange={(e) => setFormData(prev => ({...prev, hora: e.target.value}))}
                  style={{
                    width: '100%',
                    padding: isMobile ? '16px 12px' : '12px',
                    border: '2px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: isMobile ? '18px' : '16px',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{
                  display: 'block',
                  fontSize: isMobile ? '16px' : '14px',
                  fontWeight: '500',
                  color: '#374151',
                  marginBottom: '8px'
                }}>Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData(prev => ({...prev, status: e.target.value}))}
                  style={{
                    width: '100%',
                    padding: isMobile ? '16px 12px' : '12px',
                    border: '2px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: isMobile ? '18px' : '16px',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                >
                  <option value="agendada">Agendada</option>
                  <option value="realizada">Realizada</option>
                  <option value="cancelada">Cancelada</option>
                  <option value="falta">Falta</option>
                </select>
              </div>

              <div>
                <label style={{
                  display: 'block',
                  fontSize: isMobile ? '16px' : '14px',
                  fontWeight: '500',
                  color: '#374151',
                  marginBottom: '8px'
                }}>Médico*</label>
                <input
                  type="text"
                  required
                  value={formData.medico}
                  onChange={(e) => setFormData(prev => ({...prev, medico: e.target.value}))}
                  style={{
                    width: '100%',
                    padding: isMobile ? '16px 12px' : '12px',
                    border: '2px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: isMobile ? '18px' : '16px',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{
                  display: 'block',
                  fontSize: isMobile ? '16px' : '14px',
                  fontWeight: '500',
                  color: '#374151',
                  marginBottom: '8px'
                }}>Especialidade*</label>
                <input
                  type="text"
                  required
                  value={formData.especialidade}
                  onChange={(e) => setFormData(prev => ({...prev, especialidade: e.target.value}))}
                  style={{
                    width: '100%',
                    padding: isMobile ? '16px 12px' : '12px',
                    border: '2px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: isMobile ? '18px' : '16px',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{
                  display: 'block',
                  fontSize: isMobile ? '16px' : '14px',
                  fontWeight: '500',
                  color: '#374151',
                  marginBottom: '8px'
                }}>Tipo de Consulta</label>
                <select
                  value={formData.tipo}
                  onChange={(e) => setFormData(prev => ({...prev, tipo: e.target.value}))}
                  style={{
                    width: '100%',
                    padding: isMobile ? '16px 12px' : '12px',
                    border: '2px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: isMobile ? '18px' : '16px',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                >
                  <option value="Consulta">Consulta</option>
                  <option value="Retorno">Retorno</option>
                  <option value="Urgência">Urgência</option>
                  <option value="Exame">Exame</option>
                </select>
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block',
                fontSize: isMobile ? '16px' : '14px',
                fontWeight: '500',
                color: '#374151',
                marginBottom: '8px'
              }}>Queixa Principal</label>
              <textarea
                value={formData.queixaPrincipal}
                onChange={(e) => setFormData(prev => ({...prev, queixaPrincipal: e.target.value}))}
                rows="3"
                style={{
                  width: '100%',
                  padding: isMobile ? '16px 12px' : '12px',
                  border: '2px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: isMobile ? '18px' : '16px',
                  outline: 'none',
                  resize: 'vertical',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <h3 style={{
                fontSize: isMobile ? '16px' : '18px',
                fontWeight: '600',
                color: '#1f2937',
                marginBottom: '12px'
              }}>Sinais Vitais</h3>
              <div style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(auto-fit, minmax(150px, 1fr))',
                gap: isMobile ? '12px' : '16px'
              }}>
                <div>
                  <label style={{
                    display: 'block',
                    fontSize: isMobile ? '14px' : '12px',
                    fontWeight: '500',
                    color: '#374151',
                    marginBottom: '6px'
                  }}>PA (mmHg)</label>
                  <input
                    type="text"
                    placeholder="120/80"
                    value={formData.sinaisVitais.pressaoArterial}
                    onChange={(e) => updateSinaisVitais('pressaoArterial', e.target.value)}
                    style={{
                      width: '100%',
                      padding: isMobile ? '12px 8px' : '8px',
                      border: '2px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: isMobile ? '16px' : '14px',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
                <div>
                  <label style={{
                    display: 'block',
                    fontSize: isMobile ? '14px' : '12px',
                    fontWeight: '500',
                    color: '#374151',
                    marginBottom: '6px'
                  }}>FC (bpm)</label>
                  <input
                    type="text"
                    placeholder="80"
                    value={formData.sinaisVitais.frequenciaCardiaca}
                    onChange={(e) => updateSinaisVitais('frequenciaCardiaca', e.target.value)}
                    style={{
                      width: '100%',
                      padding: isMobile ? '12px 8px' : '8px',
                      border: '2px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: isMobile ? '16px' : '14px',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
                <div>
                  <label style={{
                    display: 'block',
                    fontSize: isMobile ? '14px' : '12px',
                    fontWeight: '500',
                    color: '#374151',
                    marginBottom: '6px'
                  }}>Temp (°C)</label>
                  <input
                    type="text"
                    placeholder="36.5"
                    value={formData.sinaisVitais.temperatura}
                    onChange={(e) => updateSinaisVitais('temperatura', e.target.value)}
                    style={{
                      width: '100%',
                      padding: isMobile ? '12px 8px' : '8px',
                      border: '2px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: isMobile ? '16px' : '14px',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
                <div>
                  <label style={{
                    display: 'block',
                    fontSize: isMobile ? '14px' : '12px',
                    fontWeight: '500',
                    color: '#374151',
                    marginBottom: '6px'
                  }}>Peso (kg)</label>
                  <input
                    type="text"
                    placeholder="70"
                    value={formData.sinaisVitais.peso}
                    onChange={(e) => updateSinaisVitais('peso', e.target.value)}
                    style={{
                      width: '100%',
                      padding: isMobile ? '12px 8px' : '8px',
                      border: '2px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: isMobile ? '16px' : '14px',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
                <div>
                  <label style={{
                    display: 'block',
                    fontSize: isMobile ? '14px' : '12px',
                    fontWeight: '500',
                    color: '#374151',
                    marginBottom: '6px'
                  }}>Altura (m)</label>
                  <input
                    type="text"
                    placeholder="1.70"
                    value={formData.sinaisVitais.altura}
                    onChange={(e) => updateSinaisVitais('altura', e.target.value)}
                    style={{
                      width: '100%',
                      padding: isMobile ? '12px 8px' : '8px',
                      border: '2px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: isMobile ? '16px' : '14px',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>
            </div>
<div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block',
                fontSize: isMobile ? '16px' : '14px',
                fontWeight: '500',
                color: '#374151',
                marginBottom: '8px'
              }}>Exame Físico</label>
              <textarea
                value={formData.exameFisico}
                onChange={(e) => setFormData(prev => ({...prev, exameFisico: e.target.value}))}
                rows="4"
                style={{
                  width: '100%',
                  padding: isMobile ? '16px 12px' : '12px',
                  border: '2px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: isMobile ? '18px' : '16px',
                  outline: 'none',
                  resize: 'vertical',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : '2fr 1fr',
              gap: isMobile ? '16px' : '20px',
              marginBottom: '20px'
            }}>
              <div>
                <label style={{
                  display: 'block',
                  fontSize: isMobile ? '16px' : '14px',
                  fontWeight: '500',
                  color: '#374151',
                  marginBottom: '8px'
                }}>Hipótese Diagnóstica</label>
                <input
                  type="text"
                  value={formData.hipoteseDiagnostica}
                  onChange={(e) => setFormData(prev => ({...prev, hipoteseDiagnostica: e.target.value}))}
                  style={{
                    width: '100%',
                    padding: isMobile ? '16px 12px' : '12px',
                    border: '2px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: isMobile ? '18px' : '16px',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
              <div>
                <label style={{
                  display: 'block',
                  fontSize: isMobile ? '16px' : '14px',
                  fontWeight: '500',
                  color: '#374151',
                  marginBottom: '8px'
                }}>CID-10</label>
                <input
                  type="text"
                  placeholder="Ex: I10"
                  value={formData.cid10}
                  onChange={(e) => setFormData(prev => ({...prev, cid10: e.target.value}))}
                  style={{
                    width: '100%',
                    padding: isMobile ? '16px 12px' : '12px',
                    border: '2px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: isMobile ? '18px' : '16px',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block',
                fontSize: isMobile ? '16px' : '14px',
                fontWeight: '500',
                color: '#374151',
                marginBottom: '8px'
              }}>Conduta</label>
              <textarea
                value={formData.conduta}
                onChange={(e) => setFormData(prev => ({...prev, conduta: e.target.value}))}
                rows="3"
                style={{
                  width: '100%',
                  padding: isMobile ? '16px 12px' : '12px',
                  border: '2px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: isMobile ? '18px' : '16px',
                  outline: 'none',
                  resize: 'vertical',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block',
                fontSize: isMobile ? '16px' : '14px',
                fontWeight: '500',
                color: '#374151',
                marginBottom: '8px'
              }}>Prescrições</label>
              <textarea
                value={formData.prescricoes}
                onChange={(e) => setFormData(prev => ({...prev, prescricoes: e.target.value}))}
                rows="4"
                style={{
                  width: '100%',
                  padding: isMobile ? '16px 12px' : '12px',
                  border: '2px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: isMobile ? '18px' : '16px',
                  outline: 'none',
                  resize: 'vertical',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block',
                fontSize: isMobile ? '16px' : '14px',
                fontWeight: '500',
                color: '#374151',
                marginBottom: '8px'
              }}>Exames Solicitados</label>
              <textarea
                value={formData.exameSolicitado}
                onChange={(e) => setFormData(prev => ({...prev, exameSolicitado: e.target.value}))}
                rows="3"
                style={{
                  width: '100%',
                  padding: isMobile ? '16px 12px' : '12px',
                  border: '2px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: isMobile ? '18px' : '16px',
                  outline: 'none',
                  resize: 'vertical',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block',
                fontSize: isMobile ? '16px' : '14px',
                fontWeight: '500',
                color: '#374151',
                marginBottom: '8px'
              }}>Próxima Consulta</label>
              <input
                type="date"
                value={formData.proximaConsulta}
                onChange={(e) => setFormData(prev => ({...prev, proximaConsulta: e.target.value}))}
                style={{
                  width: '100%',
                  padding: isMobile ? '16px 12px' : '12px',
                  border: '2px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: isMobile ? '18px' : '16px',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div style={{ marginBottom: '30px' }}>
              <label style={{
                display: 'block',
                fontSize: isMobile ? '16px' : '14px',
                fontWeight: '500',
                color: '#374151',
                marginBottom: '8px'
              }}>Observações</label>
              <textarea
                value={formData.observacoes}
                onChange={(e) => setFormData(prev => ({...prev, observacoes: e.target.value}))}
                rows="4"
                style={{
                  width: '100%',
                  padding: isMobile ? '16px 12px' : '12px',
                  border: '2px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: isMobile ? '18px' : '16px',
                  outline: 'none',
                  resize: 'vertical',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div style={{
              display: 'flex',
              flexDirection: isMobile ? 'column' : 'row',
              justifyContent: 'flex-end',
              gap: isMobile ? '12px' : '15px',
              paddingTop: '20px',
              borderTop: '1px solid #e5e7eb'
            }}>
              <button
                type="button"
                onClick={onCancel}
                style={{
                  padding: isMobile ? '16px 24px' : '12px 24px',
                  border: '2px solid #d1d5db',
                  borderRadius: '8px',
                  backgroundColor: 'white',
                  color: '#374151',
                  fontSize: isMobile ? '18px' : '16px',
                  fontWeight: '500',
                  cursor: 'pointer'
                }}
              >
                Cancelar
              </button>
              <button
                type="submit"
                style={{
                  padding: isMobile ? '16px 24px' : '12px 24px',
                  border: 'none',
                  borderRadius: '8px',
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  fontSize: isMobile ? '18px' : '16px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                <Save size={isMobile ? 20 : 18} />
                Salvar Consulta
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  // Card de Consulta para Mobile
  const ConsultaCard = ({ consulta }) => {
    const paciente = getPacienteById(consulta.pacienteId);
    return (
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        padding: '16px',
        marginBottom: '12px',
        boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
        border: '1px solid #e5e7eb'
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: '12px' }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            backgroundColor: getStatusColor(consulta.status) + '20',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: '12px',
            flexShrink: 0
          }}>
            <Stethoscope style={{ width: '24px', height: '24px', color: getStatusColor(consulta.status) }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              marginBottom: '4px'
            }}>
              <h3 style={{
                fontSize: '16px',
                fontWeight: '600',
                color: '#1f2937',
                margin: 0,
                lineHeight: '1.3'
              }}>
                {paciente?.nome}
              </h3>
              <span style={{
                fontSize: '12px',
                fontWeight: '500',
                color: getStatusColor(consulta.status),
                backgroundColor: getStatusColor(consulta.status) + '20',
                padding: '4px 8px',
                borderRadius: '12px'
              }}>
                {getStatusLabel(consulta.status)}
              </span>
            </div>
            <p style={{
              fontSize: '14px',
              color: '#6b7280',
              margin: '0 0 8px'
            }}>
              📅 {formatarDataHora(consulta.data, consulta.hora)}
            </p>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              fontSize: '14px',
              color: '#374151',
              marginBottom: '4px'
            }}>
              <User style={{ width: '14px', height: '14px', marginRight: '6px' }} />
              {consulta.medico} - {consulta.especialidade}
            </div>
            {consulta.queixaPrincipal && (
              <div style={{
                fontSize: '14px',
                color: '#6b7280',
                fontStyle: 'italic'
              }}>
                "{consulta.queixaPrincipal.substring(0, 50)}{consulta.queixaPrincipal.length > 50 ? '...' : ''}"
              </div>
            )}
          </div>
        </div>
        
        <div style={{
          display: 'flex',
          justifyContent: 'space-around',
          paddingTop: '12px',
          borderTop: '1px solid #f3f4f6'
        }}>
          <button
            onClick={() => setSelectedConsulta(consulta)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              background: 'none',
              border: 'none',
              color: '#3b82f6',
              cursor: 'pointer',
              padding: '8px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: '500'
            }}
          >
            <Eye size={20} style={{ marginBottom: '4px' }} />
            Ver
          </button>
          <button
            onClick={() => {
              setEditingConsulta(consulta);
              setShowConsultaForm(true);
            }}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              background: 'none',
              border: 'none',
              color: '#6366f1',
              cursor: 'pointer',
              padding: '8px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: '500'
            }}
          >
            <Edit size={20} style={{ marginBottom: '4px' }} />
            Editar
          </button>
          <button
            onClick={() => handleDeleteConsulta(consulta.id)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              background: 'none',
              border: 'none',
              color: '#ef4444',
              cursor: 'pointer',
              padding: '8px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: '500'
            }}
          >
            <Trash2 size={20} style={{ marginBottom: '4px' }} />
            Excluir
          </button>
        </div>
      </div>
    );
  };

  // Componente do Formulário de Paciente (Mobile-Friendly)
  const FormularioPaciente = ({ paciente, onSave, onCancel }) => {
    const [formData, setFormData] = useState(paciente || {
      nome: '',
      cpf: '',
      dataNascimento: '',
      telefone: '',
      email: '',
      endereco: '',
      convenio: '',
      numeroConvenio: '',
      contatoEmergencia: '',
      alergias: '',
      medicamentosUso: '',
      historicoFamiliar: '',
      observacoes: ''
    });

    const handleSubmit = (e) => {
      e.preventDefault();
      onSave(formData);
    };

    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: isMobile ? 'flex-start' : 'center',
        justifyContent: 'center',
        padding: isMobile ? '0' : '20px',
        zIndex: 1000,
        overflowY: 'auto'
      }}>
        <div style={{
          backgroundColor: 'white',
          borderRadius: isMobile ? '0' : '12px',
          padding: isMobile ? '16px' : '30px',
          width: '100%',
          maxWidth: isMobile ? '100%' : '800px',
          minHeight: isMobile ? '100vh' : 'auto',
          maxHeight: isMobile ? '100vh' : '90vh',
          overflowY: 'auto',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: isMobile ? '20px' : '30px',
            borderBottom: '1px solid #e5e7eb',
            paddingBottom: '20px'
          }}>
            <h2 style={{
              fontSize: isMobile ? '20px' : '24px',
              fontWeight: 'bold',
              color: '#1f2937',
              margin: 0
            }}>
              {paciente ? '✏️ Editar' : '➕ Novo'} {isMobile ? '' : 'Paciente'}
            </h2>
            <button 
              onClick={onCancel} 
              style={{
                background: 'none',
                border: 'none',
                color: '#6b7280',
                cursor: 'pointer',
                padding: '8px',
                borderRadius: '6px'
              }}
            >
              <X size={isMobile ? 28 : 24} />
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: isMobile ? '16px' : '20px',
              marginBottom: '20px'
            }}>
              <div>
                <label style={{
                  display: 'block',
                  fontSize: isMobile ? '16px' : '14px',
                  fontWeight: '500',
                  color: '#374151',
                  marginBottom: '8px'
                }}>Nome Completo*</label>
                <input
                  type="text"
                  required
                  value={formData.nome}
                  onChange={(e) => setFormData(prev => ({...prev, nome: e.target.value}))}
                  style={{
                    width: '100%',
                    padding: isMobile ? '16px 12px' : '12px',
                    border: '2px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: isMobile ? '18px' : '16px',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
              
              <div>
                <label style={{
                  display: 'block',
                  fontSize: isMobile ? '16px' : '14px',
                  fontWeight: '500',
                  color: '#374151',
                  marginBottom: '8px'
                }}>CPF*</label>
                <input
                  type="text"
                  required
                  value={formData.cpf}
                  onChange={(e) => setFormData(prev => ({...prev, cpf: e.target.value}))}
                  style={{
                    width: '100%',
                    padding: isMobile ? '16px 12px' : '12px',
                    border: '2px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: isMobile ? '18px' : '16px',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{
                  display: 'block',
                  fontSize: isMobile ? '16px' : '14px',
                  fontWeight: '500',
                  color: '#374151',
                  marginBottom: '8px'
                }}>Data de Nascimento*</label>
                <input
                  type="date"
                  required
                  value={formData.dataNascimento}
                  onChange={(e) => setFormData(prev => ({...prev, dataNascimento: e.target.value}))}
                  style={{
                    width: '100%',
                    padding: isMobile ? '16px 12px' : '12px',
                    border: '2px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: isMobile ? '18px' : '16px',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{
                  display: 'block',
                  fontSize: isMobile ? '16px' : '14px',
                  fontWeight: '500',
                  color: '#374151',
                  marginBottom: '8px'
                }}>Telefone*</label>
                <input
                  type="tel"
                  required
                  value={formData.telefone}
                  onChange={(e) => setFormData(prev => ({...prev, telefone: e.target.value}))}
                  style={{
                    width: '100%',
                    padding: isMobile ? '16px 12px' : '12px',
                    border: '2px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: isMobile ? '18px' : '16px',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{
                  display: 'block',
                  fontSize: isMobile ? '16px' : '14px',
                  fontWeight: '500',
                  color: '#374151',
                  marginBottom: '8px'
                }}>E-mail</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({...prev, email: e.target.value}))}
                  style={{
                    width: '100%',
                    padding: isMobile ? '16px 12px' : '12px',
                    border: '2px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: isMobile ? '18px' : '16px',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{
                  display: 'block',
                  fontSize: isMobile ? '16px' : '14px',
                  fontWeight: '500',
                  color: '#374151',
                  marginBottom: '8px'
                }}>Convênio</label>
                <input
                  type="text"
                  value={formData.convenio}
                  onChange={(e) => setFormData(prev => ({...prev, convenio: e.target.value}))}
                  style={{
                    width: '100%',
                    padding: isMobile ? '16px 12px' : '12px',
                    border: '2px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: isMobile ? '18px' : '16px',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>
<div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block',
                fontSize: isMobile ? '16px' : '14px',
                fontWeight: '500',
                color: '#374151',
                marginBottom: '8px'
              }}>Endereço Completo</label>
              <input
                type="text"
                value={formData.endereco}
                onChange={(e) => setFormData(prev => ({...prev, endereco: e.target.value}))}
                style={{
                  width: '100%',
                  padding: isMobile ? '16px 12px' : '12px',
                  border: '2px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: isMobile ? '18px' : '16px',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: isMobile ? '16px' : '20px',
              marginBottom: '20px'
            }}>
              <div>
                <label style={{
                  display: 'block',
                  fontSize: isMobile ? '16px' : '14px',
                  fontWeight: '500',
                  color: '#374151',
                  marginBottom: '8px'
                }}>Número do Convênio</label>
                <input
                  type="text"
                  value={formData.numeroConvenio}
                  onChange={(e) => setFormData(prev => ({...prev, numeroConvenio: e.target.value}))}
                  style={{
                    width: '100%',
                    padding: isMobile ? '16px 12px' : '12px',
                    border: '2px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: isMobile ? '18px' : '16px',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{
                  display: 'block',
                  fontSize: isMobile ? '16px' : '14px',
                  fontWeight: '500',
                  color: '#374151',
                  marginBottom: '8px'
                }}>Contato de Emergência</label>
                <input
                  type="text"
                  value={formData.contatoEmergencia}
                  onChange={(e) => setFormData(prev => ({...prev, contatoEmergencia: e.target.value}))}
                  style={{
                    width: '100%',
                    padding: isMobile ? '16px 12px' : '12px',
                    border: '2px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: isMobile ? '18px' : '16px',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block',
                fontSize: isMobile ? '16px' : '14px',
                fontWeight: '500',
                color: '#374151',
                marginBottom: '8px'
              }}>Alergias</label>
              <textarea
                value={formData.alergias}
                onChange={(e) => setFormData(prev => ({...prev, alergias: e.target.value}))}
                rows="3"
                style={{
                  width: '100%',
                  padding: isMobile ? '16px 12px' : '12px',
                  border: '2px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: isMobile ? '18px' : '16px',
                  outline: 'none',
                  resize: 'vertical',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block',
                fontSize: isMobile ? '16px' : '14px',
                fontWeight: '500',
                color: '#374151',
                marginBottom: '8px'
              }}>Medicamentos em Uso</label>
              <textarea
                value={formData.medicamentosUso}
                onChange={(e) => setFormData(prev => ({...prev, medicamentosUso: e.target.value}))}
                rows="3"
                style={{
                  width: '100%',
                  padding: isMobile ? '16px 12px' : '12px',
                  border: '2px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: isMobile ? '18px' : '16px',
                  outline: 'none',
                  resize: 'vertical',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block',
                fontSize: isMobile ? '16px' : '14px',
                fontWeight: '500',
                color: '#374151',
                marginBottom: '8px'
              }}>Histórico Familiar</label>
              <textarea
                value={formData.historicoFamiliar}
                onChange={(e) => setFormData(prev => ({...prev, historicoFamiliar: e.target.value}))}
                rows="3"
                style={{
                  width: '100%',
                  padding: isMobile ? '16px 12px' : '12px',
                  border: '2px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: isMobile ? '18px' : '16px',
                  outline: 'none',
                  resize: 'vertical',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div style={{ marginBottom: '30px' }}>
              <label style={{
                display: 'block',
                fontSize: isMobile ? '16px' : '14px',
                fontWeight: '500',
                color: '#374151',
                marginBottom: '8px'
              }}>Observações Gerais</label>
              <textarea
                value={formData.observacoes}
                onChange={(e) => setFormData(prev => ({...prev, observacoes: e.target.value}))}
                rows="4"
                style={{
                  width: '100%',
                  padding: isMobile ? '16px 12px' : '12px',
                  border: '2px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: isMobile ? '18px' : '16px',
                  outline: 'none',
                  resize: 'vertical',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div style={{
              display: 'flex',
              flexDirection: isMobile ? 'column' : 'row',
              justifyContent: 'flex-end',
              gap: isMobile ? '12px' : '15px',
              paddingTop: '20px',
              borderTop: '1px solid #e5e7eb'
            }}>
              <button
                type="button"
                onClick={onCancel}
                style={{
                  padding: isMobile ? '16px 24px' : '12px 24px',
                  border: '2px solid #d1d5db',
                  borderRadius: '8px',
                  backgroundColor: 'white',
                  color: '#374151',
                  fontSize: isMobile ? '18px' : '16px',
                  fontWeight: '500',
                  cursor: 'pointer'
                }}
              >
                Cancelar
              </button>
              <button
                type="submit"
                style={{
                  padding: isMobile ? '16px 24px' : '12px 24px',
                  border: 'none',
                  borderRadius: '8px',
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  fontSize: isMobile ? '18px' : '16px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                <Save size={isMobile ? 20 : 18} />
                Salvar
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  // Card de Paciente para Mobile
  const PacienteCard = ({ paciente }) => (
    <div style={{
      backgroundColor: 'white',
      borderRadius: '12px',
      padding: '16px',
      marginBottom: '12px',
      boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
      border: '1px solid #e5e7eb'
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: '12px' }}>
        <div style={{
          width: '48px',
          height: '48px',
          borderRadius: '50%',
          backgroundColor: '#dbeafe',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: '12px',
          flexShrink: 0
        }}>
          <User style={{ width: '24px', height: '24px', color: '#3b82f6' }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={{
            fontSize: '16px',
            fontWeight: '600',
            color: '#1f2937',
            margin: '0 0 4px',
            lineHeight: '1.3'
          }}>
            {paciente.nome}
          </h3>
          <p style={{
            fontSize: '14px',
            color: '#6b7280',
            margin: '0 0 8px'
          }}>
            {formatCPF(paciente.cpf)} • {calcularIdade(paciente.dataNascimento)} anos
          </p>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            fontSize: '14px',
            color: '#374151',
            marginBottom: '4px'
          }}>
            <Phone style={{ width: '14px', height: '14px', marginRight: '6px' }} />
            {paciente.telefone}
          </div>
          <div style={{
            fontSize: '14px',
            color: '#6b7280'
          }}>
            {paciente.convenio || 'Particular'}
          </div>
        </div>
      </div>
      
      <div style={{
        display: 'flex',
        justifyContent: 'space-around',
        paddingTop: '12px',
        borderTop: '1px solid #f3f4f6'
      }}>
        <button
          onClick={() => setSelectedPaciente(paciente)}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            background: 'none',
            border: 'none',
            color: '#3b82f6',
            cursor: 'pointer',
            padding: '8px',
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: '500'
          }}
        >
          <Eye size={20} style={{ marginBottom: '4px' }} />
          Ver
        </button>
        <button
          onClick={() => {
            setEditingPaciente(paciente);
            setShowForm(true);
          }}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            background: 'none',
            border: 'none',
            color: '#6366f1',
            cursor: 'pointer',
            padding: '8px',
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: '500'
          }}
        >
          <Edit size={20} style={{ marginBottom: '4px' }} />
          Editar
        </button>
        <button
          onClick={() => handleDeletePaciente(paciente.id)}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            background: 'none',
            border: 'none',
            color: '#ef4444',
            cursor: 'pointer',
            padding: '8px',
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: '500'
          }}
        >
          <Trash2 size={20} style={{ marginBottom: '4px' }} />
          Excluir
        </button>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f3f4f6' }}>
      {/* Header Mobile-Friendly */}
      <header style={{
        backgroundColor: 'white',
        boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
        borderBottom: '1px solid #e5e7eb',
        position: 'sticky',
        top: 0,
        zIndex: 50
      }}>
        <div style={{
          maxWidth: '1280px',
          margin: '0 auto',
          padding: isMobile ? '0 16px' : '0 24px'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: isMobile ? '12px 0' : '16px 0'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: isMobile ? '8px' : '12px'
            }}>
              <Activity style={{ 
                color: '#3b82f6', 
                width: isMobile ? '28px' : '32px', 
                height: isMobile ? '28px' : '32px' 
              }} />
              <h1 style={{
                fontSize: isMobile ? '18px' : '24px',
                fontWeight: 'bold',
                color: '#1f2937',
                margin: 0
              }}>
                {isMobile ? 'Prontuário' : 'Prontuário Eletrônico'}
              </h1>
            </div>
            {!isMobile && (
              <div style={{
                fontSize: '14px',
                color: '#6b7280'
              }}>
                Dr. João Silva - CRM: 12345-SP
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Navigation Mobile-Friendly */}
      <nav style={{
        backgroundColor: 'white',
        borderBottom: '1px solid #e5e7eb',
        position: 'sticky',
        top: isMobile ? '64px' : '72px',
        zIndex: 40
      }}>
        <div style={{
          maxWidth: '1280px',
          margin: '0 auto',
          padding: isMobile ? '0 16px' : '0 24px'
        }}>
          <div style={{ 
            display: 'flex', 
            gap: isMobile ? '0' : '32px',
            justifyContent: isMobile ? 'space-around' : 'flex-start'
          }}>
            {[
              { id: 'pacientes', label: 'Pacientes', icon: User },
              { id: 'consultas', label: 'Consultas', icon: Calendar },
              { id: 'relatorios', label: 'Relatórios', icon: FileText }
            ].map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    padding: isMobile ? '12px 8px' : '12px 4px',
                    border: 'none',
                    borderBottom: activeTab === tab.id ? '2px solid #3b82f6' : '2px solid transparent',
                    backgroundColor: 'transparent',
                    color: activeTab === tab.id ? '#3b82f6' : '#6b7280',
                    fontSize: isMobile ? '12px' : '14px',
                    fontWeight: '500',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: isMobile ? 'column' : 'row',
                    alignItems: 'center',
                    gap: isMobile ? '4px' : '8px',
                    flex: isMobile ? 1 : 'none'
                  }}
                >
                  <Icon size={isMobile ? 18 : 16} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main style={{
        maxWidth: '1280px',
        margin: '0 auto',
        padding: isMobile ? '16px' : '24px'
      }}>
        {activeTab === 'pacientes' && (
          <div>
            <div style={{
              display: 'flex',
              flexDirection: isMobile ? 'column' : 'row',
              justifyContent: 'space-between',
              alignItems: isMobile ? 'stretch' : 'center',
              marginBottom: isMobile ? '16px' : '24px',
              gap: isMobile ? '12px' : '0'
            }}>
              <h2 style={{
                fontSize: isMobile ? '18px' : '20px',
                fontWeight: '600',
                color: '#1f2937',
                margin: 0
              }}>
                Pacientes ({pacientes.length})
              </h2>
              <button
                onClick={() => setShowForm(true)}
                style={{
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  padding: isMobile ? '14px 16px' : '12px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  fontSize: isMobile ? '16px' : '14px',
                  fontWeight: '500',
                  width: isMobile ? '100%' : 'auto'
                }}
              >
                <Plus size={isMobile ? 20 : 18} />
                Novo Paciente
              </button>
            </div>

            <div style={{ marginBottom: isMobile ? '16px' : '24px' }}>
              <div style={{ position: 'relative' }}>
                <Search 
                  style={{
                    position: 'absolute',
                    left: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: '#9ca3af',
                    width: '20px',
                    height: '20px'
                  }}
                />
                <input
                  type="text"
                  placeholder="Pesquisar por nome ou CPF..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{
                    width: '100%',
                    paddingLeft: '44px',
                    paddingRight: '16px',
                    paddingTop: isMobile ? '16px' : '12px',
                    paddingBottom: isMobile ? '16px' : '12px',
                    border: '2px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: isMobile ? '18px' : '16px',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>

            {/* Lista de pacientes - Mobile vs Desktop */}
            {isMobile ? (
              <div>
                {filteredPacientes.map((paciente) => (
                  <PacienteCard key={paciente.id} paciente={paciente} />
                ))}
              </div>
            ) : (
              <div style={{
                backgroundColor: 'white',
                borderRadius: '8px',
                boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
                overflow: 'hidden'
              }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead style={{ backgroundColor: '#f9fafb' }}>
                    <tr>
                      <th style={{
                        padding: '12px 24px',
                        textAlign: 'left',
                        fontSize: '12px',
                        fontWeight: '500',
                        color: '#6b7280',
                        textTransform: 'uppercase'
                      }}>
                        Paciente
                      </th>
                      <th style={{
                        padding: '12px 24px',
                        textAlign: 'left',
                        fontSize: '12px',
                        fontWeight: '500',
                        color: '#6b7280',
                        textTransform: 'uppercase'
                      }}>
                        Contato
                      </th>
                      <th style={{
                        padding: '12px 24px',
                        textAlign: 'left',
                        fontSize: '12px',
                        fontWeight: '500',
                        color: '#6b7280',
                        textTransform: 'uppercase'
                      }}>
                        Convênio
                      </th>
                      <th style={{
                        padding: '12px 24px',
                        textAlign: 'right',
                        fontSize: '12px',
                        fontWeight: '500',
                        color: '#6b7280',
                        textTransform: 'uppercase'
                      }}>
                        Ações
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPacientes.map((paciente) => (
                      <tr 
                        key={paciente.id} 
                        style={{ borderTop: '1px solid #e5e7eb' }}
                      >
                        <td style={{ padding: '16px 24px' }}>
                          <div style={{ display: 'flex', alignItems: 'center' }}>
                            <div style={{
                              width: '40px',
                              height: '40px',
                              borderRadius: '50%',
                              backgroundColor: '#dbeafe',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              marginRight: '16px'
                            }}>
                              <User style={{ width: '20px', height: '20px', color: '#3b82f6' }} />
                            </div>
                            <div>
                              <div style={{
                                fontSize: '14px',
                                fontWeight: '500',
                                color: '#1f2937'
                              }}>
                                {paciente.nome}
                              </div>
                              <div style={{
                                fontSize: '14px',
                                color: '#6b7280'
                              }}>
                                {formatCPF(paciente.cpf)} • {calcularIdade(paciente.dataNascimento)} anos
                              </div>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '16px 24px' }}>
                          <div style={{
                            fontSize: '14px',
                            color: '#1f2937',
                            display: 'flex',
                            alignItems: 'center',
                            marginBottom: '4px'
                          }}>
                            <Phone style={{ width: '16px', height: '16px', marginRight: '4px' }} />
                            {paciente.telefone}
                          </div>
                          {paciente.email && (
                            <div style={{
                              fontSize: '14px',
                              color: '#6b7280',
                              display: 'flex',
                              alignItems: 'center'
                            }}>
                              <Mail style={{ width: '16px', height: '16px', marginRight: '4px' }} />
                              {paciente.email}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '16px 24px' }}>
                          <div style={{
                            fontSize: '14px',
                            color: '#1f2937'
                          }}>
                            {paciente.convenio || 'Particular'}
                          </div>
                          {paciente.numeroConvenio && (
                            <div style={{
                              fontSize: '14px',
                              color: '#6b7280'
                            }}>
                              {paciente.numeroConvenio}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                          <div style={{
                            display: 'flex',
                            justifyContent: 'flex-end',
                            gap: '8px'
                          }}>
                            <button
                              onClick={() => setSelectedPaciente(paciente)}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: '#3b82f6',
                                cursor: 'pointer',
                                padding: '4px',
                                borderRadius: '4px'
                              }}
                            >
                              <Eye size={18} />
                            </button>
                            <button
                              onClick={() => {
                                setEditingPaciente(paciente);
                                setShowForm(true);
                              }}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: '#6366f1',
                                cursor: 'pointer',
                                padding: '4px',
                                borderRadius: '4px'
                              }}
                            >
                              <Edit size={18} />
                            </button>
                            <button
                              onClick={() => handleDeletePaciente(paciente.id)}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: '#ef4444',
                                cursor: 'pointer',
                                padding: '4px',
                                borderRadius: '4px'
                              }}
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'consultas' && (
          <div>
            <div style={{
              display: 'flex',
              flexDirection: isMobile ? 'column' : 'row',
              justifyContent: 'space-between',
              alignItems: isMobile ? 'stretch' : 'center',
              marginBottom: isMobile ? '16px' : '24px',
              gap: isMobile ? '12px' : '0'
            }}>
              <h2 style={{
                fontSize: isMobile ? '18px' : '20px',
                fontWeight: '600',
                color: '#1f2937',
                margin: 0
              }}>
                Consultas ({filtrarConsultas(consultas).length})
              </h2>
              <button
                onClick={() => setShowConsultaForm(true)}
                style={{
                  backgroundColor: '#10b981',
                  color: 'white',
                  padding: isMobile ? '14px 16px' : '12px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  fontSize: isMobile ? '16px' : '14px',
                  fontWeight: '500',
                  width: isMobile ? '100%' : 'auto'
                }}
              >
                <Plus size={isMobile ? 20 : 18} />
                Nova Consulta
              </button>
            </div>

            {/* Filtros e Busca */}
            <div style={{
              display: 'flex',
              flexDirection: isMobile ? 'column' : 'row',
              gap: isMobile ? '12px' : '16px',
              marginBottom: isMobile ? '16px' : '24px'
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ position: 'relative' }}>
                  <Search 
                    style={{
                      position: 'absolute',
                      left: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: '#9ca3af',
                      width: '20px',
                      height: '20px'
                    }}
                  />
                  <input
                    type="text"
                    placeholder="Pesquisar por paciente, médico..."
                    value={consultaSearchTerm}
                    onChange={(e) => setConsultaSearchTerm(e.target.value)}
                    style={{
                      width: '100%',
                      paddingLeft: '44px',
                      paddingRight: '16px',
                      paddingTop: isMobile ? '16px' : '12px',
                      paddingBottom: isMobile ? '16px' : '12px',
                      border: '2px solid #d1d5db',
                      borderRadius: '8px',
                      fontSize: isMobile ? '18px' : '16px',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>
              <div style={{ minWidth: isMobile ? '100%' : '200px' }}>
                <select
                  value={consultaFilter}
                  onChange={(e) => setConsultaFilter(e.target.value)}
                  style={{
                    width: '100%',
                    padding: isMobile ? '16px 12px' : '12px',
                    border: '2px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize
fontSize: isMobile ? '18px' : '16px',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                >
                  <option value="todas">Todas as consultas</option>
                  <option value="hoje">Hoje</option>
                  <option value="semana">Esta semana</option>
                  <option value="mes">Este mês</option>
                </select>
              </div>
            </div>

            {/* Lista de consultas - Mobile vs Desktop */}
            {isMobile ? (
              <div>
                {filtrarConsultas(consultas).map((consulta) => (
                  <ConsultaCard key={consulta.id} consulta={consulta} />
                ))}
                {filtrarConsultas(consultas).length === 0 && (
                  <div style={{
                    textAlign: 'center',
                    padding: '48px 0',
                    color: '#6b7280'
                  }}>
                    <Calendar style={{ width: '48px', height: '48px', margin: '0 auto 16px' }} />
                    <p>Nenhuma consulta encontrada</p>
                  </div>
                )}

      {/* Modal do Prontuário de Paciente */}
      {selectedPaciente && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: isMobile ? 'flex-start' : 'center',
          justifyContent: 'center',
          padding: isMobile ? '0' : '20px',
          zIndex: 1000,
          overflowY: 'auto'
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: isMobile ? '0' : '12px',
            padding: isMobile ? '16px' : '30px',
            width: '100%',
            maxWidth: isMobile ? '100%' : '1000px',
            minHeight: isMobile ? '100vh' : 'auto',
            maxHeight: isMobile ? '100vh' : '90vh',
            overflowY: 'auto',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: isMobile ? '20px' : '30px',
              borderBottom: '1px solid #e5e7eb',
              paddingBottom: '20px'
            }}>
              <h2 style={{
                fontSize: isMobile ? '18px' : '24px',
                fontWeight: 'bold',
                color: '#1f2937',
                margin: 0,
                lineHeight: '1.2'
              }}>
                📋 {isMobile ? selectedPaciente.nome.split(' ')[0] : `Prontuário - ${selectedPaciente.nome}`}
              </h2>
              <button 
                onClick={() => setSelectedPaciente(null)} 
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#6b7280',
                  cursor: 'pointer',
                  padding: '8px',
                  borderRadius: '6px'
                }}
              >
                <X size={isMobile ? 28 : 24} />
              </button>
            </div>
            
            <div style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(400px, 1fr))',
              gap: isMobile ? '20px' : '30px'
            }}>
              <div>
                <h3 style={{
                  fontSize: isMobile ? '16px' : '18px',
                  fontWeight: '600',
                  color: '#1f2937',
                  marginBottom: '12px'
                }}>
                  👤 Dados Pessoais
                </h3>
                <div style={{
                  backgroundColor: '#f0f9ff',
                  padding: isMobile ? '16px' : '20px',
                  borderRadius: '8px',
                  fontSize: isMobile ? '15px' : '14px',
                  lineHeight: '1.6',
                  border: '1px solid #e0f2fe'
                }}>
                  <p style={{ margin: '0 0 8px' }}>
                    <strong>Nome:</strong> {selectedPaciente.nome}
                  </p>
                  <p style={{ margin: '0 0 8px' }}>
                    <strong>CPF:</strong> {formatCPF(selectedPaciente.cpf)}
                  </p>
                  <p style={{ margin: '0 0 8px' }}>
                    <strong>Idade:</strong> {calcularIdade(selectedPaciente.dataNascimento)} anos
                  </p>
                  <p style={{ margin: '0 0 8px' }}>
                    <strong>Telefone:</strong> {selectedPaciente.telefone}
                  </p>
                  <p style={{ margin: '0 0 8px' }}>
                    <strong>E-mail:</strong> {selectedPaciente.email}
                  </p>
                  <p style={{ margin: 0 }}>
                    <strong>Convênio:</strong> {selectedPaciente.convenio}
                  </p>
                </div>
              </div>
              
              <div>
                <h3 style={{
                  fontSize: isMobile ? '16px' : '18px',
                  fontWeight: '600',
                  color: '#1f2937',
                  marginBottom: '12px'
                }}>
                  ⚕️ Informações Médicas
                </h3>
                <div style={{
                  backgroundColor: '#fef7f0',
                  padding: isMobile ? '16px' : '20px',
                  borderRadius: '8px',
                  fontSize: isMobile ? '15px' : '14px',
                  lineHeight: '1.6',
                  border: '1px solid #fed7aa'
                }}>
                  <p style={{ margin: '0 0 8px' }}>
                    <strong>🚨 Alergias:</strong> {selectedPaciente.alergias || 'Nenhuma'}
                  </p>
                  <p style={{ margin: '0 0 8px' }}>
                    <strong>💊 Medicamentos:</strong> {selectedPaciente.medicamentosUso || 'Nenhum'}
                  </p>
                  <p style={{ margin: 0 }}>
                    <strong>👨‍👩‍👧‍👦 Histórico Familiar:</strong> {selectedPaciente.historicoFamiliar || 'Não informado'}
                  </p>
                </div>
              </div>
            </div>
            
            <div style={{ marginTop: isMobile ? '20px' : '30px' }}>
              <h3 style={{
                fontSize: isMobile ? '16px' : '18px',
                fontWeight: '600',
                color: '#1f2937',
                marginBottom: '12px'
              }}>
                📅 Histórico de Consultas
              </h3>
              <div style={{
                backgroundColor: '#f8fafc',
                padding: isMobile ? '16px' : '20px',
                borderRadius: '8px',
                border: '1px solid #e2e8f0'
              }}>
                {getConsultasPaciente(selectedPaciente.id).length === 0 ? (
                  <p style={{
                    color: '#64748b',
                    textAlign: 'center',
                    margin: 0,
                    fontStyle: 'italic',
                    fontSize: isMobile ? '15px' : '14px'
                  }}>
                    📝 Nenhuma consulta registrada
                  </p>
                ) : (
                  getConsultasPaciente(selectedPaciente.id).map(consulta => (
                    <div key={consulta.id} style={{
                      backgroundColor: 'white',
                      padding: isMobile ? '12px' : '16px',
                      borderRadius: '6px',
                      marginBottom: '12px',
                      border: '1px solid #e2e8f0'
                    }}>
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        marginBottom: '8px',
                        flexWrap: 'wrap',
                        gap: '8px'
                      }}>
                        <h4 style={{
                          fontSize: isMobile ? '15px' : '16px',
                          fontWeight: '500',
                          color: '#1e293b',
                          margin: 0
                        }}>
                          👨‍⚕️ {consulta.medico}
                        </h4>
                        <span style={{
                          fontSize: isMobile ? '13px' : '14px',
                          color: '#64748b',
                          backgroundColor: '#f1f5f9',
                          padding: '4px 8px',
                          borderRadius: '4px'
                        }}>
                          📅 {formatarData(consulta.data)}
                        </span>
                      </div>
                      <p style={{
                        fontSize: isMobile ? '14px' : '14px',
                        color: '#334155',
                        margin: '0 0 4px',
                        lineHeight: '1.5'
                      }}>
                        <strong>Queixa:</strong> {consulta.queixaPrincipal}
                      </p>
                      <p style={{
                        fontSize: isMobile ? '14px' : '14px',
                        color: '#64748b',
                        margin: 0,
                        lineHeight: '1.5'
                      }}>
                        <strong>Diagnóstico:</strong> {consulta.hipoteseDiagnostica}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProntuarioEletronico;
              </div>
            ) : (
              <div style={{
                backgroundColor: 'white',
                borderRadius: '8px',
                boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
                overflow: 'hidden'
              }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead style={{ backgroundColor: '#f9fafb' }}>
                    <tr>
                      <th style={{
                        padding: '12px 24px',
                        textAlign: 'left',
                        fontSize: '12px',
                        fontWeight: '500',
                        color: '#6b7280',
                        textTransform: 'uppercase'
                      }}>
                        Paciente
                      </th>
                      <th style={{
                        padding: '12px 24px',
                        textAlign: 'left',
                        fontSize: '12px',
                        fontWeight: '500',
                        color: '#6b7280',
                        textTransform: 'uppercase'
                      }}>
                        Data/Hora
                      </th>
                      <th style={{
                        padding: '12px 24px',
                        textAlign: 'left',
                        fontSize: '12px',
                        fontWeight: '500',
                        color: '#6b7280',
                        textTransform: 'uppercase'
                      }}>
                        Médico
                      </th>
                      <th style={{
                        padding: '12px 24px',
                        textAlign: 'center',
                        fontSize: '12px',
                        fontWeight: '500',
                        color: '#6b7280',
                        textTransform: 'uppercase'
                      }}>
                        Status
                      </th>
                      <th style={{
                        padding: '12px 24px',
                        textAlign: 'right',
                        fontSize: '12px',
                        fontWeight: '500',
                        color: '#6b7280',
                        textTransform: 'uppercase'
                      }}>
                        Ações
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtrarConsultas(consultas).map((consulta) => {
                      const paciente = getPacienteById(consulta.pacienteId);
                      return (
                        <tr 
                          key={consulta.id} 
                          style={{ borderTop: '1px solid #e5e7eb' }}
                        >
                          <td style={{ padding: '16px 24px' }}>
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                              <div style={{
                                width: '40px',
                                height: '40px',
                                borderRadius: '50%',
                                backgroundColor: '#dbeafe',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                marginRight: '16px'
                              }}>
                                <User style={{ width: '20px', height: '20px', color: '#3b82f6' }} />
                              </div>
                              <div>
                                <div style={{
                                  fontSize: '14px',
                                  fontWeight: '500',
                                  color: '#1f2937'
                                }}>
                                  {paciente?.nome}
                                </div>
                                <div style={{
                                  fontSize: '12px',
                                  color: '#6b7280'
                                }}>
                                  {consulta.especialidade}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: '16px 24px' }}>
                            <div style={{
                              fontSize: '14px',
                              color: '#1f2937',
                              marginBottom: '4px'
                            }}>
                              {formatarData(consulta.data)}
                            </div>
                            <div style={{
                              fontSize: '14px',
                              color: '#6b7280',
                              display: 'flex',
                              alignItems: 'center'
                            }}>
                              <Clock style={{ width: '14px', height: '14px', marginRight: '4px' }} />
                              {consulta.hora}
                            </div>
                          </td>
                          <td style={{ padding: '16px 24px' }}>
                            <div style={{
                              fontSize: '14px',
                              color: '#1f2937',
                              marginBottom: '4px'
                            }}>
                              {consulta.medico}
                            </div>
                            <div style={{
                              fontSize: '12px',
                              color: '#6b7280'
                            }}>
                              {consulta.tipo}
                            </div>
                          </td>
                          <td style={{ padding: '16px 24px', textAlign: 'center' }}>
                            <span style={{
                              fontSize: '12px',
                              fontWeight: '500',
                              color: getStatusColor(consulta.status),
                              backgroundColor: getStatusColor(consulta.status) + '20',
                              padding: '4px 12px',
                              borderRadius: '12px'
                            }}>
                              {getStatusLabel(consulta.status)}
                            </span>
                          </td>
                          <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                            <div style={{
                              display: 'flex',
                              justifyContent: 'flex-end',
                              gap: '8px'
                            }}>
                              <button
                                onClick={() => setSelectedConsulta(consulta)}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: '#3b82f6',
                                  cursor: 'pointer',
                                  padding: '4px',
                                  borderRadius: '4px'
                                }}
                              >
                                <Eye size={18} />
                              </button>
                              <button
                                onClick={() => {
                                  setEditingConsulta(consulta);
                                  setShowConsultaForm(true);
                                }}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: '#6366f1',
                                  cursor: 'pointer',
                                  padding: '4px',
                                  borderRadius: '4px'
                                }}
                              >
                                <Edit size={18} />
                              </button>
                              <button
                                onClick={() => handleDeleteConsulta(consulta.id)}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: '#ef4444',
                                  cursor: 'pointer',
                                  padding: '4px',
                                  borderRadius: '4px'
                                }}
                              >
                                <Trash2 size={18} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {filtrarConsultas(consultas).length === 0 && (
                  <div style={{
                    textAlign: 'center',
                    padding: '48px 0',
                    color: '#6b7280'
                  }}>
                    <Calendar style={{ width: '48px', height: '48px', margin: '0 auto 16px' }} />
                    <p>Nenhuma consulta encontrada</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'relatorios' && (
          <div>
            <h2 style={{
              fontSize: isMobile ? '18px' : '20px',
              fontWeight: '600',
              color: '#1f2937',
              margin: '0 0 24px'
            }}>
              Relatórios e Estatísticas
            </h2>
            
            <div style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(auto-fit, minmax(250px, 1fr))',
              gap: isMobile ? '12px' : '24px'
            }}>
              {[
                { icon: User, label: 'Pacientes', value: pacientes.length, color: '#3b82f6' },
                { icon: Calendar, label: 'Consultas', value: consultas.length, color: '#10b981' },
                { icon: Clock, label: 'Hoje', value: consultas.filter(c => c.data === new Date().toISOString().split('T')[0]).length, color: '#f59e0b' },
                { icon: Activity, label: 'Realizadas', value: consultas.filter(c => c.status === 'realizada').length, color: '#8b5cf6' }
              ].map((stat, index) => {
                const Icon = stat.icon;
                return (
                  <div key={index} style={{
                    backgroundColor: 'white',
                    padding: isMobile ? '16px' : '24px',
                    borderRadius: '8px',
                    boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)'
                  }}>
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center',
                      flexDirection: isMobile ? 'column' : 'row',
                      textAlign: isMobile ? 'center' : 'left'
                    }}>
                      <Icon style={{
                        width: isMobile ? '24px' : '32px',
                        height: isMobile ? '24px' : '32px',
                        color: stat.color,
                        marginRight: isMobile ? '0' : '16px',
                        marginBottom: isMobile ? '8px' : '0'
                      }} />
                      <div>
                        <p style={{
                          fontSize: isMobile ? '12px' : '14px',
                          fontWeight: '500',
                          color: '#6b7280',
                          margin: '0 0 4px'
                        }}>
                          {stat.label}
                        </p>
                        <p style={{
                          fontSize: isMobile ? '18px' : '24px',
                          fontWeight: '600',
                          color: '#1f2937',
                          margin: 0
                        }}>
                          {stat.value}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Gráfico de Consultas por Status */}
            <div style={{
              backgroundColor: 'white',
              padding: isMobile ? '16px' : '24px',
              borderRadius: '8px',
              boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
              marginTop: isMobile ? '16px' : '24px'
            }}>
              <h3 style={{
                fontSize: isMobile ? '16px' : '18px',
                fontWeight: '600',
                color: '#1f2937',
                marginBottom: '16px'
              }}>
                📊 Consultas por Status
              </h3>
              <div style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)',
                gap: '16px'
              }}>
                {[
                  { status: 'agendada', label: 'Agendadas', color: '#3b82f6' },
                  { status: 'realizada', label: 'Realizadas', color: '#10b981' },
                  { status: 'cancelada', label: 'Canceladas', color: '#ef4444' },
                  { status: 'falta', label: 'Faltas', color: '#f59e0b' }
                ].map(item => {
                  const count = consultas.filter(c => c.status === item.status).length;
                  const total = consultas.length;
                  const percentage = total > 0 ? Math.round((count / total) * 100) : 0;
                  
                  return (
                    <div key={item.status} style={{
                      textAlign: 'center',
                      padding: '12px',
                      borderRadius: '6px',
                      backgroundColor: item.color + '10'
                    }}>
                      <div style={{
                        fontSize: isMobile ? '20px' : '24px',
                        fontWeight: '600',
                        color: item.color,
                        marginBottom: '4px'
                      }}>
                        {count}
                      </div>
                      <div style={{
                        fontSize: isMobile ? '12px' : '14px',
                        color: '#6b7280',
                        marginBottom: '4px'
                      }}>
                        {item.label}
                      </div>
                      <div style={{
                        fontSize: '12px',
                        color: item.color,
                        fontWeight: '500'
                      }}>
                        {percentage}%
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Modal Formulário de Consulta */}
      {showConsultaForm && (
        <FormularioConsulta
          consulta={editingConsulta}
          onSave={handleSaveConsulta}
          onCancel={() => {
            setShowConsultaForm(false);
            setEditingConsulta(null);
          }}
        />
      )}

      {/* Modal Formulário de Paciente */}
      {showForm && (
        <FormularioPaciente
          paciente={editingPaciente}
          onSave={handleSavePaciente}
          onCancel={() => {
            setShowForm(false);
            setEditingPaciente(null);
          }}
        />
      )}

      {/* Modal Detalhes da Consulta */}
      {selectedConsulta && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: isMobile ? 'flex-start' : 'center',
          justifyContent: 'center',
          padding: isMobile ? '0' : '20px',
          zIndex: 1000,
          overflowY: 'auto'
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: isMobile ? '0' : '12px',
            padding: isMobile ? '16px' : '30px',
            width: '100%',
            maxWidth: isMobile ? '100%' : '1000px',
            minHeight: isMobile ? '100vh' : 'auto',
            maxHeight: isMobile ? '100vh' : '90vh',
            overflowY: 'auto',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: isMobile ? '20px' : '30px',
              borderBottom: '1px solid #e5e7eb',
              paddingBottom: '20px'
            }}>
              <h2 style={{
                fontSize: isMobile ? '18px' : '24px',
                fontWeight: 'bold',
                color: '#1f2937',
                margin: 0,
                lineHeight: '1.2'
              }}>
                🩺 {isMobile ? 'Consulta' : `Consulta - ${getPacienteById(selectedConsulta.pacienteId)?.nome}`}
              </h2>
              <button 
                onClick={() => setSelectedConsulta(null)} 
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#6b7280',
                  cursor: 'pointer',
                  padding: '8px',
                  borderRadius: '6px'
                }}
              >
                <X size={isMobile ? 28 : 24} />
              </button>
            </div>
            
            <div style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(300px, 1fr))',
              gap: isMobile ? '20px' : '30px'
            }}>
              <div>
                <h3 style={{
                  fontSize: isMobile ? '16px' : '18px',
                  fontWeight: '600',
                  color: '#1f2937',
                  marginBottom: '12px'
                }}>
                  📅 Informações da Consulta
                </h3>
                <div style={{
                  backgroundColor: '#f0f9ff',
                  padding: isMobile ? '16px' : '20px',
                  borderRadius: '8px',
                  fontSize: isMobile ? '15px' : '14px',
                  lineHeight: '1.6',
                  border: '1px solid #e0f2fe'
                }}>
                  <p style={{ margin: '0 0 8px' }}>
                    <strong>Paciente:</strong> {getPacienteById(selectedConsulta.pacienteId)?.nome}
                  </p>
                  <p style={{ margin: '0 0 8px' }}>
                    <strong>Data/Hora:</strong> {formatarDataHora(selectedConsulta.data, selectedConsulta.hora)}
                  </p>
                  <p style={{ margin: '0 0 8px' }}>
                    <strong>Médico:</strong> {selectedConsulta.medico}
                  </p>
                  <p style={{ margin: '0 0 8px' }}>
                    <strong>Especialidade:</strong> {selectedConsulta.especialidade}
                  </p>
                  <p style={{ margin: '0 0 8px' }}>
                    <strong>Tipo:</strong> {selectedConsulta.tipo}
                  </p>
                  <p style={{ margin: 0 }}>
                    <strong>Status:</strong> 
                    <span style={{
                      marginLeft: '8px',
                      color: getStatusColor(selectedConsulta.status),
                      fontWeight: '600'
                    }}>
                      {getStatusLabel(selectedConsulta.status)}
                    </span>
                  </p>
                </div>
              </div>

              {selectedConsulta.sinaisVitais && Object.values(selectedConsulta.sinaisVitais).some(v => v) && (
                <div>
                  <h3 style={{
                    fontSize: isMobile ? '16px' : '18px',
                    fontWeight: '600',
                    color: '#1f2937',
                    marginBottom: '12px'
                  }}>
                    💓 Sinais Vitais
                  </h3>
                  <div style={{
                    backgroundColor: '#fef2f2',
                    padding: isMobile ? '16px' : '20px',
                    borderRadius: '8px',
                    fontSize: isMobile ? '15px' : '14px',
                    lineHeight: '1.6',
                    border: '1px solid #fecaca'
                  }}>
                    {selectedConsulta.sinaisVitais.pressaoArterial && (
                      <p style={{ margin: '0 0 8px' }}>
                        <strong>PA:</strong> {selectedConsulta.sinaisVitais.pressaoArterial} mmHg
                      </p>
                    )}
                    {selectedConsulta.sinaisVitais.frequenciaCardiaca && (
                      <p style={{ margin: '0 0 8px' }}>
                        <strong>FC:</strong> {selectedConsulta.sinaisVitais.frequenciaCardiaca} bpm
                      </p>
                    )}
                    {selectedConsulta.sinaisVitais.temperatura && (
                      <p style={{ margin: '0 0 8px' }}>
                        <strong>Temperatura:</strong> {selectedConsulta.sinaisVitais.temperatura}°C
                      </p>
                    )}
                    {selectedConsulta.sinaisVitais.peso && (
                      <p style={{ margin: '0 0 8px' }}>
                        <strong>Peso:</strong> {selectedConsulta.sinaisVitais.peso} kg
                      </p>
                    )}
                    {selectedConsulta.sinaisVitais.altura && (
                      <p style={{ margin: 0 }}>
                        <strong>Altura:</strong> {selectedConsulta.sinaisVitais.altura} m
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {selectedConsulta.queixaPrincipal && (
              <div style={{ marginTop: isMobile ? '20px' : '30px' }}>
                <h3 style={{
                  fontSize: isMobile ? '16px' : '18px',
                  fontWeight: '600',
                  color: '#1f2937',
                  marginBottom: '12px'
                }}>
                  🗣️ Queixa Principal
                </h3>
                <div style={{
                  backgroundColor: '#fffbeb',
                  padding: isMobile ? '16px' : '20px',
                  borderRadius: '8px',
                  fontSize: isMobile ? '15px' : '14px',
                  lineHeight: '1.6',
                  border: '1px solid #fed7aa'
                }}>
                  {selectedConsulta.queixaPrincipal}
                </div>
              </div>
            )}

            {selectedConsulta.exameFisico && (
              <div style={{ marginTop: isMobile ? '20px' : '30px' }}>
                <h3 style={{
                  fontSize: isMobile ? '16px' : '18px',
                  fontWeight: '600',
                  color: '#1f2937',
                  marginBottom: '12px'
                }}>
                  🔍 Exame Físico
                </h3>
                <div style={{
                  backgroundColor: '#f0fdf4',
                  padding: isMobile ? '16px' : '20px',
                  borderRadius: '8px',
                  fontSize: isMobile ? '15px' : '14px',
                  lineHeight: '1.6',
                  border: '1px solid #bbf7d0'
                }}>
                  {selectedConsulta.exameFisico}
                </div>
              </div>
            )}

            {selectedConsulta.hipoteseDiagnostica && (
              <div style={{ marginTop: isMobile ? '20px' : '30px' }}>
                <h3 style={{
                  fontSize: isMobile ? '16px' : '18px',
                  fontWeight: '600',
                  color: '#1f2937',
                  marginBottom: '12px'
                }}>
                  🎯 Diagnóstico
                </h3>
                <div style={{
                  backgroundColor: '#faf5ff',
                  padding: isMobile ? '16px' : '20px',
                  borderRadius: '8px',
                  fontSize: isMobile ? '15px' : '14px',
                  lineHeight: '1.6',
                  border: '1px solid #e9d5ff'
                }}>
                  <p style={{ margin: '0 0 8px' }}>
                    <strong>Hipótese:</strong> {selectedConsulta.hipoteseDiagnostica}
                  </p>
                  {selectedConsulta.cid10 && (
                    <p style={{ margin: 0 }}>
                      <strong>CID-10:</strong> {selectedConsulta.cid10}
                    </p>
                  )}
                </div>
              </div>
            )}

            <div style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(300px, 1fr))',
              gap: isMobile ? '20px' : '30px',
              marginTop: isMobile ? '20px' : '30px'
            }}>
              {selectedConsulta.conduta && (
                <div>
                  <h3 style={{
                    fontSize: isMobile ? '16px' : '18px',
                    fontWeight: '600',
                    color: '#1f2937',
                    marginBottom: '12px'
                  }}>
                    📋 Conduta
                  </h3>
                  <div style={{
                    backgroundColor: '#f8fafc',
                    padding: isMobile ? '16px' : '20px',
                    borderRadius: '8px',
                    fontSize: isMobile ? '15px' : '14px',
                    lineHeight: '1.6',
                    border: '1px solid #e2e8f0'
                  }}>
                    {selectedConsulta.conduta}
                  </div>
                </div>
              )}

              {selectedConsulta.prescricoes && (
                <div>
                  <h3 style={{
                    fontSize: isMobile ? '16px' : '18px',
                    fontWeight: '600',
                    color: '#1f2937',
                    marginBottom: '12px'
                  }}>
                    💊 Prescrições
                  </h3>
                  <div style={{
                    backgroundColor: '#f0f9ff',
                    padding: isMobile ? '16px' : '20px',
                    borderRadius: '8px',
                    fontSize: isMobile ? '15px' : '14px',
                    lineHeight: '1.6',
                    border: '1px solid #e0f2fe',
                    whiteSpace: 'pre-line'
                  }}>
                    {selectedConsulta.prescricoes}
                  </div>
                </div>
              )}
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(300px, 1fr))',
              gap: isMobile ? '20px' : '30px',
              marginTop: isMobile ? '20px' : '30px'
            }}>
              {selectedConsulta.exameSolicitado && (
                <div>
                  <h3 style={{
                    fontSize: isMobile ? '16px' : '18px',
                    fontWeight: '600',
                    color: '#1f2937',
                    marginBottom: '12px'
                  }}>
                    🧪 Exames Solicitados
                  </h3>
                  <div style={{
                    backgroundColor: '#fffbeb',
                    padding: isMobile ? '16px' : '20px',
                    borderRadius: '8px',
                    fontSize: isMobile ? '15px' : '14px',
                    lineHeight: '1.6',
                    border: '1px solid #fed7aa'
                  }}>
                    {selectedConsulta.exameSolicitado}
                  </div>
                </div>
              )}

              {selectedConsulta.proximaConsulta && (
                <div>
                  <h3 style={{
                    fontSize: isMobile ? '16px' : '18px',
                    fontWeight: '600',
                    color: '#1f2937',
                    marginBottom: '12px'
                  }}>
                    📅 Próxima Consulta
                  </h3>
                  <div style={{
                    backgroundColor: '#f0fdf4',
                    padding: isMobile ? '16px' : '20px',
                    borderRadius: '8px',
                    fontSize: isMobile ? '15px' : '14px',
                    lineHeight: '1.6',
                    border: '1px solid #bbf7d0'
                  }}>
                    <strong>{formatarData(selectedConsulta.proximaConsulta)}</strong>
                  </div>
                </div>
              )}
            </div>

            {selectedConsulta.observacoes && (
              <div style={{ marginTop: isMobile ? '20px' : '30px' }}>
                <h3 style={{
                  fontSize: isMobile ? '16px' : '18px',
                  fontWeight: '600',
                  color: '#1f2937',
                  marginBottom: '12px'
                }}>
                  📝 Observações
                </h3>
                <div style={{
                  backgroundColor: '#f8fafc',
                  padding: isMobile ? '16px' : '20px',
                  borderRadius: '8px',
                  fontSize: isMobile ? '15px' : '14px',
                  lineHeight: '1.6',
                  border: '1px solid #e2e8f0'
                }}>
                  {selectedConsulta.observacoes}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
