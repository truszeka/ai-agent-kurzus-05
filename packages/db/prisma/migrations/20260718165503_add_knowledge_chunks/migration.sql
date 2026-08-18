-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateTable
CREATE TABLE "knowledge_chunks" (
    "id" SERIAL NOT NULL,
    "doc_path" TEXT NOT NULL,
    "doc_title" TEXT NOT NULL,
    "doc_source" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "chunk_index" INTEGER NOT NULL,
    "heading" TEXT,
    "content" TEXT NOT NULL,
    "embedding" vector(1536),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "knowledge_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "knowledge_chunks_doc_path_chunk_index_key" ON "knowledge_chunks"("doc_path", "chunk_index");
