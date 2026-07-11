import React from 'react';
import { Activity } from 'lucide-react';

const Header = ({ isMobile }) => {
  return (
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
  );
};

export default Header;