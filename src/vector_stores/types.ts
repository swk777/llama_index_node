// vector-store-index.ts

import Node from '../data-struts/Node.js'

// export interface NodeEmbeddingResult {
//   id: string
//   node: Node
//   embedding: number[]
//   doc_id: string
// }

export class NodeEmbeddingResult {
  id: string
  node: Node
  embedding: number[]
  doc_id: string

  constructor(id, node, embedding, docId) {
    this.id = id
    this.node = node
    this.embedding = embedding
    this.doc_id = docId
  }
}

export interface VectorStoreQueryResult {
  nodes?: Node[]
  similarities?: number[]
  ids?: string[]
}

export abstract class VectorStore {
  stores_text: boolean
  isEmbeddingQuery: boolean = true

  abstract get client(): any

  abstract get configDict(): Record<string, any>

  abstract add(embedding_results: NodeEmbeddingResult[]): string[]

  abstract delete(doc_id: string, delete_kwargs?: Record<string, any>): void

  abstract query(
    queryEmbedding: number[],
    similarityTopK: number,
    docIds?: string[],
    queryStr?: string
  ): VectorStoreQueryResult
}
