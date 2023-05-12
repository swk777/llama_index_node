import { QuestionAnswerPrompt } from './Prompt.js'
import { RefinePrompt } from './prompts.js'

const DEFAULT_TEXT_QA_PROMPT_TMPL =
  'Context information is below. \n' +
  '---------------------\n' +
  '{contextStr}' +
  '\n---------------------\n' +
  'Given the context information and not prior knowledge, ' +
  'answer the question: {queryStr}\n'

export const DEFAULT_TEXT_QA_PROMPT = new QuestionAnswerPrompt(
  DEFAULT_TEXT_QA_PROMPT_TMPL
)
export const DEFAULT_REFINE_PROMPT_TMPL =
  'The original question is as follows: {queryStr}\n' +
  'We have provided an existing answer: {existingAnswer}\n' +
  'We have the opportunity to refine the existing answer ' +
  '(only if needed) with some more context below.\n' +
  '------------\n' +
  '{contextMsg}\n' +
  '------------\n' +
  'Given the new context, refine the original answer to better ' +
  'answer the question. ' +
  "If the context isn't useful, return the original answer."

export const DEFAULT_REFINE_PROMPT = new RefinePrompt({
  template: DEFAULT_REFINE_PROMPT_TMPL
})
