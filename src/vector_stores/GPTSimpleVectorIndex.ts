import { QueryMode } from '../indices/query/schema.js'
import Node from '../data-struts/Node.js'
import { IndexDict, SimpleIndexDict } from '../data-struts/data-structure.js'
import { GPTVectorStoreIndex } from '../indices/GPTVectorStoreIndex.js'
import ServiceContext from '../indices/ServiceContext.js'
import { QuestionAnswerPrompt } from '../prompts/Prompt.js'
import { SimpleVectorStore } from './SimpleVectorStore.js'
import { GPTSimpleVectorIndexQuery } from '../indices/vector-store/queries.js'

export class GPTSimpleVectorIndex extends GPTVectorStoreIndex {
  static indexStructCls = SimpleIndexDict

  constructor({
    nodes,
    indexStruct,
    serviceContext,
    textQaTemplate,
    simpleVectorStoreDataDict,
    ...restArgs
  }: {
    nodes?: Node[] | null
    indexStruct?: IndexDict | null
    serviceContext?: ServiceContext | null
    textQaTemplate?: QuestionAnswerPrompt | null
    simpleVectorStoreDataDict?: { [key: string]: any } | null
  }) {
    if (indexStruct && Object.keys(indexStruct.embeddingsDict).length > 0) {
      simpleVectorStoreDataDict = {
        embeddingDict: indexStruct.embeddingsDict
      }
    }

    const vectorStore = new SimpleVectorStore(simpleVectorStoreDataDict)
    super({
      nodes,
      indexStruct,
      serviceContext,
      textQaTemplate,
      vectorStore: vectorStore,
      ...restArgs
    })

    if (!this.indexStruct) {
      this.indexStruct = new IndexDict()
    }
    this.indexStruct.embeddingsDict = vectorStore.data.embeddingDict
  }

  static getQueryMap() {
    return {
      [QueryMode.DEFAULT]: GPTSimpleVectorIndexQuery,
      [QueryMode.EMBEDDING]: GPTSimpleVectorIndexQuery
    }
  }

  _preprocessQuery(mode: QueryMode, queryKwargs: any) {
    super._preprocessQuery(mode, queryKwargs)
    delete queryKwargs['vectorStore']
    const vectorStore = this._vectorStore as SimpleVectorStore
    queryKwargs['simpleVectorStoreDataDict'] = vectorStore.data
    // HACKING POINT
    queryKwargs['vectorStore'] = vectorStore
  }
}
