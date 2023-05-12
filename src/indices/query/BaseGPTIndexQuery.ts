import { llmTokenCounter } from '../../token_counter/LLMTokenCounter.js'
import { RESPONSE_TYPE, Response } from '../../response/schema.js'
import {
  ResponseBuilder,
  ResponseMode,
  TextChunk
} from '../../indices/response/builder.js'
import { DocumentStore } from '../../DocumentStore.js'
import ServiceContext from '../../indices/ServiceContext.js'
import { QuestionAnswerPrompt } from '../../prompts/Prompt.js'
import { RefinePrompt } from '../../prompts/prompts.js'
import { truncateText } from '../../utils.js'
import Node, { NodeWithScore } from 'data-struts/Node.js'
import { QueryBundle } from './schema.js'
import { BaseTokenUsageOptimizer } from '../../optimization/optimizer.js'
import { BaseNodePostprocessor } from '../../indices/postprocessor/node.js'
import { DEFAULT_TEXT_QA_PROMPT } from '../../prompts/defaultPrompts.js'
import { DEFAULT_REFINE_PROMPT_SEL } from '../../prompts/default-prompt-selectors.js'
import { V2IndexStruct as IndexStruct } from '../../data-struts/data-structure.js'
import { SimilarityTracker } from './embeddingUtils.js'

type RESPONSE_TEXT_TYPE = any
function getInitialNodePostprocessors(
  requiredKeywords?: string[] | null,
  excludeKeywords?: string[] | null,
  similarityCutoff?: number | null
): BaseNodePostprocessor[] {
  const postprocessors: BaseNodePostprocessor[] = []
  // TODO
  // if (requiredKeywords !== undefined || excludeKeywords !== undefined) {
  //   requiredKeywords = requiredKeywords || []
  //   excludeKeywords = excludeKeywords || []
  //   const keywordPostprocessor = new KeywordNodePostprocessor(
  //     requiredKeywords,
  //     excludeKeywords
  //   )
  //   postprocessors.push(keywordPostprocessor)
  // }

  // if (similarityCutoff !== undefined) {
  //   const similarityPostprocessor = new SimilarityPostprocessor(
  //     similarityCutoff
  //   )
  //   postprocessors.push(similarityPostprocessor)
  // }

  return postprocessors
}
export abstract class BaseGPTIndexQuery<IS extends IndexStruct> {
  protected _indexStruct: IS
  protected _docstore: DocumentStore
  protected _serviceContext: ServiceContext
  protected _responseMode: ResponseMode
  protected textQaTemplate: QuestionAnswerPrompt
  protected refineTemplate: RefinePrompt
  protected _includeSummary: boolean
  protected _responseKwargs: Record<string, any>
  protected _useAsync: boolean
  protected _streaming: boolean
  protected _docIds: string[] | null
  protected _optimizer: BaseTokenUsageOptimizer | null
  protected nodePreprocessors: BaseNodePostprocessor[]
  protected _verbose: boolean
  protected responseBuilder: ResponseBuilder
  protected similarityCutoff: number | null
  constructor({
    indexStruct,
    serviceContext,
    docstore = null,
    requiredKeywords = null,
    excludeKeywords = null,
    responseMode = ResponseMode.DEFAULT,
    textQaTemplate = null,
    refineTemplate = null,
    includeSummary = false,
    responseKwargs = null,
    similarityCutoff = null,
    useAsync = false,
    streaming = false,
    docIds = null,
    optimizer = null,
    nodePostprocessors = null,
    verbose = false
  }: {
    indexStruct: IS
    serviceContext: ServiceContext
    docstore: DocumentStore | null
    requiredKeywords: string[] | null
    excludeKeywords: string[] | null
    responseMode: ResponseMode
    textQaTemplate: QuestionAnswerPrompt | null
    refineTemplate: RefinePrompt | null
    includeSummary: boolean
    responseKwargs: Record<string, any> | null
    similarityCutoff: number | null
    useAsync: boolean
    streaming: boolean
    docIds: string[] | null
    optimizer: BaseTokenUsageOptimizer | null
    nodePostprocessors: BaseNodePostprocessor[] | null
    verbose: boolean
  }) {
    if (indexStruct === null) {
      throw new Error('indexStruct must be provided.')
    }
    this._validateIndexStruct(indexStruct)
    this._indexStruct = indexStruct
    if (docstore === null) {
      throw new Error('docstore must be provided.')
    }
    this._docstore = docstore
    this._serviceContext = serviceContext

    this._responseMode = responseMode

    this.textQaTemplate = textQaTemplate || DEFAULT_TEXT_QA_PROMPT

    this.refineTemplate = refineTemplate || DEFAULT_REFINE_PROMPT_SEL
    this._includeSummary = includeSummary
    this._responseKwargs = responseKwargs || {}
    this._useAsync = useAsync

    if (this._serviceContext.llamaLogger !== null) {
      this._serviceContext.llamaLogger.setMetadata({
        index_type: this._indexStruct.getType(),
        indexId: this._indexStruct.indexId
      })
    }

    this.responseBuilder = new ResponseBuilder({
      serviceContext: this._serviceContext,
      textQaTemplate: this.textQaTemplate,
      refineTemplate: this.refineTemplate,
      useAsync,
      streaming
    })

    this.similarityCutoff = similarityCutoff

    this._streaming = streaming
    this._docIds = docIds
    this._optimizer = optimizer

    const initNodePreprocessors = getInitialNodePostprocessors(
      requiredKeywords,
      excludeKeywords,
      similarityCutoff
    )
    nodePostprocessors = nodePostprocessors || []
    this.nodePreprocessors = initNodePreprocessors.concat(nodePostprocessors)
    this._verbose = verbose
  }

