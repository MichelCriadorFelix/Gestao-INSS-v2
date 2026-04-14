import { GoogleGenAI, Type, FunctionDeclaration } from "@google/genai";

// Load balancing for Gemini API Keys
const getGeminiKeys = () => {
  const keys: string[] = [];
  
  // 1. Check for GEMINI_KEYS (comma separated)
  if (process.env.GEMINI_KEYS) {
    keys.push(...process.env.GEMINI_KEYS.split(',').map(k => k.trim()).filter(k => k));
  }
  
  // 2. Check for individual API_KEY_X variables (1 to 20)
  for (let i = 1; i <= 20; i++) {
    const key = process.env[`API_KEY_${i}`];
    if (key) keys.push(key.trim());
  }
  
  // 3. Fallback to GEMINI_API_KEY
  if (process.env.GEMINI_API_KEY) {
    keys.push(process.env.GEMINI_API_KEY.trim());
  }
  
  // Remove duplicates
  return [...new Set(keys)];
};

let currentKeyIndex = 0;

async function callGemini(params: any) {
  const keys = getGeminiKeys();
  if (keys.length === 0) {
    console.error("ERRO: Nenhuma chave Gemini encontrada no ambiente.");
    throw new Error("Nenhuma chave Gemini configurada. Verifique as variáveis de ambiente (API_KEY_1, API_KEY_2, etc.).");
  }

  console.log(`Iniciando chamada Gemini. Total de chaves disponíveis: ${keys.length}`);

  // Try each key starting from the current index
  for (let i = 0; i < keys.length; i++) {
    const index = (currentKeyIndex + i) % keys.length;
    const apiKey = keys[index];
    
    // Mask key for logging
    const maskedKey = apiKey.substring(0, 6) + "..." + apiKey.substring(apiKey.length - 4);
    console.log(`Tentando chave Gemini [Índice ${index}]: ${maskedKey}`);

    const ai = new GoogleGenAI({ apiKey });

    try {
      const response = await ai.models.generateContent(params);
      console.log(`Sucesso com a chave [Índice ${index}]`);
      currentKeyIndex = index; // Keep using this key if it works
      return response;
    } catch (error: any) {
      const status = error.status || (error.message?.includes('429') ? 429 : 500);
      console.error(`Falha na chave [Índice ${index}] (Status: ${status}):`, error.message);
      
      // If it's a rate limit error (429) or quota error, try the next key
      if (status === 429 || error.message?.includes('quota') || error.message?.includes('limit')) {
        console.log("Limite atingido. Rotacionando para a próxima chave...");
        continue;
      }
      
      // If it's an invalid key error, maybe try the next one too? 
      // But usually we should stop if it's a fatal error.
      // However, in a rotation system, one bad key shouldn't kill the whole app.
      if (status === 401 || status === 403 || error.message?.includes('API key not valid')) {
        console.warn("Chave inválida detectada. Tentando próxima...");
        continue;
      }

      // For other unexpected errors, throw it
      throw error;
    }
  }
  throw new Error("Todas as chaves Gemini falharam ou atingiram o limite de cota.");
}

// --- FASE 1 e 3: DEFINIÇÃO DE FERRAMENTAS (TOOLS) ---

