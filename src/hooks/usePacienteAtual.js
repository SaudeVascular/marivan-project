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

export function usePacienteAtual(pacientes) {
  const { id } = useParams();
  const cache = usePacientesCache();
  const lista = pacientes ?? cache?.pacientes ?? [];
  const paciente = lista.find((p) => String(p.id) === String(id));
  const [falha, setFalha] = React.useState(null); // { id, tentativa, estado }
  const [tentativa, setTentativa] = React.useState(0);
  const setCache = cache?.setPacientes;
  const precisaBuscar = !paciente && Boolean(id) && Boolean(setCache);

  React.useEffect(() => {
    if (!precisaBuscar) return undefined;
    let cancelado = false;
    comTimeout(pacientesService.buscarPorId(id))
      .then(p => { if (!cancelado) setCache(prev => mesclarPacientes(prev, [p])); })
      .catch(erro => { if (!cancelado) setFalha({ id, tentativa, estado: classificarErroPaciente(erro) }); });
    return () => { cancelado = true; };
  }, [precisaBuscar, id, setCache, tentativa]);

  const recarregar = React.useCallback(() => setTentativa(t => t + 1), []);

  let estado;
  if (paciente) estado = 'pronto';
  else if (!precisaBuscar) estado = 'nao-encontrado';
  else if (falha && falha.id === id && falha.tentativa === tentativa) estado = falha.estado;
  else estado = 'carregando';

  return { paciente, id, estado, carregando: estado === 'carregando', recarregar };
}
