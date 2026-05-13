# Contexto do Projeto: Gestão do Escritório - Felix & Castro Advocacia

## Infraestrutura e Serviços
- **Database e Storage:** Supabase Pro (PostgreSQL, pgvector para RAG, Auth, Storage).
- **Hospedagem:** Vercel Pro (Deployment principal).
- **Modelo de IA Padrão:** O modelo principal e padrão de todo o sistema é SEMPRE o `gemini-3-flash-preview` (via `@google/genai` SSR stream).
- **Modelos Alternativos:** Integração com OpenRouter (Modelos Elite) para requisições específicas via API.

## Funcionalidades Core
- **Gestão de Clientes e Contratos:** CRUD completo via Supabase (tabela `clients`).
- **Cálculos Jurídicos:** 
  - Cálculo Trabalhista (`LaborCalc.tsx`).
  - Cálculo Previdenciário (`SocialSecurityCalc.tsx`) integrado com tabela do salário mínimo.
- **RAG (Retrieval-Augmented Generation):** Base de Legislação e Jurisprudência com busca vetorial via Supabase (`pgvector`) e `gemini-text-embedding-004`.
- **Editor de Petições:** Exportação para DOCX rica e integrada.
- **Gestão Extensiva:** Agenda, Módulos Pessoais e Controle Financeiro.

## Arquitetura de IA (Padrão Ouro de Geração Contínua)
O sistema possui duas personas principais de IA: **Dr. Michel Felix** (Civil/Trabalhista/Geral) e **Dra. Luana Castro** (Previdenciário). Ambas compartilham o seguinte "Padrão Ouro" de arquitetura implementado no backend (`api/index.ts`):

1. **Janela de Contexto e Histórico (`compressHistory`):**
   - O histórico de mensagens (Frontend) foi expandido para preservar as últimas **40 mensagens** (cerca de 20 turnos de fala). Isso garante total rastreabilidade quando o advogado e a IA ficam debatendo um caso extensivamente antes de elaborar a peça.
   - Textos de "Tomada de Ciência" (OCRs imensos) ou de longo retorno das IAs (relatórios grandes) recebem uma "poda" inteligente, cortando no frontend após 500 caracteres, pois o contexto global do documento já é entregue e garantido na chave `documentContext` de cada requisição.

2. **Detecção de Intenção (Intent Detection):**
   - Antes de iniciar o Stream da resposta principal, o backend executa uma detecção prévia invisível para decidir se a iteração atual é uma instrução focada em `[GERAÇÃO]` (criar texto final de petição), `[CASUAL]` (dúvidas) ou `[ARQUIVO]/[FASE DE TOMADA DE CIÊNCIA]` (apenas sugar a densidade do documento/OCR e não emitir opiniões longas).

3. **O Dilema de Contexto Resolvido (Memória de Draft):**
   - **Limites Amplos:** A configuração do Gemini possui restrição forçada de `maxOutputTokens: 16383` (permite fluxos com mais de 7.000 palavras em peça final).
   - **Persistência de Peça Automática:** Sempre que a resposta da IA em modo `[GERAÇÃO]` extrapolar 5.000 caracteres, o backend guarda SILENCIOSAMENTE este material integral no Supabase (tabela `ai_conversations`, como `lawyer_type: 'petition_draft'` no id `draft__{nome-ia}_{sessionId}`) substituindo o rascunho anterior desta sessão.
   - **Cirurgia de Peças Perfeitas:** Ao pedir que modifique uma peça ("Petição quase boa, mude apenas X"), a IA em modo geração interceptará esse `petition_draft` de 40.000 caracteres (máximo da memória buffer injetado) e anexará no prompt sob a marcação `[PETIÇÃO BASE ANTERIOR - IMPORTANTE]`. Resultando em uma IA que nunca envia petições miúdas ou com perda gradual de contexto ao progredir nas aprovações de linha.

4. **OCR Impecável de Evidências:**
   - Suporte avançado via File API do Gemini / Base64 nativo gerado temporariamente ao Storage no Supabase a fim de validar páginas densas de sentenças e PDFs extensos sem estourar chamadas HTTP locais.

## REGRAS INEGOCIÁVEIS DE DESENVOLVIMENTO FUTURO
1. **NUNCA DESTRUA A LÓGICA DE DRAFT:** O bloco que busca o `petition_draft` no Supabase e o injeta como "ESTRUTURA PRINCIPAL" no `/api/index.ts` NUNCA deve ser removido, otimizado negativamente ou reescrito a menos que visando sua expansão de buffer superior a 50k caracteres.
2. **NUNCA MODIFIQUE O MÁXIMO DE TOKENS:** `maxOutputTokens: 16383` deve seguir inalterado nas respostas da IA principal em `/api/dr-michel/chat` e `/api/dra-luana/chat`.
3. **NUNCA AFUNILE O `compressHistory` ABAIXO DE 40 MENSAGENS:** Mexer na compressão destruirá as longas defesas baseadas em relatórios gigantescos de clientes complexos.
4. **NÃO OMITA O MODELO BASE:** `gemini-3-flash-preview` foi testado vastamente; se uma refatoração exigir alterar para versões superiores (como Pro), isso só pode ocorrer de forma paralela via opções configuráveis no frontend.

> Você, como IA assistente, comprometa-se a ler o estado de `api/index.ts` e arquivos React frontais sempre analisando as dependências de cada mudança na arquitetura de Rascunhos Supabase antes de intervir em falhas.
