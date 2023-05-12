// import { TextSplitter } from 'langchain/text_splitter'
import { Document } from 'langchain/document'
import { globalsHelper } from '../utils.js'

export class TextSplit {
  textChunk: string
  numCharOverlap: number | null

  constructor(textChunk: string, numCharOverlap: number | null = null) {
    this.textChunk = textChunk
    this.numCharOverlap = numCharOverlap
  }
}

interface TextSplitterParams {
  chunkSize: number

  chunkOverlap: number
}

export abstract class TextSplitter implements TextSplitterParams {
  chunkSize = 1000

  chunkOverlap = 200

  constructor(fields?: Partial<TextSplitterParams>) {
    this.chunkSize = fields?.chunkSize ?? this.chunkSize
    this.chunkOverlap = fields?.chunkOverlap ?? this.chunkOverlap
    if (this.chunkOverlap >= this.chunkSize) {
      throw new Error('Cannot have chunkOverlap >= chunkSize')
    }
  }

  abstract splitText(text: string): Promise<string[]>

  async createDocuments(
    texts: string[],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    metadatas: Record<string, any>[] = []
  ): Promise<Document[]> {
    const _metadatas =
      metadatas.length > 0 ? metadatas : new Array(texts.length).fill({})
    const documents = new Array<Document>()
    for (let i = 0; i < texts.length; i += 1) {
      const text = texts[i]
      let lineCounterIndex = 1
      let prevChunk = null
      for (const chunk of await this.splitText(text)) {
        // we need to count the \n that are in the text before getting removed by the splitting
        let numberOfIntermediateNewLines = 0
        if (prevChunk) {
          const indexChunk = text.indexOf(chunk)
          const indexEndPrevChunk = text.indexOf(prevChunk) + prevChunk.length
          const removedNewlinesFromSplittingText = text.slice(
            indexEndPrevChunk,
            indexChunk
          )
          numberOfIntermediateNewLines = (
            removedNewlinesFromSplittingText.match(/\n/g) || []
          ).length
        }
        lineCounterIndex += numberOfIntermediateNewLines
        const newLinesCount = (chunk.match(/\n/g) || []).length

        const loc =
          _metadatas[i].loc && typeof _metadatas[i].loc === 'object'
            ? { ..._metadatas[i].loc }
            : {}
        loc.lines = {
          from: lineCounterIndex,
          to: lineCounterIndex + newLinesCount
        }
        const metadataWithLinesNumber = {
          ..._metadatas[i],
          loc
        }
        documents.push(
          new Document({
            pageContent: chunk,
            metadata: metadataWithLinesNumber
          })
        )
        lineCounterIndex += newLinesCount
        prevChunk = chunk
      }
    }
    return documents
  }

  async splitDocuments(documents: Document[]): Promise<Document[]> {
    const texts = documents.map(doc => doc.pageContent)
    const metadatas = documents.map(doc => doc.metadata)
    return this.createDocuments(texts, metadatas)
  }

  private joinDocs(docs: string[], separator: string): string | null {
    const text = docs.join(separator).trim()
    return text === '' ? null : text
  }

  mergeSplits(splits: string[], separator: string): string[] {
    const docs: string[] = []
    const currentDoc: string[] = []
    let total = 0
    for (const d of splits) {
      const _len = d.length
      if (total + _len >= this.chunkSize) {
        if (total > this.chunkSize) {
          console.warn(
            `Created a chunk of size ${total}, +
which is longer than the specified ${this.chunkSize}`
          )
        }
        if (currentDoc.length > 0) {
          const doc = this.joinDocs(currentDoc, separator)
          if (doc !== null) {
            docs.push(doc)
          }
          // Keep on popping if:
          // - we have a larger chunk than in the chunk overlap
          // - or if we still have any chunks and the length is long
          while (
            total > this.chunkOverlap ||
            (total + _len > this.chunkSize && total > 0)
          ) {
            total -= currentDoc[0].length
            currentDoc.shift()
          }
        }
      }
      currentDoc.push(d)
      total += _len
    }
    const doc = this.joinDocs(currentDoc, separator)
    if (doc !== null) {
      docs.push(doc)
    }
    return docs
  }
}

// type Callable = (text: string) => Array<number>

export default class TokenTextSplitter extends TextSplitter {
  private _separator: string
  // private chunkSize: number
  // private chunkOverlap: number
  private tokenizer
  private _backupSeparators: string[]

  constructor(
    separator: string = ' ',
    chunkSize: number = 3900,
    chunkOverlap: number = 200,
    tokenizer?,
    backupSeparators: string[] = ['\n']
  ) {
    super({ chunkSize: chunkSize, chunkOverlap: chunkOverlap })
    if (chunkOverlap > chunkSize) {
      throw new Error(
        `Got a larger chunk overlap (${chunkOverlap}) than chunk size ` +
          `(${chunkSize}), should be smaller.`
      )
    }
    this._separator = separator
    this.chunkSize = chunkSize
    this.chunkOverlap = chunkOverlap
    this.tokenizer = tokenizer || globalsHelper.tokenizer
    this._backupSeparators = backupSeparators
  }

  private _reduceChunkSize(
    startIdx: number,
    curIdx: number,
    splits: string[]
  ): number {
    let currentDocTotal = this.tokenizer.encode(
      splits.slice(startIdx, curIdx).join(this._separator)
    ).length
    while (currentDocTotal > this.chunkSize) {
      const percentToReduce =
        (currentDocTotal - this.chunkSize) / currentDocTotal
      const numToReduce = Math.floor(percentToReduce * (curIdx - startIdx)) + 1
      curIdx -= numToReduce
      currentDocTotal = this.tokenizer.encode(
        splits.slice(startIdx, curIdx).join(this._separator)
      ).length
    }
    return curIdx
  }

