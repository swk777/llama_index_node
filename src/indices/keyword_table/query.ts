import { KeywordTable } from '../../data-struts/data-structure.js'
import { BaseGPTIndexQuery } from '../../indices/query/BaseGPTIndexQuery.js'
import { SimilarityTracker } from '../../indices/query/embeddingUtils.js'
import { QueryBundle } from '../../indices/query/schema.js'
import {
  DEFAULT_KEYWORD_EXTRACT_TEMPLATE,
  DEFAULT_QUERY_KEYWORD_EXTRACT_TEMPLATE
} from '../../prompts/defaultPrompts.js'
import {
  KeywordExtractPrompt,
  QueryKeywordExtractPrompt
} from '../../prompts/prompts.js'
import {
  extractKeywordsGivenResponse,
  rakeExtractKeywords,
  simpleExtractKeywords
} from './utils.js'

export abstract class BaseGPTKeywordTableQuery extends BaseGPTIndexQuery<KeywordTable> {
  maxKeywordsPerQuery: number
  numChunksPerQuery: number
  keywordExtractTemplate: KeywordExtractPrompt
  queryKeywordExtractTemplate: QueryKeywordExtractPrompt

  constructor({
    indexStruct,
    keywordExtractTemplate = null,
    queryKeywordExtractTemplate = null,
    maxKeywordsPerQuery = 10,
    numChunksPerQuery = 10,
    ...kwargs
  }: {
    indexStruct: KeywordTable
    keywordExtractTemplate: KeywordExtractPrompt | null
    queryKeywordExtractTemplate: QueryKeywordExtractPrompt | null
    maxKeywordsPerQuery: number
    numChunksPerQuery: number
  }) {
    // @ts-ignore
    super({ indexStruct, ...kwargs })
    this.maxKeywordsPerQuery = maxKeywordsPerQuery
    this.numChunksPerQuery = numChunksPerQuery
    this.keywordExtractTemplate =
      keywordExtractTemplate || DEFAULT_KEYWORD_EXTRACT_TEMPLATE
    this.queryKeywordExtractTemplate =
      queryKeywordExtractTemplate || DEFAULT_QUERY_KEYWORD_EXTRACT_TEMPLATE
  }

  abstract _getKeywords(queryStr: string)

  async _retrieve(
    queryBundle: QueryBundle,
    similarityTracker: SimilarityTracker | null = null
  ) {
    const logger = console
    logger.info(`> Starting query: ${queryBundle.queryStr}`)
    const keywords = await this._getKeywords(queryBundle.queryStr)
    logger.info(`query keywords: ${keywords}`)

    // go through text chunks in order of most matching keywords
    const chunkIndicesCount: Record<string, number> = {}
    const filteredKeywords = keywords.filter(k =>
      this.indexStruct.keywords.has(k)
    )
    logger.info(`> Extracted keywords: ${filteredKeywords}`)
    for (let k of filteredKeywords) {
      for (let nodeId of this.indexStruct.table.get(k)!) {
        if (!chunkIndicesCount[nodeId]) {
          chunkIndicesCount[nodeId] = 0
        }
        chunkIndicesCount[nodeId]++
      }
    }
    const sortedChunkIndices = Object.keys(chunkIndicesCount)
      .sort((a, b) => chunkIndicesCount[b] - chunkIndicesCount[a])
      .slice(0, this.numChunksPerQuery)
    let sortedNodes = this._docstore.getNodes(sortedChunkIndices)
    // filter sorted nodes
    for (let nodeProcessor of this.nodePreprocessors) {
      sortedNodes = nodeProcessor.postprocessNodes(sortedNodes)
    }

    // if (logger.getEffectiveLevel() == logging.DEBUG) {
    //   for (let [chunkIdx, node] of sortedNodes.entries()) {
    //     logger.debug(
    //       `> Querying with idx: ${chunkIdx}: ${truncateText(
    //         node.getText(),
    //         50
    //       )}`
    //     )
    //   }
    // }

    return sortedNodes
  }
}

export class GPTKeywordTableGPTQuery extends BaseGPTKeywordTableQuery {
  async _getKeywords(queryStr: string) {
    const [response, _] = await this._serviceContext.llmPredictor.predict(
      this.queryKeywordExtractTemplate,
      { max_keywords: this.maxKeywordsPerQuery, question: queryStr }
    )
    const keywords = extractKeywordsGivenResponse(
      response,
      undefined,
      'KEYWORDS:'
    )
    return Array.from(keywords)
  }
}

export class GPTKeywordTableSimpleQuery extends BaseGPTKeywordTableQuery {
  _getKeywords(queryStr: string): string[] {
    return Array.from(simpleExtractKeywords(queryStr, this.maxKeywordsPerQuery))
  }
}

export class GPTKeywordTableRAKEQuery extends BaseGPTKeywordTableQuery {
  _getKeywords(queryStr: string): string[] {
    return Array.from(rakeExtractKeywords(queryStr, this.maxKeywordsPerQuery))
  }
}
