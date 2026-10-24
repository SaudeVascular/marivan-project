import React from 'react';
import { useAuth } from './useAuth';
import { usuariosService } from '../services/usuarios.service';
import { CONSELHO_POR_FUNCAO } from '../constants/roles';

export function useMedicoPerfil() {
  const { user } = useAuth();
  const [medico, setMedico] = React.useState('');
  const [crm, setCrm] = React.useState('');
  const [especialidade, setEspecialidade] = React.useState('');
  const [assinaturaImagem, setAssinaturaImagem] = React.useState(null);
  // Dados do conselho separados (sem "Dr."/"Dra." nem "/UF" juntos) —
  // a guia SP/SADT tem um campo próprio para cada um (15 a 18).
  const [registroConselho, setRegistroConselho] = React.useState({ nome: '', conselho: '', numero: '', uf: '', cbo: '' });

  React.useEffect(() => {
    if (!user?.id) return;
    usuariosService.buscarPerfil(user.id).then(perfil => {
      if (perfil) {
        const titulo = perfil.sexo === 'Feminino' ? 'Dra.' : 'Dr.';
        // Sigla pela função (ou papel clínico concedido ao Administrador):
        // o número em perfis.crm pode ser CRM, COREN, CRP ou CREFITO.
        const conselho = CONSELHO_POR_FUNCAO[perfil.papel_clinico_administrador || perfil.funcao] || 'CRM';
        setMedico(`${titulo} ${perfil.nome || ''}`.trim());
        setCrm(perfil.crm
          ? `${conselho} ${perfil.crm}${perfil.uf ? '/' + perfil.uf : ''}${perfil.rqe ? ` — RQE ${perfil.rqe}` : ''}`
          : '');
        setEspecialidade([perfil.especialidade, perfil.area_atuacao].filter(Boolean).join(' — '));
        setAssinaturaImagem(perfil.assinatura_imagem || null);
        setRegistroConselho({
          nome: perfil.nome || '',
          conselho,
          numero: perfil.crm || '',
          uf: perfil.uf || '',
          cbo: perfil.cbo || '',
        });
      }
    });
  }, [user?.id]);

  return { medico, crm, especialidade, assinaturaImagem, registroConselho };
}
