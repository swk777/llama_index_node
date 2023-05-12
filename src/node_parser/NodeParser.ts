import Node from '../data-struts/Node.js'
import Document from '../readers/schema/Document.js'

export interface NodeParser {
  getNodesFromDocuments(documents: Document[]): Node[]
}
