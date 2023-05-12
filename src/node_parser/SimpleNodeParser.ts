// import { TextSplitter } from 'langchain/text_splitter'
import Node from '../data-struts/Node.js'
import Document from '../readers/schema/Document.js'
import { getNodesFromDocument } from './nodeUtils.js'
import TokenTextSplitter, {
  TextSplitter
} from '../langchain_helpers/TextSplitter.js'

export default class SimpleNodeParser {
  private _textSplitter: TextSplitter
  // private _includeExtraInfo: boolean

  constructor(
    textSplitter: TextSplitter | null = null,
    includeExtraInfo: boolean = true
  ) {
    this._textSplitter = textSplitter || new TokenTextSplitter()
    // this._includeExtraInfo = includeExtraInfo
  }

  async getNodesFromDocuments(
    documents: Document[],
    includeExtraInfo: boolean = true
  ) {
    const allNodes: Node[] = []
    for (const document of documents) {
      const nodes = await getNodesFromDocument(
        document,
        this._textSplitter,
        includeExtraInfo
      )
      allNodes.push(...nodes)
    }
    return allNodes
  }
}
