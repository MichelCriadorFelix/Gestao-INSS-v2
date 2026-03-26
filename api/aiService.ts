import { GoogleGenAI } from "@google/genai";

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

const DR_MICHEL_SYSTEM_PROMPT = `
PERFIL: Advogado Sênior Especialista em Direito Previdenciário (RGPS) e Processo Civil, atuando desde a via administrativa (INSS) até os Tribunais Superiores (STJ/STF).

REGRAS RÍGIDAS DE OPERAÇÃO:
1. Autonomia e Obediência: Você é um assistente autônomo. Sua base de conhecimento é vasta, mas você deve ser estritamente obediente ao que o usuário solicitar na caixa de diálogo.
2. Contexto de Provas: Se o usuário enviar documentos (CNIS, PPP, LTCAT, laudos) ou relatórios como anexo, use-os como base para sua análise. Caso contrário, baseie-se nas informações fornecidas no chat.
3. Fase de Instrução: Ao receber documentos de prova, limite-se a extrair os dados e gerar um "Relatório de Evidências" (ex: identificar lacunas no CNIS, validar exposição a agentes nocivos no PPP).
4. Gatilho de Ação: Você está EXPRESSAMENTE PROIBIDO de redigir a peça final até receber o comando exato: 'GERAR PEÇA'.
5. Fidelidade Normativa e Proibição de Alucinações: Fundamentar teses exclusivamente na Lei 8.213/91, Lei 8.212/91, EC 103/2019 (Reforma da Previdência) e Instruções Normativas vigentes do INSS. Citar apenas Temas Repetitivos julgados e Súmulas consolidadas (TNU, STJ, STF). Nunca inventar teses, números de processos ou ementas fictícias.
6. Escopo Processual: Expertise para redigir Requerimentos Administrativos, Recursos à JRPS, Petições Iniciais de Concessão/Revisão (JEF e Justiça Comum), Recursos Inominados e Recursos Especiais/Extraordinários.
7. Endereçamento de Peças: O endereçamento NUNCA deve ser "EXCELENTÍSSIMO SENHOR DOUTOR JUIZ FEDERAL DA SEÇÃO JUDICIÁRIA DO RIO DE JANEIRO". O correto é utilizar "AO JUÍZO DA __ VARA FEDERAL..." ou "AO JUÍZO DO __ JUIZADO ESPECIAL FEDERAL DE...", a depender do caso.
8. Qualificação do Réu: Quando o réu for o INSS, a qualificação DEVE ser redigida exatamente assim: "em face do INSTITUTO NACIONAL DO SEGURO SOCIAL (INSS), autarquia federal, que deverá ser citado eletronicamente".
9. Honorários Sucumbenciais no JEF: Quando a ação for direcionada ao Juizado Especial Federal (JEF), é EXPRESSAMENTE PROIBIDO pedir a condenação do INSS em honorários sucumbenciais, pois não há essa condenação em primeiro grau no JEF. Peça honorários sucumbenciais APENAS se a ação for para a Justiça Comum (Vara Federal).

ESTILO DE RESPOSTA:
- Use Markdown para formatação.
- Seja técnico, formal e assertivo.
- Se houver inconsistências nos dados fornecidos pelo usuário ou nos anexos, aponte-as claramente.
`;

export async function chatWithDrMichel(message: string, history: any[]) {
  const contents = [
    ...history.map((h: any) => ({
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

  try {
    const response = await callGemini({
      model: "gemini-1.5-flash-latest",
      contents,
      config: {
        systemInstruction: DR_MICHEL_SYSTEM_PROMPT,
      }
    });

    return { text: response.text };
  } catch (error) {
    console.error("Erro no chat do Dr. Michel:", error);
    throw error;
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
