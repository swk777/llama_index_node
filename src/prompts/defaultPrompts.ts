import { QuestionAnswerPrompt } from './Prompt.js'
import {
  KeywordExtractPrompt,
  QueryKeywordExtractPrompt,
  RefinePrompt
} from './prompts.js'

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

const DEFAULT_KEYWORD_EXTRACT_TEMPLATE_TMPL =
  'Some text is provided below. Given the text, extract up to {max_keywords} ' +
  'keywords from the text. Avoid stopwords.' +
  '---------------------\n' +
  '{text}\n' +
  '---------------------\n' +
  "Provide keywords in the following comma-separated format: 'KEYWORDS: <keywords>'\n"

export const DEFAULT_KEYWORD_EXTRACT_TEMPLATE: KeywordExtractPrompt =
  new KeywordExtractPrompt(DEFAULT_KEYWORD_EXTRACT_TEMPLATE_TMPL)

const DEFAULT_QUERY_KEYWORD_EXTRACT_TEMPLATE_TMPL =
  'A question is provided below. Given the question, extract up to {max_keywords} ' +
  'keywords from the text. Focus on extracting the keywords that we can use ' +
  'to best lookup answers to the question. Avoid stopwords.\n' +
  '---------------------\n' +
  '{question}\n' +
  '---------------------\n' +
  "Provide keywords in the following comma-separated format: 'KEYWORDS: <keywords>'\n"

export const DEFAULT_QUERY_KEYWORD_EXTRACT_TEMPLATE =
  new QueryKeywordExtractPrompt(DEFAULT_QUERY_KEYWORD_EXTRACT_TEMPLATE_TMPL)
