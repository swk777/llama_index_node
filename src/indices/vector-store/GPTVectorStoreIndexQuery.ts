import { IndexDict } from '../../data-struts/data-structure.js'
import ServiceContext from '../ServiceContext.js'
import { BaseGPTIndexQuery } from '../query/BaseGPTIndexQuery.js'
import { SimilarityTracker } from '../query/embeddingUtils.js'
import { QueryBundle } from '../query/schema.js'
import { VectorStore } from '../../vector_stores/types.js'

export default class GPTVectorStoreIndexQuery extends BaseGPTIndexQuery<IndexDict> {
  private _similarityTopK: number
  private _vectorStore: VectorStore

  constructor({
    indexStruct,
    serviceContext,
    vectorStore = null,
    similarityTopK = 1,
    ...restArgs
  }: {
    indexStruct: IndexDict
    serviceContext: ServiceContext
    vectorStore: VectorStore | null
    similarityTopK: number
  }) {
    // @ts-ignore
    super({ indexStruct, serviceContext, ...restArgs })
    this._similarityTopK = similarityTopK
    if (vectorStore === null) {
      throw new Error('Vector store is required for vector store query.')
    }
    this._vectorStore = vectorStore
  }

  async _retrieve(
    queryBundle: QueryBundle,
    similarityTracker: SimilarityTracker | null = null
  ) {
    let queryResult
    if (this._vectorStore.isEmbeddingQuery) {
      if (queryBundle.embedding === null) {
        queryBundle.embedding =
          await this._serviceContext.embedModel.getAggEmbeddingFromQueries(
            queryBundle.embeddingStrs
          )
      }
      queryResult = this._vectorStore.query(
        queryBundle.embedding,
        this._similarityTopK,
        this._docIds
      )
    } else {
      queryResult = this._vectorStore.query(
        [],
        this._similarityTopK,
        this._docIds,
        queryBundle.queryStr
      )
    }
    if (!queryResult.nodes) {
      if (queryResult.ids === null) {
        throw new Error(
          'Vector store query result should return at least one of nodes or ids.'
        )
      }
      const nodeIds = queryResult.ids
        .map((idx: number) => this._indexStruct.nodesDict[idx])
        .filter(Boolean)
      const nodes = this._docstore.getNodes(nodeIds)
      queryResult.nodes = nodes
    }

    // logVectorStoreQueryResult(queryResult)

    if (similarityTracker !== null && queryResult.similarities !== null) {
      for (let i = 0; i < queryResult.nodes.length; i++) {
        const node = queryResult.nodes[i]
        const similarity = queryResult.similarities[i]
        similarityTracker.add(node, similarity)
      }
    }

    return queryResult.nodes
  }
}
