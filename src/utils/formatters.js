// Formatadores de dados para o prontuário eletrônico

// Datas como 'YYYY-MM-DD' não têm hora, então `new Date(date)` as interpreta
// como meia-noite UTC — em horário de Brasília isso pode voltar um dia.
// Construindo a data a partir dos componentes locais evitamos esse desvio.
const parseDateLocal = (date) => {
  if (date instanceof Date) return date;
  if (typeof date === 'string') {
    const [datePart] = date.split('T');
    const [year, month, day] = datePart.split('-').map(Number);
    if (year && month && day) return new Date(year, month - 1, day);
  }
  return new Date(date);
};

export const formatCPF = (cpf) => {
  // Remove caracteres não numéricos
  const cleaned = cpf.replace(/\D/g, '');
  
  // Aplica a formatação
  return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
};

export const formatPhone = (phone) => {
  // Remove caracteres não numéricos
  const cleaned = phone.replace(/\D/g, '');
  
  // Aplica a formatação para telefone brasileiro
  if (cleaned.length === 11) {
    return cleaned.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  } else if (cleaned.length === 10) {
    return cleaned.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
  }
  return phone;
};

export const formatDate = (date) => {
  if (!date) return '';

  const d = parseDateLocal(date);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  
  return `${day}/${month}/${year}`;
};

export const formatDateTime = (date, time) => {
  const formattedDate = formatDate(date);
  return `${formattedDate} às ${time}`;
};

export const calcularIdade = (dataNascimento) => {
  if (!dataNascimento) return null;
  const hoje = new Date();
  const nascimento = parseDateLocal(dataNascimento);
  let idade = hoje.getFullYear() - nascimento.getFullYear();
  const m = hoje.getMonth() - nascimento.getMonth();
  
  if (m < 0 || (m === 0 && hoje.getDate() < nascimento.getDate())) {
    idade--;
  }
  
  return idade;
};

export const getStatusColor = (status) => {
  const colors = {
    'Agendada': '#3b82f6',    // Azul
    'Realizada': '#10b981',   // Verde
    'Cancelada': '#ef4444',   // Vermelho
    'Em Atendimento': '#f59e0b' // Amarelo
  };
  
  return colors[status] || '#6b7280'; // Cinza como padrão
};

export const getStatusText = (status) => {
  const texts = {
    'Agendada': 'Agendada',
    'Realizada': 'Realizada',
    'Cancelada': 'Cancelada',
    'Em Atendimento': 'Em Atendimento'
  };
  
  return texts[status] || status;
};

export const formatCurrency = (value) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
};

export const capitalizeFirstLetter = (string) => {
  return string.charAt(0).toUpperCase() + string.slice(1).toLowerCase();
};

// Preposições/conectivos de nome que ficam em minúsculo (exceto se forem a
// primeira palavra do nome).
const PREPOSICOES_NOME = ['de', 'da', 'do', 'das', 'dos', 'e'];

// Padroniza nome próprio (várias palavras): cada palavra com inicial
// maiúscula e o resto minúsculo, independente de como foi digitado —
// exceto preposições ("de", "da", "dos"...), que ficam em minúsculo.
export const capitalizarNome = (nome) => {
  if (!nome) return '';
  return nome
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .split(' ')
    .map((palavra, idx) => {
      if (!palavra) return palavra;
      if (idx > 0 && PREPOSICOES_NOME.includes(palavra)) return palavra;
      return palavra.charAt(0).toUpperCase() + palavra.slice(1);
    })
    .join(' ');
};

export const truncateText = (text, maxLength) => {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};