import React from 'react';
import { useParams } from 'react-router-dom';
import { pacientesService } from '../services/pacientes.service';
import { usePacientesCache, mesclarPacientes } from './usePacientesCache';

// Paciente da URL (/prontuario/:id etc.). Procura primeiro nos pacientes
// já lidos; se não estiver lá (link direto, recarregar a página, paciente
// fora da página de busca atual), busca pelo id no servidor e guarda no
// cache. `carregando` distingue "ainda buscando" de "não encontrado".
export function usePacienteAtual(pacientes) {
  const { id } = useParams();
  const cache = usePacientesCache();
  const lista = pacientes ?? cache?.pacientes ?? [];
  const paciente = lista.find((p) => String(p.id) === String(id));
  const [falhou, setFalhou] = React.useState(null);
  const setCache = cache?.setPacientes;
  const precisaBuscar = !paciente && Boolean(id) && Boolean(setCache);

  React.useEffect(() => {
    if (!precisaBuscar) return undefined;
    let cancelado = false;
    pacientesService.buscarPorId(id)
      .then(p => { if (!cancelado) setCache(prev => mesclarPacientes(prev, [p])); })
      .catch(() => { if (!cancelado) setFalhou(id); });
    return () => { cancelado = true; };
  }, [precisaBuscar, id, setCache]);

  return { paciente, id, carregando: precisaBuscar && falhou !== id };
}
