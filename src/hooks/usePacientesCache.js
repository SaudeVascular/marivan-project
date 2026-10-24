import React from 'react';
import { pacientesService } from '../services/pacientes.service';

// Pacientes já lidos nesta sessão, compartilhados entre as telas (o
// prontuário guarda ali os registros, a edição de antecedentes atualiza
// o cadastro, etc.). NÃO é mais a lista completa: o app deixou de
// carregar todos os pacientes ao abrir. Cada tela busca no servidor o
// que precisa — useBuscaPacientes (listas e buscas), usePacientesPorIds
// (nomes na agenda/cobranças) e usePacienteAtual (paciente da URL) — e
// o resultado é mesclado aqui.
export const PacientesCacheContext = React.createContext(null);

export function usePacientesCache() {
  return React.useContext(PacientesCacheContext);
}

// Mescla por id preservando o que só existe no cache (ex.: `registros`
// carregados pelo prontuário).
export function mesclarPacientes(atuais, novos) {
  if (!novos?.length) return atuais;
  const porId = new Map(novos.map(p => [String(p.id), p]));
  const mesclados = atuais.map(p => {
    const novo = porId.get(String(p.id));
    if (!novo) return p;
    porId.delete(String(p.id));
    return { ...p, ...novo, registros: p.registros?.length ? p.registros : novo.registros };
  });
  return [...mesclados, ...porId.values()];
}

/**
 * Busca paginada no servidor, com espera de 300 ms entre teclas.
 * `listarSemTermo`: sem texto digitado, lista em ordem alfabética (tela
 * de Pacientes); senão não busca nada (seletores de agenda/cobrança).
 */
export function useBuscaPacientes(termo, { limite, listarSemTermo = false } = {}) {
  const cache = usePacientesCache();
  const setCache = cache?.setPacientes;
  const [estado, setEstado] = React.useState({ itens: [], total: 0, carregando: false, erro: null });
  const [versao, setVersao] = React.useState(0);
  const termoLimpo = String(termo || '').trim();
  const ativo = listarSemTermo || termoLimpo.length > 0;
  const requisicao = React.useRef(0);

  React.useEffect(() => {
    const id = ++requisicao.current;
    if (!ativo) {
      setEstado({ itens: [], total: 0, carregando: false, erro: null });
      return undefined;
    }
    setEstado(e => ({ ...e, carregando: true, erro: null }));
    const timer = setTimeout(() => {
      pacientesService.buscar({ termo: termoLimpo, limite })
        .then(({ itens, total }) => {
          if (id !== requisicao.current) return;
          setEstado({ itens, total, carregando: false, erro: null });
          setCache?.(prev => mesclarPacientes(prev, itens));
        })
        .catch(erro => {
          if (id === requisicao.current) setEstado(e => ({ ...e, carregando: false, erro }));
        });
    }, 300);
    return () => clearTimeout(timer);
  }, [termoLimpo, ativo, limite, versao, setCache]);

  const carregarMais = React.useCallback(() => {
    const id = requisicao.current;
    setEstado(e => ({ ...e, carregando: true }));
    pacientesService.buscar({ termo: termoLimpo, limite, offset: estado.itens.length })
      .then(({ itens, total }) => {
        if (id !== requisicao.current) return;
        setEstado(e => ({ itens: mesclarPacientes(e.itens, itens), total, carregando: false, erro: null }));
        setCache?.(prev => mesclarPacientes(prev, itens));
      })
      .catch(erro => {
        if (id === requisicao.current) setEstado(e => ({ ...e, carregando: false, erro }));
      });
  }, [termoLimpo, limite, estado.itens.length, setCache]);

  const recarregar = React.useCallback(() => setVersao(v => v + 1), []);

  return { ...estado, temMais: estado.itens.length < estado.total, carregarMais, recarregar };
}

/**
 * Garante no cache os pacientes destes ids (agenda, recepção,
 * cobranças só têm o paciente_id). Devolve true enquanto busca.
 */
export function usePacientesPorIds(ids) {
  const cache = usePacientesCache();
  const lista = cache?.pacientes;
  const setCache = cache?.setPacientes;
  const pedidos = React.useRef(new Set());
  const [carregando, setCarregando] = React.useState(false);

  const faltando = React.useMemo(() => {
    if (!lista) return [];
    const conhecidos = new Set(lista.map(p => String(p.id)));
    return [...new Set((ids || []).filter(Boolean).map(String))]
      .filter(id => !conhecidos.has(id) && !pedidos.current.has(id))
      .sort();
  }, [ids, lista]);
  const chave = faltando.join(',');

  React.useEffect(() => {
    if (!chave || !setCache) return undefined;
    const alvo = chave.split(',');
    alvo.forEach(id => pedidos.current.add(id));
    // A mesclagem no cache acontece mesmo se a tela mudar no meio: os ids
    // já estão marcados como pedidos e não seriam buscados de novo.
    let cancelado = false;
    setCarregando(true);
    pacientesService.buscarPorIds(alvo)
      .then(encontrados => setCache(prev => mesclarPacientes(prev, encontrados)))
      .catch(() => alvo.forEach(id => pedidos.current.delete(id)))
      .finally(() => { if (!cancelado) setCarregando(false); });
    return () => { cancelado = true; };
  }, [chave, setCache]);

  return carregando;
}
