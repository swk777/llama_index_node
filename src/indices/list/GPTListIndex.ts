import Node from '../../data-struts/Node.js'
import { IndexList } from '../../data-struts/data-structure.js'
import BaseGPTIndex from '../../indices/BaseGPTIndex.js'
import ServiceContext from '../../indices/ServiceContext.js'
import { QueryMode } from '../../indices/query/schema.js'
import { QuestionAnswerPrompt } from '../../prompts/Prompt.js'
import { DEFAULT_TEXT_QA_PROMPT } from '../../prompts/defaultPrompts.js'
import GPTListIndexEmbeddingQuery from './GPTListIndexEmbeddingQuery.js'
import { GPTListIndexQuery } from './query.js'

export default class GPTListIndex extends BaseGPTIndex<IndexList> {
  textQaTemplate: QuestionAnswerPrompt

  constructor({
    nodes = [],
    indexStruct = null,
    serviceContext = null,
    textQaTemplate = null,
    ...restArgs
  }: {
    nodes: Node[]
    indexStruct: IndexList | null
    serviceContext: ServiceContext | null
    textQaTemplate: QuestionAnswerPrompt | null
  }) {
    super({ nodes, indexStruct, serviceContext, ...restArgs })
    this.textQaTemplate = textQaTemplate || DEFAULT_TEXT_QA_PROMPT
  }

  static getQueryMap() {
    return {
      [QueryMode.DEFAULT]: GPTListIndexQuery,
      [QueryMode.EMBEDDING]: GPTListIndexEmbeddingQuery
    }
  }

  _buildIndexFromNodes(nodes: Node[]) {
    const indexStruct = new IndexList()
    for (const n of nodes) {
      indexStruct.addNode(n)
    }
    return indexStruct
  }

  _insert(nodes: Node[]): void {
    for (const n of nodes) {
      console.log('inserting node to index struct: ', n.getDocId())
      this.indexStruct.addNode(n)
    }
  }

  _delete(docId: string): void {
    const curNodeIds = this.indexStruct.nodes
    const curNodes = this._docstore.getNodes(curNodeIds)
    const nodesToKeep = curNodes.filter(n => n.refDocId !== docId)
    this.indexStruct.nodes = nodesToKeep.map(n => n.getDocId())
  }

  _preprocessQuery(mode: QueryMode, queryKwargs: any): void {
    super._preprocessQuery(mode, queryKwargs)
    if (!queryKwargs.hasOwnProperty('textQaTemplate')) {
      queryKwargs.textQaTemplate = this.textQaTemplate
    }
  }
}
