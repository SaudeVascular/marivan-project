import React from 'react';
import { useAuth } from './useAuth';
import { usuariosService } from '../services/usuarios.service';

export function useMedicoPerfil() {
  const { user } = useAuth();
  const [medico, setMedico] = React.useState('');
  const [crm, setCrm] = React.useState('');
  const [especialidade, setEspecialidade] = React.useState('');

  React.useEffect(() => {
    if (!user?.id) return;
    usuariosService.buscarPerfil(user.id).then(perfil => {
      if (perfil) {
        const titulo = perfil.sexo === 'Feminino' ? 'Dra.' : 'Dr.';
        setMedico(`${titulo} ${perfil.nome || ''}`.trim());
        setCrm(perfil.crm ? `${perfil.crm}${perfil.uf ? '/' + perfil.uf : ''}` : '');
        setEspecialidade([perfil.especialidade, perfil.area_atuacao].filter(Boolean).join(' — '));
      }
    });
  }, [user?.id]);

  return { medico, crm, especialidade };
}
