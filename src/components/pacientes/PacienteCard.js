import React from 'react';
import { User, Phone, Eye, Edit, Trash2 } from 'lucide-react';

const PacienteCard = ({ 
  paciente, 
  onView, 
  onEdit, 
  onDelete,
  formatCPF,
  calcularIdade 
}) => {
  return (
    <div style={{
      backgroundColor: 'white',
      borderRadius: '12px',
      padding: '16px',
      marginBottom: '12px',
      boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
      border: '1px solid #e5e7eb',
      transition: 'all 0.2s'
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1)';
      e.currentTarget.style.transform = 'translateY(-2px)';
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.boxShadow = '0 1px 3px 0 rgba(0, 0, 0, 0.1)';
      e.currentTarget.style.transform = 'translateY(0)';
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
            lineHeight: '1.3',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
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
          onClick={() => onView(paciente)}
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
            transition: 'background-color 0.2s'
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#eff6ff'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
        >
          <Eye size={20} style={{ marginBottom: '4px' }} />
          Ver
        </button>
        <button
          onClick={() => onEdit(paciente)}
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
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#ede9fe'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
        >
          <Edit size={20} style={{ marginBottom: '4px' }} />
          Editar
        </button>
        <button
          onClick={() => onDelete(paciente.id)}
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
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#fee2e2'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
        >
          <Trash2 size={20} style={{ marginBottom: '4px' }} />
          Excluir
        </button>
      </div>
    </div>
  );
};

export default PacienteCard;