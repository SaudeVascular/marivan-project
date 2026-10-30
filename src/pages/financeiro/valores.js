import { formatarMoeda } from '../../utils/formatters';

// Regras de valores da migração 54, na tela:
//   valor do procedimento − desconto = valor pago
//   valor pago − glosa = valor recebido (só quando Pago)
//   recebido = parte da clínica + parte do profissional (percentual dele)

// Desconto digitado em R$ ou em % → reais, com 2 casas, entre 0 e o valor.
export function descontoEmReais(valor, entrada, tipo) {
  const n = Number(String(entrada ?? '').replace(',', '.'));
  if (!(n > 0) || !(valor > 0)) return 0;
  const reais = tipo === '%' ? (valor * n) / 100 : n;
  return Math.round(Math.min(reais, valor) * 100) / 100;
}

export function textoDesconto(desconto, valor) {
  if (!(desconto > 0)) return '—';
  const pct = valor > 0 ? (desconto / valor) * 100 : 0;
  return `${formatarMoeda(desconto)} (${pct.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%)`;
}

export const FORMAS_PAGAMENTO = ['Dinheiro', 'PIX', 'Cartão de Débito', 'Cartão de Crédito', 'Boleto'];

export function somarValores(linhas) {
  const t = { quantidade: 0, valor: 0, desconto: 0, valorPago: 0, glosa: 0, recebido: 0, recebidoClinica: 0, recebidoProfissional: 0 };
  for (const l of linhas) {
    t.quantidade += 1;
    for (const k of ['valor', 'desconto', 'valorPago', 'glosa', 'recebido', 'recebidoClinica', 'recebidoProfissional']) t[k] += Number(l[k]) || 0;
  }
  return t;
}
