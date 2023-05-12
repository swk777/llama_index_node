import { BaseLanguageModel } from 'langchain/base_language'
import { LLMChain } from 'langchain/chains'
import { ChatOpenAI } from 'langchain/chat_models/openai'
import { Cohere } from 'langchain/llms/cohere'
import { OpenAI } from 'langchain/llms/openai'
import { Prompt } from '../prompts/Prompt.js'
import { MAX_CHUNK_SIZE, NUM_OUTPUTS } from '../constants.js'

import {
  modelnameToContextsize,
  retryOnExceptionsWithBackoff,
  ErrorToRetry,
  globalsHelper
} from '../utils.js'

const GPT4_CONTEXT_SIZE = 8192
const GPT4_32K_CONTEXT_SIZE = 32768

export class LLMMetadata {
  maxInputSize: number
  numOutput: number

  constructor(
    maxInputSize: number = MAX_CHUNK_SIZE,
    numOutput: number = NUM_OUTPUTS
  ) {
    this.maxInputSize = maxInputSize
    this.numOutput = numOutput
  }
}

function _getLlmMetadata(llm: BaseLanguageModel): LLMMetadata {
  if (!(llm instanceof BaseLanguageModel)) {
    throw new Error('llm must be an instance of langchain.llms.base.LLM')
  }

  if (llm instanceof OpenAI) {
    return new LLMMetadata(modelnameToContextsize(llm.modelName), llm.maxTokens)
  } else if (llm instanceof ChatOpenAI) {
    const max_tokens = llm.maxTokens || 4096

    if (llm.modelName === 'gpt-4') {
      return new LLMMetadata(GPT4_CONTEXT_SIZE, max_tokens)
    } else if (llm.modelName === 'gpt-4-32k') {
      return new LLMMetadata(GPT4_32K_CONTEXT_SIZE, max_tokens)
    } else {
      console.warn(
        'Unknown max input size for %s, using defaults.',
        llm.modelName
      )
      return new LLMMetadata()
    }
  } else if (llm instanceof Cohere) {
    const max_tokens = llm.maxTokens || 2048
    return new LLMMetadata(undefined, max_tokens)
  } else {
    return new LLMMetadata()
  }
}

// function* _get_response_gen(openai_response_stream: Generator): Generator {
//   for (const response of openai_response_stream) {
//     yield response.choices[0].text
//   }
// }

export abstract class BaseLLMPredictor {
  abstract getLLMMetadata(): LLMMetadata

  abstract predict(prompt: Prompt, promptArgs?: any): Promise<[string, string]>

  //   abstract stream(prompt: Prompt, promptArgs?: any): [Generator, string] // Replace 'Generator' with the correct type

  abstract get totalTokensUsed(): number

  abstract get lastTokenUsage(): number
  abstract set lastTokenUsage(value: number)

  abstract apredict(prompt: Prompt, promptArgs?: any): Promise<[string, string]>
}

export default class LLMPredictor extends BaseLLMPredictor {
  private _llm: BaseLanguageModel
  public retryOnThrottling: boolean
  private _totalTokensUsed: number
  public flag: boolean
  private _lastTokenUsage: number | null
  // hacking point
  constructor(llm?: BaseLanguageModel, retryOnThrottling: boolean = false) {
    super()
    this._llm =
      llm ||
      new OpenAI(
        { temperature: 0, modelName: 'text-davinci-003' },
        {
          apiKey: process.env.OPENAI_API_KEY,
          basePath: process.env.BASE_PATH || 'https://api.openai.com/v1'
        }
      )
    this.retryOnThrottling = retryOnThrottling
    this._totalTokensUsed = 0
    this.flag = true
    this._lastTokenUsage = null
  }

  get llm(): BaseLanguageModel {
    return this._llm
  }

  getLLMMetadata(): LLMMetadata {
    if (this.hasOwnProperty('_llm') && this._llm !== null) {
      return _getLlmMetadata(this._llm)
    } else {
      return new LLMMetadata()
    }
  }

  private async _predict(prompt: Prompt, promptArgs: any) {
    const llmChain = new LLMChain({
      prompt: prompt.getLangchainPrompt(this._llm),
      llm: this._llm
    })
    const fullPromptArgs = prompt.getFullFormatArgs(promptArgs)
    let llmPrediction: string
    if (this.retryOnThrottling) {
      llmPrediction = await retryOnExceptionsWithBackoff(
        async () => await llmChain.predict(fullPromptArgs),
        [
          new ErrorToRetry('openai.error.RateLimitError'),
          new ErrorToRetry('openai.error.ServiceUnavailableError'),
          new ErrorToRetry('openai.error.TryAgain'),
          new ErrorToRetry(
            'openai.error.APIConnectionError',
            (e: any) => e.should_retry
          )
        ]
      )
    } else {
      llmPrediction = await llmChain.predict(fullPromptArgs)
    }
    return llmPrediction
  }

  async predict(prompt: Prompt, promptArgs: any): Promise<[string, string]> {
    const fullPromptArgs = await prompt.format(this._llm, promptArgs)
    const llmPrediction = await this._predict(prompt, promptArgs)
    const promptTokensCount = this._countTokens(fullPromptArgs)
    const predictionTokensCount = this._countTokens(llmPrediction)
    this._totalTokensUsed += promptTokensCount + predictionTokensCount

    return [llmPrediction, fullPromptArgs]
  }

  // // NOTE: TypeScript doesn't support async generators
  async stream() {
    // if (!(this._llm instanceof OpenAI)) {
    //   throw new Error('stream is only supported for OpenAI LLMs')
    // }
    // const fullPromptArgs = prompt.format(this._llm, promptArgs)
    // const raw_response_gen = this._llm.stream(fullPromptArgs)
    // const response_gen = _get_response_gen(raw_response_gen)
    // return [response_gen, fullPromptArgs]
  }

  get totalTokensUsed(): number {
    return this._totalTokensUsed
  }

  private _countTokens(text: string): number {
    const tokens = globalsHelper.tokenizer.encode(text)
    return tokens.length
  }

  get lastTokenUsage(): number {
    if (this._lastTokenUsage === null) {
      return 0
    }
    return this._lastTokenUsage
  }

  set lastTokenUsage(value: number) {
    this._lastTokenUsage = value
  }

  private async _apredict(prompt: Prompt, promptArgs: any): Promise<string> {
    const llmChain = new LLMChain({
      prompt: prompt.getLangchainPrompt(this._llm),
      llm: this._llm
    })
    const fullPromptArgs = prompt.getFullFormatArgs(promptArgs)

    const llmPrediction = await llmChain.predict(fullPromptArgs)
    return llmPrediction
  }

  async apredict(prompt: Prompt, promptArgs: any): Promise<[string, string]> {
    const fullPromptArgs = await prompt.format(this._llm, promptArgs)
    const llmPrediction = await this._apredict(prompt, promptArgs)

    const promptTokensCount = this._countTokens(fullPromptArgs)
    const predictionTokensCount = this._countTokens(llmPrediction)
    this._totalTokensUsed += promptTokensCount + predictionTokensCount

    return [llmPrediction, fullPromptArgs]
  }
}
