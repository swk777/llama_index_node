// baseEmbedding.ts
import { globalsHelper } from '../utils.js'

type EMB_TYPE = number[]

const DEFAULT_EMBED_BATCH_SIZE = 10

function meanAgg(embeddings: EMB_TYPE[]): number[] {
  const mean = embeddings.reduce(
    (acc, emb) => acc.map((value, idx) => value + emb[idx]),
    Array(embeddings[0].length).fill(0)
  )
  return mean.map(value => value / embeddings.length)
}

export default abstract class BaseEmbedding {
  private _totalTokensUsed = 0
  private _lastTokenUsage: number | null = null
  private _tokenizer = globalsHelper.tokenizer
  private _textQueue: Array<[string, string]> = []

  constructor(private _embed_batch_size: number = DEFAULT_EMBED_BATCH_SIZE) {
    if (_embed_batch_size <= 0) {
      throw new Error('embed_batch_size must be > 0')
    }
  }

  protected abstract _getQueryEmbedding(query: string): Promise<number[]>

  public async getQueryEmbedding(query: string): Promise<number[]> {
    const queryEmbedding = await this._getQueryEmbedding(query)
    const queryTokensCount = this._tokenizer.encode(query).length
    this._totalTokensUsed += queryTokensCount
    return queryEmbedding
  }

  public async getAggEmbeddingFromQueries(queries: string[], aggFn = null) {
    const queryEmbeddings = await Promise.all(
      queries.map(async query => await this.getQueryEmbedding(query))
    )
    aggFn = aggFn || meanAgg
    return aggFn(queryEmbeddings)
  }

  protected abstract _getTextEmbedding(text: string): Promise<number[]>

  public getTextEmbedding(text: string): Promise<number[]> {
    const textEmbedding = this._getTextEmbedding(text)
    const textTokensCount = this._tokenizer.encode(text).length
    this._totalTokensUsed += textTokensCount
    return textEmbedding
  }

  public queueTextForEmbedding(textId: string, text: string): void {
    this._textQueue.push([textId, text])
  }

  public async getQueuedTextEmbeddings() {
    const textQueue = this._textQueue
    let curBatch: Array<[string, string]> = []
    let resultIds: string[] = []
    let resultEmbeddings = []
    for (const [idx, [textId, text]] of textQueue.entries()) {
      curBatch.push([textId, text])
      const textTokensCount = this._tokenizer.encode(text).length
      this._totalTokensUsed += textTokensCount
      if (
        idx === textQueue.length - 1 ||
        curBatch.length === this._embed_batch_size
      ) {
        const curBatchIds = curBatch.map(([id, _]) => id)
        const curBatchTexts = curBatch.map(([_, t]) => t)
        const embeddings = await this._getTextEmbeddings(curBatchTexts)
        resultIds.push(...curBatchIds)
        resultEmbeddings.push(...embeddings)

        curBatch = []
      }
    }

    this._textQueue = []
    return [resultIds, resultEmbeddings]
  }
  public async agetQueuedTextEmbeddings(textQueue) {
    let curBatch: Array<[string, string]> = []
    let resultIds: string[] = []
    let resultEmbeddings = []
    for (const [idx, [textId, text]] of textQueue.entries()) {
      curBatch.push([textId, text])
      const textTokensCount = this._tokenizer.encode(text).length
      this._totalTokensUsed += textTokensCount
      if (
        idx === textQueue.length - 1 ||
        curBatch.length === this._embed_batch_size
      ) {
        const curBatchIds = curBatch.map(([id, _]) => id)
        const curBatchTexts = curBatch.map(([_, t]) => t)
        const embeddings = await this._getTextEmbeddings(curBatchTexts)
        resultIds.push(...curBatchIds)
        resultEmbeddings.push(...embeddings)

        curBatch = []
      }
    }

    this._textQueue = []
    return [resultIds, resultEmbeddings]
  }

  public similarity(
    embedding1: EMB_TYPE,
    embedding2: EMB_TYPE,
    mode: SimilarityMode = SimilarityMode.DEFAULT
  ): number {
    return similarity(embedding1, embedding2, mode)
  }

  get totalTokensUsed(): number {
    return this._totalTokensUsed
  }
  set totalTokensUsed(value: number) {
    this._totalTokensUsed = value
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

  async _getTextEmbeddings(texts: string[]) {
    return await Promise.all(
      texts.map(async text => await this._getTextEmbedding(text))
    )
  }
}

// similarity.ts
export enum SimilarityMode {
  DEFAULT = 'cosine',
  DOT_PRODUCT = 'dot_product',
  EUCLIDEAN = 'euclidean'
}

export function similarity(
  embedding1: EMB_TYPE,
  embedding2: EMB_TYPE,
  mode: SimilarityMode = SimilarityMode.DEFAULT
): number {
  if (mode === SimilarityMode.EUCLIDEAN) {
    const diff = embedding1.map((value, idx) => value - embedding2[idx])
    const euclideanDistance = Math.sqrt(
      diff.reduce((acc, value) => acc + value * value, 0)
    )
    return euclideanDistance
  } else if (mode === SimilarityMode.DOT_PRODUCT) {
    const product = embedding1.reduce(
      (acc, value, idx) => acc + value * embedding2[idx],
      0
    )
    return product
  } else {
    const product = embedding1.reduce(
      (acc, value, idx) => acc + value * embedding2[idx],
      0
    )
    const norm =
      Math.sqrt(embedding1.reduce((acc, value) => acc + value * value, 0)) *
      Math.sqrt(embedding2.reduce((acc, value) => acc + value * value, 0))
    return product / norm
  }
}
