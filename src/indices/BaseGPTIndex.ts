import fs from 'fs'
import { serialize } from 'class-transformer'
import { INDEX_STRUCT_KEY, DOCSTORE_KEY } from '../constants.js'
import { DocumentStore } from '../DocumentStore.js'
import Node from '../data-struts/Node.js'
import { V2IndexStruct } from '../data-struts/data-structure.js'
import Document from '../readers/schema/Document.js'
import { llmTokenCounter } from '../token_counter/LLMTokenCounter.js'
import ServiceContext from './ServiceContext.js'
import { QueryBundle, QueryConfig, QueryMode } from './query/schema.js'
import { BaseQueryTransform } from './query/query-transform/BaseQueryTransform.js'
import QueryRunner from './query/QueryRunner.js'
import { loadIndexStructFromDict } from './registry.js'

export default abstract class BaseGPTIndex<IS extends V2IndexStruct> {
  protected _serviceContext: ServiceContext
  protected _docstore: DocumentStore
  protected indexStruct: IS

  constructor({
    nodes,
    indexStruct,
    docstore,
    serviceContext
  }: {
    nodes?: Node[] | null
    indexStruct?: IS | null
    docstore?: DocumentStore | null
    serviceContext?: ServiceContext | null
  }) {
    if (indexStruct === null && nodes === null) {
      throw new Error('One of documents or indexStruct must be provided.')
    }
    if (indexStruct !== null && indexStruct !== undefined && nodes) {
      throw new Error('Only one of documents or indexStruct can be provided.')
    }
    this._serviceContext = serviceContext || ServiceContext.fromDefaults()
    this._docstore = docstore || new DocumentStore()
    const init = (async () => {
      if (!indexStruct) {
        this.indexStruct = await this.buildIndexFromNodes(nodes as Node[])
      } else {
        this.indexStruct = indexStruct
      }
      // @ts-ignore
      delete this.then
      return this
    })()
    // @ts-ignore
    this.then = init.then.bind(init)
  }

  static async fromDocuments({
    documents,
    docstore,
    serviceContext,
    ...restArgs
  }: {
    documents: Document[]
    docstore?: DocumentStore | null
    serviceContext?: ServiceContext | null
  }) {
    serviceContext = serviceContext || ServiceContext.fromDefaults()
    docstore = docstore || new DocumentStore()
    for (const doc of documents) {
      docstore.setDocumentHash(doc.getDocId(), doc.getDocHash())
    }

    const nodes = await serviceContext.nodeParser.getNodesFromDocuments(
      documents
    )
    // @ts-ignore
    const gptIndex = await new this({
      nodes,
      serviceContext,
      docstore,
      ...restArgs
    })
    return gptIndex
  }

  get docstore(): DocumentStore {
    return this._docstore
  }

  get serviceContext(): ServiceContext {
    return this._serviceContext
  }

  abstract _buildIndexFromNodes(nodes: Node[])

  @llmTokenCounter('buildIndexFromNodes')
  async buildIndexFromNodes(nodes: Node[]) {
    this._docstore.addDocuments(nodes, true)
    return await this._buildIndexFromNodes(nodes)
  }

  abstract _insert(nodes: Node[], ...insertArgs: any[]): void

  @llmTokenCounter('insert')
  insert_nodes(nodes: Node[], ...insertArgs: any[]): void {
    this.docstore.addDocuments(nodes, true)
    this._insert(nodes, ...insertArgs)
  }

  async insert(document: Document, ...insertArgs: any[]) {
    const nodes = await this.serviceContext.nodeParser.getNodesFromDocuments([
      document
    ])
    await this.insert_nodes(nodes, ...insertArgs)
  }

  abstract _delete(doc_id: string, ...delete_kwargs: any[]): void

  delete(doc_id: string, ...delete_kwargs: any[]): void {
    console.debug(`> Deleting document: ${doc_id}`)
    this._delete(doc_id, ...delete_kwargs)
  }

  update(document: Document, ...update_kwargs: any[]): void {
    this.delete(document.getDocId(), ...update_kwargs)
    this.insert(document, ...update_kwargs)
  }

  refresh(documents: Document[], ...update_kwargs: any[]): boolean[] {
    const refreshed_documents: boolean[] = new Array(documents.length).fill(
      false
    )
    documents.forEach((document, i) => {
      const existing_doc_hash = this._docstore.getDocumentHash(
        document.getDocId()
      )
      if (existing_doc_hash !== document.getDocHash()) {
        this.update(document, ...update_kwargs)
        refreshed_documents[i] = true
      } else if (existing_doc_hash === null) {
        this.insert(document, ...update_kwargs)
        refreshed_documents[i] = true
      }
    })

    return refreshed_documents
  }

  saveToDict(...save_kwargs: any[]): object {
    const out_dict: { [key: string]: any } = {
      [INDEX_STRUCT_KEY]: this.indexStruct.toDict(),
      [DOCSTORE_KEY]: this.docstore.serializeToDict()
    }
    return out_dict
  }

  saveToString(...save_kwargs: any[]): string {
    const out_dict = this.saveToDict(...save_kwargs)
    return serialize(out_dict)
  }

  saveToDisk(
    savePath: string,
    encoding: BufferEncoding = 'utf8',
    ...save_kwargs: any[]
  ): void {
    const index_string = this.saveToString(...save_kwargs)
    fs.writeFileSync(savePath, index_string, { encoding })
  }
  _preprocessQuery(
    mode: QueryMode,
    queryKwargs: { [key: string]: any }
  ): void {}

  async query(
    queryStr: string | QueryBundle,
    mode: string = QueryMode.DEFAULT,
    queryTransform: BaseQueryTransform | null = null,
    useAsync: boolean = false,
    queryKwargs: { [key: string]: any } = {}
  ) {
    const modeEnum = QueryMode[mode]
    this._preprocessQuery(modeEnum, queryKwargs)
    const queryConfig = new QueryConfig({
      indexStructType: this.indexStruct?.getType(),
      queryMode: modeEnum,
      queryKwargs: queryKwargs
    })
    const queryRunner = new QueryRunner({
      indexStruct: this.indexStruct,
      serviceContext: this._serviceContext,
      docstore: this.docstore,
      queryConfigs: [queryConfig],
      queryTransform: queryTransform,
      recursive: false,
      useAsync: useAsync
    })

    return await queryRunner.query(queryStr)
  }
  static loadFromDict(resultDict: { [key: string]: any }, restArgs: any) {
    const indexStruct = loadIndexStructFromDict(resultDict[INDEX_STRUCT_KEY])
    if (!(indexStruct instanceof indexStruct.constructor)) {
      throw new Error(
        `indexStruct must be of type ${typeof indexStruct} but got ${typeof indexStruct}`
      )
    }
    const docstore = DocumentStore.loadFromDict(resultDict[DOCSTORE_KEY])
    // @ts-ignore
    return new this({ indexStruct: indexStruct, docstore, ...restArgs })
  }

  static loadFromString(indexString: string, restArgs: any) {
    const resultDict = JSON.parse(indexString)
    return this.loadFromDict(resultDict, restArgs)
  }

  static loadFromDisk(savePath: string, restArgs?: any) {
    // hacking point
    const fileContents = fs.readFileSync(savePath, 'utf8')
    return this.loadFromString(fileContents, restArgs)
  }
}
