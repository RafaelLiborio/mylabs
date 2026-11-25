/**
 * Documentos legais do MyLabs: Termos de Uso e Política de Privacidade (LGPD — Lei nº 13.709/2018).
 *
 * IMPORTANTE: ao alterar o TEXTO de um documento de forma material, incremente a versão correspondente
 * em LEGAL_VERSIONS. Todos os usuários serão solicitados a aceitar novamente no próximo acesso
 * (ver ConsentGate). O histórico de aceites fica na tabela public.legal_acceptances.
 */

export type LegalDocumentId = 'terms' | 'privacy'
export type ConsentDocumentId = 'terms' | 'privacy' | 'health_data' | 'professional_duties'

export const LEGAL_VERSIONS: Record<ConsentDocumentId, string> = {
  terms: '2026.11.24',
  privacy: '2026.11.24',
  health_data: '2026.11.24',
  professional_duties: '2026.11.24',
}

/** Dados institucionais exibidos nos documentos. Preencha e-mail/CNPJ quando disponíveis. */
export const LEGAL_CONFIG = {
  productName: 'MyLabs',
  operatorName: 'Rafael Libório',
  operatorRole: 'responsável pela operação e pelo suporte da plataforma MyLabs',
  /** E-mail do Encarregado/Canal de privacidade. Se vazio, o documento indica a Central de Privacidade do app. */
  privacyEmail: '',
  /** CNPJ ou CPF do operador. Se vazio, não é exibido. */
  taxId: '',
  supportWhatsappDisplay: '+55 (77) 99831-8717',
  lastUpdatedLabel: '24 de novembro de 2026',
}

export type LegalBlock =
  | { type: 'p'; text: string }
  | { type: 'ul'; items: string[] }
  | { type: 'note'; text: string }

export interface LegalSection {
  id: string
  title: string
  blocks: LegalBlock[]
}

export interface LegalDocument {
  id: LegalDocumentId
  title: string
  subtitle: string
  version: string
  sections: LegalSection[]
}

const contactLine = LEGAL_CONFIG.privacyEmail
  ? `pelo e-mail ${LEGAL_CONFIG.privacyEmail}, `
  : ''

