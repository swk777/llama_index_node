import ServiceContext from '../../../indices/ServiceContext.js'
import { V2IndexStruct as IndexStruct } from '../../../data-struts/data-structure.js'
import QueryRunner from '../QueryRunner.js'
import {
  BaseQueryTransform,
  IdentityQueryTransform
} from '../query-transform/BaseQueryTransform.js'
import { QueryBundle } from '../schema.js'
import { QuestionAnswerPrompt } from '../../../prompts/Prompt.js'
import { DEFAULT_TEXT_QA_PROMPT } from '../../../prompts/defaultPrompts.js'
import { Response } from '../../../response/schema.js'
import {
  ResponseBuilder,
  ResponseMode,
  TextChunk
} from '../../../indices/response/builder.js'
import { RefinePrompt } from '../../../prompts/prompts.js'
import { DEFAULT_REFINE_PROMPT_SEL } from '../../../prompts/default-prompt-selectors.js'

type RESPONSE_TYPE = any // Replace 'any' with the appropriate type if known

export abstract class BaseQueryCombiner {
  protected _indexStruct: IndexStruct
  protected _queryTransform: BaseQueryTransform
  protected _queryRunner: QueryRunner

  constructor(
    indexStruct: IndexStruct,
    queryTransform: BaseQueryTransform,
    queryRunner: QueryRunner
  ) {
    this._indexStruct = indexStruct
    this._queryTransform = queryTransform
    this._queryRunner = queryRunner
  }

  abstract run(queryBundle: QueryBundle, level: number): RESPONSE_TYPE

  async arun(
    queryBundle: QueryBundle,
    level: number = 0
  ): Promise<RESPONSE_TYPE> {
    return this.run(queryBundle, level)
  }
}
export class SingleQueryCombiner extends BaseQueryCombiner {
  private _prepareUpdate(queryBundle: QueryBundle): QueryBundle {
    const transformExtraInfo = {
      indexStruct: this._indexStruct
    }
    const updatedQueryBundle = new IdentityQueryTransform().call(queryBundle, {
      extraInfo: transformExtraInfo
    })
    return updatedQueryBundle
  }

  run(queryBundle: QueryBundle, level: number = 0): RESPONSE_TYPE {
    const updatedQueryBundle = this._prepareUpdate(queryBundle)
    return this._queryRunner.queryTransformed(
      updatedQueryBundle,
      this._indexStruct,
      level
    )
  }

  async arun(
    queryBundle: QueryBundle,
    level: number = 0
  ): Promise<RESPONSE_TYPE> {
    const updatedQueryBundle = this._prepareUpdate(queryBundle)
    return await this._queryRunner.queryTransformed(
      updatedQueryBundle,
      this._indexStruct,
      level
    )
  }
}

export function defaultStopFn(stopDict: Record<string, unknown>): boolean {
  const queryBundle = stopDict['queryBundle'] as QueryBundle | undefined

  if (!queryBundle) {
    throw new Error('Response must be provided to stop function.')
  }

  if (queryBundle.queryStr.toLowerCase().includes('none')) {
    return true
  } else {
    return false
  }
}

type Callable = (input: Record<string, unknown>) => boolean

export class MultiStepQueryCombiner extends BaseQueryCombiner {
  private _serviceContext: ServiceContext | undefined
  private _numSteps: number | undefined
  private _earlyStopping: boolean
  private _stopFn: Callable
  private _responseMode: ResponseMode
  private textQaTemplate: QuestionAnswerPrompt
  private refineTemplate: RefinePrompt
  private responseBuilder: ResponseBuilder
  private _responseKwargs: Record<string, unknown>

