import React from 'react';
import { Save, Check, AlertCircle, Loader } from 'lucide-react';

const SaveStatus = ({ status, lastSaved, isMobile }) => {
  // Não mostrar nada se estiver idle
  if (status === 'idle' && !lastSaved) return null;

  const getStatusConfig = () => {
    switch (status) {
      case 'saving':
        return {
          icon: <Loader size={16} className="animate-spin" />,
          text: 'Salvando...',
          color: '#3b82f6',
          bgColor: '#dbeafe'
        };
      case 'saved':
        return {
          icon: <Check size={16} />,
          text: 'Salvo',
          color: '#10b981',
          bgColor: '#d1fae5'
        };
      case 'error':
        return {
          icon: <AlertCircle size={16} />,
          text: 'Erro ao salvar',
          color: '#ef4444',
          bgColor: '#fee2e2'
        };
      default:
        if (lastSaved) {
          return {
            icon: <Check size={16} />,
            text: `Salvo às ${lastSaved.toLocaleTimeString('pt-BR', { 
              hour: '2-digit', 
              minute: '2-digit' 
            })}`,
            color: '#6b7280',
            bgColor: '#f3f4f6'
          };
        }
        return null;
    }
  };

  const config = getStatusConfig();
  if (!config) return null;

  const styles = {
    container: {
      position: 'fixed',
      bottom: isMobile ? '20px' : '24px',
      right: isMobile ? '20px' : '24px',
      backgroundColor: config.bgColor,
      color: config.color,
      padding: isMobile ? '10px 16px' : '12px 20px',
      borderRadius: '8px',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      fontSize: isMobile ? '14px' : '14px',
      fontWeight: '500',
      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
      border: `1px solid ${config.color}20`,
      zIndex: 100,
      transition: 'all 0.3s ease',
      animation: 'slideIn 0.3s ease'
    },
    icon: {
      animation: status === 'saving' ? 'spin 1s linear infinite' : 'none'
    }
  };

  return (
    <>
      <style jsx>{`
        @keyframes slideIn {
          from {
            transform: translateY(100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
      
      <div style={styles.container}>
        <span style={styles.icon}>{config.icon}</span>
        <span>{config.text}</span>
      </div>
    </>
  );
};

export default SaveStatus;