export const TERMS_OF_USE: LegalDocument = {
  id: 'terms',
  title: 'Termos de Uso',
  subtitle: 'Regras para uso da plataforma MyLabs por clientes, nutricionistas e equipe de suporte.',
  version: LEGAL_VERSIONS.terms,
  sections: [
    {
      id: 'aceitacao',
      title: '1. Aceitação e definições',
      blocks: [
        {
          type: 'p',
          text: 'Estes Termos de Uso regulam o acesso e a utilização da plataforma MyLabs (“Plataforma”). Ao acessar com suas credenciais e marcar a caixa de aceite, você declara que leu, compreendeu e concorda com estes Termos e com a Política de Privacidade.',
        },
        {
          type: 'ul',
          items: [
            '“Cliente” (ou “Paciente”): pessoa acompanhada por um nutricionista, cuja conta é criada pelo profissional ou pelo suporte.',
            '“Nutricionista”: profissional de saúde credenciado pelo Suporte, responsável por prescrever dietas, treinos e avaliações aos seus clientes.',
            '“Suporte/Administrador”: equipe do MyLabs responsável por credenciar nutricionistas, administrar contas e prestar suporte técnico.',
            '“Operador da Plataforma”: ' + LEGAL_CONFIG.operatorName + ', ' + LEGAL_CONFIG.operatorRole + '.',
          ],
        },
        {
          type: 'p',
          text: 'Se você não concordar com algum ponto, não deve utilizar a Plataforma. Você pode recusar o aceite a qualquer momento e encerrar a sessão; nesse caso, o acesso às funcionalidades ficará indisponível.',
        },
      ],
    },
    {
      id: 'o-que-e',
      title: '2. O que é o MyLabs (e o que não é)',
      blocks: [
        {
          type: 'p',
          text: 'O MyLabs é uma ferramenta de apoio ao acompanhamento nutricional, à periodização de treinos e à avaliação antropométrica. A Plataforma conecta o nutricionista aos seus clientes, permitindo registrar prescrições, avaliações, registros diários (refeições, água, treino, peso e fotos) e solicitações de suporte.',
        },
        {
          type: 'note',
          text: 'O MyLabs NÃO presta atendimento de saúde, NÃO realiza diagnóstico e NÃO substitui consulta, avaliação ou acompanhamento profissional. Toda prescrição é de responsabilidade exclusiva do nutricionista que a elabora.',
        },
        {
          type: 'p',
          text: 'Em caso de emergência ou mal-estar, procure atendimento médico imediato (SAMU 192) e não utilize a Plataforma para esse fim.',
        },
      ],
    },
    {
      id: 'contas',
      title: '3. Contas, perfis e acesso',
      blocks: [
        {
          type: 'ul',
          items: [
            'Cada perfil acessa apenas a sua rota de login (Cliente, Nutricionista ou Suporte). O cadastro de nutricionistas é feito exclusivamente pelo Suporte, mediante verificação do registro profissional (CRN).',
            'As contas de clientes são criadas pelo nutricionista responsável ou pelo Suporte, com e-mail de acesso e senha inicial. Recomendamos que você altere a senha inicial no primeiro acesso.',
            'As credenciais são pessoais e intransferíveis. Você é responsável por todas as atividades realizadas com a sua conta e deve comunicar imediatamente qualquer uso indevido.',
            'Cada cliente está vinculado a um nutricionista. Nutricionistas acessam apenas os clientes vinculados a eles; clientes nunca acessam módulos de nutricionista ou de suporte.',
            'O Suporte pode editar, suspender ou excluir contas e registros para fins de administração, segurança e atendimento a solicitações de titulares.',
          ],
        },
        {
          type: 'p',
          text: 'O uso da Plataforma por menores de 18 anos somente é permitido com o consentimento específico do pai, mãe ou responsável legal, que responderá pelos atos do menor, nos termos do art. 14 da LGPD.',
        },
      ],
    },
    {
      id: 'natureza-informacoes',
      title: '4. Natureza das informações e limites dos cálculos',
      blocks: [
        {
          type: 'p',
          text: 'Os cálculos exibidos (por exemplo gasto energético, composição corporal, IMC, relações cintura-quadril e cintura-estatura, equivalências de alimentos) baseiam-se em equações e tabelas publicadas na literatura científica e na Tabela Brasileira de Composição de Alimentos (TACO). São estimativas populacionais e podem diferir do resultado individual.',
        },
        {
          type: 'ul',
          items: [
            'A escolha da equação, dos fatores de atividade e das metas é responsabilidade do nutricionista, que deve avaliar a adequação ao caso clínico.',
            'Fórmulas personalizadas cadastradas por nutricionistas são de autoria e responsabilidade de quem as cadastrou; o MyLabs não as valida clinicamente.',
            'Imagens ilustrativas de alimentos, GIFs e modelos anatômicos 3D têm finalidade educativa e não representam porção, preparo ou técnica individualizada.',
          ],
        },
      ],
    },
    {
      id: 'deveres-cliente',
      title: '5. Deveres do Cliente',
      blocks: [
        {
          type: 'ul',
          items: [
            'Fornecer informações verdadeiras e atualizadas (inclusive condições de saúde, alergias, medicamentos e restrições) ao seu nutricionista.',
            'Seguir a orientação do nutricionista e informá-lo sobre qualquer sintoma, desconforto ou intercorrência.',
            'Publicar apenas fotos suas e de refeições/treinos. Não enviar imagens de terceiros sem autorização, nem conteúdo íntimo, ilícito, ofensivo ou que viole direitos de outras pessoas.',
            'Não compartilhar sua senha e não tentar acessar dados de outros usuários.',
          ],
        },
      ],
    },
    {
      id: 'deveres-nutri',
      title: '6. Deveres do Nutricionista',
      blocks: [
        {
          type: 'ul',
          items: [
            'Manter o registro profissional (CRN) regular e informar ao Suporte qualquer alteração ou suspensão.',
            'Cumprir o Código de Ética e de Conduta do Nutricionista (Resolução CFN nº 599/2018) e demais normas profissionais, inclusive quanto ao sigilo e ao registro do atendimento.',
            'Atuar como controlador dos dados clínicos de seus clientes (LGPD, art. 5º, VI): definir as finalidades, coletar apenas dados necessários, informar o cliente sobre o tratamento e manter base legal adequada para os dados de saúde.',
            'Utilizar os dados dos clientes somente para o acompanhamento nutricional, não os compartilhando com terceiros sem base legal ou consentimento.',
            'Responder pela prescrição de dietas, treinos, metas, avaliações e orientações registradas na Plataforma.',
          ],
        },
      ],
    },
    {
      id: 'conteudo',
      title: '7. Conteúdo enviado e licença',
      blocks: [
        {
          type: 'p',
          text: 'Fotos, anexos, textos e demais conteúdos enviados continuam sendo seus. Ao enviá-los, você concede ao MyLabs uma licença limitada, não exclusiva e revogável, apenas para armazenar, exibir e processar esses conteúdos com a finalidade de prestar o serviço, para você e para o nutricionista responsável.',
        },
        {
          type: 'ul',
          items: [
            'Fotos do diário (refeições e treino) e fotos de evolução ficam em armazenamento privado e são acessíveis ao próprio cliente e ao nutricionista responsável, por meio de endereços temporários.',
            'Você pode excluir as fotos que publicou diretamente na Plataforma ou solicitar a exclusão pela Central de Privacidade.',
            'Não utilizamos suas fotos para publicidade, treinamento de modelos de inteligência artificial ou divulgação.',
          ],
        },
      ],
    },
    {
      id: 'whatsapp',
      title: '8. Integração com WhatsApp',
      blocks: [
        {
          type: 'p',
          text: 'A Plataforma gera mensagens prontas e abre o aplicativo WhatsApp (serviço de terceiro) para você contatar seu nutricionista ou o Suporte. A partir do envio, a mensagem passa a ser tratada pelo WhatsApp conforme os termos e a política daquele serviço, fora do controle do MyLabs.',
        },
        {
          type: 'ul',
          items: [
            'Evite incluir informações sensíveis desnecessárias no texto da mensagem.',
            'O MyLabs não garante a entrega, o horário de resposta nem a disponibilidade do profissional.',
            'O número de WhatsApp do nutricionista e o do Suporte são cadastrados por eles próprios e utilizados apenas para esse canal.',
          ],
        },
      ],
    },
    {
      id: 'terceiros',
      title: '9. Conteúdos de terceiros e atribuições',
      blocks: [
        {
          type: 'p',
          text: 'A Plataforma utiliza conteúdos e bases de terceiros, que permanecem sujeitos às respectivas licenças:',
        },
        {
          type: 'ul',
          items: [
            'Composição de alimentos: Tabela Brasileira de Composição de Alimentos (TACO), 4ª edição, NEPA/UNICAMP.',
            'Modelo anatômico 3D (Atlas Anatômico): “Écorché” (github.com/Charleeh/ecorche), licenciado sob CC BY-SA 4.0, baseado em BodyParts3D, © The Database Center for Life Science, CC BY 4.0, e em Z-Anatomy, de Gauthier Kervyn, CC BY-SA 4.0. O arquivo do modelo foi utilizado sem alteração de malha; as traduções de nomes para o português foram aplicadas apenas na interface.',
            'Equações científicas citadas nas telas de avaliação: Mifflin-St Jeor, Harris-Benedict, Cunningham, Jackson & Pollock, Durnin & Womersley, Faulkner, Siri, entre outras, com as referências indicadas na própria Plataforma.',
          ],
        },
      ],
    },
    {
      id: 'propriedade',
      title: '10. Propriedade intelectual',
      blocks: [
        {
          type: 'p',
          text: 'O nome “MyLabs”, a identidade visual, o layout e o código-fonte da Plataforma pertencem ao seu Operador, ressalvados os componentes de código aberto e os conteúdos de terceiros mencionados acima. É proibido copiar, descompilar, revender ou explorar comercialmente a Plataforma sem autorização.',
        },
      ],
    },
    {
      id: 'condutas',
      title: '11. Condutas proibidas',
      blocks: [
        {
          type: 'ul',
          items: [
            'Tentar burlar autenticação, controles de acesso ou o isolamento entre perfis; explorar falhas; realizar varredura automatizada ou sobrecarregar o serviço.',
            'Acessar, copiar ou divulgar dados de terceiros sem autorização.',
            'Inserir conteúdo ilícito, discriminatório, ofensivo, sexualmente explícito ou que viole direitos de terceiros.',
            'Utilizar a Plataforma para prescrever, divulgar ou comercializar produtos e condutas sem respaldo técnico ou em desacordo com normas profissionais.',
            'Fazer-se passar por outra pessoa ou profissional.',
          ],
        },
        {
          type: 'p',
          text: 'O descumprimento pode levar à suspensão ou exclusão da conta, sem prejuízo de medidas legais cabíveis.',
        },
      ],
    },
    {
      id: 'disponibilidade',
      title: '12. Disponibilidade e alterações do serviço',
      blocks: [
        {
          type: 'p',
          text: 'Empregamos esforços razoáveis para manter a Plataforma disponível e segura, mas não garantimos funcionamento ininterrupto ou livre de erros. Podem ocorrer manutenções, atualizações e indisponibilidades de provedores de infraestrutura. Funcionalidades podem ser alteradas, incluídas ou descontinuadas.',
        },
        {
          type: 'p',
          text: 'Contas de demonstração, quando disponíveis, contêm dados fictícios e não devem ser utilizadas para registrar informações reais de pacientes.',
        },
      ],
    },
    {
      id: 'responsabilidade',
      title: '13. Responsabilidades',
      blocks: [
        {
          type: 'p',
          text: 'Na máxima extensão permitida pela lei, o MyLabs não responde por decisões clínicas, prescrições, resultados de saúde ou estéticos, nem por informações incorretas fornecidas por usuários. Também não responde por falhas de serviços de terceiros (por exemplo WhatsApp, redes de telecomunicação e provedores de nuvem) fora do seu controle razoável.',
        },
        {
          type: 'p',
          text: 'Nada nestes Termos exclui ou limita direitos assegurados ao consumidor pela legislação aplicável, nem a responsabilidade que não possa ser excluída por lei.',
        },
      ],
    },
    {
      id: 'encerramento',
      title: '14. Suspensão, encerramento e exclusão',
      blocks: [
        {
          type: 'p',
          text: 'Você pode pedir o encerramento da conta e a eliminação dos seus dados pela Central de Privacidade (menu do perfil → “Privacidade e Meus Dados”). O Suporte também pode suspender ou encerrar contas que violem estes Termos. Os efeitos sobre os seus dados seguem a Política de Privacidade, incluindo as hipóteses legais de retenção.',
        },
      ],
    },
    {
      id: 'alteracoes',
      title: '15. Alterações destes Termos',
      blocks: [
        {
          type: 'p',
          text: 'Podemos atualizar estes Termos para refletir mudanças legais, técnicas ou de funcionalidades. Cada versão é identificada por data. Em alterações relevantes, solicitaremos um novo aceite no seu próximo acesso. O histórico dos seus aceites é registrado de forma imutável.',
        },
      ],
    },
    {
      id: 'foro',
      title: '16. Lei aplicável e foro',
      blocks: [
        {
          type: 'p',
          text: 'Estes Termos são regidos pelas leis da República Federativa do Brasil, em especial o Código de Defesa do Consumidor, o Marco Civil da Internet (Lei nº 12.965/2014) e a LGPD. Nas relações de consumo, fica eleito o foro do domicílio do consumidor (CDC, art. 101, I). Nas demais hipóteses, aplica-se o foro do domicílio do Operador da Plataforma.',
        },
      ],
    },
    {
      id: 'contato',
      title: '17. Contato',
      blocks: [
        {
          type: 'p',
          text: `Dúvidas sobre estes Termos: ${contactLine}pela aba “Assistência WhatsApp” (Suporte do Sistema) ou pelo WhatsApp do Suporte ${LEGAL_CONFIG.supportWhatsappDisplay}.`,
        },
      ],
    },
  ],
}

