import { IndexDict } from '../../data-struts/data-structure.js'
import { SimpleVectorStore } from '../../vector_stores/SimpleVectorStore.js'
import GPTVectorStoreIndexQuery from './GPTVectorStoreIndexQuery.js'

export class GPTSimpleVectorIndexQuery extends GPTVectorStoreIndexQuery {
  constructor({
    indexStruct,
    simpleVectorStoreDataDict,
    restArgs
  }: {
    indexStruct: IndexDict
    simpleVectorStoreDataDict?: { [key: string]: any } | null
    restArgs: any
  }) {
    let vectorStore
    if (
      simpleVectorStoreDataDict === null ||
      simpleVectorStoreDataDict === undefined
    ) {
      if (Object.keys(indexStruct.embeddingsDict).length > 0) {
        simpleVectorStoreDataDict = {
          embeddingDict: indexStruct.embeddingsDict
        }
        vectorStore = new SimpleVectorStore({
          simpleVectorStoreDataDict: simpleVectorStoreDataDict
        })
      } else {
        throw new Error('Vector store is required for vector store query.')
      }
    } else {
      vectorStore = new SimpleVectorStore({
        simpleVectorStoreDataDict: simpleVectorStoreDataDict
      })
    }
    super({ indexStruct: indexStruct, vectorStore: vectorStore, ...restArgs })
  }
}
