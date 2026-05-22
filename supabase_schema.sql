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

-- 3. Criar índices para otimizar as buscas por cliente, arquivo e compartimento
CREATE INDEX IF NOT EXISTS idx_client_document_chunks_client_id ON client_document_chunks(client_id);
CREATE INDEX IF NOT EXISTS idx_client_document_chunks_file ON client_document_chunks(client_id, compartment, file_name);

-- 4. Criar/Recriar a função RPC de busca semântica para o RAG
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
