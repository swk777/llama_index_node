import { v4 as uuidv4 } from 'uuid'
import DataClassJsonMixin from '../helpers/DataClassJsonMixin.js'
import Node from './Node.js'
import { IndexStructType } from './IndexStructType.js'
import { DATA_KEY, TYPE_KEY } from '../constants.js'

export abstract class V2IndexStruct extends DataClassJsonMixin {
  indexId: string
  summary: string | null

  constructor() {
    super()
    this.indexId = uuidv4()
    this.summary = null
  }

  getSummary(): string {
    if (this.summary === null) {
      throw new Error('summary field of the indexStruct not set.')
    }
    return this.summary
  }

  abstract getType(): IndexStructType

  toDict(encodeJson: boolean = false): { [key: string]: any } {
    const outDict = {
      [TYPE_KEY]: this.getType(),
      [DATA_KEY]: super.toDict()
    }
    return outDict
  }
}

export class IndexDict extends V2IndexStruct {
  nodesDict: Record<string, string>
  docIdDict: Record<string, string[]>
  embeddingsDict: Record<string, number[]>

  constructor() {
    super()
    this.nodesDict = {}
    this.docIdDict = {}
    this.embeddingsDict = {}
  }

  addNode(node: Node, text_id?: string): string {
    const vectorId = text_id ?? node.getDocId()
    this.nodesDict[vectorId] = node.getDocId()
    if (node.refDocId) {
      if (!this.docIdDict[node.refDocId]) {
        this.docIdDict[node.refDocId] = []
      }
      this.docIdDict[node.refDocId].push(vectorId)
    }
    return vectorId
  }

  delete(docId: string): void {
    if (!this.docIdDict[docId]) {
      throw new Error('docId not found in docIdDict')
    }
    for (const vectorId of this.docIdDict[docId]) {
      delete this.nodesDict[vectorId]
    }
  }

  getType(): IndexStructType {
    return IndexStructType.VECTOR_STORE
  }
  static getType(): IndexStructType {
    return IndexStructType.VECTOR_STORE
  }
}
export class SimpleIndexDict extends IndexDict {
  // Index dict for simple vector index

  static getType(): IndexStructType {
    // Get type
    return IndexStructType.SIMPLE_DICT
  }
}
type Dict<T> = { [key: number]: T }
export class IndexGraph extends V2IndexStruct {
  allNodes: Dict<string> = {}
  rootNodes: Dict<string> = {}
  nodeIdToChildrenIds: { [key: string]: string[] } = {}

  get nodeIdToIndex(): { [key: string]: number } {
    return Object.fromEntries(
      Object.entries(this.allNodes).map(([index, nodeId]) => [
        nodeId,
        Number(index)
      ])
    )
  }

  get size(): number {
    return Object.keys(this.allNodes).length
  }

  getIndex(node: Node): number {
    return this.nodeIdToIndex[node.getDocId()]
  }

  insert(node: Node, index?: number, childrenNodes?: Node[]): void {
    index = index || this.size
    const nodeId = node.getDocId()

    this.allNodes[index] = nodeId

    if (!childrenNodes) {
      childrenNodes = []
    }
    const childrenIds = childrenNodes.map(n => n.getDocId())
    this.nodeIdToChildrenIds[nodeId] = childrenIds
  }

  getChildren(parentNode: Node | null): Dict<string> {
    if (parentNode === null) {
      return this.rootNodes
    } else {
      const parentId = parentNode.getDocId()
      const childrenIds = this.nodeIdToChildrenIds[parentId]
      return Object.fromEntries(
        childrenIds.map(child_id => [this.nodeIdToIndex[child_id], child_id])
      )
    }
  }

  insertUnderParent(
    node: Node,
    parentNode: Node | null,
    newIndex?: number
  ): void {
    newIndex = newIndex || this.size
    if (parentNode === null) {
      this.rootNodes[newIndex] = node.getDocId()
    } else {
      const parentId = parentNode.getDocId()
      if (!(parentId in this.nodeIdToChildrenIds)) {
        this.nodeIdToChildrenIds[parentId] = []
      }
      this.nodeIdToChildrenIds[parentId].push(node.getDocId())
    }

    this.allNodes[newIndex] = node.getDocId()
  }

  getType(): IndexStructType {
    return IndexStructType.TREE
  }
}

export class CompositeIndex extends V2IndexStruct {
  allIndexStructs: { [key: string]: V2IndexStruct }
  rootId: string | null

  constructor(allIndexStructs, rootId) {
    super()
    this.allIndexStructs = allIndexStructs || {}
    this.rootId = rootId || null
  }

  getType(): IndexStructType {
    return IndexStructType.COMPOSITE
  }
  static getType(): IndexStructType {
    return IndexStructType.COMPOSITE
  }

  toDict(encodeJson: boolean = false): { [key: string]: any } {
    const dataDict = {
      allIndexStructs: Object.entries(this.allIndexStructs).reduce(
        (acc, [id, struct]) => {
          acc[id] = struct.toDict(encodeJson)
          return acc
        },
        {} as { [key: string]: any }
      ),
      rootId: this.rootId
    }

    const outDict = {
      typeKey: CompositeIndex.getType(),
      dataKey: dataDict
    }
    return outDict
  }
}

export class IndexList extends V2IndexStruct {
  nodes: string[] = []

  addNode(node: Node): void {
    this.nodes.push(node.getDocId())
  }

  static getType(): IndexStructType {
    return IndexStructType.LIST
  }
  getType(): IndexStructType {
    return IndexStructType.LIST
  }
}

export class KeywordTable extends V2IndexStruct {
  table: Map<string, Set<string>>

  constructor() {
    super()
    this.table = new Map()
  }

  addNode(keywords: string[], node: Node): void {
    for (let keyword of keywords) {
      if (!this.table.has(keyword)) {
        this.table.set(keyword, new Set())
      }
      this.table.get(keyword)!.add(node.getDocId())
    }
  }

  get nodeIds(): Set<string> {
    let nodeIds = new Set<string>()
    for (let idSet of this.table.values()) {
      for (let id of idSet) {
        nodeIds.add(id)
      }
    }
    return nodeIds
  }

  get keywords(): Set<string> {
    return new Set(this.table.keys())
  }

  get size(): number {
    return this.table.size
  }

  static getType(): IndexStructType {
    return IndexStructType.KEYWORD_TABLE
  }
  getType(): IndexStructType {
    return IndexStructType.KEYWORD_TABLE
  }
}
