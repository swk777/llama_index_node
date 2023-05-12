// simple-vector-store-index.ts

import DataClassJsonMixin from '../helpers/DataClassJsonMixin.js'
import { getTopKEmbeddings } from '../indices/query/embeddingUtils.js'
import {
  NodeEmbeddingResult,
  VectorStore,
  VectorStoreQueryResult
} from './types.js'

export class SimpleVectorStoreData extends DataClassJsonMixin {
  embeddingDict: Record<string, number[]>
  textIdToDocId: Record<string, string>

  constructor(
    embeddingDict: Record<string, number[]> = {},
    textIdToDocId: Record<string, string> = {}
  ) {
    super()
    this.embeddingDict = embeddingDict
    this.textIdToDocId = textIdToDocId
  }
}

export class SimpleVectorStore extends VectorStore {
  stores_text = false
  public data: SimpleVectorStoreData

  constructor(simpleVectorStoreDataDict?: Record<string, any>) {
    super()

    if (simpleVectorStoreDataDict) {
      // @ts-ignore
      this.data = SimpleVectorStoreData.fromDict(
        simpleVectorStoreDataDict
      ) as SimpleVectorStoreData
    } else {
      this.data = new SimpleVectorStoreData()
    }
  }

  get client(): null {
    return null
  }

  get configDict(): Record<string, any> {
    return {
      simpleVectorStoreDataDict: this.data.toDict()
    }
  }

  get(textId: string): number[] {
    return this.data.embeddingDict[textId]
  }

  add(embedding_results: NodeEmbeddingResult[]): string[] {
    const ids: string[] = []

    for (const result of embedding_results) {
      const textId = result.id
      this.data.embeddingDict[textId] = result.embedding
      this.data.textIdToDocId[textId] = result.doc_id
      ids.push(result.id)
    }

    return ids
  }

  delete(doc_id: string): void {
    const textIdsToDelete: Set<string> = new Set()

    for (const [textId, docId] of Object.entries(this.data.textIdToDocId)) {
      if (doc_id === docId) {
        textIdsToDelete.add(textId)
      }
    }

    for (const textId of textIdsToDelete) {
      delete this.data.embeddingDict[textId]
      delete this.data.textIdToDocId[textId]
    }
  }

  query(
    queryEmbedding: number[],
    similarityTopK: number
    // docIds?: string[],
    // queryStr?: string
  ): VectorStoreQueryResult {
    // TODO: consolidate with get_query_text_embedding_similarities
    const items = Object.entries(this.data.embeddingDict)
    const node_ids = items.map(item => item[0])
    const embeddings = items.map(item => item[1])
    const [top_similarities, top_ids] = getTopKEmbeddings({
      queryEmbedding,
      embeddings,
      similarityTopK,
      // @ts-ignore
      embeddingIds: node_ids
    })
    return {
      similarities: top_similarities,
      // @ts-ignore
      ids: top_ids
    }
  }
}

// Make sure to import and implement the "getTopKEmbeddings" function from "gpt_index.indices.query.embedding_utils".
