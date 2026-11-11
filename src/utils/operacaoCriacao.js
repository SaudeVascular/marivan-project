import { comTimeout } from './comTimeout';
import { novoId } from './operacaoClinica';

// Criação idempotente de paciente, agendamento e cobrança (migração 47).
//
// Cada formulário ganha um identificador de operação, guardado nesta aba
// ANTES do envio. Se a resposta se perder (timeout, rede caindo depois do
// commit), a repetição reenvia o MESMO id: o banco recusa a duplicata
// (23505 no índice de operacao_id) e o que foi criado na primeira vez é
// recuperado — repetir nunca cria dois. O id só é descartado quando o
// banco confirma (ou recusa de vez).
export const OPERACAO_CRIACAO_PREFIX = 'pep_operacao_criacao_';

const definitivo = erro => /^(22|23|42|P0|P4)/.test(erro?.code || '') || erro?.code === 'PGRST202';
const ehDuplicataDaOperacao = erro => erro?.code === '23505' && /operacao_id/.test(`${erro.message || ''} ${erro.details || ''}`);

function ler(chave) {
  try { return JSON.parse(sessionStorage.getItem(chave) || 'null'); } catch { return null; }
}

/**
 * @param {object} p
 * @param {string} p.userId
 * @param {string} p.escopo     ex.: 'paciente:novo'
 * @param {object} p.intencao   dados do formulário (só para comparar)
 * @param {(operacaoId: string) => Promise<any>} p.inserir
 * @param {(operacaoId: string) => Promise<any>} p.recuperar  null se a operação não chegou ao banco
 * @returns {Promise<{ resultado: any, recuperado: boolean }>}
 *   recuperado = true quando o que voltou é uma criação ANTERIOR (sem
 *   confirmação) com dados diferentes dos atuais — a tela deve avisar.
 */
export async function criarComOperacao({ userId, escopo, intencao, inserir, recuperar }) {
  if (!userId) throw new Error('Entre na sua conta antes de salvar.');
  const chave = OPERACAO_CRIACAO_PREFIX + JSON.stringify([userId, escopo]);
  const assinatura = JSON.stringify(intencao);
  let operacao = ler(chave);

  // Uma criação anterior ficou sem confirmação: antes de criar outra,
  // confere se ela chegou ao banco.
  if (operacao && operacao.assinatura !== assinatura) {
    const anterior = await comTimeout(recuperar(operacao.id));
    if (anterior) {
      sessionStorage.removeItem(chave);
      return { resultado: anterior, recuperado: true };
    }
    operacao = null;
  }
  if (!operacao) {
    operacao = { id: novoId(), assinatura };
    try {
      sessionStorage.setItem(chave, JSON.stringify(operacao));
    } catch {
      throw new Error('Não foi possível preparar uma gravação segura nesta aba. Verifique o armazenamento do navegador antes de salvar.');
    }
  }

  const tentar = async () => {
    try {
      return await comTimeout(inserir(operacao.id));
    } catch (erro) {
      if (ehDuplicataDaOperacao(erro)) {
        const criado = await comTimeout(recuperar(operacao.id));
        if (criado) return criado;
      }
      throw erro;
    }
  };

  try {
    let resultado;
    try {
      resultado = await tentar();
    } catch (erro) {
      if (definitivo(erro)) throw erro;
      resultado = await tentar(); // resposta perdida: mesmo id, sem duplicar
    }
    sessionStorage.removeItem(chave);
    return { resultado, recuperado: false };
  } catch (erro) {
    if (definitivo(erro)) {
      sessionStorage.removeItem(chave);
      throw erro;
    }
    throw Object.assign(new Error('A gravação ainda não foi confirmada. Verifique a conexão e salve de novo: a mesma operação será conferida, sem duplicar.'), { code: 'RESULTADO_INCERTO' });
  }
}