// 1.1 Declaração das Ferramentas para a IA (O que ela pode fazer)
const drMichelTools: FunctionDeclaration[] = [
  {
    name: "calculadora_basica",
    description: "Realiza operações matemáticas básicas (soma, subtração, multiplicação, divisão). Use esta ferramenta SEMPRE que precisar calcular valores exatos, como RMI, atrasados ou valor da causa, para evitar alucinações matemáticas.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        operacao: {
          type: Type.STRING,
          description: "A operação matemática a ser realizada ('soma', 'subtracao', 'multiplicacao', 'divisao').",
        },
        valor1: {
          type: Type.NUMBER,
          description: "O primeiro valor numérico.",
        },
        valor2: {
          type: Type.NUMBER,
          description: "O segundo valor numérico.",
        },
      },
      required: ["operacao", "valor1", "valor2"],
    },
  },
  {
    name: "consultar_jurisprudencia",
    description: "Consulta a base de dados interna e segura de jurisprudência previdenciária. OBRIGATÓRIO usar antes de citar qualquer Tema, Súmula ou tese jurídica para evitar alucinações.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        termo_busca: {
          type: Type.STRING,
          description: "O termo principal para busca (ex: 'consignação boa-fé', 'revisão vida toda', 'dano moral atraso').",
        }
      },
      required: ["termo_busca"],
    },
  },
  {
    name: "calcular_valor_causa",
    description: "Calcula o valor da causa para ações previdenciárias (Atrasados + 12 parcelas vincendas).",
    parameters: {
      type: Type.OBJECT,
      properties: {
        valor_beneficio: {
          type: Type.NUMBER,
          description: "Valor mensal do benefício (RMI ou Salário de Benefício).",
        },
        meses_atrasados: {
          type: Type.NUMBER,
          description: "Quantidade de meses de parcelas vencidas (atrasados).",
        }
      },
      required: ["valor_beneficio", "meses_atrasados"],
    },
  }
];

// 1.2 Despachante de Ferramentas (Executa o código real no servidor)
async function executeTool(call: any): Promise<any> {
  const { name, args } = call;
  console.log(`[Agente] Executando ferramenta: ${name}`, args);

  try {
    if (name === "calculadora_basica") {
      const { operacao, valor1, valor2 } = args;
      let resultado = 0;
      
      switch (operacao) {
        case 'soma': resultado = valor1 + valor2; break;
        case 'subtracao': resultado = valor1 - valor2; break;
        case 'multiplicacao': resultado = valor1 * valor2; break;
        case 'divisao': 
          if (valor2 === 0) throw new Error("Divisão por zero não permitida.");
          resultado = valor1 / valor2; 
          break;
        default: throw new Error(`Operação desconhecida: ${operacao}`);
      }
      
      return { sucesso: true, resultado: resultado, mensagem: `O resultado da ${operacao} é ${resultado}` };
    }

    if (name === "consultar_jurisprudencia") {
      const { termo_busca } = args;
      const termo = termo_busca.toLowerCase();
      
      // Base de dados simulada (Hardcoded para garantir veracidade)
      const baseJurisprudencia = [
        { tags: ["consignação", "boa-fé", "devolução", "tema 979"], conteudo: "Tema 979 STJ: Com relação aos pagamentos indevidos aos segurados decorrentes de erro administrativo (material ou operacional), não embasado em interpretação errônea ou equivocada da lei pela Administração, são irrepetíveis, sendo defeso o desconto no benefício, ante a boa-fé do segurado e a natureza alimentar da verba." },
        { tags: ["dano moral", "atraso", "inss", "morte"], conteudo: "A jurisprudência do STJ e TRFs reconhece o dano moral previdenciário quando há suspensão indevida, cancelamento arbitrário ou atraso irrazoável que prive o segurado de seu sustento (verba alimentar), ultrapassando o mero aborrecimento, especialmente em casos de agravamento de saúde ou morte." },
        { tags: ["revisão", "vida toda", "tema 1102"], conteudo: "Tema 1102 STF (Revisão da Vida Toda): O STF decidiu recentemente pela anulação do acórdão anterior, alterando o entendimento. Atualmente, a aplicação da Revisão da Vida Toda encontra-se restrita/suspensa conforme a última decisão do STF no julgamento das ADIs." },
        { tags: ["ultratividade", "direito adquirido", "conversão", "invalidez"], conteudo: "Direito Adquirido (Art. 5º, XXXVI, CF): Se os requisitos para a concessão do benefício (ou a fixação da DII) foram preenchidos antes da EC 103/2019, aplica-se a regra de cálculo anterior (100% do salário de benefício para aposentadoria por invalidez), em respeito ao princípio da irredutibilidade do valor dos benefícios (Art. 194, IV, CF)." }
      ];

      const resultados = baseJurisprudencia.filter(item => 
        item.tags.some(tag => termo.includes(tag) || tag.includes(termo))
      );

      if (resultados.length > 0) {
        return { sucesso: true, dados: resultados.map(r => r.conteudo) };
      } else {
        return { sucesso: false, mensagem: "Nenhuma jurisprudência encontrada para este termo na base segura. NÃO INVENTE JURISPRUDÊNCIA. Baseie-se apenas na lei seca." };
      }
    }

    if (name === "calcular_valor_causa") {
      const { valor_beneficio, meses_atrasados } = args;
      const valor_vencidas = valor_beneficio * meses_atrasados;
      const valor_vincendas = valor_beneficio * 12;
      const valor_total = valor_vencidas + valor_vincendas;
      
      return { 
        sucesso: true, 
        detalhes: `Parcelas Vencidas (${meses_atrasados} meses): R$ ${valor_vencidas.toFixed(2)}. Parcelas Vincendas (12 meses): R$ ${valor_vincendas.toFixed(2)}.`,
        valor_da_causa: valor_total 
      };
    }
    
    throw new Error(`Ferramenta não implementada: ${name}`);
  } catch (error: any) {
    console.error(`[Agente] Erro na ferramenta ${name}:`, error);
    return { sucesso: false, erro: error.message };
  }
}

