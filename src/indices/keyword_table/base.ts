import lodash from 'lodash'
import Node from '../../data-struts/Node.js'
import { KeywordTable } from '../../data-struts/data-structure.js'
import BaseGPTIndex from '../../indices/BaseGPTIndex.js'
import ServiceContext from '../../indices/ServiceContext.js'
import { DEFAULT_KEYWORD_EXTRACT_TEMPLATE } from '../../prompts/defaultPrompts.js'
import { KeywordExtractPrompt } from '../../prompts/prompts.js'
import {
  GPTKeywordTableGPTQuery,
  GPTKeywordTableRAKEQuery,
  GPTKeywordTableSimpleQuery
} from './query.js'
import { zip } from '../../utils.js'

export enum QueryMode {
  DEFAULT = 'DEFAULT',
  SIMPLE = 'SIMPLE',
  RAKE = 'RAKE'
}

export type QueryMap = {
  [QueryMode.DEFAULT]: typeof GPTKeywordTableGPTQuery
  [QueryMode.SIMPLE]: typeof GPTKeywordTableSimpleQuery
  [QueryMode.RAKE]: typeof GPTKeywordTableRAKEQuery
}

export class BaseGPTKeywordTableIndex extends BaseGPTIndex<KeywordTable> {
  maxKeywordsPerChunk: number
  keywordExtractTemplate: KeywordExtractPrompt
  _useAsync: boolean

  constructor({
    nodes,
    indexStruct,
    serviceContext,
    keywordExtractTemplate,
    maxKeywordsPerChunk = 10,
    useAsync = false,
    ...kwargs
  }: {
    nodes: Node[] | null
    indexStruct: KeywordTable | null
    serviceContext: ServiceContext | null
    keywordExtractTemplate: KeywordExtractPrompt | null
    maxKeywordsPerChunk: number
    useAsync: boolean
  }) {
    super({ nodes, indexStruct, serviceContext, ...kwargs })
    // need to set parameters before building index in base class.
    this.maxKeywordsPerChunk = maxKeywordsPerChunk
    this.keywordExtractTemplate =
      keywordExtractTemplate || DEFAULT_KEYWORD_EXTRACT_TEMPLATE
    // NOTE: Partially format keyword extract template here.
    this.keywordExtractTemplate.partialFormat({
      maxKeywords: this.maxKeywordsPerChunk
    })
    this._useAsync = useAsync
  }

  static getQueryMap(): QueryMap {
    return {
      [QueryMode.DEFAULT]: GPTKeywordTableGPTQuery,
      [QueryMode.SIMPLE]: GPTKeywordTableSimpleQuery,
      [QueryMode.RAKE]: GPTKeywordTableRAKEQuery
    }
  }

  _extractKeywords(text: string): Set<string> {
    return new Set()
  }

  async _asyncExtractKeywords(text: string): Promise<Set<string>> {
    // by default just call sync version
    return this._extractKeywords(text)
  }

  _addNodesToIndex(indexStruct: KeywordTable, nodes: Node[]): void {
    for (let n of nodes) {
      let keywords = this._extractKeywords(n.getText())
      indexStruct.addNode(Array.from(keywords), n)
    }
  }

  async _asyncAddNodesToIndex(
    indexStruct: KeywordTable,
    nodes: Node[]
  ): Promise<void> {
    for (let n of nodes) {
      let keywords = await this._asyncExtractKeywords(n.getText())
      indexStruct.addNode(Array.from(keywords), n)
    }
  }

  async _buildIndexFromNodes(nodes: Node[]) {
    let indexStruct = new KeywordTable()
    if (this._useAsync) {
      let tasks = [this._asyncAddNodesToIndex(indexStruct, nodes)]
      await Promise.all(tasks)
    } else {
      this._addNodesToIndex(indexStruct, nodes)
    }
    return indexStruct
  }

  _insert(nodes: Node[], ...insertKwargs: any[]): void {
    for (let n of nodes) {
      let keywords = this._extractKeywords(n.getText())
      this.indexStruct.addNode(Array.from(keywords), n)
    }
  }

  _delete(docId: string, ...deleteKwargs: any[]): void {
    let nodeIdxsToDelete = new Set<string>()
    let nodeIdList = Array.from(this.indexStruct.nodeIds)
    let nodes = this._docstore.getNodes(nodeIdList)
    for (let [nodeIdx, node] of zip(nodeIdList, nodes)) {
      if (node.refDocId != docId) {
        continue
      }
      nodeIdxsToDelete.add(nodeIdx)
    }
    for (let nodeIdx of nodeIdxsToDelete) {
      this._docstore.deleteDocument(nodeIdx)
    }

    // delete nodeIdxs from keyword to node idxs mapping
    let keywordsToDelete = new Set()
    for (let [keyword, nodeIdxs] of Object.entries(this.indexStruct.table)) {
      if (lodash.intersection(nodeIdxsToDelete, nodeIdxs)) {
        this.indexStruct.table[keyword] = lodash.difference(
          nodeIdxs,
          nodeIdxsToDelete
        )
        if (this.indexStruct.table[keyword].length == 0) {
          keywordsToDelete.add(keyword)
        }
      }
    }
    for (let keyword of keywordsToDelete) {
      delete this.indexStruct.table[keyword as string]
    }
  }
}
