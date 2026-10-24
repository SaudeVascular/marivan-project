import { supabase } from '../services/supabase';
import { comTimeout } from './comTimeout';

export const OPERACAO_CLINICA_PREFIX = 'pep_operacao_clinica_';
const emAndamento = new Map();

function novoId() {
  // getRandomValues também funciona no acesso local por HTTP em rede privada.
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function removerSeAtual(chave, id) {
  try {
    const atual = JSON.parse(sessionStorage.getItem(chave) || 'null');
    if (atual?.parametros.p_operacao_id === id) sessionStorage.removeItem(chave);
  } catch {
    // Confirmado no servidor: falha de limpeza local não é falha de gravação.
    // Se o recibo permanecer, a repetição será reconciliada pelo mesmo ID.
  }
}

const erroDefinitivo = error => /^(22|23|42|P409|P000)/.test(error?.code || '') || error?.code === 'PGRST202';

async function enviar(parametros) {
  const { data, error } = await comTimeout(supabase.rpc('salvar_registro_clinico', parametros));
  if (error) throw error;
  if (!data?.id || !Number.isInteger(data.versao)) throw new Error('Resposta de gravação inválida.');
  return data;
}

async function executar(chave, intencao, parametros) {
  let operacao;
  try {
    operacao = JSON.parse(sessionStorage.getItem(chave) || 'null');
    if (operacao && (!operacao.parametros?.p_operacao_id || !operacao.intencao)) throw new Error('Operação pendente inválida');
    if (!operacao) {
      operacao = { intencao, parametros: { ...parametros, p_operacao_id: novoId() } };
      // Persistir ANTES do envio garante que reload reutiliza a identidade.
      sessionStorage.setItem(chave, JSON.stringify(operacao));
    }
  } catch {
    throw new Error('Não foi possível preparar uma gravação segura nesta aba. Verifique o armazenamento do navegador antes de salvar.');
  }

  let resultado;
  try {
    try {
      resultado = await enviar(operacao.parametros);
    } catch (error) {
      if (erroDefinitivo(error)) throw error;
      // Resposta perdida após commit: repetir o mesmo pedido recupera o
      // recibo. Se ainda não executou, a repetição efetua a gravação uma vez.
      resultado = await enviar(operacao.parametros);
    }
  } catch (error) {
    if (erroDefinitivo(error)) {
      removerSeAtual(chave, operacao.parametros.p_operacao_id);
      const mensagem = error.code === 'P4090'
        ? 'Este registro mudou em outra sessão. Seu texto foi preservado. Atualize o histórico e compare a versão atual antes de salvar.'
        : error.message;
      throw Object.assign(new Error(mensagem), { code: error.code });
    }
    throw Object.assign(new Error('A gravação ainda não foi confirmada. Mantenha esta aba aberta e tente salvar novamente; a mesma operação será verificada sem duplicar o registro.'), { code: 'RESULTADO_INCERTO' });
  }
  const confirmar = () => removerSeAtual(chave, operacao.parametros.p_operacao_id);
  if (operacao.intencao !== intencao) {
    throw Object.assign(new Error('A gravação anterior foi confirmada e está no histórico. As alterações atuais continuam na tela e ainda não foram salvas. Revise o registro recuperado antes de continuar.'), {
      code: 'OPERACAO_RECUPERADA', registroConfirmado: resultado, confirmar,
    });
  }
  return { dados: resultado, confirmar };
}

export async function executarOperacaoClinica({ userId, escopo, intencao, parametros }) {
  if (!userId) throw new Error('Entre na sua conta antes de salvar.');
  const chave = OPERACAO_CLINICA_PREFIX + JSON.stringify([userId, escopo]);
  const assinatura = JSON.stringify(intencao);
  const anterior = emAndamento.get(chave);
  if (anterior) {
    const resultado = await anterior.promise;
    if (anterior.assinatura !== assinatura) {
      throw Object.assign(new Error('Uma gravação anterior foi confirmada. Revise o histórico antes de salvar as alterações atuais.'), { code: 'OPERACAO_RECUPERADA', registroConfirmado: resultado.dados, confirmar: resultado.confirmar });
    }
    return resultado;
  }
  const promise = executar(chave, assinatura, parametros);
  const entrada = { assinatura, promise };
  emAndamento.set(chave, entrada);
  try {
    return await promise;
  } finally {
    if (emAndamento.get(chave) === entrada) emAndamento.delete(chave);
  }
}