const DR_MICHEL_SYSTEM_PROMPT = `
PERFIL: Advogado Sênior Especialista em Direito Previdenciário (RGPS) e Processo Civil, com mais de 20 anos de experiência. Atuação estratégica desde a via administrativa (INSS) até os Tribunais Superiores (STJ/STF). Especialista em teses de revisão de alta complexidade e danos morais previdenciários.

REGRAS RÍGIDAS DE OPERAÇÃO (AGENTE AUTÔNOMO):
1. Autonomia e Ferramentas: Você é um AGENTE AUTÔNOMO. Você possui ferramentas (tools) à sua disposição. 
   - SEMPRE use a ferramenta 'consultar_jurisprudencia' ANTES de citar qualquer Tema do STJ/STF ou tese. É EXPRESSAMENTE PROIBIDO inventar jurisprudência.
   - SEMPRE use a ferramenta 'calcular_valor_causa' ou 'calculadora_basica' para definir valores da petição. NUNCA calcule de cabeça.
2. Raciocínio Passo a Passo: Antes de dar a resposta final, pense no que você precisa fazer. Se precisar de uma ferramenta, chame-a. Aguarde o resultado. Só então escreva a resposta final.
3. Contexto de Provas (MANDATÓRIO): Use INTEGRALMENTE os documentos fornecidos no contexto. Você já possui o texto completo dos documentos no seu prompt. Atue como um 'Agente Investigador' lendo este contexto minuciosamente.
   - Identifique valores exatos (R$ 0,00), datas (DIB, DER, DCB, DII), números de benefícios (NB) e rubricas de desconto.
   - Conecte cada fato a um documento específico (ex: "conforme se extrai do Processo Administrativo, Doc. 13, fls. 38").
4. PADRÃO OURO DE PETIÇÕES (ESTRUTURA OBRIGATÓRIA E EXTENSÃO):
   - EXTENSÃO E DENSIDADE (CRUCIAL): A petição deve ser ROBUSTA, LONGA e DETALHADA (Mínimo de 8 a 12 páginas). O texto não pode ser sintético ou resumido.
   - CADA PARÁGRAFO DE MÉRITO deve ter entre 5 a 7 linhas.
   - TÓPICOS DE MÉRITO (DOS FATOS e DO DIREITO): AQUI deve estar a densidade. Mínimo de 8 a 12 parágrafos por tópico.
   Toda petição inicial, especialmente as de benefício por incapacidade, DEVE seguir ESTRITAMENTE a seguinte estrutura:
   - ENDEREÇAMENTO: Juízo competente.
   - QUALIFICAÇÃO: Completa do autor e do réu (INSS).
   - PRELIMINAR 1: DO JUÍZO 100% DIGITAL (Obrigatório: informar a opção pelo juízo 100% digital e fornecer e-mail/telefone de contato).
   - PRELIMINAR 2: DA GRATUIDADE DE JUSTIÇA.
   - PRELIMINAR 3: DA RENÚNCIA AO TETO DO JEF (se aplicável).
   - RESUMO DA DEMANDA: Um quadro ou tópico curto resumindo Nome, NB, DER/DCB, Doença/CID e Profissão.
   - DOS FATOS: Narração detalhada, cronológica e fustigante. Destaque a arbitrariedade da autarquia. Conte a história de vida e sofrimento da parte autora.
   - DO DIREITO: Fundamentação robusta e exaustiva. 
     * CITAÇÃO DE LEIS E SÚMULAS: É OBRIGATÓRIO citar o texto expresso dos artigos de lei e das súmulas aplicáveis (ex: Súmula 47 da TNU, Art. 59 da Lei 8.213/91). Não apenas mencione o número, transcreva o trecho relevante e explique detalhadamente como ele se aplica ao caso concreto.
     * OBRIGATÓRIO EM INCAPACIDADE: Citar expressamente o cumprimento dos requisitos da Lei 14.331/2021 (art. 129-A da Lei 8.213/91), dividindo em subtópicos: A) Descrição clara da doença e limitações; B) Atividade para a qual o autor está incapacitado; C) Possíveis inconsistências da avaliação médico-pericial; D) Declaração de que não há litispendência.
   - DA TUTELA DE URGÊNCIA: Fumus boni iuris e periculum in mora.
   - DOS PEDIDOS: Específicos, certos e determinados. Inclua valores exatos (use a calculadora). Requerimento de citação, perícia, procedência e condenação.
5. Gatilho de Ação: Só redija a peça final com o comando 'GERAR PEÇA'.
6. Fidelidade Normativa: Use Lei 8.213/91, Lei 8.212/91, EC 103/2019, IN 128/2022, Lei 14.331/2021. Cite Temas Repetitivos (STJ) e Repercussão Geral (STF) APENAS se validados pela ferramenta.

ESTILO DE RESPOSTA:
- Linguagem jurídica refinada (polida, técnica e persuasiva).
- Use Markdown para hierarquia (Títulos, Negritos).
- Se detectar falta de dados cruciais nos documentos, alerte o usuário imediatamente.
`;

