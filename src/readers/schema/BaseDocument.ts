// Base schema for data structures.
import { createHash } from 'crypto'
import { getNewId } from '../../utils.js'
import { ValueError } from '../../error.js'
import DataClassJsonMixin from '../../helpers/DataClassJsonMixin.js'

/*
  Base document.
  Generic abstract interfaces that captures both index structs
  as well as documents.
*/
abstract class BaseDocument extends DataClassJsonMixin {
  // TODO: consolidate fields from Document/IndexStruct into base class
  text?: string
  docId?: string
  embedding?: Array<number>
  docHash?: string

  // extra fields
  extraInfo?: Record<string, any>

  constructor(
    text?: string,
    docId?: string,
    embedding?: Array<number>,
    docHash?: string,
    extraInfo?: Record<string, any>
  ) {
    super()
    this.text = text
    this.docId = docId
    this.embedding = embedding
    this.docHash = docHash
    this.extraInfo = extraInfo

    // Post init
    if (this.docId === undefined || this.docId === null) {
      this.docId = getNewId(new Set())
    }
    if (this.docHash === undefined || this.docHash === null) {
      this.docHash = this.generateDocHash()
    }
  }

  private generateDocHash(): string {
    // Generate a hash to represent the document
    const docIdentity = (this.text || '') + JSON.stringify(this.extraInfo)
    return createHash('sha256').update(docIdentity).digest('hex')
  }

  abstract getType(): string

  getTypes(): Array<string> {
    // Get Document type
    // TODO: remove this method
    // a hack to preserve backwards compatibility for vector indices
    return [this.getType()]
  }

  getText(): string {
    // Get text
    if (this.text === undefined || this.text === null) {
      throw new ValueError('text field not set.')
    }
    return this.text
  }

  getDocId(): string {
    // Get doc_id
    if (this.docId === undefined || this.docId === null) {
      throw new ValueError('doc_id not set.')
    }
    return this.docId
  }

  getDocHash(): string {
    // Get doc_hash
    if (this.docHash === undefined || this.docHash === null) {
      throw new ValueError('doc_hash is not set.')
    }
    return this.docHash
  }

  isDocIdNone(): boolean {
    // Check if doc_id is None
    return this.docId === undefined || this.docId === null
  }

  isTextNone(): boolean {
    // Check if text is None
    return this.text === undefined || this.text === null
  }

  getEmbedding(): Array<number> {
    // Get embedding
    // Errors if embedding is None
    if (this.embedding === undefined || this.embedding === null) {
      throw new ValueError('embedding not set.')
    }
    return this.embedding
  }

  get extraInfoStr(): string | undefined {
    // Extra info string
    if (this.extraInfo === undefined || this.extraInfo === null) {
      return undefined
    }

    return Object.entries(this.extraInfo)
      .map(([key, value]) => `${key}: ${String(value)}`)
      .join('\n')
  }
}

export default BaseDocument
