import React from 'react';
import { User, Calendar, FileText } from 'lucide-react';

const Navigation = ({ activeTab, setActiveTab, isMobile }) => {
  const tabs = [
    { id: 'pacientes', label: 'Pacientes', icon: User },
    { id: 'consultas', label: 'Consultas', icon: Calendar },
    { id: 'relatorios', label: 'Relatórios', icon: FileText }
  ];

  return (
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
          {tabs.map(tab => {
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
                  flex: isMobile ? 1 : 'none',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  if (activeTab !== tab.id) {
                    e.target.style.color = '#60a5fa';
                  }
                }}
                onMouseLeave={(e) => {
                  if (activeTab !== tab.id) {
                    e.target.style.color = '#6b7280';
                  }
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
  );
};

export default Navigation;