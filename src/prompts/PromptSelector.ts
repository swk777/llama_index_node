import { BasePromptTemplate } from 'langchain/prompts'
import { BaseLanguageModel } from 'langchain/base_language'

export abstract class BasePromptSelector {
  abstract getPrompt(llm: BaseLanguageModel): BasePromptTemplate
}

export class ConditionalPromptSelector extends BasePromptSelector {
  defaultPrompt: BasePromptTemplate

  conditionals: Array<
    [condition: (llm: BaseLanguageModel) => boolean, prompt: BasePromptTemplate]
  >

  constructor(
    default_prompt: BasePromptTemplate,
    conditionals: Array<
      [
        condition: (llm: BaseLanguageModel) => boolean,
        prompt: BasePromptTemplate
      ]
    > = []
  ) {
    super()
    this.defaultPrompt = default_prompt
    this.conditionals = conditionals
  }

  getPrompt(llm: BaseLanguageModel): BasePromptTemplate {
    for (const [condition, prompt] of this.conditionals) {
      if (condition(llm)) {
        return prompt
      }
    }
    return this.defaultPrompt
  }
}

export function isLLM(llm: BaseLanguageModel): llm is BaseLanguageModel {
  return llm instanceof BaseLanguageModel
}
