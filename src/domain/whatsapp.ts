/**
 * Utilitários de integração com WhatsApp (Assistência do Nutricionista & Suporte Técnico do Sistema MyLabs).
 */

export function sanitizeWhatsappDigits(raw: string | null | undefined): string {
  if (!raw) return ''
  const digits = raw.replace(/\D/g, '')
  if (!digits) return ''
  // Se digitou apenas DDD + número no Brasil (10 ou 11 dígitos), adiciona DDI 55 automaticamente
  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`
  }
  return digits
}

export function formatWhatsappDisplay(raw: string | null | undefined): string {
  const digits = sanitizeWhatsappDigits(raw)
  if (!digits) return 'Não configurado'
  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
    const ddd = digits.slice(2, 4)
    const rest = digits.slice(4)
    if (rest.length === 9) return `+55 (${ddd}) ${rest.slice(0, 5)}-${rest.slice(5)}`
    return `+55 (${ddd}) ${rest.slice(0, 4)}-${rest.slice(4)}`
  }
  return `+${digits}`
}

export function isValidWhatsapp(raw: string | null | undefined): boolean {
  const digits = sanitizeWhatsappDigits(raw)
  return /^[0-9]{10,15}$/.test(digits)
}

export interface WhatsappTemplateOption {
  id: string
  kind: 'nutritionist' | 'system'
  category: string
  label: string
  prompt: string
}

export const WHATSAPP_TEMPLATES: WhatsappTemplateOption[] = [
  {
    id: 'nutri_diet_swap',
    kind: 'nutritionist',
    category: 'Dieta & Substituições',
    label: 'Dúvida na Dieta ou Substituição',
    prompt: 'Gostaria de tirar uma dúvida sobre a substituição de um alimento na minha refeição do plano atual.',
  },
  {
    id: 'nutri_workout',
    kind: 'nutritionist',
    category: 'Treino & Execução',
    label: 'Ajuste no Meu Treino / Exercício',
    prompt: 'Preciso de orientação sobre um exercício da minha ficha de treino desta semana.',
  },
  {
    id: 'nutri_symptom',
    kind: 'nutritionist',
    category: 'Adaptação Clínica',
    label: 'Relatar Adaptação / Saciedade / Sintoma',
    prompt: 'Quero compartilhar como estou me sentindo com o protocolo atual de dieta e hidratação.',
  },
  {
    id: 'nutri_checkin',
    kind: 'nutritionist',
    category: 'Consulta & Retorno',
    label: 'Agendar ou Reagendar Check-in / Avaliação',
    prompt: 'Gostaria de alinhar o melhor horário para nossa próxima avaliação antropométrica.',
  },
  {
    id: 'sys_access',
    kind: 'system',
    category: 'Acesso & Conta',
    label: 'Problema de Login, Senha ou Conta',
    prompt: 'Estou com dificuldade em relação ao meu acesso ou dados cadastrais na plataforma MyLabs.',
  },
  {
    id: 'sys_bug',
    kind: 'system',
    category: 'Erro Técnico no Sistema',
    label: 'Reportar Erro ou Instabilidade no Sistema',
    prompt: 'Identifiquei um comportamento inesperado no aplicativo MyLabs e preciso de suporte técnico.',
  },
  {
    id: 'sys_media',
    kind: 'system',
    category: 'Anexos, Fotos ou GIFs',
    label: 'Dúvida com Anexos, Fotos ou Visualização',
    prompt: 'Preciso de ajuda técnica para visualizar ou enviar fotos/anexos no sistema MyLabs.',
  },
]

export function buildReadyWhatsappMessage(params: {
  kind: 'nutritionist' | 'system'
  clientName: string
  clientEmail?: string
  nutritionistName?: string
  category: string
  customMessage: string
  goal?: string | null
}): string {
  const { kind, clientName, clientEmail, nutritionistName, category, customMessage, goal } = params
  if (kind === 'nutritionist') {
    const lines = [
      `Olá${nutritionistName ? `, *${nutritionistName}*` : ''}!`,
      `Sou *${clientName}* (cliente pelo app *MyLabs*).`,
      goal ? `*Objetivo atual:* ${goal}` : '',
      `*Assunto:* ${category}`,
      '',
      `*Mensagem:*`,
      customMessage.trim(),
    ].filter(Boolean)
    return lines.join('\n')
  }

  const lines = [
    `Olá, *Suporte Técnico MyLabs*!`,
    `*Usuário:* ${clientName}${clientEmail ? ` (${clientEmail})` : ''}`,
    nutritionistName ? `*Nutricionista vinculado:* ${nutritionistName}` : '',
    `*Categoria:* ${category}`,
    '',
    `*Descrição do chamado:*`,
    customMessage.trim(),
  ].filter(Boolean)
  return lines.join('\n')
}

export function buildWhatsappUrl(phone: string, text: string): string {
  const digits = sanitizeWhatsappDigits(phone)
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`
}
