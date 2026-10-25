import React from 'react';
import { useAuth } from './useAuth';
import { usuariosService } from '../services/usuarios.service';
import { CONSELHO_POR_FUNCAO, UFS } from '../constants/roles';
import { comTimeout } from '../utils/comTimeout';

const VAZIO = {
  medico: '',
  crm: '',
  especialidade: '',
  assinaturaImagem: null,
  // Dados do conselho separados (sem "Dr."/"Dra." nem "/UF" juntos) —
  // a guia SP/SADT tem um campo próprio para cada um (15 a 18).
  registroConselho: { nome: '', conselho: '', numero: '', uf: '', cbo: '' },
};

// Identidade do profissional logado para os documentos. Enquanto ela não
// estiver carregada e completa (nome, número do conselho e UF), `pronto` é
// false e as telas não deixam salvar nem imprimir — sem isso, uma resposta
// lenta ou uma falha gerava PDF e texto salvo com "Não informado".
//
// `estado`: 'carregando' | 'pronto' | 'incompleto' (cadastro sem nome ou
// número do conselho) | 'erro' (falha de rede/servidor; `recarregar`).
export function useMedicoPerfil() {
  const { user } = useAuth();
  const [dados, setDados] = React.useState(VAZIO);
  const [estado, setEstado] = React.useState('carregando');
  const [tentativa, setTentativa] = React.useState(0);

  React.useEffect(() => {
    if (!user?.id) return undefined;
    let ativo = true;
    setEstado('carregando');
    comTimeout(usuariosService.buscarPerfil(user.id))
      .then(perfil => {
        if (!ativo) return;
        if (!perfil) { setDados(VAZIO); setEstado('incompleto'); return; }
        const titulo = perfil.sexo === 'Feminino' ? 'Dra.' : 'Dr.';
        // Sigla pela função (ou papel clínico concedido ao Administrador):
        // o número em perfis.crm pode ser CRM, COREN, CRP ou CREFITO.
        const conselho = CONSELHO_POR_FUNCAO[perfil.papel_clinico_administrador || perfil.funcao] || 'CRM';
        setDados({
          medico: perfil.nome ? `${titulo} ${perfil.nome}`.trim() : '',
          crm: perfil.crm
            ? `${conselho} ${perfil.crm}${perfil.uf ? '/' + perfil.uf : ''}${perfil.rqe ? ` — RQE ${perfil.rqe}` : ''}`
            : '',
          especialidade: [perfil.especialidade, perfil.area_atuacao].filter(Boolean).join(' — '),
          assinaturaImagem: perfil.assinatura_imagem || null,
          registroConselho: {
            nome: perfil.nome || '',
            conselho,
            numero: perfil.crm || '',
            uf: perfil.uf || '',
            cbo: perfil.cbo || '',
          },
        });
        // Mesma regra do banco ao assinar (migração 44).
        const completo = (perfil.nome || '').trim().length >= 3
          && /^[0-9A-Za-z./-]{1,20}$/.test((perfil.crm || '').trim())
          && UFS.includes((perfil.uf || '').trim().toUpperCase());
        setEstado(completo ? 'pronto' : 'incompleto');
      })
      .catch(() => {
        if (!ativo) return;
        setDados(VAZIO);
        setEstado('erro');
      });
    return () => { ativo = false; };
  }, [user?.id, tentativa]);

  const recarregar = React.useCallback(() => setTentativa(t => t + 1), []);

  return { ...dados, estado, pronto: estado === 'pronto', recarregar };
}