export const PRIVACY_POLICY: LegalDocument = {
  id: 'privacy',
  title: 'Política de Privacidade',
  subtitle: 'Como o MyLabs trata dados pessoais e dados de saúde, conforme a LGPD (Lei nº 13.709/2018).',
  version: LEGAL_VERSIONS.privacy,
  sections: [
    {
      id: 'papeis',
      title: '1. Quem é responsável pelos seus dados',
      blocks: [
        {
          type: 'p',
          text: 'Para entender a quem cada informação pertence, a LGPD distingue papéis. No MyLabs eles se dividem assim:',
        },
        {
          type: 'ul',
          items: [
            'Nutricionista (Controlador dos dados clínicos): decide por que e como os dados de saúde do seu cliente são tratados no acompanhamento nutricional (dieta, treino, avaliações, evolução, observações clínicas).',
            `MyLabs / ${LEGAL_CONFIG.operatorName} (Operador dos dados clínicos): fornece a infraestrutura e trata esses dados em nome e conforme as instruções do nutricionista.`,
            'MyLabs (Controlador dos dados de conta e segurança): decide sobre os dados necessários para autenticação, controle de acesso, suporte técnico, prevenção a fraudes e registros de aceite.',
          ],
        },
        {
          type: 'p',
          text:
            'Canal de privacidade e Encarregado pelo tratamento de dados (art. 41 da LGPD): ' +
            LEGAL_CONFIG.operatorName +
            (LEGAL_CONFIG.privacyEmail ? `, ${LEGAL_CONFIG.privacyEmail}` : ', por meio da Central de Privacidade dentro da Plataforma') +
            `, ou WhatsApp ${LEGAL_CONFIG.supportWhatsappDisplay}.` +
            (LEGAL_CONFIG.taxId ? ` Documento: ${LEGAL_CONFIG.taxId}.` : ''),
        },
      ],
    },
    {
      id: 'dados',
      title: '2. Quais dados tratamos',
      blocks: [
        {
          type: 'ul',
          items: [
            'Conta e identificação: nome, e-mail de acesso, perfil (cliente, nutricionista ou suporte), foto de perfil (opcional), telefone/WhatsApp de contato e, para nutricionistas, CRN, especialidade, clínica, cidade e UF.',
            'Cadastro clínico do cliente: data de nascimento, sexo, estatura, objetivo, nível de atividade, metas e observações clínicas registradas pelo nutricionista.',
            'Avaliações antropométricas: peso, dobras cutâneas, circunferências, resultados calculados (percentual de gordura, massa magra, IMC e outros) e fotos de evolução.',
            'Registros de acompanhamento: planos alimentares e de treino, refeições marcadas, água, peso diário, exercícios concluídos e repetições.',
            'Fotos do diário: imagens de refeições e do treino do dia enviadas pelo cliente, com data e legenda.',
            'Comunicações: solicitações de suporte e solicitações de privacidade registradas na Plataforma (o conteúdo trocado no WhatsApp fica no próprio WhatsApp).',
            'Dados técnicos: endereço IP, tipo de navegador, data e hora de acesso, registros de autenticação e, no aceite legal, o identificador do navegador (user agent).',
          ],
        },
        {
          type: 'p',
          text: 'Não coletamos geolocalização, contatos do aparelho, nem dados de cartão de crédito.',
        },
      ],
    },
    {
      id: 'sensiveis',
      title: '3. Dados de saúde (dados pessoais sensíveis)',
      blocks: [
        {
          type: 'p',
          text: 'Informações sobre saúde, composição corporal, hábitos alimentares, treinos e fotos corporais podem revelar condições de saúde e, por isso, são tratadas como dados pessoais sensíveis (LGPD, art. 5º, II e art. 11). Aplicamos proteção reforçada e limitamos o acesso ao estritamente necessário.',
        },
        {
          type: 'p',
          text: 'As bases legais aplicáveis são o seu consentimento específico e destacado para finalidades determinadas (art. 11, I) — coletado no aceite da Plataforma — e a tutela da saúde, em procedimento realizado por profissional de saúde (art. 11, II, “f”), no caso do atendimento prestado pelo nutricionista.',
        },
        {
          type: 'note',
          text: 'Você pode revogar o consentimento a qualquer momento, de forma gratuita, pela Central de Privacidade. A revogação não afeta o tratamento já realizado e pode impedir o uso de funcionalidades que dependam dos dados.',
        },
      ],
    },
    {
      id: 'finalidades',
      title: '4. Para que usamos os dados e em que base legal',
      blocks: [
        {
          type: 'ul',
          items: [
            'Prestar o acompanhamento nutricional e de treino (prescrever, registrar, exibir evolução e relatórios) — execução do contrato / tutela da saúde / consentimento.',
            'Autenticar usuários, isolar o acesso por perfil e proteger a Plataforma contra acessos indevidos e fraudes — legítimo interesse e segurança (LGPD, art. 6º, VII).',
            'Atender solicitações de suporte e de titulares de dados — execução do contrato e obrigação legal.',
            'Manter o registro de aceite dos documentos legais — cumprimento de obrigação legal e exercício regular de direitos (art. 8º, §2º).',
            'Gerar relatórios periódicos de acompanhamento ao nutricionista, conforme a periodicidade por ele definida — execução do contrato / tutela da saúde.',
            'Cumprir obrigações legais e regulatórias e responder a ordens de autoridades.',
          ],
        },
        {
          type: 'p',
          text: 'Não vendemos dados pessoais, não exibimos publicidade, não criamos perfis de consumo e não tomamos decisões exclusivamente automatizadas que produzam efeitos jurídicos sobre você. Os cálculos exibidos são apoio ao julgamento do nutricionista.',
        },
      ],
    },
    {
      id: 'compartilhamento',
      title: '5. Com quem os dados são compartilhados',
      blocks: [
        {
          type: 'ul',
          items: [
            'Seu nutricionista responsável: acessa os dados clínicos e as fotos dos clientes a ele vinculados. Nenhum outro nutricionista tem acesso.',
            'Equipe de Suporte/Administração do MyLabs: acesso restrito para administrar contas, prestar suporte técnico e atender solicitações de privacidade.',
            'Provedores de infraestrutura (operadores): Supabase (banco de dados, autenticação e armazenamento de arquivos, com projeto hospedado na região de São Paulo — Brasil) e GitHub Pages (hospedagem dos arquivos do site). Eles tratam dados somente para viabilizar o serviço.',
            'WhatsApp (Meta): somente quando você, por iniciativa própria, envia uma mensagem pronta; o conteúdo segue as regras do WhatsApp.',
            'Autoridades públicas: quando exigido por lei ou ordem judicial.',
          ],
        },
        {
          type: 'p',
          text: 'Fotos e arquivos são armazenados em repositório privado e exibidos por endereços temporários. Nenhum dado de saúde é publicado ou indexado.',
        },
      ],
    },
    {
      id: 'transferencia',
      title: '6. Transferência internacional',
      blocks: [
        {
          type: 'p',
          text: 'O banco de dados e os arquivos ficam hospedados em São Paulo. Contudo, os provedores mencionados são empresas com operações no exterior, o que pode envolver acesso técnico ou suporte a partir de outros países. Nessa hipótese, a transferência ocorre com base no art. 33 da LGPD, mediante garantias contratuais de proteção adequadas oferecidas pelos provedores.',
        },
      ],
    },
    {
      id: 'retencao',
      title: '7. Por quanto tempo guardamos os dados',
      blocks: [
        {
          type: 'ul',
          items: [
            'Dados da conta e do acompanhamento: enquanto a conta estiver ativa e o vínculo com o nutricionista existir.',
            'Após o encerramento ou o pedido de eliminação: os dados são eliminados ou anonimizados, ressalvadas as hipóteses de conservação autorizadas no art. 16 da LGPD — por exemplo, cumprimento de obrigação legal ou regulatória, inclusive o dever do nutricionista de manter o registro do atendimento conforme as normas do Conselho Federal de Nutricionistas, e exercício regular de direitos.',
            'Registros de acesso e de segurança: mantidos pelo prazo necessário às finalidades de segurança e por, no mínimo, o período previsto no Marco Civil da Internet (art. 15, seis meses).',
            'Registro de aceite dos documentos legais: mantido enquanto a conta existir, para comprovação do consentimento.',
          ],
        },
      ],
    },
    {
      id: 'seguranca',
      title: '8. Segurança',
      blocks: [
        {
          type: 'ul',
          items: [
            'Controle de acesso por perfil e isolamento no próprio banco de dados (segurança em nível de linha — RLS): cada usuário só enxerga o que lhe é permitido.',
            'Comunicação criptografada (HTTPS/TLS) e senhas armazenadas apenas de forma protegida (hash) pelo serviço de autenticação.',
            'Fotos do diário, de evolução e anexos em armazenamento privado, acessíveis por links temporários e somente a quem tem permissão.',
            'Registro versionado e imutável dos aceites legais.',
          ],
        },
        {
          type: 'p',
          text: 'Nenhum sistema é totalmente imune a riscos. Em caso de incidente de segurança que possa acarretar risco ou dano relevante, comunicaremos os titulares e a Autoridade Nacional de Proteção de Dados (ANPD) nos termos do art. 48 da LGPD. Proteja sua senha e saia da conta em dispositivos compartilhados.',
        },
      ],
    },
    {
      id: 'cookies',
      title: '9. Cookies e armazenamento local',
      blocks: [
        {
          type: 'p',
          text: 'A Plataforma utiliza apenas armazenamento local estritamente necessário para manter a sua sessão autenticada. Não usamos cookies de publicidade, de análise de comportamento (analytics) nem ferramentas de rastreamento de terceiros. As fontes tipográficas são servidas pelo próprio site, sem requisições a serviços de fontes externos.',
        },
      ],
    },
    {
      id: 'direitos',
      title: '10. Seus direitos como titular',
      blocks: [
        {
          type: 'p',
          text: 'Conforme o art. 18 da LGPD, você pode, a qualquer momento e mediante requisição:',
        },
        {
          type: 'ul',
          items: [
            'confirmar a existência de tratamento e acessar seus dados;',
            'corrigir dados incompletos, inexatos ou desatualizados;',
            'solicitar anonimização, bloqueio ou eliminação de dados desnecessários, excessivos ou tratados em desconformidade;',
            'solicitar a portabilidade dos dados;',
            'obter informação sobre as entidades com as quais compartilhamos dados;',
            'ser informado sobre a possibilidade de não fornecer consentimento e suas consequências;',
            'revogar o consentimento e pedir a eliminação dos dados tratados com base nele;',
            'peticionar perante a ANPD (gov.br/anpd).',
          ],
        },
        {
          type: 'p',
          text: 'Como exercer: acesse o menu do seu perfil → “Privacidade e Meus Dados”, onde você pode baixar uma cópia dos seus dados em formato estruturado (JSON) e registrar solicitações de correção, eliminação, portabilidade, revogação de consentimento ou informações. As solicitações chegam ao Suporte e respondemos nos prazos da LGPD (declaração completa em até 15 dias, art. 19, II).',
        },
        {
          type: 'note',
          text: 'Alguns dados clínicos são mantidos pelo nutricionista como controlador e podem estar sujeitos a prazos de guarda profissionais. Nesses casos, explicaremos o motivo de uma eventual retenção e encaminharemos o seu pedido ao profissional responsável.',
        },
      ],
    },
    {
      id: 'criancas',
      title: '11. Crianças e adolescentes',
      blocks: [
        {
          type: 'p',
          text: 'O tratamento de dados de menores de 18 anos ocorre somente no seu melhor interesse e com o consentimento específico e em destaque de pelo menos um dos pais ou responsável legal (art. 14 da LGPD). Se você é responsável legal e deseja exercer direitos em nome do menor, utilize a Central de Privacidade.',
        },
      ],
    },
    {
      id: 'alteracoes-privacidade',
      title: '12. Alterações desta Política',
      blocks: [
        {
          type: 'p',
          text: 'Esta Política pode ser atualizada para refletir mudanças legais ou de funcionalidades. A versão vigente é sempre identificada por data. Para mudanças relevantes — especialmente novas finalidades ou novos compartilhamentos — pediremos um novo aceite.',
        },
      ],
    },
    {
      id: 'contato-privacidade',
      title: '13. Contato e reclamações',
      blocks: [
        {
          type: 'p',
          text: `Dúvidas, solicitações e reclamações sobre privacidade: Central de Privacidade (menu do perfil), ${contactLine}ou WhatsApp ${LEGAL_CONFIG.supportWhatsappDisplay}. Você também pode apresentar reclamação à Autoridade Nacional de Proteção de Dados (ANPD), em gov.br/anpd.`,
        },
      ],
    },
  ],
}

