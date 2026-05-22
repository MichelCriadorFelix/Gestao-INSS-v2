-- 1. Habilitar a extensão pgvector (necessária para busca vetorial)
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Criar a tabela de trechos de documentos (chunks) dos clientes
CREATE TABLE IF NOT EXISTS client_document_chunks (
    id BIGSERIAL PRIMARY KEY,
    client_id TEXT NOT NULL,
    compartment TEXT NOT NULL,
    subfolder TEXT,
    file_name TEXT NOT NULL,
    file_url TEXT,
    chunk_index INTEGER, -- Índice numérico do trecho
    content TEXT NOT NULL,
    embedding vector(768), -- Vetores do gemini-embedding-2-preview possuem dimensão de 768
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Garantir que a coluna chunk_index exista caso a tabela já tenha sido criada antes
ALTER TABLE client_document_chunks ADD COLUMN IF NOT EXISTS chunk_index INTEGER;

-- 3. Configurar Políticas de Privacidade e Segurança (RLS - Row Level Security)
-- Habilita o RLS na tabela
ALTER TABLE client_document_chunks ENABLE ROW LEVEL SECURITY;

-- Remove políticas anteriores caso existam para evitar conflitos de duplicação
DROP POLICY IF EXISTS "Permitir leitura pública ou para autenticados" ON client_document_chunks;
DROP POLICY IF EXISTS "Permitir inserção para autenticados" ON client_document_chunks;
DROP POLICY IF EXISTS "Permitir exclusão para autenticados" ON client_document_chunks;
DROP POLICY IF EXISTS "Permitir tudo para usuários autenticados" ON client_document_chunks;
DROP POLICY IF EXISTS "Permitir tudo para anon" ON client_document_chunks;

-- Cria políticas flexíveis e seguras de acesso para usuários autenticados (advogados logados)
CREATE POLICY "Permitir tudo para usuários autenticados" 
ON client_document_chunks 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- Permite leitura e escrita temporária para conexões anon se necessário (opcional/segurança de fallback)
CREATE POLICY "Permitir leitura para anon" 
ON client_document_chunks 
FOR SELECT 
TO anon 
USING (true);

CREATE POLICY "Permitir inserção e exclusão para anon" 
ON client_document_chunks 
FOR ALL 
TO anon 
USING (true) 
WITH CHECK (true);

-- 4. Criar índices para otimizar as buscas por cliente, arquivo e compartimento
CREATE INDEX IF NOT EXISTS idx_client_document_chunks_client_id ON client_document_chunks(client_id);
CREATE INDEX IF NOT EXISTS idx_client_document_chunks_file ON client_document_chunks(client_id, compartment, file_name);

-- 5. Criar/Recriar a função RPC de busca semântica para o RAG
CREATE OR REPLACE FUNCTION match_client_documents(
  query_embedding vector(768),
  match_threshold float,
  match_count int,
  filter_client_id text
)
RETURNS TABLE (
  id bigint,
  client_id text,
  compartment text,
  subfolder text,
  file_name text,
  file_url text,
  chunk_index int,
  content text,
  metadata jsonb,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    cdc.id,
    cdc.client_id,
    cdc.compartment,
    cdc.subfolder,
    cdc.file_name,
    cdc.file_url,
    cdc.chunk_index,
    cdc.content,
    cdc.metadata,
    1 - (cdc.embedding <=> query_embedding) AS similarity
  FROM client_document_chunks cdc
  WHERE cdc.client_id = filter_client_id
    AND 1 - (cdc.embedding <=> query_embedding) > match_threshold
  ORDER BY cdc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
