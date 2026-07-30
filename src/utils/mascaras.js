import { formatDate } from './formatters';

export const formatarData = (dataISO) => (dataISO ? formatDate(dataISO) : '-');

export const formatarCPF = (valor) => {
  const n = valor.replace(/\D/g, '').slice(0, 11);
  return n
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
};

export const formatarCNPJ = (valor) => {
  const n = valor.replace(/\D/g, '').slice(0, 14);
  return n
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
};
