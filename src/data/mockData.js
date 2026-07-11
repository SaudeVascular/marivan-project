// Dados de exemplo para desenvolvimento

export const pacientesIniciais = [
  {
    id: 1,
    nome: 'Maria Silva Santos',
    cpf: '123.456.789-00',
    dataNascimento: '1985-03-15',
    telefone: '(11) 99999-9999',
    email: 'maria@email.com',
    endereco: 'Rua das Flores, 123 - São Paulo, SP',
    convenio: 'Unimed',
    numeroConvenio: '123456789',
    contatoEmergencia: 'João Silva - (11) 88888-8888',
    alergias: 'Penicilina, Dipirona',
    medicamentosUso: 'Losartana 50mg - 1x/dia',
    historicoFamiliar: 'Hipertensão (pai), Diabetes (mãe)',
    observacoes: 'Paciente hipertensa controlada'
  },
  {
    id: 2,
    nome: 'José Oliveira Lima',
    cpf: '987.654.321-00',
    dataNascimento: '1970-08-22',
    telefone: '(11) 77777-7777',
    email: 'jose@email.com',
    endereco: 'Av. Principal, 456 - São Paulo, SP',
    convenio: 'Bradesco Saúde',
    numeroConvenio: '987654321',
    contatoEmergencia: 'Ana Oliveira - (11) 66666-6666',
    alergias: 'Nenhuma conhecida',
    medicamentosUso: 'Metformina 850mg - 2x/dia\nSinvastatina 20mg - 1x/dia',
    historicoFamiliar: 'Diabetes (pai e mãe)',
    observacoes: 'Diabético tipo 2, acompanhamento trimestral'
  },
  {
    id: 3,
    nome: 'Ana Paula Rodrigues',
    cpf: '456.789.123-00',
    dataNascimento: '1992-07-10',
    telefone: '(11) 95555-5555',
    email: 'ana.paula@email.com',
    endereco: 'Rua dos Jardins, 789 - São Paulo, SP',
    convenio: 'SulAmérica',
    numeroConvenio: '456789123',
    contatoEmergencia: 'Pedro Rodrigues - (11) 94444-4444',
    alergias: 'Frutos do mar',
    medicamentosUso: 'Anticoncepcional oral',
    historicoFamiliar: 'Câncer de mama (avó materna)',
    observacoes: 'Paciente saudável, check-up anual'
  }
];

export const consultasIniciais = [
  {
    id: 1,
    pacienteId: 1,
    data: '2025-01-20',
    hora: '09:00',
    medico: 'Dr. Carlos Mendes',
    especialidade: 'Clínica Geral',
    tipo: 'Consulta',
    status: 'Realizada',
    queixaPrincipal: 'Dor de cabeça frequente há 2 semanas',
    exameFisico: 'PA: 140/90 mmHg, FC: 80 bpm, Temp: 36.5°C\nPaciente em bom estado geral\nAusculta cardíaca e pulmonar sem alterações\nAbdome flácido, indolor',
    hipoteseDiagnostica: 'Cefaleia tensional + Hipertensão arterial não controlada',
    conduta: 'Ajuste da medicação anti-hipertensiva\nPrescrição de analgésico para cefaleia\nOrientações sobre mudanças no estilo de vida\nRetorno em 15 dias',
    prescricoes: 'Paracetamol 750mg - 8/8h por 3 dias\nLosartana aumentar para 100mg - 1x/dia',
    observacoes: 'Paciente orientada sobre controle da pressão arterial e diário de cefaleia'
  },
  {
    id: 2,
    pacienteId: 2,
    data: '2025-08-01',
    hora: '10:30',
    medico: 'Dr. Carlos Mendes',
    especialidade: 'Clínica Geral',
    tipo: 'Retorno',
    status: 'Agendada',
    queixaPrincipal: 'Acompanhamento diabetes - Retorno trimestral',
    observacoes: 'Trazer exames recentes: Glicemia jejum, HbA1c, Perfil lipídico'
  },
  {
    id: 3,
    pacienteId: 1,
    data: '2025-08-01',
    hora: '14:00',
    medico: 'Dr. Carlos Mendes',
    especialidade: 'Clínica Geral',
    tipo: 'Consulta',
    status: 'Agendada',
    queixaPrincipal: 'Check-up anual',
    observacoes: 'Jejum de 12h para coleta de sangue'
  },
  {
    id: 4,
    pacienteId: 3,
    data: '2025-08-02',
    hora: '08:30',
    medico: 'Dr. Carlos Mendes',
    especialidade: 'Clínica Geral',
    tipo: 'Consulta',
    status: 'Agendada',
    queixaPrincipal: 'Dor abdominal recorrente',
    observacoes: 'Paciente relata dor há 1 semana'
  },
  {
    id: 5,
    pacienteId: 2,
    data: '2025-01-15',
    hora: '15:00',
    medico: 'Dr. Carlos Mendes',
    especialidade: 'Clínica Geral',
    tipo: 'Consulta',
    status: 'Realizada',
    queixaPrincipal: 'Controle de diabetes - Consulta de rotina',
    exameFisico: 'PA: 130/80 mmHg, FC: 75 bpm, Peso: 82kg\nGlicemia capilar: 145mg/dl\nExame dos pés sem alterações',
    hipoteseDiagnostica: 'Diabetes mellitus tipo 2 - Controlado',
    conduta: 'Manter medicação atual\nReforçar dieta e exercícios\nSolicitar exames de controle',
    prescricoes: 'Manter:\nMetformina 850mg - 2x/dia\nSinvastatina 20mg - 1x/dia',
    observacoes: 'Paciente aderente ao tratamento. Glicemia melhor controlada.'
  }
];

export const medicosDisponiveis = [
  {
    id: 1,
    nome: 'Dr. Carlos Mendes',
    crm: '12345-SP',
    especialidade: 'Clínica Geral'
  },
  {
    id: 2,
    nome: 'Dra. Patricia Santos',
    crm: '54321-SP',
    especialidade: 'Pediatria'
  },
  {
    id: 3,
    nome: 'Dr. Roberto Silva',
    crm: '67890-SP',
    especialidade: 'Cardiologia'
  }
];

export const conveniosDisponiveis = [
  'Particular',
  'Unimed',
  'Bradesco Saúde',
  'SulAmérica',
  'Amil',
  'Porto Seguro',
  'Notredame Intermédica',
  'Hapvida',
  'SUS'
];

export const tiposConsulta = [
  'Consulta',
  'Retorno',
  'Emergência',
  'Exame',
  'Procedimento'
];

export const statusConsulta = [
  'Agendada',
  'Em Atendimento',
  'Realizada',
  'Cancelada'
];