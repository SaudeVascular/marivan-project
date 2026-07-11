import { useParams } from 'react-router-dom';

export function usePacienteAtual(pacientes) {
  const { id } = useParams();
  const paciente = pacientes.find((p) => String(p.id) === String(id));
  return { paciente, id };
}
