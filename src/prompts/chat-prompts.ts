import {
  HumanMessagePromptTemplate,
  AIMessagePromptTemplate,
  ChatPromptTemplate
} from 'langchain/prompts'
import { RefinePrompt } from './prompts.js'

export const CHAT_REFINE_PROMPT_TMPL_MSGS = [
  HumanMessagePromptTemplate.fromTemplate('{queryStr}'),
  AIMessagePromptTemplate.fromTemplate('{existingAnswer}'),
  HumanMessagePromptTemplate.fromTemplate(
    'We have the opportunity to refine the above answer ' +
      '(only if needed) with some more context below.\n' +
      '------------\n' +
      '{contextMsg}\n' +
      '------------\n' +
      'Given the new context, refine the original answer to better ' +
      'answer the question. ' +
      "If the context isn't useful, output the original answer again."
  )
]

export const CHAT_REFINE_PROMPT_LC = ChatPromptTemplate.fromPromptMessages(
  CHAT_REFINE_PROMPT_TMPL_MSGS
)
export const CHAT_REFINE_PROMPT = RefinePrompt.from_langchain_prompt(
  CHAT_REFINE_PROMPT_LC
)
