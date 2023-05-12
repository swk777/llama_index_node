import { RefinePrompt } from 'prompts/prompts.js'
import ServiceContext from 'indices/ServiceContext.js'
import { QuestionAnswerPrompt } from '../../prompts/Prompt.js'
import Node, { NodeWithScore } from '../../data-struts/Node.js'
import LlamaLogger from '../../logger/LlamaLogger.js'
import { truncateText } from '../../utils.js'

export enum ResponseMode {
  DEFAULT = 'default',
  COMPACT = 'compact',
  TREE_SUMMARIZE = 'tree_summarize',
  NO_TEXT = 'no_text'
}
export class TextChunk {
  text: string
  is_answer: boolean = false

  constructor(text: string, is_answer: boolean = false) {
    this.text = text
    this.is_answer = is_answer
  }
}
type RESPONSE_TEXT_TYPE = string | Promise<string>
type Generator = Promise<string>
export class ResponseBuilder {
  private _serviceContext: ServiceContext
  textQaTemplate: QuestionAnswerPrompt
  refineTemplate: RefinePrompt
  private _texts: TextChunk[]
  sourceNodes: NodeWithScore[]
  // private _useAsync: boolean
  private _streaming: boolean

  constructor({
    serviceContext,
    textQaTemplate,
    refineTemplate,
    texts,
    nodes,
    useAsync = false,
    streaming = false
  }: {
    serviceContext: ServiceContext
    textQaTemplate: QuestionAnswerPrompt
    refineTemplate: RefinePrompt
    texts?: TextChunk[]
    nodes?: Node[]
    useAsync: boolean
    streaming?: boolean
  }) {
    this._serviceContext = serviceContext
    this.textQaTemplate = textQaTemplate
    this.refineTemplate = refineTemplate
    this._texts = texts || []
    this.sourceNodes = (nodes || []).map(node => new NodeWithScore(node))
    // this._useAsync = useAsync
    this._streaming = streaming
  }

  private _log_prompt_and_response(
    formattedPrompt: string,
    response: RESPONSE_TEXT_TYPE,
    log_prefix: string = ''
  ): void {
    console.debug(`> ${log_prefix} prompt template: ${formattedPrompt}`)
    this._serviceContext.llamaLogger.addLog({
      formattedPromptTemplate: formattedPrompt
    })
    console.debug(`> ${log_prefix} response: ${response}`)
    this._serviceContext.llamaLogger.addLog({
      [`${log_prefix.toLowerCase()}_response`]: response || 'Empty Response'
    })
  }

  addTextChunks(textChunks: TextChunk[]): void {
    this._texts.push(...textChunks)
  }

  reset(): void {
    this._texts = []
    this.sourceNodes = []
  }

  addNodeAsSource(node: Node, similarity?: number): void {
    this.addNodeWithScore(new NodeWithScore(node, similarity))
  }

  addNodeWithScore(node_with_score: NodeWithScore): void {
    this.sourceNodes.push(node_with_score)
  }

  getSources(): NodeWithScore[] {
    return this.sourceNodes
  }

  get_logger(): LlamaLogger {
    return this._serviceContext.llamaLogger
  }

