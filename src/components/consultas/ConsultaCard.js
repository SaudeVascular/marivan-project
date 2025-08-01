import React from 'react';
import { Clock, Calendar, Stethoscope, Check, Edit, X, Eye } from 'lucide-react';

const ConsultaCard = ({ 
  consulta, 
  paciente, 
  onConcluir, 
  onEditar, 
  onCancelar,
  getStatusColor 
}) => {
  const isAgendada = consulta.status === 'Agendada';
  const isRealizada = consulta.status === 'Realizada';

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
      {/* Cabeçalho do Card */}
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
            {paciente?.nome || 'Paciente não encontrado'}
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
        
        {/* Informações da Consulta */}
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
        
        {/* Motivo da Consulta */}
        <p style={{
          fontSize: '14px',
          color: '#374151',
          margin: '8px 0 0',
          lineHeight: '1.4'
        }}>
          <strong>Motivo:</strong> {consulta.queixaPrincipal}
        </p>
        
        {/* Observações se houver */}
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

        {/* Informações adicionais para consultas realizadas */}
        {isRealizada && consulta.hipoteseDiagnostica && (
          <div style={{
            marginTop: '12px',
            paddingTop: '12px',
            borderTop: '1px solid #f3f4f6'
          }}>
            <p style={{
              fontSize: '14px',
              color: '#374151',
              margin: '0 0 4px'
            }}>
              <strong>Diagnóstico:</strong> {consulta.hipoteseDiagnostica}
            </p>
            {consulta.prescricoes && (
              <p style={{
                fontSize: '14px',
                color: '#374151',
                margin: '0'
              }}>
                <strong>Prescrições:</strong> {consulta.prescricoes}
              </p>
            )}
          </div>
        )}
      </div>
      
      {/* Botões de Ação */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-around',
        paddingTop: '12px',
        borderTop: '1px solid #f3f4f6'
      }}>
        {isAgendada ? (
          <>
            <button
              onClick={() => onConcluir(consulta)}
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
                fontWeight: '500',
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={(e) => e.target.style.backgroundColor = '#f0fdf4'}
              onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
            >
              <Check size={20} style={{ marginBottom: '4px' }} />
              Realizar
            </button>
            <button
              onClick={() => onEditar(consulta)}
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
                fontWeight: '500',
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={(e) => e.target.style.backgroundColor = '#ede9fe'}
              onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
            >
              <Edit size={20} style={{ marginBottom: '4px' }} />
              Editar
            </button>
            <button
              onClick={() => onCancelar(consulta.id)}
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
                fontWeight: '500',
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={(e) => e.target.style.backgroundColor = '#fee2e2'}
              onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
            >
              <X size={20} style={{ marginBottom: '4px' }} />
              Cancelar
            </button>
          </>
        ) : (
          <button
            onClick={() => onEditar(consulta)}
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
              margin: '0 auto',
              transition: 'background-color 0.2s'
            }}
            onMouseEnter={(e) => e.target.style.backgroundColor = '#dbeafe'}
            onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
          >
            <Eye size={20} style={{ marginBottom: '4px' }} />
            Ver Detalhes
          </button>
        )}
      </div>
    </div>
  );
};

export default ConsultaCard;