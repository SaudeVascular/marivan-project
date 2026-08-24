import React from 'react';

export function PasswordInput({
  label,
  icon = null,
  containerStyle = {},
  labelStyle = {},
  inputStyle = {},
  ...inputProps
}) {
  const idGerado = React.useId();
  const [visivel, setVisivel] = React.useState(false);
  const id = inputProps.id || idGerado;

  return (
    <div style={containerStyle}>
      <label htmlFor={id} style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '4px', ...labelStyle }}>
        {label}
      </label>
      <div style={{ position: 'relative' }}>
        {icon}
        <input
          {...inputProps}
          id={id}
          type={visivel ? 'text' : 'password'}
          style={{ width: '100%', padding: '10px', paddingRight: '78px', boxSizing: 'border-box', ...inputStyle }}
        />
        <button
          type="button"
          onClick={() => setVisivel((valor) => !valor)}
          aria-label={`${visivel ? 'Ocultar' : 'Mostrar'} ${label.toLowerCase()}`}
          aria-pressed={visivel}
          style={{
            position: 'absolute',
            right: '8px',
            top: '50%',
            transform: 'translateY(-50%)',
            padding: '4px 7px',
            border: '1px solid #d1d5db',
            borderRadius: '4px',
            backgroundColor: '#f9fafb',
            color: '#374151',
            cursor: 'pointer',
            fontSize: '11px',
          }}
        >
          {visivel ? 'Ocultar' : 'Mostrar'}
        </button>
      </div>
    </div>
  );
}
