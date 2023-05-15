import BaseEmbedding from '../embeddings/BaseEmbedding.js'
import OpenAIEmbedding from '../embeddings/OpenAIEmbedding.js'
import TokenTextSplitter from '../langchain_helpers/TextSplitter.js'
import LLMPredictor from '../llm_predictor/LLMPredictor.js'
import LlamaLogger from '../logger/LlamaLogger.js'
import { NodeParser } from '../node_parser/NodeParser.js'
import SimpleNodeParser from '../node_parser/SimpleNodeParser.js'
import PromptHelper from './PromptHelper.js'

function _get_default_node_parser(
  chunkSizeLimit: number = null
): SimpleNodeParser {
  const tokenTextSplitter =
    chunkSizeLimit === null
      ? new TokenTextSplitter()
      : new TokenTextSplitter(undefined, chunkSizeLimit)
  return new SimpleNodeParser(tokenTextSplitter)
}

export default class ServiceContext {
  llmPredictor: LLMPredictor
  promptHelper: PromptHelper
  embedModel: BaseEmbedding | OpenAIEmbedding
  nodeParser: NodeParser | SimpleNodeParser
  llamaLogger: LlamaLogger
  chunkSizeLimit?: number

  constructor(
    llmPredictor: LLMPredictor,
    promptHelper: PromptHelper,
    embedModel: BaseEmbedding | OpenAIEmbedding,
    nodeParser: NodeParser | SimpleNodeParser,
    llamaLogger: LlamaLogger,
    chunkSizeLimit: number = null
  ) {
    this.llmPredictor = llmPredictor
    this.promptHelper = promptHelper
    this.embedModel = embedModel
    this.nodeParser = nodeParser
    this.llamaLogger = llamaLogger
    this.chunkSizeLimit = chunkSizeLimit
  }

  static fromDefaults({
    llmPredictor = null,
    promptHelper = null,
    embedModel = null,
    nodeParser = null,
    llamaLogger = null,
    chunkSizeLimit = null
  }: {
    llmPredictor?: LLMPredictor
    promptHelper?: PromptHelper
    embedModel?: BaseEmbedding | OpenAIEmbedding
    nodeParser?: NodeParser | SimpleNodeParser
    llamaLogger?: LlamaLogger
    chunkSizeLimit?: number
  }): ServiceContext {
    llmPredictor = llmPredictor || new LLMPredictor()
    embedModel = embedModel || new OpenAIEmbedding()
    promptHelper =
      promptHelper ||
      PromptHelper.from_llm_predictor(llmPredictor, chunkSizeLimit)
    nodeParser = nodeParser || _get_default_node_parser(chunkSizeLimit)
    llamaLogger = llamaLogger || new LlamaLogger()

    return new ServiceContext(
      llmPredictor,
      promptHelper,
      embedModel,
      nodeParser,
      llamaLogger,
      chunkSizeLimit
    )
  }
}
