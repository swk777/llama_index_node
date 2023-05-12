import { BasePromptTemplate } from 'langchain'
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
    defaultPrompt: BasePromptTemplate,
    conditionals: Array<
      [
        condition: (llm: BaseLanguageModel) => boolean,
        prompt: BasePromptTemplate
      ]
    > = []
  ) {
    super()
    this.defaultPrompt = defaultPrompt
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
