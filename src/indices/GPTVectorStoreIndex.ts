import Node from '../data-struts/Node.js'
import BaseGPTIndex from './BaseGPTIndex.js'
import ServiceContext from './ServiceContext.js'
import { IndexDict } from '../data-struts/data-structure.js'
import { QuestionAnswerPrompt } from '../prompts/Prompt.js'
import { DEFAULT_TEXT_QA_PROMPT } from '../prompts/defaultPrompts.js'
import { SimpleVectorStore } from '../vector_stores/SimpleVectorStore.js'
import { NodeEmbeddingResult, VectorStore } from '../vector_stores/types.js'
import { llmTokenCounter } from '../token_counter/LLMTokenCounter.js'
import { VECTOR_STORE_CONFIG_DICT_KEY } from '../constants.js'

function zip(...arrays) {
  const length = Math.min(...arrays.map(array => array.length))
  const result = []
  for (let i = 0; i < length; i++) {
    result.push(arrays.map(array => array[i]))
  }
  return result
}

function getNewId(existing_ids: Set<string>): string {
  let newId: string
  do {
    newId = Math.random().toString(36).substr(2, 9)
  } while (existing_ids.has(newId))
  return newId
}

async function run_async_tasks(tasks: Promise<void>[]): Promise<void> {
  await Promise.all(tasks)
}

export class GPTVectorStoreIndex extends BaseGPTIndex<IndexDict> {
  static indexStructCls = IndexDict

  _vectorStore: VectorStore
  textQaTemplate: QuestionAnswerPrompt
  private _useAsync: boolean

  constructor({
    nodes,
    indexStruct,
    serviceContext,
    textQaTemplate,
    vectorStore,
    useAsync = false,
    ...restArgs
  }: {
    nodes?: Node[]
    indexStruct?: IndexDict
    serviceContext?: ServiceContext
    textQaTemplate?: QuestionAnswerPrompt
    vectorStore?: VectorStore
    useAsync?: boolean
  }) {
    super({ nodes, indexStruct, serviceContext, ...restArgs })

    this._vectorStore = vectorStore || new SimpleVectorStore()
    this.textQaTemplate = textQaTemplate || DEFAULT_TEXT_QA_PROMPT
    this._useAsync = useAsync
  }

  async _asyncAddNodesToIndex(
    indexStruct: IndexDict,
    nodes: Node[]
  ): Promise<void> {
    const embeddingResults = await this._agetNodeEmbeddingResults(
      nodes,
      new Set<string>()
    )
    const newIds = this._vectorStore.add(embeddingResults)
    if (!this._vectorStore.stores_text) {
      for (const [result, newId] of zip(embeddingResults, newIds)) {
        indexStruct.addNode(result.node, newId)
        this._docstore.addDocuments([result.node], true)
      }
    }
  }

  async _addNodesToIndex(indexStruct: IndexDict, nodes: Node[]) {
    const embeddingResults = await this._getNodeEmbeddingResults(
      nodes,
      new Set<string>()
    )
    const newIds = this._vectorStore.add(embeddingResults)
    if (!this._vectorStore.stores_text) {
      for (const [result, newId] of zip(embeddingResults, newIds)) {
        indexStruct.addNode(result.node, newId)
        indexStruct.embeddingsDict[result.id] = result.embedding
        this._docstore.addDocuments([result.node], true)
      }
    }
  }
  async _getNodeEmbeddingResults(nodes: Node[], existingNodeIds: Set<string>) {
    const idToNodeMap: Map<string, Node> = new Map()
    const idToEmbedMap: Map<string, number[]> = new Map()
    for (const node of nodes) {
      const newId = getNewId(
        new Set([...existingNodeIds, ...idToNodeMap.keys()])
      )
      if (!node.embedding) {
        this._serviceContext.embedModel.queueTextForEmbedding(
          newId,
          node.getText()
        )
      } else {
        idToEmbedMap.set(newId, node.embedding)
      }

      idToNodeMap.set(newId, node)
    }

    const [resultIds, resultEmbeddings] =
      await this._serviceContext.embedModel.getQueuedTextEmbeddings()
    resultIds.forEach((newId, index) => {
      idToEmbedMap.set(newId, resultEmbeddings[index])
    })

    const resultTuples: NodeEmbeddingResult[] = []
    idToEmbedMap.forEach((embed, id) => {
      const docId = idToNodeMap.get(id).refDocId
      if (docId === null) {
        throw new Error('Reference doc id is null.')
      }
      resultTuples.push(
        new NodeEmbeddingResult(id, idToNodeMap.get(id), embed, docId)
      )
    })
    return resultTuples
  }