  protected _getTextFromNode(
    node: Node,
    level: number | null = null
  ): TextChunk {
    const levelStr = level === null ? '' : `[Level ${level}]`
    const fmtTextChunk = truncateText(node.getText(), 50)
    console.debug(`>${levelStr} Searching in chunk: ${fmtTextChunk}`)
    const responseTxt = node.getText()
    const fmtResponse = truncateText(responseTxt, 200)
    if (this._verbose) {
      console.log(`>${levelStr} Got node text: ${fmtResponse}\n`, 'blue')
    }
    return new TextChunk(responseTxt)
  }

  get indexStruct(): IS {
    return this._indexStruct
  }

  protected _validateIndexStruct(indexStruct: IS): void {}

  protected async _giveResponseForNodes(
    responseBuilder: ResponseBuilder,
    queryStr: string
  ) {
    const response = await responseBuilder.getResponse(
      queryStr,
      undefined,
      this._responseMode,
      this._responseKwargs
    )
    return response
  }

  protected async _agiveResponseForNodes(
    responseBuilder: ResponseBuilder,
    queryStr: string
  ): Promise<RESPONSE_TEXT_TYPE> {
    const response = await responseBuilder.agetResponse(
      queryStr,
      undefined,
      this._responseMode,
      this._responseKwargs
    )
    return response
  }

  async retrieve(queryBundle: QueryBundle) {
    const similarity_tracker = new SimilarityTracker()
    let nodes = await this._retrieve(queryBundle, similarity_tracker)
    const postprocess_info = { similarity_tracker }
    for (const nodeProcessor of this.nodePreprocessors) {
      nodes = nodeProcessor.postprocessNodes(nodes, postprocess_info)
    }

    return similarity_tracker.getZippedNodes(nodes)
  }

  protected abstract _retrieve(
    queryBundle: QueryBundle,
    similarity_tracker: SimilarityTracker
  )
  protected _getExtraInfoForResponse(
    nodes: Node[]
  ): { [key: string]: any } | null {
    return null
  }

