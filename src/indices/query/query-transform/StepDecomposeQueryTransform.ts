import LLMPredictor from '../../../llm_predictor/LLMPredictor.js'
import { QueryBundle } from '../schema.js'
import { Response } from '../../../response/schema.js'
import { V2IndexStruct as IndexStruct } from '../../../data-struts/data-structure.js'
import { BaseQueryTransform } from './BaseQueryTransform.js'
import {
  DEFAULT_STEP_DECOMPOSE_QUERY_TRANSFORM_PROMPT,
  StepDecomposeQueryTransformPrompt
} from './prompts.js'

export class StepDecomposeQueryTransform extends BaseQueryTransform {
  private llmPredictor: LLMPredictor
  private stepDecomposeQueryPrompt: StepDecomposeQueryTransformPrompt
  public verbose: boolean

  constructor(
    llmPredictor?: LLMPredictor,
    stepDecomposeQueryPrompt?: StepDecomposeQueryTransformPrompt,
    verbose: boolean = false
  ) {
    super()
    this.llmPredictor = llmPredictor || new LLMPredictor()
    this.stepDecomposeQueryPrompt =
      stepDecomposeQueryPrompt || DEFAULT_STEP_DECOMPOSE_QUERY_TRANSFORM_PROMPT
    this.verbose = verbose
  }
  // @ts-ignore
  public async _run(queryBundle: QueryBundle, extraInfo: Record<string, any>) {
    const indexStruct = extraInfo['index_struct'] as IndexStruct
    const indexText = indexStruct.getSummary()
    const prevReasoning = extraInfo['prev_reasoning'] as Response
    const fmtPrevReasoning = prevReasoning ? `\n${prevReasoning}` : 'None'

    const queryStr = queryBundle.queryStr
    const [newQueryStr, formattedPrompt] = await this.llmPredictor.predict(
      this.stepDecomposeQueryPrompt,
      { fmtPrevReasoning, queryStr, indexText }
    )

    if (this.verbose) {
      console.log(`> Current query: ${queryStr}\n`)
      console.log(`> Formatted prompt: ${formattedPrompt}\n`)
      console.log(`> New query: ${newQueryStr}\n`)
    }

    return new QueryBundle(newQueryStr, queryBundle.customEmbeddingStrs)
  }
}
