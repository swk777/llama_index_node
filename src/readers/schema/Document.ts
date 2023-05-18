import { Document as LCDocument } from 'langchain/document'
import BaseDocument from './BaseDocument.js'

export default class Document extends BaseDocument {
  constructor({
    text,
    docId,
    embedding,
    docHash,
    extraInfo,
    image
  }: {
    text?: string
    docId?: string
    embedding?: number[]
    docHash?: string
    extraInfo?: Record<string, unknown>
    image?: string
  }) {
    super(text, docId, embedding, docHash, extraInfo)
    if (this.text === undefined) {
      throw new Error('text field not set.')
    }
  }

  getType(): string {
    return 'Document'
  }

  toLangChainFormat(): LCDocument {
    const metadata = this.extraInfo || {}
    return new LCDocument({ pageContent: this.text, metadata })
  }

  static fromLangChainFormat(doc: LCDocument): Document {
    return new Document({ text: doc.pageContent, extraInfo: doc.metadata })
  }
}

export class ImageDocument extends Document {
  image?: string

  constructor({
    text,
    docId,
    embedding,
    docHash,
    extraInfo,
    image
  }: {
    text?: string
    docId?: string
    embedding?: number[]
    docHash?: string
    extraInfo?: Record<string, unknown>
    image?: string
  }) {
    super({ text, docId, embedding, docHash, extraInfo })
    this.image = image
  }
}