  protected _prepareResponseBuilder(
    responseBuilder: ResponseBuilder,
    queryBundle: QueryBundle,
    nodes: NodeWithScore[],
    additionalSourceNodes?: NodeWithScore[]
  ): void {
    responseBuilder.reset()
    for (const nodeWithScore of nodes) {
      let text = this._getTextFromNode(nodeWithScore.node)
      responseBuilder.addNodeAsSource(nodeWithScore.node, nodeWithScore.score)
      if (this._optimizer !== null) {
        text = new TextChunk(this._optimizer.optimize(queryBundle, text.text))
      }
      responseBuilder.addTextChunks([text])
    }

    if (additionalSourceNodes !== undefined) {
      for (const node of additionalSourceNodes) {
        responseBuilder.addNodeWithScore(node)
      }
    }
  }

  protected _prepareResponseOutput(
    responseBuilder: ResponseBuilder,
    responseStr: RESPONSE_TEXT_TYPE | null,
    tuples: NodeWithScore[]
  ): RESPONSE_TYPE {
    const response_extra_info = this._getExtraInfoForResponse(
      tuples.map(nodeWithScore => nodeWithScore.node)
    )

    if (responseStr === null || typeof responseStr === 'string') {
      return new Response(
        responseStr,
        responseBuilder.getSources(),
        response_extra_info
      )
    }
    // else if (responseStr === null || responseStr instanceof Generator) {
    //   return new StreamingResponse(
    //     responseStr,
    //     responseBuilder.getSources(),
    //     response_extra_info
    //   )
    // }
    else {
      throw new Error('Response must be a string or a generator.')
    }
  }

  async synthesize(
    queryBundle: QueryBundle,
    nodes: NodeWithScore[],
    additionalSourceNodes?: NodeWithScore[]
  ) {
    this._prepareResponseBuilder(
      this.responseBuilder,
      queryBundle,
      nodes,
      additionalSourceNodes
    )

    let responseStr: RESPONSE_TEXT_TYPE | null
    if (this._responseMode !== ResponseMode.NO_TEXT) {
      responseStr = await this._giveResponseForNodes(
        this.responseBuilder,
        queryBundle.queryStr
      )
    } else {
      responseStr = null
    }

    return this._prepareResponseOutput(this.responseBuilder, responseStr, nodes)
  }
  async asynthesize(
    queryBundle: QueryBundle,
    nodes: NodeWithScore[],
    additionalSourceNodes?: NodeWithScore[]
  ): Promise<RESPONSE_TYPE> {
    const responseBuilder = new ResponseBuilder({
      serviceContext: this._serviceContext,
      textQaTemplate: this.textQaTemplate,
      refineTemplate: this.refineTemplate,
      useAsync: this._useAsync,
      streaming: this._streaming
    })

    this._prepareResponseBuilder(
      responseBuilder,
      queryBundle,
      nodes,
      additionalSourceNodes
    )

    let responseStr: RESPONSE_TEXT_TYPE | null
    if (this._responseMode !== ResponseMode.NO_TEXT) {
      responseStr = await this._agiveResponseForNodes(
        responseBuilder,
        queryBundle.queryStr
      )
    } else {
      responseStr = null
    }
    return this._prepareResponseOutput(responseBuilder, responseStr, nodes)
  }

  protected async _query(queryBundle: QueryBundle) {
    const nodes = await this.retrieve(queryBundle)
    return await this.synthesize(queryBundle, nodes)
  }

  protected async _aquery(queryBundle: QueryBundle): Promise<RESPONSE_TYPE> {
    const nodes = await this.retrieve(queryBundle)
    const response = await this.asynthesize(queryBundle, nodes)
    return response
  }

  @llmTokenCounter('query')
  async query(queryBundle: QueryBundle) {
    return await this._query(queryBundle)
  }

  @llmTokenCounter('query')
  async aquery(queryBundle: QueryBundle): Promise<RESPONSE_TYPE> {
    return await this._aquery(queryBundle)
  }
}