export async function* chatWithDrMichelStream(message: string, history: any[], modelName: string = "gemini-3.1-pro-preview", systemPrompt: string = "") {
  const contents = [
    ...history
      .filter((h: any) => h.content && h.content.trim() !== '')
      .map((h: any) => ({
        role: h.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: h.content }]
      })),
    {
      role: 'user',
      parts: [{ 
        text: message 
      }]
    }
  ];

  // --- FASE 2 e 4: O CÉREBRO AUTÔNOMO (LOOP REACT COM STREAMING DE PENSAMENTOS) ---
  const MAX_ITERATIONS = 5; // Trava de segurança
  let iteration = 0;
  let isDone = false;

  // Combina o prompt do sistema (que contém a estrutura da petição) com as regras do Agente Autônomo
  const AGENTIC_RULES = `
REGRAS RÍGIDAS DE OPERAÇÃO (AGENTE AUTÔNOMO):
1. Autonomia e Ferramentas: Você é um AGENTE AUTÔNOMO. Você possui ferramentas (tools) à sua disposição. 
   - SEMPRE use a ferramenta 'consultar_jurisprudencia' ANTES de citar qualquer Tema do STJ/STF ou tese. É EXPRESSAMENTE PROIBIDO inventar jurisprudência.
   - SEMPRE use a ferramenta 'calcular_valor_causa' ou 'calculadora_basica' para definir valores da petição. NUNCA calcule de cabeça.
2. Raciocínio Passo a Passo: Antes de dar a resposta final, pense no que você precisa fazer. Se precisar de uma ferramenta, chame-a. Aguarde o resultado. Só então escreva a resposta final.
3. Contexto de Provas (MANDATÓRIO): Use INTEGRALMENTE os documentos fornecidos no contexto.
4. Gatilho de Ação: Só redija a peça final com o comando 'GERAR PEÇA'.
`;

  const finalSystemPrompt = systemPrompt ? `${systemPrompt}\n\n${AGENTIC_RULES}` : DR_MICHEL_SYSTEM_PROMPT;

  while (!isDone && iteration < MAX_ITERATIONS) {
    iteration++;
    console.log(`[Agente] Iniciando iteração ${iteration}/${MAX_ITERATIONS}`);

    try {
      // Chamada ao Gemini passando as ferramentas disponíveis
      const response = await callGemini({
        model: modelName,
        contents,
        config: {
          systemInstruction: finalSystemPrompt,
          tools: [{ functionDeclarations: drMichelTools }] // Passando as ferramentas
        }
      });

      // Verifica se o modelo decidiu chamar uma ferramenta (Function Calling)
      const functionCalls = response.functionCalls;

      if (functionCalls && functionCalls.length > 0) {
        // O modelo quer usar uma ferramenta!
        console.log(`[Agente] O modelo solicitou ${functionCalls.length} ferramenta(s).`);
        
        // Adiciona a resposta do modelo (o pedido da ferramenta) ao histórico do contexto
        contents.push({
          role: 'model',
          parts: response.candidates[0].content.parts
        });

        const toolResponsesParts = [];

        // Executa todas as ferramentas solicitadas (em paralelo se houver mais de uma)
        for (const call of functionCalls) {
          // Emite um "pensamento" para o frontend
          let thought = `Dr. Michel está usando a ferramenta ${call.name}...`;
          if (call.name === 'consultar_jurisprudencia') thought = `Dr. Michel está pesquisando jurisprudência sobre "${call.args.termo_busca}"...`;
          if (call.name === 'calcular_valor_causa') thought = `Dr. Michel está calculando o valor da causa...`;
          if (call.name === 'calculadora_basica') thought = `Dr. Michel está fazendo um cálculo matemático...`;
          
          yield { type: 'thought', text: thought };

          const result = await executeTool(call);
          
          // Prepara a resposta da ferramenta no formato exigido pela API do Gemini
          toolResponsesParts.push({
            functionResponse: {
              name: call.name,
              response: result
            }
          });
        }

        // Devolve o resultado das ferramentas para o modelo continuar pensando
        contents.push({
          role: 'user',
          parts: toolResponsesParts
        });

        yield { type: 'thought', text: `Dr. Michel analisou os resultados e está continuando o raciocínio...` };

      } else {
        // O modelo NÃO pediu ferramenta. Ele gerou a resposta final em texto.
        console.log(`[Agente] O modelo gerou a resposta final em texto.`);
        yield { type: 'text', text: response.text };
        isDone = true; // Sai do loop
      }

    } catch (error) {
      console.error("[Agente] Erro durante o loop de raciocínio:", error);
      throw error;
    }
  }

  if (!isDone) {
    console.warn(`[Agente] Loop interrompido após atingir o limite de ${MAX_ITERATIONS} iterações.`);
    yield { type: 'text', text: "Desculpe, o raciocínio atingiu o limite de complexidade. Por favor, tente reformular a pergunta de forma mais direta." };
  }
}