  private _preprocessSplits(splits: string[], chunkSize: number): string[] {
    const newSplits: string[] = []
    for (const split of splits) {
      // @ts-ignore
      const numCurTokens = this.tokenizer.encode(split).length
      // const numCurTokens = tokenizer.encode(split).length
      if (numCurTokens <= chunkSize) {
        newSplits.push(split)
      } else {
        let curSplits = [split]
        if (this._backupSeparators.length > 0) {
          for (const sep of this._backupSeparators) {
            if (split.includes(sep)) {
              curSplits = split.split(sep)
              break
            }
          }
        } else {
          curSplits = [split]
        }

        const curSplits2: string[] = []
        for (const curSplit of curSplits) {
          const numCurTokens = this.tokenizer.encode(curSplit).length
          if (numCurTokens <= chunkSize) {
            curSplits2.push(curSplit)
          } else {
            const curSplitChunks = Array.from(
              { length: Math.ceil(curSplit.length / chunkSize) },
              (_, i) => curSplit.slice(i * chunkSize, i * chunkSize + chunkSize)
            )
            curSplits2.push(...curSplitChunks)
          }
        }

        newSplits.push(...curSplits2)
      }
    }
    return newSplits
  }

  private _postprocessSplits(docs: TextSplit[]): TextSplit[] {
    return docs.filter(doc => doc.textChunk.replace(' ', '') !== '')
  }

  public splitText(text: string): Promise<string[]> {
    // TODO extraInfoStr
    const textSplits = this.splitTextWithOverlaps(text, '')
    return Promise.resolve(textSplits.map(text_split => text_split.textChunk))
  }
  //   public split_text(text: string, extraInfoStr?: string): string[] {
  //     // TODO extraInfoStr
  //     const textSplits = this.splitTextWithOverlaps(text, extraInfoStr)
  //     return textSplits.map(text_split => text_split.textChunk)
  //   }
  public splitTextWithOverlaps(
    text: string,
    extraInfoStr?: string
  ): TextSplit[] {
    if (text === '') {
      return []
    }

    const extraInfoTokens = extraInfoStr
      ? this.tokenizer.encode(`${extraInfoStr}\n\n`).length + 1
      : 0
    const effectiveChunkSize = this.chunkSize - extraInfoTokens

    if (effectiveChunkSize <= 0) {
      throw new Error(
        'Effective chunk size is non-positive after considering extraInfo'
      )
    }

    const splits = text.split(this._separator)
    const processedSplits = this._preprocessSplits(splits, effectiveChunkSize)

    const docs: TextSplit[] = []
    let startIdx = 0
    let curIdx = 0
    let curTotal = 0
    let prevIdx = 0

    while (curIdx < processedSplits.length) {
      const curToken = processedSplits[curIdx]
      const numCurTokens = Math.max(this.tokenizer.encode(curToken).length, 1)

      if (numCurTokens > effectiveChunkSize) {
        throw new Error(
          `A single term is larger than the allowed chunk size.\nTerm size: ${numCurTokens}\nChunk size: ${this.chunkSize}\nEffective chunk size: ${effectiveChunkSize}`
        )
      }

      if (curTotal + numCurTokens > effectiveChunkSize) {
        curIdx = this._reduceChunkSize(startIdx, curIdx, processedSplits)
        let overlap = 0

        if (prevIdx > 0 && prevIdx > startIdx) {
          overlap = processedSplits
            .slice(startIdx, prevIdx)
            .join(this._separator).length
        }

        docs.push(
          new TextSplit(
            processedSplits.slice(startIdx, curIdx).join(this._separator),
            overlap
          )
        )
        prevIdx = curIdx

        while (curTotal > this.chunkOverlap && startIdx < curIdx) {
          const cur_num_tokens = Math.max(
            this.tokenizer.encode(processedSplits[startIdx]).length,
            1
          )
          curTotal -= cur_num_tokens
          startIdx += 1
        }

        if (startIdx === curIdx) {
          curTotal = 0
        }
      }

      curTotal += numCurTokens
      curIdx += 1
    }

    let overlap = 0
    if (prevIdx > startIdx) {
      overlap = processedSplits
        .slice(startIdx, prevIdx)
        .join(this._separator).length
    }

    docs.push(
      new TextSplit(
        processedSplits.slice(startIdx, curIdx).join(this._separator),
        overlap
      )
    )
    const final_docs = this._postprocessSplits(docs)
    return final_docs
  }

  public truncateText(text: string): string {
    if (text === '') {
      return ''
    }

    const splits = text.split(this._separator)
    const processedSplits = this._preprocessSplits(splits, this.chunkSize)

    let startIdx = 0
    let curIdx = 0
    let curTotal = 0

    while (curIdx < processedSplits.length) {
      const curToken = processedSplits[curIdx]
      const numCurTokens = Math.max(this.tokenizer.encode(curToken).length, 1)

      if (curTotal + numCurTokens > this.chunkSize) {
        curIdx = this._reduceChunkSize(startIdx, curIdx, processedSplits)
        break
      }

      curTotal += numCurTokens
      curIdx += 1
    }

    return processedSplits.slice(startIdx, curIdx).join(this._separator)
  }
}
