import React, { useState, useEffect } from 'react';
import { 
  Search, Plus, User, Calendar, FileText, Activity, Phone, Mail, Save, 
  X, Eye, Edit, Trash2, Clock, Stethoscope, 
  Check, CalendarDays 
} from 'lucide-react';

const ProntuarioEletronico = () => {
  const [activeTab, setActiveTab] = useState('pacientes');
  const [pacientes, setPacientes] = useState([]);
  const [consultas, setConsultas] = useState([]);
  const [selectedPaciente, setSelectedPaciente] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingPaciente, setEditingPaciente] = useState(null);
  const [isMobile, setIsMobile] = useState(false);
  
  // Estados para Consultas
  const [showConsultaForm, setShowConsultaForm] = useState(false);
  const [editingConsulta, setEditingConsulta] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [consultaSearchTerm, setConsultaSearchTerm] = useState('');

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
      }
    ];

    const consultasIniciais = [
      {
        id: 1,
        pacienteId: 1,
        data: '2025-01-20',
        hora: '09:00',
        medico: 'Dr. Carlos Mendes',
        especialidade: 'Clínica Geral',
        tipo: 'Consulta',
        status: 'Realizada',
        queixaPrincipal: 'Dor de cabeça frequente',
        exameFisico: 'PA: 140/90 mmHg, FC: 80 bpm, Temp: 36.5°C',
        hipoteseDiagnostica: 'Cefaleia tensional',
        conduta: 'Prescrição de analgésico, retorno em 15 dias',
        prescricoes: 'Paracetamol 750mg - 8/8h por 3 dias',
        observacoes: 'Orientado sobre controle da pressão arterial'
      },
      {
        id: 2,
        pacienteId: 2,
        data: '2025-08-01',
        hora: '10:30',
        medico: 'Dr. Carlos Mendes',
        especialidade: 'Clínica Geral',
        tipo: 'Retorno',
        status: 'Agendada',
        queixaPrincipal: 'Acompanhamento diabetes',
        observacoes: 'Trazer exames recentes'
      },
      {
        id: 3,
        pacienteId: 1,
        data: '2025-08-01',
        hora: '14:00',
        medico: 'Dr. Carlos Mendes',
        especialidade: 'Clínica Geral',
        tipo: 'Consulta',
        status: 'Agendada',
        queixaPrincipal: 'Check-up anual',
        observacoes: 'Jejum de 12h para coleta de sangue'
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

  const handleDeletePaciente = (id) => {
    if (window.confirm('Tem certeza que deseja excluir este paciente?')) {
      setPacientes(prev => prev.filter(p => p.id !== id));
      setConsultas(prev => prev.filter(c => c.pacienteId !== id));
    }
  };

  // Funções para Consultas
  const handleSaveConsulta = (dadosConsulta) => {
    if (editingConsulta) {
      setConsultas(prev => prev.map(c => 
        c.id === editingConsulta.id ? { ...dadosConsulta, id: editingConsulta.id } : c
      ));
      setEditingConsulta(null);
    } else {
      const novaConsulta = {
        ...dadosConsulta,
        id: Date.now(),
        status: 'Agendada'
      };
      setConsultas(prev => [...prev, novaConsulta]);
    }
    setShowConsultaForm(false);
  };

  const handleDeleteConsulta = (id) => {
    if (window.confirm('Tem certeza que deseja cancelar esta consulta?')) {
      setConsultas(prev => prev.filter(c => c.id !== id));
    }
  };

  const handleConcluirConsulta = (consulta) => {
    setEditingConsulta(consulta);
    setShowConsultaForm(true);
  };

  const getPacienteById = (id) => {
    return pacientes.find(p => p.id === id);
  };

  const filteredConsultas = consultas.filter(consulta => {
    const paciente = getPacienteById(consulta.pacienteId);
    const matchesSearch = paciente && (
      paciente.nome.toLowerCase().includes(consultaSearchTerm.toLowerCase()) ||
      consulta.medico.toLowerCase().includes(consultaSearchTerm.toLowerCase())
    );
    const matchesDate = !selectedDate || consulta.data === selectedDate;
    return matchesSearch && matchesDate;
  });

  const getStatusColor = (status) => {
    switch(status) {
      case 'Agendada': return '#3b82f6';
      case 'Realizada': return '#10b981';
      case 'Cancelada': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const getConsultasHoje = () => {
    const hoje = new Date().toISOString().split('T')[0];
    return consultas.filter(c => c.data === hoje && c.status === 'Agendada').length;
  };

  // Componente do Formulário de Consulta
  const FormularioConsulta = ({ consulta, onSave, onCancel }) => {
    const [formData, setFormData] = useState(consulta || {
      pacienteId: '',
      data: '',
      hora: '',
      medico: 'Dr. Carlos Mendes',
      especialidade: 'Clínica Geral',
      tipo: 'Consulta',
      queixaPrincipal: '',
      exameFisico: '',
      hipoteseDiagnostica: '',
      conduta: '',
      prescricoes: '',
      observacoes: ''
    });

    const isRealizandoConsulta = consulta && consulta.status === 'Agendada';

    const handleSubmit = (e) => {
      e.preventDefault();
      const dadosParaSalvar = {
        ...formData,
        status: isRealizandoConsulta ? 'Realizada' : formData.status || 'Agendada'
      };
      onSave(dadosParaSalvar);
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
            paddingBottom: '20px',
            position: isMobile ? 'sticky' : 'static',
            top: 0,
            backgroundColor: 'white',
            zIndex: 10
          }}>
            <h2 style={{
              fontSize: isMobile ? '20px' : '24px',
              fontWeight: 'bold',
              color: '#1f2937',
              margin: 0
            }}>
              {isRealizandoConsulta ? '🩺 Realizar Consulta' : (consulta ? '✏️ Editar' : '➕ Nova')} Consulta
            </h2>
            <button 
              onClick={onCancel} 
              style={{
                background: 'none',
                border: 'none',
                color: '#6b7280',
                cursor: 'pointer',
                padding: '8px',
                borderRadius: '6px',
                fontSize: isMobile ? '24px' : '20px'
              }}
            >
              <X size={isMobile ? 28 : 24} />
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            {/* Dados Básicos da Consulta */}
            <div style={{
              backgroundColor: '#f9fafb',
              padding: isMobile ? '16px' : '20px',
              borderRadius: '8px',
              marginBottom: '20px'
            }}>
              <h3 style={{
                fontSize: isMobile ? '16px' : '18px',
                fontWeight: '600',
                color: '#374151',
                marginBottom: '16px'
              }}>
                📅 Dados da Consulta
              </h3>
              
              <div style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: isMobile ? '16px' : '20px'
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
                    disabled={isRealizandoConsulta}
                    value={formData.pacienteId}
                    onChange={(e) => setFormData(prev => ({...prev, pacienteId: parseInt(e.target.value)}))}
                    style={{
                      width: '100%',
                      padding: isMobile ? '16px 12px' : '12px',
                      border: '2px solid #d1d5db',
                      borderRadius: '8px',
                      fontSize: isMobile ? '18px' : '16px',
                      outline: 'none',
                      boxSizing: 'border-box',
                      backgroundColor: isRealizandoConsulta ? '#f3f4f6' : 'white'
                    }}
                  >
                    <option value="">Selecione um paciente</option>
                    {pacientes.map(paciente => (
                      <option key={paciente.id} value={paciente.id}>
                        {paciente.nome} - {formatCPF(paciente.cpf)}
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
                    disabled={isRealizandoConsulta}
                    value={formData.data}
                    onChange={(e) => setFormData(prev => ({...prev, data: e.target.value}))}
                    style={{
                      width: '100%',
                      padding: isMobile ? '16px 12px' : '12px',
                      border: '2px solid #d1d5db',
                      borderRadius: '8px',
                      fontSize: isMobile ? '18px' : '16px',
                      outline: 'none',
                      boxSizing: 'border-box',
                      backgroundColor: isRealizandoConsulta ? '#f3f4f6' : 'white'
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
                  }}>Hora*</label>
                  <input
                    type="time"
                    required
                    disabled={isRealizandoConsulta}
                    value={formData.hora}
                    onChange={(e) => setFormData(prev => ({...prev, hora: e.target.value}))}
                    style={{
                      width: '100%',
                      padding: isMobile ? '16px 12px' : '12px',
                      border: '2px solid #d1d5db',
                      borderRadius: '8px',
                      fontSize: isMobile ? '18px' : '16px',
                      outline: 'none',
                      boxSizing: 'border-box',
                      backgroundColor: isRealizandoConsulta ? '#f3f4f6' : 'white'
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
                  }}>Tipo</label>
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
                    <option value="Emergência">Emergência</option>
                    <option value="Exame">Exame</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Informações Clínicas */}
            <div style={{
              backgroundColor: '#fff',
              padding: isMobile ? '16px' : '20px',
              borderRadius: '8px',
              border: '1px solid #e5e7eb',
              marginBottom: '20px'
            }}>
              <h3 style={{
                fontSize: isMobile ? '16px' : '18px',
                fontWeight: '600',
                color: '#374151',
                marginBottom: '16px'
              }}>
                🩺 Informações Clínicas
              </h3>

              <div style={{ marginBottom: '16px' }}>
                <label style={{
                  display: 'block',
                  fontSize: isMobile ? '16px' : '14px',
                  fontWeight: '500',
                  color: '#374151',
                  marginBottom: '8px'
                }}>Queixa Principal*</label>
                <textarea
                  required
                  value={formData.queixaPrincipal}
                  onChange={(e) => setFormData(prev => ({...prev, queixaPrincipal: e.target.value}))}
                  rows="3"
                  placeholder="Descreva o motivo da consulta..."
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

              {isRealizandoConsulta && (
                <>
                  <div style={{ marginBottom: '16px' }}>
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
                      placeholder="PA, FC, Temp, achados do exame físico..."
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

                  <div style={{ marginBottom: '16px' }}>
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
                      placeholder="Diagnóstico provável..."
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

                  <div style={{ marginBottom: '16px' }}>
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
                      placeholder="Tratamento recomendado, exames solicitados..."
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

                  <div style={{ marginBottom: '16px' }}>
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
                      placeholder="Medicamentos prescritos, posologia..."
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
                </>
              )}

              <div>
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
                  rows="3"
                  placeholder="Informações adicionais..."
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
            </div>

            {/* Botões */}
            <div style={{
              display: 'flex',
              flexDirection: isMobile ? 'column' : 'row',
              justifyContent: 'flex-end',
              gap: isMobile ? '12px' : '15px',
              paddingTop: '20px',
              borderTop: '1px solid #e5e7eb',
              position: isMobile ? 'sticky' : 'static',
              bottom: 0,
              backgroundColor: 'white',
              marginTop: '20px'
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
                  cursor: 'pointer',
                  order: isMobile ? 2 : 1
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
                  gap: '8px',
                  order: isMobile ? 1 : 2
                }}
              >
                {isRealizandoConsulta ? (
                  <>
                    <Check size={isMobile ? 20 : 18} />
                    Concluir Consulta
                  </>
                ) : (
                  <>
                    <Save size={isMobile ? 20 : 18} />
                    Salvar
                  </>
                )}
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
        border: '1px solid #e5e7eb',
        borderLeft: `4px solid ${getStatusColor(consulta.status)}`
      }}>
        <div style={{ marginBottom: '12px' }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: '8px'
          }}>
            <h3 style={{
              fontSize: '16px',
              fontWeight: '600',
              color: '#1f2937',
              margin: '0'
            }}>
              {paciente?.nome}
            </h3>
            <span style={{
              fontSize: '12px',
              fontWeight: '500',
              color: getStatusColor(consulta.status),
              backgroundColor: `${getStatusColor(consulta.status)}15`,
              padding: '4px 8px',
              borderRadius: '4px'
            }}>
              {consulta.status}
            </span>
          </div>
          
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            fontSize: '14px',
            color: '#6b7280',
            flexWrap: 'wrap'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Clock size={14} />
              {consulta.hora}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Calendar size={14} />
              {new Date(consulta.data).toLocaleDateString('pt-BR')}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Stethoscope size={14} />
              {consulta.tipo}
            </div>
          </div>
          
          <p style={{
            fontSize: '14px',
            color: '#374151',
            margin: '8px 0 0',
            lineHeight: '1.4'
          }}>
            <strong>Motivo:</strong> {consulta.queixaPrincipal}
          </p>
          
          {consulta.observacoes && (
            <p style={{
              fontSize: '13px',
              color: '#6b7280',
              margin: '8px 0 0',
              fontStyle: 'italic'
            }}>
              📝 {consulta.observacoes}
            </p>
          )}
        </div>
        
        <div style={{
          display: 'flex',
          justifyContent: 'space-around',
          paddingTop: '12px',
          borderTop: '1px solid #f3f4f6'
        }}>
          {consulta.status === 'Agendada' && (
            <>
              <button
                onClick={() => handleConcluirConsulta(consulta)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  background: 'none',
                  border: 'none',
                  color: '#10b981',
                  cursor: 'pointer',
                  padding: '8px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: '500'
                }}
              >
                <Check size={20} style={{ marginBottom: '4px' }} />
                Realizar
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
                <X size={20} style={{ marginBottom: '4px' }} />
                Cancelar
              </button>
            </>
          )}
          {consulta.status === 'Realizada' && (
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
                color: '#3b82f6',
                cursor: 'pointer',
                padding: '8px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: '500',
                margin: '0 auto'
              }}
            >
              <Eye size={20} style={{ marginBottom: '4px' }} />
              Ver Detalhes
            </button>
          )}
        </div>
      </div>
    );
  };

  // Componente do Formulário Mobile-Friendly para Pacientes
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
            paddingBottom: '20px',
            position: isMobile ? 'sticky' : 'static',
            top: 0,
            backgroundColor: 'white',
            zIndex: 10
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
                borderRadius: '6px',
                fontSize: isMobile ? '24px' : '20px'
              }}
            >
              <X size={isMobile ? 28 : 24} />
            </button>
          </div>

          <div>
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
              borderTop: '1px solid #e5e7eb',
              position: isMobile ? 'sticky' : 'static',
              bottom: 0,
              backgroundColor: 'white',
              marginTop: '20px'
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
                  cursor: 'pointer',
                  order: isMobile ? 2 : 1
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSubmit}
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
                  gap: '8px',
                  order: isMobile ? 1 : 2
                }}
              >
                <Save size={isMobile ? 20 : 18} />
                Salvar
              </button>
            </div>
          </div>
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
                Consultas ({getConsultasHoje()} hoje)
              </h2>
              <button
                onClick={() => setShowConsultaForm(true)}
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
                Nova Consulta
              </button>
            </div>

            {/* Filtros */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : '1fr 200px',
              gap: isMobile ? '12px' : '16px',
              marginBottom: isMobile ? '16px' : '24px'
            }}>
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
                  placeholder="Pesquisar paciente ou médico..."
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
              
              <div style={{ position: 'relative' }}>
                <CalendarDays 
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
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
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

            {/* Lista de consultas */}
            {isMobile ? (
              <div>
                {filteredConsultas.length === 0 ? (
                  <div style={{
                    backgroundColor: 'white',
                    borderRadius: '12px',
                    padding: '48px 16px',
                    textAlign: 'center',
                    boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
                    border: '1px solid #e5e7eb'
                  }}>
                    <Calendar style={{
                      width: '48px',
                      height: '48px',
                      color: '#9ca3af',
                      margin: '0 auto 16px'
                    }} />
                    <p style={{
                      color: '#6b7280',
                      margin: 0
                    }}>
                      Nenhuma consulta encontrada
                    </p>
                  </div>
                ) : (
                  filteredConsultas.map((consulta) => (
                    <ConsultaCard key={consulta.id} consulta={consulta} />
                  ))
                )}
              </div>
            ) : (
              <div style={{
                backgroundColor: 'white',
                borderRadius: '8px',
                boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
                overflow: 'hidden'
              }}>
                {filteredConsultas.length === 0 ? (
                  <div style={{
                    padding: '48px',
                    textAlign: 'center'
                  }}>
                    <Calendar style={{
                      width: '64px',
                      height: '64px',
                      color: '#9ca3af',
                      margin: '0 auto 16px'
                    }} />
                    <p style={{
                      color: '#6b7280',
                      margin: 0,
                      fontSize: '16px'
                    }}>
                      Nenhuma consulta encontrada
                    </p>
                  </div>
                ) : (
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
                          Tipo/Motivo
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
                      {filteredConsultas.map((consulta) => {
                        const paciente = getPacienteById(consulta.pacienteId);
                        return (
                          <tr 
                            key={consulta.id} 
                            style={{ borderTop: '1px solid #e5e7eb' }}
                          >
                            <td style={{ padding: '16px 24px' }}>
                              <div style={{
                                fontSize: '14px',
                                fontWeight: '500',
                                color: '#1f2937'
                              }}>
                                {paciente?.nome}
                              </div>
                              <div style={{
                                fontSize: '14px',
                                color: '#6b7280'
                              }}>
                                {paciente && formatCPF(paciente.cpf)}
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
                                <Calendar style={{ width: '16px', height: '16px', marginRight: '4px' }} />
                                {new Date(consulta.data).toLocaleDateString('pt-BR')}
                              </div>
                              <div style={{
                                fontSize: '14px',
                                color: '#6b7280',
                                display: 'flex',
                                alignItems: 'center'
                              }}>
                                <Clock style={{ width: '16px', height: '16px', marginRight: '4px' }} />
                                {consulta.hora}
                              </div>
                            </td>
                            <td style={{ padding: '16px 24px' }}>
                              <div style={{
                                fontSize: '14px',
                                fontWeight: '500',
                                color: '#1f2937'
                              }}>
                                {consulta.tipo}
                              </div>
                              <div style={{
                                fontSize: '14px',
                                color: '#6b7280'
                              }}>
                                {consulta.queixaPrincipal}
                              </div>
                            </td>
                            <td style={{ padding: '16px 24px', textAlign: 'center' }}>
                              <span style={{
                                fontSize: '12px',
                                fontWeight: '500',
                                color: getStatusColor(consulta.status),
                                backgroundColor: `${getStatusColor(consulta.status)}15`,
                                padding: '4px 12px',
                                borderRadius: '4px'
                              }}>
                                {consulta.status}
                              </span>
                            </td>
                            <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                              <div style={{
                                display: 'flex',
                                justifyContent: 'flex-end',
                                gap: '8px'
                              }}>
                                {consulta.status === 'Agendada' ? (
                                  <>
                                    <button
                                      onClick={() => handleConcluirConsulta(consulta)}
                                      style={{
                                        background: 'none',
                                        border: 'none',
                                        color: '#10b981',
                                        cursor: 'pointer',
                                        padding: '4px',
                                        borderRadius: '4px'
                                      }}
                                      title="Realizar consulta"
                                    >
                                      <Check size={18} />
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
                                      title="Editar consulta"
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
                                      title="Cancelar consulta"
                                    >
                                      <X size={18} />
                                    </button>
                                  </>
                                ) : (
                                  <button
                                    onClick={() => {
                                      setEditingConsulta(consulta);
                                      setShowConsultaForm(true);
                                    }}
                                    style={{
                                      background: 'none',
                                      border: 'none',
                                      color: '#3b82f6',
                                      cursor: 'pointer',
                                      padding: '4px',
                                      borderRadius: '4px'
                                    }}
                                    title="Ver detalhes"
                                  >
                                    <Eye size={18} />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
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
                { icon: Activity, label: 'Sistema', value: 'Online', color: '#8b5cf6' },
                { icon: FileText, label: 'Versão', value: '2.1', color: '#f59e0b' }
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
                          color: stat.value === 'Online' ? '#10b981' : '#1f2937',
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
          </div>
        )}
      </main>

      {/* Modal Formulário */}
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

      {/* Modal Formulário Consulta */}
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

      {/* Modal do Prontuário Mobile-Friendly */}
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
              paddingBottom: '20px',
              position: isMobile ? 'sticky' : 'static',
              top: 0,
              backgroundColor: 'white',
              zIndex: 10
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
                          📅 {new Date(consulta.data).toLocaleDateString('pt-BR')}
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