  async _agetNodeEmbeddingResults(
    nodes: Node[],
    existingNodeIds: Set<string>
  ): Promise<NodeEmbeddingResult[]> {
    const idToNodeMap: Map<string, Node> = new Map()
    const idToEmbedMap: Map<string, number[]> = new Map()

    const textQueue: [string, string][] = []

    for (const node of nodes) {
      const newId = getNewId(
        new Set([...existingNodeIds, ...idToNodeMap.keys()])
      )
      if (node.embedding === null) {
        textQueue.push([newId, node.getText()])
      } else {
        idToEmbedMap.set(newId, node.embedding)
      }

      idToNodeMap.set(newId, node)
    }

    const [resultIds, resultEmbeddings] =
      await this._serviceContext.embedModel.agetQueuedTextEmbeddings(textQueue)
    resultIds.forEach((newId, index) => {
      idToEmbedMap.set(newId, resultEmbeddings[index])
    })

    const resultTuples: NodeEmbeddingResult[] = []
    idToEmbedMap.forEach((embed, id) => {
      const docId = idToNodeMap.get(id).refDocId
      if (docId === null) {
        throw new Error('Reference doc id is null.')
      }
      resultTuples.push(
        new NodeEmbeddingResult(id, idToNodeMap.get(id), embed, docId)
      )
    })

    return resultTuples
  }

  async _buildIndexFromNodes(nodes: Node[]) {
    const indexStruct = new IndexDict()
    // this._useAsync = true
    if (this._useAsync) {
      // hacking point
      await this._asyncAddNodesToIndex(indexStruct, nodes)
    } else {
      await this._addNodesToIndex(indexStruct, nodes)
    }
    // @ts-ignore
    this.indexStructCls = indexStruct
    return indexStruct
  }

  // @ts-ignore
  @llmTokenCounter('buildIndexFromNodes')
  buildIndexFromNodes(nodes: Node[]) {
    return this._buildIndexFromNodes(nodes)
  }

  async _insert(nodes: Node[], ...insertArgs: any[]) {
    if (this._useAsync) {
      const tasks = [this._asyncAddNodesToIndex(this.indexStruct, nodes)]
      run_async_tasks(tasks)
    } else {
      await this._addNodesToIndex(this.indexStruct, nodes)
    }
  }

  async insert_nodes(nodes: Node[], ...insertArgs: any[]) {
    await this._insert(nodes, ...insertArgs)
  }

  _delete(doc_id: string, ...delete_kwargs: any[]): void {
    // @ts-ignore
    this.indexStruct.remove_node(doc_id)
    this._vectorStore.delete(doc_id)
    this._docstore.deleteDocument(doc_id)
  }

  static loadFromDict(
    result_dict: { [key: string]: any },
    restArgs: any = {}
  ): GPTVectorStoreIndex {
    // hacking point
    if (result_dict[VECTOR_STORE_CONFIG_DICT_KEY]) {
      restArgs[VECTOR_STORE_CONFIG_DICT_KEY] = new SimpleVectorStore(
        result_dict[VECTOR_STORE_CONFIG_DICT_KEY]['simpleVectorStoreDataDict']
      )
    }
    return super.loadFromDict(result_dict, restArgs)
  }

  saveToDict(...save_kwargs: any[]): { [key: string]: any } {
    const out_dict = super.saveToDict()
    out_dict[VECTOR_STORE_CONFIG_DICT_KEY] = this._vectorStore.configDict
    return out_dict
  }
}