  constructor(
    indexStruct: IndexStruct,
    queryTransform: BaseQueryTransform,
    queryRunner: any,
    serviceContext?: ServiceContext,
    textQaTemplate?: QuestionAnswerPrompt,
    refineTemplate?: RefinePrompt,
    responseMode: ResponseMode = ResponseMode.DEFAULT,
    responseKwargs: Record<string, unknown> = {},
    numSteps: number = 3,
    earlyStopping: boolean = true,
    stopFn?: Callable,
    useAsync: boolean = true
  ) {
    super(indexStruct, queryTransform, queryRunner)

    this._serviceContext = serviceContext || ServiceContext.fromDefaults({})
    this._numSteps = numSteps
    this._earlyStopping = earlyStopping
    this._stopFn = stopFn || defaultStopFn

    if (!this._earlyStopping && this._numSteps === undefined) {
      throw new Error('Must specify numSteps if earlyStopping is False.')
    }

    this._responseMode = ResponseMode[responseMode]

    this.textQaTemplate = textQaTemplate || DEFAULT_TEXT_QA_PROMPT
    this.refineTemplate = refineTemplate || DEFAULT_REFINE_PROMPT_SEL
    this.responseBuilder = new ResponseBuilder({
      serviceContext: this._serviceContext,
      textQaTemplate: this.textQaTemplate,
      refineTemplate: this.refineTemplate,
      useAsync
    })
    this._responseKwargs = responseKwargs
  }

  private _combineQueries(
    queryBundle: QueryBundle,
    prevReasoning: string
  ): QueryBundle {
    const transformExtraInfo = {
      indexStruct: this._indexStruct,
      prevReasoning: prevReasoning
    }
    const updatedQueryBundle = new IdentityQueryTransform().call(queryBundle, {
      extraInfo: transformExtraInfo
    })
    return updatedQueryBundle
  }

  async run(queryBundle: QueryBundle, level: number = 0) {
    let prevReasoning = ''
    let curResponse = null
    let shouldStop = false
    let curSteps = 0

    this.responseBuilder.reset()
    const final_response_extra_info: Record<string, any> = { sub_qa: [] }

    while (!shouldStop) {
      if (this._numSteps !== undefined && curSteps >= this._numSteps) {
        shouldStop = true
        break
      } else if (shouldStop) {
        break
      }

      const updatedQueryBundle = this._combineQueries(
        queryBundle,
        prevReasoning
      )

      const stopDict = { queryBundle: updatedQueryBundle }
      if (this._stopFn(stopDict)) {
        shouldStop = true
        break
      }

      curResponse = this._queryRunner.queryTransformed(
        updatedQueryBundle,
        this._indexStruct,
        level
      )
      const cur_qa_text = `\nQuestion: ${
        updatedQueryBundle.queryStr
      }\nAnswer: ${String(curResponse)}`
      this.responseBuilder.addTextChunks([new TextChunk(cur_qa_text)])
      for (const source_node of curResponse.sourceNodes) {
        this.responseBuilder.addNodeWithScore(source_node)
      }
      final_response_extra_info.sub_qa.push([
        updatedQueryBundle.queryStr,
        curResponse
      ])

      prevReasoning += `- ${updatedQueryBundle.queryStr}\n- ${String(
        curResponse
      )}\n`
      curSteps += 1
    }

    const final_response_str = await this.responseBuilder.getResponse(
      queryBundle.queryStr,
      undefined,
      this._responseMode,
      this._responseKwargs
    )

    // if (final_response_str instanceof Generator) {
    //   throw new Error(
    //     'Currently streaming is not supported for query combiner.'
    //   )
    // }

    return new Response(
      final_response_str,
      this.responseBuilder.getSources(),
      final_response_extra_info
    )
  }
}

export function getDefaultQueryCombiner(
  indexStruct: IndexStruct,
  queryTransform: BaseQueryTransform,
  queryRunner: any, // NOTE: type as any to avoid circular dependency
  extraKwargs: Record<string, any> | null = null
): BaseQueryCombiner {
  extraKwargs = extraKwargs || {}

  // if (queryTransform instanceof StepDecomposeQueryTransform) {
  //   return new MultiStepQueryCombiner(
  //     indexStruct,
  //     queryTransform,
  //     queryRunner,
  //     extraKwargs["serviceContext"] || null,
  //   );
  // } else {
  return new SingleQueryCombiner(indexStruct, queryTransform, queryRunner)
  // }
}
