import Node, { ImageNode, IndexNode } from './data-struts/Node.js'
import DataClassJsonMixin from './helpers/DataClassJsonMixin.js'
import BaseDocument from './readers/schema/BaseDocument.js'
import Document from './readers/schema/Document.js'

interface DocumentStoreProps {
  docs?: { [key: string]: BaseDocument }
  refDocInfo?: { [key: string]: { [key: string]: any } }
}

export class DocumentStore extends DataClassJsonMixin {
  private docs: { [key: string]: BaseDocument }
  private refDocInfo: { [key: string]: { [key: string]: any } }

  constructor({ docs = {}, refDocInfo = {} }: DocumentStoreProps = {}) {
    super()
    this.docs = docs
    this.refDocInfo = refDocInfo
  }

  serializeToDict(): { [key: string]: any } {
    const docsDict: { [key: string]: any } = {}
    for (const docId in this.docs) {
      const doc = this.docs[docId]
      const docDict = doc.toDict()
      docDict['TYPE_KEY'] = doc.getType()
      docsDict[docId] = docDict
    }
    return { docs: docsDict, refDocInfo: this.refDocInfo }
  }

  static loadFromDict(docsDict: { [key: string]: any }): DocumentStore {
    const docsObjDict: { [key: string]: BaseDocument } = {}
    for (const docId in docsDict['docs']) {
      const docDict = docsDict['docs'][docId]
      const docType = docDict['TYPE_KEY']
      delete docDict['TYPE_KEY']
      let doc: BaseDocument
      if (docType === 'Document' || docType === null) {
        // @ts-ignore
        doc = Document.fromDict(docDict)
      } else if (docType === Node.getNodeType()) {
        // @ts-ignore
        doc = Node.fromDict(docDict)
      } else if (docType === ImageNode.getType()) {
        // @ts-ignore
        doc = ImageNode.fromDict(docDict)
      } else if (docType === IndexNode.getType()) {
        // @ts-ignore
        doc = IndexNode.fromDict(docDict)
      } else {
        throw new Error(`Unknown doc type: ${docType}`)
      }
      docsObjDict[docId] = doc
    }
    return new DocumentStore({
      docs: docsObjDict,
      refDocInfo: docsDict['refDocInfo'] || {}
    })
  }

  static fromDocuments(
    docs: BaseDocument[],
    allowUpdate: boolean = true
  ): DocumentStore {
    const obj = new DocumentStore()
    obj.addDocuments(docs, allowUpdate)
    return obj
  }

  static merge(docstores: DocumentStore[]): DocumentStore {
    const mergedDocstore = new DocumentStore()
    for (const docstore of docstores) {
      mergedDocstore.updateDocstore(docstore)
    }
    return mergedDocstore
  }

  updateDocstore(other: DocumentStore): void {
    Object.assign(this.docs, other.docs)
  }

  addDocuments(docs: BaseDocument[], allowUpdate: boolean = true): void {
    for (const doc of docs) {
      if (doc.isDocIdNone()) {
        throw new Error('docId not set')
      }

      if (!allowUpdate && this.documentExists(doc.getDocId())) {
        throw new Error(
          `docId ${doc.getDocId()} already exists. Set allowUpdate to true to overwrite.`
        )
      }
      this.docs[doc.getDocId()] = doc
      if (!this.refDocInfo[doc.getDocId()]) {
        this.refDocInfo[doc.getDocId()] = {}
      }
      this.refDocInfo[doc.getDocId()]['docHash'] = doc.getDocHash()
    }
  }

  getDocument(docId: string, raiseError: boolean = true): BaseDocument | null {
    const doc = this.docs[docId] || null
    if (!doc && raiseError) {
      throw new Error(`docId ${docId} not found.`)
    }
    return doc
  }

  setDocumentHash(docId: string, docHash: string): void {
    if (!this.refDocInfo[docId]) {
      this.refDocInfo[docId] = {}
    }
    this.refDocInfo[docId]['docHash'] = docHash
  }

  getDocumentHash(docId: string): string | null {
    return this.refDocInfo[docId]?.['docHash'] || null
  }

  documentExists(docId: string): boolean {
    return !!this.docs[docId]
  }

  deleteDocument(
    docId: string,
    raiseError: boolean = true
  ): BaseDocument | null {
    const doc = this.docs[docId] || null
    if (doc === null && raiseError) {
      throw new Error(`docId ${docId} not found.`)
    }
    delete this.docs[docId]
    delete this.refDocInfo[docId]
    return doc
  }

  getNodes(nodeIds: string[], raiseError: boolean = true): Node[] {
    return nodeIds.map(nodeId => this.getNode(nodeId, raiseError))
  }

  getNode(nodeId: string, raiseError: boolean = true): Node {
    const doc = this.getDocument(nodeId, raiseError)
    if (!(doc instanceof Node)) {
      throw new Error(`Document ${nodeId} is not a Node.`)
    }
    return doc as Node
  }

  getNodeDict(nodeIdDict: { [key: number]: string }): {
    [key: number]: Node
  } {
    const result: { [key: number]: Node } = {}
    for (const index in nodeIdDict) {
      const nodeId = nodeIdDict[index]
      result[parseInt(index)] = this.getNode(nodeId)
    }
    return result
  }
}
