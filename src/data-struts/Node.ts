import BaseDocument from '../readers/schema/BaseDocument.js'

interface Dict<T> {
  [key: string]: T
}

export enum DocumentRelationship {
  SOURCE = 'source',
  PREVIOUS = 'previous',
  NEXT = 'next'
}

export enum NodeType {
  TEXT = 'text',
  IMAGE = 'image',
  INDEX = 'index'
}

export default class Node extends BaseDocument {
  nodeInfo?: Dict<any>
  relationships: Dict<string>

  constructor(
    text: string,
    docId?: string,
    embeddings?: Array<number>,
    docHash?: string,
    extraInfo?: Record<string, any>,
    nodeInfo?: Dict<any>,
    relationships: Dict<string> = {}
  ) {
    super(text, docId, embeddings, docHash, extraInfo)
    if (text === null) {
      throw new Error('text field not set.')
    }
    this.nodeInfo = nodeInfo
    this.relationships = relationships
  }

  get refDocId(): string | null {
    return this.relationships[DocumentRelationship.SOURCE] || null
  }

  get prevNodeId(): string {
    if (!this.relationships.hasOwnProperty(DocumentRelationship.PREVIOUS)) {
      throw new Error('Node does not have previous node')
    }
    return this.relationships[DocumentRelationship.PREVIOUS]
  }

  get nextNodeId(): string {
    if (!this.relationships.hasOwnProperty(DocumentRelationship.NEXT)) {
      throw new Error('Node does not have next node')
    }
    return this.relationships[DocumentRelationship.NEXT]
  }

  getText(): string {
    const text = super.getText()
    const resultText =
      this.extraInfoStr === null || this.extraInfoStr === undefined
        ? text
        : `${this.extraInfoStr}\n\n${text}`
    return resultText
  }

  static getNodeType(): string {
    return NodeType.TEXT
  }

  getType(): string {
    return NodeType.TEXT
  }
}

export class ImageNode extends Node {
  image?: string

  static getType(): string {
    return NodeType.IMAGE
  }
}

export class IndexNode extends Node {
  indexId?: string

  static getType(): string {
    return NodeType.INDEX
  }
}

export class NodeWithScore {
  node: Node
  score?: number

  constructor(node: Node, score?: number) {
    this.node = node
    this.score = score
  }

  get docId(): string | undefined {
    console.warn('.doc_id is deprecated, use .node.ref_doc_id instead')
    return this.node.refDocId
  }

  get sourceText(): string {
    console.warn('.source_text is deprecated, use .node.get_text() instead')
    return this.node.getText()
  }

  get extraInfo(): Dict<any> | undefined {
    console.warn('.extraInfo is deprecated, use .node.extraInfo instead')
    return this.node.extraInfo
  }

  get nodeInfo(): Dict<any> | undefined {
    console.warn('.node_info is deprecated, use .node.node_info instead')
    return this.node.nodeInfo
  }

  get similarity(): number | undefined {
    console.warn('.similarity is deprecated, use .score instead')
    return this.score
  }

  get image(): string | undefined {
    console.warn(
      '.image is deprecated, check if Node is an ImageNode and use .node.image instead'
    )
    if (this.node instanceof ImageNode) {
      return this.node.image
    } else {
      return null
    }
  }
}
