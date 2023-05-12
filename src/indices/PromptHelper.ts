// import { LLMPredictor } from './langchain_helpers/chain_wrapper'
import { TokenizerFn, globalsHelper } from '../utils.js'
import { MAX_CHUNK_OVERLAP } from '../constants.js'
import { Prompt } from '../prompts/Prompt.js'
import Node from '../data-struts/Node.js'
import TokenTextSplitter from '../langchain_helpers/TextSplitter.js'
import LLMPredictor from '../llm_predictor/LLMPredictor.js'

export default class PromptHelper {
  maxInputSize: number
  numOutput: number
  maxChunkOverlap: number
  embeddingLimit: number | null
  chunkSizeLimit: number | null
  _tokenizer: TokenizerFn
  _separator: string
  useChunkSizeLimit: boolean

  constructor(
    maxInputSize: number,
    numOutput: number,
    maxChunkOverlap: number,
    embeddingLimit: number | null = null,
    chunkSizeLimit: number | null = null,
    tokenizer: TokenizerFn | null = null,
    separator: string = ' '
  ) {
    this.maxInputSize = maxInputSize
    this.numOutput = numOutput
    this.maxChunkOverlap = maxChunkOverlap
    this.embeddingLimit = embeddingLimit
    this.chunkSizeLimit = chunkSizeLimit
    this._tokenizer = tokenizer || globalsHelper.tokenizer
    this._separator = separator
    this.useChunkSizeLimit = chunkSizeLimit !== null
  }

  static from_llm_predictor(
    llmPredictor: LLMPredictor,
    maxChunkOverlap: number | null = null,
    embeddingLimit: number | null = null,
    chunkSizeLimit: number | null = null,
    tokenizer: TokenizerFn | null = null
  ): PromptHelper {
    const llmMetadata = llmPredictor.getLLMMetadata()
    maxChunkOverlap =
      maxChunkOverlap ||
      Math.min(MAX_CHUNK_OVERLAP, llmMetadata.maxInputSize / 10)
    if (chunkSizeLimit !== null) {
      maxChunkOverlap = Math.min(maxChunkOverlap, chunkSizeLimit / 10)
    }

    return new PromptHelper(
      llmMetadata.maxInputSize,
      llmMetadata.numOutput,
      maxChunkOverlap,
      embeddingLimit,
      chunkSizeLimit,
      tokenizer
    )
  }

  getChunkSizeGivenPrompt(
    prompt_text: string,
    num_chunks: number,
    padding: number | null = 1
  ): number {
    const promptTokens = this._tokenizer.encode(prompt_text)
    const numPromptTokens = promptTokens.length

    let result =
      (this.maxInputSize - numPromptTokens - this.numOutput) / num_chunks
    if (padding !== null) {
      result -= padding
    }

    if (this.embeddingLimit !== null) {
      result = Math.min(result, this.embeddingLimit)
    }
    if (this.chunkSizeLimit !== null && this.useChunkSizeLimit) {
      result = Math.min(result, this.chunkSizeLimit)
    }

    return result
  }

  async _getEmptyPromptTxt(prompt: Prompt) {
    const fmt_dict: Record<string, string> = {}
    for (const v of prompt.inputVariables || []) {
      if (!prompt.partialDict[v]) {
        fmt_dict[v] = ''
      }
    }
    return await prompt.format(null, fmt_dict) // TODO: change `null` to the appropriate value
  }

  async get_biggest_prompt(prompts: Array<Prompt>) {
    const emptyPromptTxts = Promise.all(
      prompts.map(async prompt => {
        return await this._getEmptyPromptTxt(prompt)
      })
    )
    // @ts-ignore
    const emptyPromptTxtLens = emptyPromptTxts.map(txt => txt.length)
    const biggestPrompt =
      prompts[emptyPromptTxtLens.indexOf(Math.max(...emptyPromptTxtLens))]
    return biggestPrompt
  }

  async getTextSplitterGivenPrompt(
    prompt: Prompt,
    num_chunks: number,
    padding: number | null = 1
  ) {
    const emptyPromptTxt = await this._getEmptyPromptTxt(prompt)
    const chunkSize = this.getChunkSizeGivenPrompt(
      emptyPromptTxt,
      num_chunks,
      padding
    )
    const textSplitter = new TokenTextSplitter(
      this._separator,
      chunkSize,
      this.maxChunkOverlap / num_chunks,
      this._tokenizer
    )
    return textSplitter
  }

  async getTextFromNodes(node_list: Array<Node>, prompt: Prompt | null = null) {
    const numNodes = node_list.length
    let textSplitter: TokenTextSplitter | null = null
    if (prompt !== null) {
      textSplitter = await this.getTextSplitterGivenPrompt(prompt, numNodes, 1)
    }
    const results = node_list.map(node => {
      const text =
        textSplitter !== null
          ? textSplitter.truncateText(node.getText())
          : node.getText()
      return text
    })

    return results.join('\n')
  }

  async getNumberedTextFromNodes(
    node_list: Array<Node>,
    prompt: Prompt | null = null
  ) {
    const numNodes = node_list.length
    let textSplitter: TokenTextSplitter | null = null
    if (prompt !== null) {
      textSplitter = await this.getTextSplitterGivenPrompt(prompt, numNodes, 5)
    }
    const results: Array<string> = []
    let number = 1
    for (const node of node_list) {
      let node_text = node.getText().replace(/\n/g, ' ')
      if (textSplitter !== null) {
        node_text = textSplitter.truncateText(node_text)
      }
      const text = `(${number}) ${node_text}`
      results.push(text)
      number += 1
    }
    return results.join('\n\n')
  }

  async compactTextChunks(prompt: Prompt, textChunks: Array<string>) {
    const combinedStr = textChunks
      .map(chunk => chunk.trim())
      .filter(chunk => chunk.length > 0)
      .join('\n\n')
    const textSplitter = await this.getTextSplitterGivenPrompt(prompt, 1, 1)
    return textSplitter.splitText(combinedStr)
  }
}
