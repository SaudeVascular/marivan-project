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

export const formatarCNPJ = (valor) => {
  const n = valor.replace(/\D/g, '').slice(0, 14);
  return n
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
};
