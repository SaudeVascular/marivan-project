import React, { useState } from 'react';
import { X, Save } from 'lucide-react';

const PacienteForm = ({ paciente, onSave, onCancel, isMobile }) => {
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

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
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
            {paciente ? '✏️ Editar' : '➕ Novo'} Paciente
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
          {/* Dados Pessoais */}
          <fieldset style={{
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            padding: '20px',
            marginBottom: '20px'
          }}>
            <legend style={{
              fontSize: isMobile ? '16px' : '18px',
              fontWeight: '600',
              color: '#374151',
              padding: '0 8px'
            }}>
              👤 Dados Pessoais
            </legend>

            <div style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: isMobile ? '16px' : '20px'
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
                  onChange={(e) => handleChange('nome', e.target.value)}
                  style={{
                    width: '100%',
                    padding: isMobile ? '16px 12px' : '12px',
                    border: '2px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: isMobile ? '18px' : '16px',
                    outline: 'none',
                    boxSizing: 'border-box',
                    transition: 'border-color 0.2s'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                  onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
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
                  onChange={(e) => handleChange('cpf', e.target.value)}
                  placeholder="000.000.000-00"
                  style={{
                    width: '100%',
                    padding: isMobile ? '16px 12px' : '12px',
                    border: '2px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: isMobile ? '18px' : '16px',
                    outline: 'none',
                    boxSizing: 'border-box',
                    transition: 'border-color 0.2s'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                  onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
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
                  onChange={(e) => handleChange('dataNascimento', e.target.value)}
                  style={{
                    width: '100%',
                    padding: isMobile ? '16px 12px' : '12px',
                    border: '2px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: isMobile ? '18px' : '16px',
                    outline: 'none',
                    boxSizing: 'border-box',
                    transition: 'border-color 0.2s'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                  onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
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
                  onChange={(e) => handleChange('telefone', e.target.value)}
                  placeholder="(00) 00000-0000"
                  style={{
                    width: '100%',
                    padding: isMobile ? '16px 12px' : '12px',
                    border: '2px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: isMobile ? '18px' : '16px',
                    outline: 'none',
                    boxSizing: 'border-box',
                    transition: 'border-color 0.2s'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                  onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
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
                  onChange={(e) => handleChange('email', e.target.value)}
                  placeholder="email@exemplo.com"
                  style={{
                    width: '100%',
                    padding: isMobile ? '16px 12px' : '12px',
                    border: '2px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: isMobile ? '18px' : '16px',
                    outline: 'none',
                    boxSizing: 'border-box',
                    transition: 'border-color 0.2s'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                  onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
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
                  onChange={(e) => handleChange('convenio', e.target.value)}
                  placeholder="Nome do convênio"
                  style={{
                    width: '100%',
                    padding: isMobile ? '16px 12px' : '12px',
                    border: '2px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: isMobile ? '18px' : '16px',
                    outline: 'none',
                    boxSizing: 'border-box',
                    transition: 'border-color 0.2s'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                  onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                />
              </div>
            </div>

            <div style={{ marginTop: '20px' }}>
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
                onChange={(e) => handleChange('endereco', e.target.value)}
                placeholder="Rua, número, bairro, cidade - Estado"
                style={{
                  width: '100%',
                  padding: isMobile ? '16px 12px' : '12px',
                  border: '2px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: isMobile ? '18px' : '16px',
                  outline: 'none',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.2s'
                }}
                onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
              />
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)',
              gap: isMobile ? '16px' : '20px',
              marginTop: '20px'
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
                  onChange={(e) => handleChange('numeroConvenio', e.target.value)}
                  placeholder="Número da carteirinha"
                  style={{
                    width: '100%',
                    padding: isMobile ? '16px 12px' : '12px',
                    border: '2px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: isMobile ? '18px' : '16px',
                    outline: 'none',
                    boxSizing: 'border-box',
                    transition: 'border-color 0.2s'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                  onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
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
                  onChange={(e) => handleChange('contatoEmergencia', e.target.value)}
                  placeholder="Nome - Telefone"
                  style={{
                    width: '100%',
                    padding: isMobile ? '16px 12px' : '12px',
                    border: '2px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: isMobile ? '18px' : '16px',
                    outline: 'none',
                    boxSizing: 'border-box',
                    transition: 'border-color 0.2s'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                  onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                />
              </div>
            </div>
          </fieldset>

          {/* Informações Médicas */}
          <fieldset style={{
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            padding: '20px',
            marginBottom: '20px'
          }}>
            <legend style={{
              fontSize: isMobile ? '16px' : '18px',
              fontWeight: '600',
              color: '#374151',
              padding: '0 8px'
            }}>
              ⚕️ Informações Médicas
            </legend>

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
                onChange={(e) => handleChange('alergias', e.target.value)}
                rows="3"
                placeholder="Liste as alergias conhecidas..."
                style={{
                  width: '100%',
                  padding: isMobile ? '16px 12px' : '12px',
                  border: '2px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: isMobile ? '18px' : '16px',
                  outline: 'none',
                  resize: 'vertical',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.2s'
                }}
                onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
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
                onChange={(e) => handleChange('medicamentosUso', e.target.value)}
                rows="3"
                placeholder="Liste os medicamentos e dosagens..."
                style={{
                  width: '100%',
                  padding: isMobile ? '16px 12px' : '12px',
                  border: '2px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: isMobile ? '18px' : '16px',
                  outline: 'none',
                  resize: 'vertical',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.2s'
                }}
                onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
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
                onChange={(e) => handleChange('historicoFamiliar', e.target.value)}
                rows="3"
                placeholder="Doenças na família..."
                style={{
                  width: '100%',
                  padding: isMobile ? '16px 12px' : '12px',
                  border: '2px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: isMobile ? '18px' : '16px',
                  outline: 'none',
                  resize: 'vertical',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.2s'
                }}
                onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
              />
            </div>

            <div>
              <label style={{
                display: 'block',
                fontSize: isMobile ? '16px' : '14px',
                fontWeight: '500',
                color: '#374151',
                marginBottom: '8px'
              }}>Observações Gerais</label>
              <textarea
                value={formData.observacoes}
                onChange={(e) => handleChange('observacoes', e.target.value)}
                rows="4"
                placeholder="Informações adicionais importantes..."
                style={{
                  width: '100%',
                  padding: isMobile ? '16px 12px' : '12px',
                  border: '2px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: isMobile ? '18px' : '16px',
                  outline: 'none',
                  resize: 'vertical',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.2s'
                }}
                onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
              />
            </div>
          </fieldset>

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
                order: isMobile ? 2 : 1,
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.target.style.backgroundColor = '#f9fafb';
                e.target.style.borderColor = '#9ca3af';
              }}
              onMouseLeave={(e) => {
                e.target.style.backgroundColor = 'white';
                e.target.style.borderColor = '#d1d5db';
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
                order: isMobile ? 1 : 2,
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => e.target.style.backgroundColor = '#2563eb'}
              onMouseLeave={(e) => e.target.style.backgroundColor = '#3b82f6'}
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

export default PacienteForm;