export const LEGAL_DOCUMENTS: Record<LegalDocumentId, LegalDocument> = {
  terms: TERMS_OF_USE,
  privacy: PRIVACY_POLICY,
}

/** Quais aceites são exigidos de cada perfil. */
export function requiredConsentsForRole(role: string | undefined | null): ConsentDocumentId[] {
  if (role === 'client') return ['terms', 'privacy', 'health_data']
  if (role === 'nutritionist') return ['terms', 'privacy', 'professional_duties']
  return ['terms', 'privacy']
}

export const CONSENT_LABELS: Record<ConsentDocumentId, { title: string; text: string }> = {
  terms: {
    title: 'Termos de Uso',
    text: 'Li e concordo com os Termos de Uso do MyLabs.',
  },
  privacy: {
    title: 'Política de Privacidade',
    text: 'Li e compreendi a Política de Privacidade e como meus dados pessoais são tratados.',
  },
  health_data: {
    title: 'Consentimento para dados de saúde e fotos',
    text: 'Consinto, de forma específica e destacada, com o tratamento dos meus dados de saúde (medidas, avaliações, registros de dieta e treino) e das fotos que eu enviar, para o acompanhamento com meu nutricionista, conforme a Política de Privacidade (LGPD, art. 11, I). Sei que posso revogar este consentimento a qualquer momento.',
  },
  professional_duties: {
    title: 'Responsabilidades do Nutricionista',
    text: 'Declaro que meu registro no CRN está regular e que atuo como controlador dos dados clínicos dos meus clientes: informarei os pacientes sobre o tratamento, usarei os dados apenas para o acompanhamento nutricional e respeitarei o sigilo profissional e a LGPD.',
  },
}
