import { formatDate } from './formatters';

export const formatarData = (dataISO) => (dataISO ? formatDate(dataISO) : '-');

export const formatarDataDigitada = (valor, adicionarSeparador = false) => {
  const numeros = (valor || '').replace(/\D/g, '').slice(0, 8);
  if (numeros.length <= 2) {
    return numeros.length === 2 && adicionarSeparador ? `${numeros}/` : numeros;
  }
  if (numeros.length <= 4) {
    const dataParcial = `${numeros.slice(0, 2)}/${numeros.slice(2)}`;
    return numeros.length === 4 && adicionarSeparador ? `${dataParcial}/` : dataParcial;
  }
  return `${numeros.slice(0, 2)}/${numeros.slice(2, 4)}/${numeros.slice(4)}`;
};

export const dataBrasileiraParaISO = (valor) => {
  const correspondencia = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(valor || '');
  if (!correspondencia) return '';

  const [, dia, mes, ano] = correspondencia;
  const data = new Date(Date.UTC(Number(ano), Number(mes) - 1, Number(dia)));
  const valida = data.getUTCFullYear() === Number(ano)
    && data.getUTCMonth() === Number(mes) - 1
    && data.getUTCDate() === Number(dia);

  return valida ? `${ano}-${mes}-${dia}` : '';
};

export const formatarCPF = (valor) => {
  const n = valor.replace(/\D/g, '').slice(0, 11);
  return n
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
};

// Numérico ou alfanumérico (IN RFB 2.229/2024): 12 caracteres [0-9A-Z]
// e 2 dígitos verificadores.
export const formatarCNPJ = (valor) => {
  const c = String(valor || '').toUpperCase().replace(/[^0-9A-Z]/g, '').slice(0, 14);
  let r = c.slice(0, 2);
  if (c.length > 2) r += '.' + c.slice(2, 5);
  if (c.length > 5) r += '.' + c.slice(5, 8);
  if (c.length > 8) r += '/' + c.slice(8, 12);
  if (c.length > 12) r += '-' + c.slice(12);
  return r;
};