  async refineResponseSingle(
    response: RESPONSE_TEXT_TYPE,
    queryStr: string,
    textChunk: string
  ) {
    // TODO: consolidate with logic in response/schema.ts
    // if (response instanceof Generator) {
    //   response = get_response_text(response)
    // }

    const fmtTextChunk = truncateText(textChunk, 50)
    console.debug(`> Refine context: ${fmtTextChunk}`)
    // NOTE: partial format refineTemplate with queryStr and existingAnswer here
    const refineTemplate = this.refineTemplate.partialFormat({
      queryStr,
      existingAnswer: response,
      // hacking point
      contextMsg: ''
    })
    const refine_text_splitter =
      await this._serviceContext.promptHelper.getTextSplitterGivenPrompt(
        refineTemplate,
        1
      )
    const textChunks = await refine_text_splitter.splitText(textChunk)

    for (const curTextChunk of textChunks) {
      let formattedPrompt: string
      if (!this._streaming) {
        ;[response, formattedPrompt] =
          await this._serviceContext.llmPredictor.predict(refineTemplate, {
            contextMsg: curTextChunk
          })
      } else {
        //TODO
        // ;[response, formattedPrompt] =
        //   this._serviceContext.llmPredictor.stream(
        //     refineTemplate,
        //     curTextChunk
        //   )
      }
      this._log_prompt_and_response(formattedPrompt, response, 'Refined')
    }

    return response
  }
  async giveResponseSingle(queryStr: string, textChunk: string) {
    const textQATemplate = this.textQaTemplate.partialFormat({
      queryStr: queryStr
    })
    const qaTextSplitter =
      await this._serviceContext.promptHelper.getTextSplitterGivenPrompt(
        textQATemplate,
        1
      )
    const textChunks = await qaTextSplitter.splitText(textChunk)
    let response: RESPONSE_TEXT_TYPE | null = null
    for (const curTextChunk of textChunks) {
      if (response === null && !this._streaming) {
        const [res, formattedPrompt] =
          await this._serviceContext.llmPredictor.predict(textQATemplate, {
            contextStr: curTextChunk || ''
          })
        response = res
        this._log_prompt_and_response(formattedPrompt, response, 'Initial')
      } else if (response === null && this._streaming) {
        // const [res, formattedPrompt] =
        //   await this._serviceContext.llmPredictor.stream(
        //     textQATemplate,
        //     curTextChunk
        //   )
        // response = res
        // this._log_prompt_and_response(formattedPrompt, response, 'Initial')
      } else {
        response = await this.refineResponseSingle(
          response,
          queryStr,
          curTextChunk
        )
      }
    }
    if (typeof response === 'string') {
      response = response || 'Empty Response'
    } else {
      response = response as Generator
    }

    return response
  }

  async getResponseOverChunks(
    queryStr: string,
    textChunks: TextChunk[],
    prevResponse?: string
  ) {
    let prevResponseObj: RESPONSE_TEXT_TYPE | null = prevResponse ?? null
    let response: RESPONSE_TEXT_TYPE | null = null
    for (const textChunk of textChunks) {
      if (!prevResponseObj) {
        if (textChunk.is_answer) {
          response = textChunk.text
        } else {
          response = await this.giveResponseSingle(queryStr, textChunk.text)
        }
      } else {
        response = await this.refineResponseSingle(
          prevResponseObj,
          queryStr,
          textChunk.text
        )
      }
      prevResponseObj = response
    }
    if (typeof response === 'string') {
      response = response || 'Empty Response'
    } else {
      response = response as Generator
    }

    return response
  }

  private async _getResponseDefault(queryStr: string, prevResponse?: string) {
    return await this.getResponseOverChunks(queryStr, this._texts, prevResponse)
  }

  // private async _getResponseCompact(queryStr: string, prevResponse?: string) {
  //   const maxPrompt =
  //     await this._serviceContext.promptHelper.get_biggest_prompt([
  //       this.textQaTemplate,
  //       this.refineTemplate
  //     ])

  //   const tempAttrs = { useChunkSizeLimit: false }
  //   Object.assign(this._serviceContext.promptHelper, tempAttrs)

  //   const newTexts =
  //     await this._serviceContext.promptHelper.compactTextChunks(
  //       maxPrompt,
  //       this._texts.map(t => t.text)
  //     )
  //   const newTextChunks = newTexts.map(t => new TextChunk(t))
  //   const response = this.getResponseOverChunks(
  //     queryStr,
  //     newTextChunks,
  //     prevResponse
  //   )

  //   // Revert tempAttrs
  //   for (const key in tempAttrs) {
  //     delete this._serviceContext.promptHelper[key]
  //   }

  //   return response
  // }

  // private _getTreeIndexBuilderAndNodes(
  //   summaryTemplate: SummaryPrompt,
  //   queryStr: string,
  //   numChildren: number = 10
  // ): [GPTTreeIndexBuilder, Node[]] {
  //   const allText = this._texts.map(t => t.text).join('\n\n');
  //   const textSplitter = await this._serviceContext.promptHelper.getTextSplitterGivenPrompt(summaryTemplate, numChildren);
  //   const textChunks = await textSplitter.splitText(allText);
  //   const nodes = textChunks.map(t => new Node(t));

  //   const docstore = new DocumentStore();
  //   docstore.addDocuments(nodes, false);
  //   const indexBuilder = new GPTTreeIndexBuilder(
  //     numChildren,
  //     summaryTemplate,
  //     this._serviceContext,
  //     docstore,
  //     this._useAsync
  //   );

  //   return [indexBuilder, nodes];
  // }

