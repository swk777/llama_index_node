import { v4 as uuidv4 } from 'uuid'
import tiktoken from 'tiktoken-node'
import stopwords from 'nltk-stopwords'
import { BaseLanguageModel } from 'langchain/base_language'

export type TokenizerFn = { encode: (text: string) => Array<number> }

class GlobalsHelper {
  private _tokenizer: TokenizerFn | null = null
  private _stopwords: Array<string> | null = null

  public get tokenizer(): TokenizerFn {
    if (!this._tokenizer) {
      const enc = tiktoken.getEncoding('gpt2')
      this._tokenizer = enc
    }
    return this._tokenizer
  }

  public get stopwords(): Array<string> {
    if (!this._stopwords) {
      this._stopwords = stopwords.load('english')
    }
    return this._stopwords
  }
}

export const globalsHelper = new GlobalsHelper()

export function getNewId(d: Set<string>): string {
  let newId: string
  do {
    newId = uuidv4()
  } while (d.has(newId))
  return newId
}
export function truncateText(text: string, maxLength: number): string {
  return text.slice(0, maxLength - 3) + '...'
}

export function modelnameToContextsize(modelname: string): number {
  switch (modelname) {
    case 'text-davinci-003':
      return 4097
    case 'text-curie-001':
      return 2048
    case 'text-babbage-001':
      return 2048
    case 'text-ada-001':
      return 2048
    case 'code-davinci-002':
      return 8000
    case 'code-cushman-001':
      return 2048
    default:
      return 4097
  }
}

export class ErrorToRetry {
  exceptionCls: any // Replace 'any' with the correct type
  checkFn?: CheckFn

  constructor(exceptionCls: any, checkFn?: CheckFn) {
    // Replace 'any' with the correct type
    this.exceptionCls = exceptionCls
    this.checkFn = checkFn
  }
}
export async function retryOnExceptionsWithBackoff(
  lambdaFn: () => Promise<any>,
  errorsToRetry: ErrorToRetry[],
  maxTries: number = 10,
  minBackoffSecs: number = 0.5,
  maxBackoffSecs: number = 60.0
): Promise<any> {
  if (!errorsToRetry.length) {
    throw new Error('At least one error to retry needs to be provided')
  }

  const errorChecks: Record<string, (error: any) => boolean> =
    errorsToRetry.reduce((acc, errorToRetry) => {
      acc[errorToRetry.exceptionCls.name] = errorToRetry.checkFn
      return acc
    }, {})

  let backoffSecs = minBackoffSecs
  let tries = 0

  while (true) {
    try {
      return await lambdaFn()
    } catch (e) {
      console.error(e)
      tries += 1
      if (tries >= maxTries) {
        throw e
      }
      const checkFn = errorChecks[e.constructor.name]
      if (checkFn && !checkFn(e)) {
        throw e
      }
      await new Promise(resolve => setTimeout(resolve, backoffSecs * 1000))
      backoffSecs = Math.min(backoffSecs * 2, maxBackoffSecs)
    }
  }
}

type CheckFn = (error: any) => boolean // Replace 'any' with the correct type

// export class ErrorToRetry {
//     exceptionCls: any; // Replace 'any' with the correct type
//     checkFn?: CheckFn;

//     constructor(exceptionCls: any, checkFn?: CheckFn) { // Replace 'any' with the correct type
//         this.exceptionCls = exceptionCls;
//         this.checkFn = checkFn;
//     }
// }
export function isChatModel(llm: BaseLanguageModel): boolean {
  return llm._modelType() === 'base_chat_model'
}

export function zip(...arrays) {
  const length = Math.min(...arrays.map(array => array.length))
  const result = []
  for (let i = 0; i < length; i++) {
    result.push(arrays.map(array => array[i]))
  }
  return result
}
