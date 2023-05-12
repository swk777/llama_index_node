import { Document as LCDocument } from 'langchain/document'
import Document from './schema/Document.js'

// Utilities for loading data from a directory.
abstract class BaseReader {
  // Load data from the input directory.
  abstract loadData(...args): Promise<Document[]>

  // Load data in LangChain document format.
  async loadLangchainDocuments(...args): Promise<LCDocument[]> {
    const docs: Document[] = await this.loadData(...args)
    return docs.map(d => d.toLangChainFormat())
  }
}

export default BaseReader
