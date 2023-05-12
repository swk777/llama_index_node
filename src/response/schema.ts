import { NodeWithScore } from '../data-struts/Node.js'
import { truncateText } from '../utils.js'

export class Response {
  response: string | null
  sourceNodes: NodeWithScore[]
  extraInfo?: { [key: string]: any } | null

  constructor(
    response: string | null,
    sourceNodes: NodeWithScore[] = [],
    extraInfo: { [key: string]: any } | null = null
  ) {
    this.response = response
    this.sourceNodes = sourceNodes
    this.extraInfo = extraInfo
  }

  toString(): string {
    return this.response ?? 'None'
  }

  getFormattedSources(length: number = 100): string {
    const texts: string[] = []
    for (const sourceNode of this.sourceNodes) {
      const fmtTextChunk = truncateText(sourceNode.sourceText, length)
      const doc_id = sourceNode.docId ?? 'None'
      const source_text = `> Source (Doc id: ${doc_id}): ${fmtTextChunk}`
      texts.push(source_text)
    }
    return texts.join('\n\n')
  }
}

export class StreamingResponse {
  responseGen?: AsyncGenerator<string>
  sourceNodes: NodeWithScore[]
  extraInfo?: { [key: string]: any } | null
  responseTxt?: string | null

  constructor(
    responseGen: AsyncGenerator<string> | null = null,
    sourceNodes: NodeWithScore[] = [],
    extraInfo: { [key: string]: any } | null = null,
    responseTxt: string | null = null
  ) {
    this.responseGen = responseGen
    this.sourceNodes = sourceNodes
    this.extraInfo = extraInfo
    this.responseTxt = responseTxt
  }

  async toString(): Promise<string> {
    if (this.responseTxt === null && this.responseGen !== null) {
      let responseTxt = ''
      for await (const text of this.responseGen) {
        responseTxt += text
      }
      this.responseTxt = responseTxt
    }
    return this.responseTxt ?? 'None'
  }

  async getResponse(): Promise<Response> {
    if (this.responseTxt === null && this.responseGen !== null) {
      let responseTxt = ''
      for await (const text of this.responseGen) {
        responseTxt += text
      }
      this.responseTxt = responseTxt
    }
    return new Response(this.responseTxt, this.sourceNodes, this.extraInfo)
  }

  async printResponseStream(): Promise<void> {
    if (this.responseTxt === null && this.responseGen !== null) {
      let responseTxt = ''
      for await (const text of this.responseGen) {
        console.log(text, '')
      }
      this.responseTxt = responseTxt
    } else {
      console.log(this.responseTxt)
    }
  }

  getFormattedSources(length: number = 100): string {
    const texts: string[] = []
    for (const sourceNode of this.sourceNodes) {
      const fmtTextChunk = truncateText(sourceNode.sourceText, length)
      const doc_id = sourceNode.docId ?? 'None'
      const source_text = `> Source (Doc id: ${doc_id}): ${fmtTextChunk}`
      texts.push(source_text)
    }
    return texts.join('\n\n')
  }
}

export type RESPONSE_TYPE = Response | StreamingResponse