  // private _getTreeResponseOverRootNodes(
  //   queryStr: string,
  //   prevResponse: string | null,
  //   rootNodes: Record<number, Node>,
  //   textQATemplate: QuestionAnswerPrompt
  // ): RESPONSE_TEXT_TYPE {
  //   const nodeList = getSortedNodeList(rootNodes)
  //   const nodeText =
  //     await this._serviceContext.promptHelper.getTextFromNodes(
  //       nodeList,
  //       textQATemplate
  //     )
  //   const response = this.getResponseOverChunks(
  //     queryStr,
  //     [new TextChunk(nodeText)],
  //     prevResponse
  //   )

  //   if (typeof response === 'string') {
  //     return response || 'Empty Response'
  //   }

  //   return response
  // }

  // private _getResponseTreeSummarize(
  //   queryStr: string,
  //   prevResponse: string | null,
  //   numChildren: number = 10
  // ): RESPONSE_TEXT_TYPE {
  //   const textQATemplate = this.textQaTemplate.partialFormat({ queryStr });
  //   const summaryTemplate = await SummaryPrompt.from_prompt(textQATemplate);

  //   const [indexBuilder, nodes] = this._getTreeIndexBuilderAndNodes(summaryTemplate, queryStr, numChildren);
  //   const indexGraph = new IndexGraph();
  //   nodes.forEach(node => indexGraph.insert(node));
  //   const newIndexGraph = indexBuilder.buildIndexFromNodes(indexGraph, indexGraph.all_nodes, indexGraph.all_nodes);
  //   const rootNodes = newIndexGraph.root_nodes.reduce((acc, node_id, index) => {
  //     acc[index] = indexBuilder.docstore.getNode(node_id);
  //     return acc;
  //   }, {} as Record<number, Node>);

  //   return this._getTreeResponseOverRootNodes(queryStr, prevResponse, rootNodes, textQATemplate);
  // }

  // async agetResponseTreeSummarize(
  //   queryStr: string,
  //   prevResponse: string | null,
  //   numChildren: number = 10
  // ): Promise<RESPONSE_TEXT_TYPE> {
  //   const textQATemplate = this.textQaTemplate.partialFormat({ queryStr });
  //   const summaryTemplate = await SummaryPrompt.from_prompt(textQATemplate);

  //   const [indexBuilder, nodes] = this._getTreeIndexBuilderAndNodes(summaryTemplate, queryStr, numChildren);
  //   const indexGraph = new IndexGraph();
  //   nodes.forEach(node => indexGraph.insert(node));
  //   const newIndexGraph = await indexBuilder.abuildIndexFromNodes(indexGraph, indexGraph.all_nodes, indexGraph.all_nodes);
  //   const rootNodes = newIndexGraph.root_nodes.reduce((acc, (node_id, index) => {
  //     acc[index] = indexBuilder.docstore.getNode(node_id);
  //     return acc;
  //     }, {} as Record<number, Node>);

  //     return this._getTreeResponseOverRootNodes(queryStr, prevResponse, rootNodes, textQATemplate);
  //   }

  async getResponse(
    queryStr: string,
    prevResponse: string | null = null,
    mode: ResponseMode = ResponseMode.DEFAULT,
    responseKwargs: any = {}
  ) {
    if (mode === ResponseMode.DEFAULT) {
      // hacking point
      return await this._getResponseDefault(queryStr, prevResponse)
    } else if (mode === ResponseMode.COMPACT) {
      return await this._getResponseDefault(queryStr, prevResponse)
    } else if (mode === ResponseMode.TREE_SUMMARIZE) {
      return null //this._getResponseTreeSummarize(queryStr, prevResponse, responseKwargs);
    } else {
      throw new Error(`Invalid mode: ${mode}`)
    }
  }

  async agetResponse(
    queryStr: string,
    prevResponse: string | null = null,
    mode: ResponseMode = ResponseMode.DEFAULT,
    responseKwargs: any = {}
  ) {
    if (mode === ResponseMode.DEFAULT) {
      return await this._getResponseDefault(queryStr, prevResponse)
    } else if (mode === ResponseMode.COMPACT) {
      return this._getResponseDefault(queryStr, prevResponse)
    } else if (mode === ResponseMode.TREE_SUMMARIZE) {
      // hacking point
      return this._getResponseDefault(queryStr, prevResponse)
      // return await this.agetResponseTreeSummarize(
      //   queryStr,
      //   prevResponse,
      //   responseKwargs
      // )
    } else {
      throw new Error(`Invalid mode: ${mode}`)
    }
  }
}
