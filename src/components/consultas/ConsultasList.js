import React from 'react';
import { Plus, Search, Calendar, CalendarDays, Clock, Check, Edit, X, Eye } from 'lucide-react';
import ConsultaCard from './ConsultaCard';

const ConsultasList = ({ 
  consultas,
  pacientes,
  consultaSearchTerm,
  setConsultaSearchTerm,
  selectedDate,
  setSelectedDate,
  onNovaConsulta,
  onEditarConsulta,
  onConcluirConsulta,
  onCancelarConsulta,
  isMobile,
  formatCPF,
  getStatusColor
}) => {
  
  // Funções auxiliares
  const getPacienteById = (id) => {
    return pacientes.find(p => p.id === id);
  };

  const getConsultasHoje = () => {
    const hoje = new Date().toISOString().split('T')[0];
    return consultas.filter(c => c.data === hoje && c.status === 'Agendada').length;
  };

  // Filtrar consultas
  const filteredConsultas = consultas.filter(consulta => {
    const paciente = getPacienteById(consulta.pacienteId);
    const matchesSearch = paciente && (
      paciente.nome.toLowerCase().includes(consultaSearchTerm.toLowerCase()) ||
      consulta.medico.toLowerCase().includes(consultaSearchTerm.toLowerCase())
    );
    const matchesDate = !selectedDate || consulta.data === selectedDate;
    return matchesSearch && matchesDate;
  });

  // Componente de tabela para Desktop
  const TabelaConsultas = () => (
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
              <th style={headerCellStyle}>Paciente</th>
              <th style={headerCellStyle}>Data/Hora</th>
              <th style={headerCellStyle}>Tipo/Motivo</th>
              <th style={{ ...headerCellStyle, textAlign: 'center' }}>Status</th>
              <th style={{ ...headerCellStyle, textAlign: 'right' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {filteredConsultas.map((consulta) => {
              const paciente = getPacienteById(consulta.pacienteId);
              return (
                <tr key={consulta.id} style={{ borderTop: '1px solid #e5e7eb' }}>
                  <td style={cellStyle}>
                    <div style={{ fontSize: '14px', fontWeight: '500', color: '#1f2937' }}>
                      {paciente?.nome}
                    </div>
                    <div style={{ fontSize: '14px', color: '#6b7280' }}>
                      {paciente && formatCPF(paciente.cpf)}
                    </div>
                  </td>
                  <td style={cellStyle}>
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
                  <td style={cellStyle}>
                    <div style={{ fontSize: '14px', fontWeight: '500', color: '#1f2937' }}>
                      {consulta.tipo}
                    </div>
                    <div style={{ fontSize: '14px', color: '#6b7280' }}>
                      {consulta.queixaPrincipal}
                    </div>
                  </td>
                  <td style={{ ...cellStyle, textAlign: 'center' }}>
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
                  <td style={{ ...cellStyle, textAlign: 'right' }}>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                      {consulta.status === 'Agendada' ? (
                        <>
                          <button
                            onClick={() => onConcluirConsulta(consulta)}
                            style={actionButtonStyle}
                            title="Realizar consulta"
                          >
                            <Check size={18} />
                          </button>
                          <button
                            onClick={() => onEditarConsulta(consulta)}
                            style={{ ...actionButtonStyle, color: '#6366f1' }}
                            title="Editar consulta"
                          >
                            <Edit size={18} />
                          </button>
                          <button
                            onClick={() => onCancelarConsulta(consulta.id)}
                            style={{ ...actionButtonStyle, color: '#ef4444' }}
                            title="Cancelar consulta"
                          >
                            <X size={18} />
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => onEditarConsulta(consulta)}
                          style={{ ...actionButtonStyle, color: '#3b82f6' }}
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
  );

  // Styles
  const headerCellStyle = {
    padding: '12px 24px',
    textAlign: 'left',
    fontSize: '12px',
    fontWeight: '500',
    color: '#6b7280',
    textTransform: 'uppercase'
  };

  const cellStyle = {
    padding: '16px 24px'
  };

  const actionButtonStyle = {
    background: 'none',
    border: 'none',
    color: '#10b981',
    cursor: 'pointer',
    padding: '4px',
    borderRadius: '4px'
  };

  return (
    <div>
      {/* Header com contadores e botão */}
      <div style={{
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        justifyContent: 'space-between',
        alignItems: isMobile ? 'stretch' : 'center',
        marginBottom: isMobile ? '16px' : '24px',
        gap: isMobile ? '12px' : '0'
      }}>
        <div>
          <h2 style={{
            fontSize: isMobile ? '18px' : '20px',
            fontWeight: '600',
            color: '#1f2937',
            margin: '0'
          }}>
            Consultas
          </h2>
          <p style={{
            fontSize: isMobile ? '14px' : '16px',
            color: '#6b7280',
            margin: '4px 0 0'
          }}>
            {getConsultasHoje()} agendadas para hoje • {filteredConsultas.length} total
          </p>
        </div>
        <button
          onClick={onNovaConsulta}
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
            width: isMobile ? '100%' : 'auto',
            transition: 'background-color 0.2s'
          }}
          onMouseEnter={(e) => e.target.style.backgroundColor = '#2563eb'}
          onMouseLeave={(e) => e.target.style.backgroundColor = '#3b82f6'}
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
        {/* Busca */}
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
              boxSizing: 'border-box',
              transition: 'border-color 0.2s'
            }}
            onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
            onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
          />
        </div>
        
        {/* Filtro de Data */}
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
              boxSizing: 'border-box',
              transition: 'border-color 0.2s'
            }}
            onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
            onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
          />
        </div>
      </div>

      {/* Lista de consultas - Mobile vs Desktop */}
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
              <ConsultaCard 
                key={consulta.id} 
                consulta={consulta}
                paciente={getPacienteById(consulta.pacienteId)}
                onConcluir={onConcluirConsulta}
                onEditar={onEditarConsulta}
                onCancelar={onCancelarConsulta}
                getStatusColor={getStatusColor}
              />
            ))
          )}
        </div>
      ) : (
        <TabelaConsultas />
      )}
    </div>
  );
};

export default ConsultasList;