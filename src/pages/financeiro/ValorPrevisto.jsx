import { formatarMoeda } from '../../utils/formatters';

// Coluna da clínica ou do profissional: o que já foi recebido; numa
// cobrança pendente, a divisão prevista (em cinza) — ainda não entrou.
export function ValorOuPrevisto({ recebido, previsto, pendente }) {
  if (pendente && previsto > 0) {
    return <span title="Previsto: ainda não recebido" style={{ color: '#6b7280', fontStyle: 'italic' }}>previsto {formatarMoeda(previsto)}</span>;
  }
  return formatarMoeda(recebido);
}
