import React from 'react';
import { useParams } from 'react-router-dom';
import { pacientesService } from '../services/pacientes.service';
import { usePacientesCache, mesclarPacientes } from './usePacientesCache';
import { comTimeout } from '../utils/comTimeout';

// Paciente da URL (/prontuario/:id etc.). Procura primeiro nos pacientes
// já lidos; se não estiver lá (link direto, recarregar a página, paciente
// fora da página de busca atual), busca pelo id no servidor e guarda no
// cache.
//
// `estado` separa o que a tela precisa dizer — uma falha de rede não pode
// aparecer como "Paciente não encontrado" (a equipe iria procurar ou
// recadastrar alguém que existe):
//   'pronto' | 'carregando'
//   'nao-encontrado' — o banco respondeu e não há paciente com esse id
//                      visível para você (a RLS não distingue "não existe"
//                      de "existe, mas você não pode ver")
//   'sem-permissao'  — o banco recusou a leitura
//   'erro'           — rede/servidor; `recarregar` tenta de novo
export function classificarErroPaciente(erro) {
  if (erro?.code === 'PGRST116') return 'nao-encontrado';
  if (erro?.code === '42501' || erro?.status === 401 || erro?.status === 403) return 'sem-permissao';
  return 'erro';
}

// Telas clínicas (prontuário, documentos, enfermagem): o paciente vem
// sempre pela leitura registrada, com os antecedentes (migração 57) —
// mesmo que já esteja no cache por uma busca, que os traz vazios.
export function usePacienteAtual(pacientes) {
  const { id } = useParams();
  const cache = usePacientesCache();
  const lista = pacientes ?? cache?.pacientes ?? [];
  const doCache = lista.find((p) => String(p.id) === String(id));
  const [leitura, setLeitura] = React.useState(null); // { id, tentativa, estado }
  const [tentativa, setTentativa] = React.useState(0);
  const setCache = cache?.setPacientes;

  React.useEffect(() => {
    if (!id || !setCache) return undefined;
    let cancelado = false;
    comTimeout(pacientesService.buscarClinico(id))
      .then(p => {
        if (cancelado) return;
        setCache(prev => mesclarPacientes(prev, [p]));
        setLeitura({ id, tentativa, estado: 'pronto' });
      })
      .catch(erro => { if (!cancelado) setLeitura({ id, tentativa, estado: classificarErroPaciente(erro) }); });
    return () => { cancelado = true; };
  }, [id, setCache, tentativa]);

  const recarregar = React.useCallback(() => setTentativa(t => t + 1), []);

  const lido = leitura && leitura.id === id && leitura.tentativa === tentativa;
  let estado;
  if (!id || !setCache) estado = doCache ? 'pronto' : 'nao-encontrado';
  else if (!lido) estado = 'carregando';
  else estado = leitura.estado === 'pronto' && !doCache ? 'carregando' : leitura.estado;
  const paciente = estado === 'pronto' ? doCache : undefined;

  return { paciente, id, estado, carregando: estado === 'carregando', recarregar };
}
