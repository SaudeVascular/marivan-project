import React, { useState } from 'react';
import { X, Save, Check } from 'lucide-react';

const ConsultaForm = ({ 
  consulta, 
  pacientes, 
  onSave, 
  onCancel, 
  isMobile,
  formatCPF 
}) => {
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
  const isVisualizandoConsulta = consulta && consulta.status === 'Realizada';

  const handleSubmit = (e) => {
    e.preventDefault();
    const dadosParaSalvar = {
      ...formData,
      status: isRealizandoConsulta ? 'Realizada' : formData.status || 'Agendada'
    };
    onSave(dadosParaSalvar);
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Título do formulário baseado no contexto
  const getFormTitle = () => {
    if (isVisualizandoConsulta) return '📋 Detalhes da Consulta';
    if (isRealizandoConsulta) return '🩺 Realizar Consulta';
    if (consulta) return '✏️ Editar Consulta';
    return '➕ Nova Consulta';
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
        {/* Cabeçalho */}
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
            {getFormTitle()}
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
          {/* Seção: Dados Básicos da Consulta */}
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
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              📅 Dados da Consulta
            </h3>
            
            <div style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: isMobile ? '16px' : '20px'
            }}>
              {/* Paciente */}
              <div>
                <label style={{
                  display: 'block',
                  fontSize: isMobile ? '16px' : '14px',
                  fontWeight: '500',
                  color: '#374151',
                  marginBottom: '8px'
                }}>
                  Paciente*
                </label>
                <select
                  required
                  disabled={isRealizandoConsulta || isVisualizandoConsulta}
                  value={formData.pacienteId}
                  onChange={(e) => handleChange('pacienteId', parseInt(e.target.value))}
                  style={{
                    width: '100%',
                    padding: isMobile ? '16px 12px' : '12px',
                    border: '2px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: isMobile ? '18px' : '16px',
                    outline: 'none',
                    boxSizing: 'border-box',
                    backgroundColor: (isRealizandoConsulta || isVisualizandoConsulta) ? '#f3f4f6' : 'white',
                    cursor: (isRealizandoConsulta || isVisualizandoConsulta) ? 'not-allowed' : 'pointer'
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
              
              {/* Data */}
              <div>
                <label style={{
                  display: 'block',
                  fontSize: isMobile ? '16px' : '14px',
                  fontWeight: '500',
                  color: '#374151',
                  marginBottom: '8px'
                }}>
                  Data*
                </label>
                <input
                  type="date"
                  required
                  disabled={isRealizandoConsulta || isVisualizandoConsulta}
                  value={formData.data}
                  onChange={(e) => handleChange('data', e.target.value)}
                  style={{
                    width: '100%',
                    padding: isMobile ? '16px 12px' : '12px',
                    border: '2px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: isMobile ? '18px' : '16px',
                    outline: 'none',
                    boxSizing: 'border-box',
                    backgroundColor: (isRealizandoConsulta || isVisualizandoConsulta) ? '#f3f4f6' : 'white',
                    cursor: (isRealizandoConsulta || isVisualizandoConsulta) ? 'not-allowed' : 'text'
                  }}
                />
              </div>

              {/* Hora */}
              <div>
                <label style={{
                  display: 'block',
                  fontSize: isMobile ? '16px' : '14px',
                  fontWeight: '500',
                  color: '#374151',
                  marginBottom: '8px'
                }}>
                  Hora*
                </label>
                <input
                  type="time"
                  required
                  disabled={isRealizandoConsulta || isVisualizandoConsulta}
                  value={formData.hora}
                  onChange={(e) => handleChange('hora', e.target.value)}
                  style={{
                    width: '100%',
                    padding: isMobile ? '16px 12px' : '12px',
                    border: '2px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: isMobile ? '18px' : '16px',
                    outline: 'none',
                    boxSizing: 'border-box',
                    backgroundColor: (isRealizandoConsulta || isVisualizandoConsulta) ? '#f3f4f6' : 'white',
                    cursor: (isRealizandoConsulta || isVisualizandoConsulta) ? 'not-allowed' : 'text'
                  }}
                />
              </div>

              {/* Tipo */}
              <div>
                <label style={{
                  display: 'block',
                  fontSize: isMobile ? '16px' : '14px',
                  fontWeight: '500',
                  color: '#374151',
                  marginBottom: '8px'
                }}>
                  Tipo de Consulta
                </label>
                <select
                  value={formData.tipo}
                  disabled={isVisualizandoConsulta}
                  onChange={(e) => handleChange('tipo', e.target.value)}
                  style={{
                    width: '100%',
                    padding: isMobile ? '16px 12px' : '12px',
                    border: '2px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: isMobile ? '18px' : '16px',
                    outline: 'none',
                    boxSizing: 'border-box',
                    backgroundColor: isVisualizandoConsulta ? '#f3f4f6' : 'white',
                    cursor: isVisualizandoConsulta ? 'not-allowed' : 'pointer'
                  }}
                >
                  <option value="Consulta">Consulta</option>
                  <option value="Retorno">Retorno</option>
                  <option value="Emergência">Emergência</option>
                  <option value="Exame">Exame</option>
                </select>
              </div>

              {/* Médico */}
              <div>
                <label style={{
                  display: 'block',
                  fontSize: isMobile ? '16px' : '14px',
                  fontWeight: '500',
                  color: '#374151',
                  marginBottom: '8px'
                }}>
                  Médico
                </label>
                <input
                  type="text"
                  value={formData.medico}
                  disabled={isVisualizandoConsulta}
                  onChange={(e) => handleChange('medico', e.target.value)}
                  style={{
                    width: '100%',
                    padding: isMobile ? '16px 12px' : '12px',
                    border: '2px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: isMobile ? '18px' : '16px',
                    outline: 'none',
                    boxSizing: 'border-box',
                    backgroundColor: isVisualizandoConsulta ? '#f3f4f6' : 'white',
                    cursor: isVisualizandoConsulta ? 'not-allowed' : 'text'
                  }}
                />
              </div>

              {/* Especialidade */}
              <div>
                <label style={{
                  display: 'block',
                  fontSize: isMobile ? '16px' : '14px',
                  fontWeight: '500',
                  color: '#374151',
                  marginBottom: '8px'
                }}>
                  Especialidade
                </label>
                <input
                  type="text"
                  value={formData.especialidade}
                  disabled={isVisualizandoConsulta}
                  onChange={(e) => handleChange('especialidade', e.target.value)}
                  style={{
                    width: '100%',
                    padding: isMobile ? '16px 12px' : '12px',
                    border: '2px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: isMobile ? '18px' : '16px',
                    outline: 'none',
                    boxSizing: 'border-box',
                    backgroundColor: isVisualizandoConsulta ? '#f3f4f6' : 'white',
                    cursor: isVisualizandoConsulta ? 'not-allowed' : 'text'
                  }}
                />
              </div>
            </div>
          </div>

          {/* Seção: Informações Clínicas */}
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
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              🩺 Informações Clínicas
            </h3>

            {/* Queixa Principal */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{
                display: 'block',
                fontSize: isMobile ? '16px' : '14px',
                fontWeight: '500',
                color: '#374151',
                marginBottom: '8px'
              }}>
                Queixa Principal*
              </label>
              <textarea
                required
                value={formData.queixaPrincipal}
                disabled={isVisualizandoConsulta}
                onChange={(e) => handleChange('queixaPrincipal', e.target.value)}
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
                  boxSizing: 'border-box',
                  backgroundColor: isVisualizandoConsulta ? '#f3f4f6' : 'white',
                  cursor: isVisualizandoConsulta ? 'not-allowed' : 'text'
                }}
              />
            </div>

            {/* Campos adicionais para realização ou visualização de consulta */}
            {(isRealizandoConsulta || isVisualizandoConsulta) && (
              <>
                {/* Exame Físico */}
                <div style={{ marginBottom: '16px' }}>
                  <label style={{
                    display: 'block',
                    fontSize: isMobile ? '16px' : '14px',
                    fontWeight: '500',
                    color: '#374151',
                    marginBottom: '8px'
                  }}>
                    Exame Físico
                  </label>
                  <textarea
                    value={formData.exameFisico}
                    disabled={isVisualizandoConsulta}
                    onChange={(e) => handleChange('exameFisico', e.target.value)}
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
                      boxSizing: 'border-box',
                      backgroundColor: isVisualizandoConsulta ? '#f3f4f6' : 'white',
                      cursor: isVisualizandoConsulta ? 'not-allowed' : 'text'
                    }}
                  />
                </div>

                {/* Hipótese Diagnóstica */}
                <div style={{ marginBottom: '16px' }}>
                  <label style={{
                    display: 'block',
                    fontSize: isMobile ? '16px' : '14px',
                    fontWeight: '500',
                    color: '#374151',
                    marginBottom: '8px'
                  }}>
                    Hipótese Diagnóstica
                  </label>
                  <input
                    type="text"
                    value={formData.hipoteseDiagnostica}
                    disabled={isVisualizandoConsulta}
                    onChange={(e) => handleChange('hipoteseDiagnostica', e.target.value)}
                    placeholder="Diagnóstico provável..."
                    style={{
                      width: '100%',
                      padding: isMobile ? '16px 12px' : '12px',
                      border: '2px solid #d1d5db',
                      borderRadius: '8px',
                      fontSize: isMobile ? '18px' : '16px',
                      outline: 'none',
                      boxSizing: 'border-box',
                      backgroundColor: isVisualizandoConsulta ? '#f3f4f6' : 'white',
                      cursor: isVisualizandoConsulta ? 'not-allowed' : 'text'
                    }}
                  />
                </div>

                {/* Conduta */}
                <div style={{ marginBottom: '16px' }}>
                  <label style={{
                    display: 'block',
                    fontSize: isMobile ? '16px' : '14px',
                    fontWeight: '500',
                    color: '#374151',
                    marginBottom: '8px'
                  }}>
                    Conduta
                  </label>
                  <textarea
                    value={formData.conduta}
                    disabled={isVisualizandoConsulta}
                    onChange={(e) => handleChange('conduta', e.target.value)}
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
                      boxSizing: 'border-box',
                      backgroundColor: isVisualizandoConsulta ? '#f3f4f6' : 'white',
                      cursor: isVisualizandoConsulta ? 'not-allowed' : 'text'
                    }}
                  />
                </div>

                {/* Prescrições */}
                <div style={{ marginBottom: '16px' }}>
                  <label style={{
                    display: 'block',
                    fontSize: isMobile ? '16px' : '14px',
                    fontWeight: '500',
                    color: '#374151',
                    marginBottom: '8px'
                  }}>
                    Prescrições
                  </label>
                  <textarea
                    value={formData.prescricoes}
                    disabled={isVisualizandoConsulta}
                    onChange={(e) => handleChange('prescricoes', e.target.value)}
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
                      boxSizing: 'border-box',
                      backgroundColor: isVisualizandoConsulta ? '#f3f4f6' : 'white',
                      cursor: isVisualizandoConsulta ? 'not-allowed' : 'text'
                    }}
                  />
                </div>
              </>
            )}

            {/* Observações */}
            <div>
              <label style={{
                display: 'block',
                fontSize: isMobile ? '16px' : '14px',
                fontWeight: '500',
                color: '#374151',
                marginBottom: '8px'
              }}>
                Observações
              </label>
              <textarea
                value={formData.observacoes}
                disabled={isVisualizandoConsulta}
                onChange={(e) => handleChange('observacoes', e.target.value)}
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
                  boxSizing: 'border-box',
                  backgroundColor: isVisualizandoConsulta ? '#f3f4f6' : 'white',
                  cursor: isVisualizandoConsulta ? 'not-allowed' : 'text'
                }}
              />
            </div>
          </div>

          {/* Botões */}
          {!isVisualizandoConsulta && (
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
                  order: isMobile ? 2 : 1,
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => e.target.style.backgroundColor = '#f9fafb'}
                onMouseLeave={(e) => e.target.style.backgroundColor = 'white'}
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
                  order: isMobile ? 1 : 2,
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => e.target.style.backgroundColor = '#2563eb'}
                onMouseLeave={(e) => e.target.style.backgroundColor = '#3b82f6'}
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
          )}

          {/* Botão Fechar para visualização */}
          {isVisualizandoConsulta && (
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              paddingTop: '20px',
              borderTop: '1px solid #e5e7eb',
              marginTop: '20px'
            }}>
              <button
                type="button"
                onClick={onCancel}
                style={{
                  padding: isMobile ? '16px 32px' : '12px 32px',
                  border: 'none',
                  borderRadius: '8px',
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  fontSize: isMobile ? '18px' : '16px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => e.target.style.backgroundColor = '#2563eb'}
                onMouseLeave={(e) => e.target.style.backgroundColor = '#3b82f6'}
              >
                Fechar
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};

export default ConsultaForm;