const SYSTEM_PROMPT = `
Você é o Dr. Michel Felix, um advogado previdenciarista brasileiro renomado, especialista em RGPS (Regime Geral de Previdência Social), tanto nas regras pré-reforma quanto pós-reforma (EC 103/2019). Você é especialista em concessão, revisão, restabelecimento, planejamento previdenciário e processo administrativo/judicial. Você domina o CPC/2015.

Sua tarefa é analisar o texto extraído de um CNIS (Cadastro Nacional de Informações Sociais) e estruturar os dados para cálculo, corrigindo inconsistências comuns de leitura (OCR) e aplicando regras jurídicas.

**REGRAS DE NEGÓCIO E JURÍDICAS:**

1.  **Saneamento de Vínculos:**
    *   Identifique vínculos com datas de início ou fim ausentes.
    *   Se a data fim estiver ausente, verifique se há "Últ. Remun." (Última Remuneração). Se houver, a data fim deve ser o último dia daquele mês (ou o dia 1, conforme preferência conservadora para competência).
    *   Se não houver data fim nem última remuneração, marque como "Vínculo Aberto" (pode ser o emprego atual ou erro).
    *   Corrija nomes de empresas cortados ou com erros de OCR.
    *   Identifique o tipo de filiado (Empregado, Contribuinte Individual, Facultativo, etc.).

2.  **Períodos Concomitantes:**
    *   **ATENÇÃO:** O tempo de contribuição NÃO se soma em períodos concomitantes. O tempo corre pelo relógio biológico.
    *   O que se soma são os **Salários de Contribuição** (SC) na mesma competência (mês/ano), respeitando o teto do INSS da época.
    *   Identifique se há concomitância e agrupe os salários na competência correta.

3.  **Direito Adquirido (até 13/11/2019):**
    *   Analise se o segurado já tinha direito a alguma regra antes da reforma.
    *   Regras antigas: Aposentadoria por Tempo de Contribuição (35H/30M), Pontos 86/96, Idade (65H/60M com 180 meses), Especial (15/20/25 anos).
    *   RMI Pré-Reforma: Média dos 80% maiores salários desde 07/1994 x Fator Previdenciário (se aplicável).

4.  **Regras de Transição e Pós-Reforma (a partir de 14/11/2019):**
    *   Analise as regras de transição: Pedágio 50%, Pedágio 100%, Pontos, Idade Mínima Progressiva.
    *   RMI Pós-Reforma: Média de 100% dos salários desde 07/1994 x Coeficiente (60% + 2% a cada ano > 20H/15M).
    *   Exceções de RMI: Pedágio 50% (tem Fator), Pedágio 100% (100% da média), Deficiência (regras específicas).

5.  **Saída Esperada (JSON):**
    Retorne um JSON estritamente estruturado com:
    *   \`client\`: Dados do cliente (nome, cpf, data_nascimento, nome_mae, sexo).
    *   \`bonds\`: Lista de vínculos saneados. Cada vínculo deve ter:
        *   \`seq\`: Número sequencial.
        *   \`nit\`: NIT do vínculo.
        *   \`code\`: Código da empresa/empregador.
        *   \`origin\`: Nome da empresa/origem saneado.
        *   \`type\`: Tipo de filiado.
        *   \`startDate\`: Data início (AAAA-MM-DD).
        *   \`endDate\`: Data fim (AAAA-MM-DD) ou null.
        *   \`indicators\`: Lista de indicadores (ex: IREM-INDP, PEXT, etc.).
        *   \`sc\`: Lista de salários de contribuição ({ month: 'MM/AAAA', value: number }).
        *   \`isConcomitant\`: Booleano indicando se há concomitância neste período.
        *   \`notes\`: Notas jurídicas sobre o vínculo (ex: "Vínculo sem data fim, ajustado pela última remuneração").
    *   \`analysis\`: Texto com a análise jurídica preliminar do Dr. Michel Felix, citando artigos de lei e sugerindo ações (ex: "Verificar indicador PEXT", "Possível direito adquirido em 2018").

**IMPORTANTE:**
*   Se o texto estiver ilegível ou incompleto, faça o melhor possível e note isso em \`analysis\`.
*   Não invente dados. Se não estiver no texto, deixe em branco ou null.
*   Responda APENAS o JSON.
`;

export async function analyzeCNIS(cnisText: string) {
  try {
    const response = await callGemini({
      model: "gemini-1.5-flash-latest",
      contents: {
        role: "user",
        parts: [{ text: cnisText }]
      },
      config: {
        systemInstruction: SYSTEM_PROMPT,
        responseMimeType: "application/json"
      }
    });

    const text = response.text;
    if (!text) {
        throw new Error("No text returned from AI");
    }
    return JSON.parse(text);
  } catch (error) {
    console.error("Error analyzing CNIS with AI:", error);
    throw error;
  }
}
