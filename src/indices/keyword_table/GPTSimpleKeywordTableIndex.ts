import { BaseGPTKeywordTableIndex } from './base.js'
import { simpleExtractKeywords } from './utils.js'

export default class GPTSimpleKeywordTableIndex extends BaseGPTKeywordTableIndex {
  _extractKeywords(text: string): Set<string> {
    return simpleExtractKeywords(text, this.maxKeywordsPerChunk ?? 10)
  }
}
