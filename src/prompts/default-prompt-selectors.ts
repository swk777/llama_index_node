import { ConditionalPromptSelector } from '../from-langchain/selector.js'
import { isChatModel } from '../utils.js'
import { CHAT_REFINE_PROMPT } from './chat-prompts.js'
import { DEFAULT_REFINE_PROMPT } from './defaultPrompts.js'
import { RefinePrompt } from './prompts.js'

const DEFAULT_REFINE_PROMPT_SEL_LC = new ConditionalPromptSelector(
  DEFAULT_REFINE_PROMPT.getLangchainPrompt(),
  [[isChatModel, CHAT_REFINE_PROMPT.getLangchainPrompt()]]
)

export const DEFAULT_REFINE_PROMPT_SEL = new RefinePrompt({
  langchainPromptSelector: DEFAULT_REFINE_PROMPT_SEL_LC
})
