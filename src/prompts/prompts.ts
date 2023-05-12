import { BasePromptTemplate } from 'langchain/prompts'
import { PromptType } from '../data-struts/Prompt.js'
import { Prompt } from './Prompt.js'
import { ConditionalPromptSelector } from './PromptSelector.js'
import { BaseOutputParser } from '../output_parser/output-parser.js'

export class SummaryPrompt extends Prompt {
  static promptType: PromptType = PromptType.SUMMARY
  static inputVariables: string[] = ['contextStr']

  constructor(
    template: string | null = null,
    langchainPrompt: BasePromptTemplate | null = null,
    langchainPromptSelector: ConditionalPromptSelector | null = null,
    stopToken: string | null = null,
    outputParser: BaseOutputParser | null = null,
    promptKwargs: any = {}
  ) {
    super({
      template,
      langchainPrompt,
      langchainPromptSelector,
      stopToken,
      outputParser,
      promptKwargs
    })
  }
}

export class RefinePrompt extends Prompt {
  promptType: PromptType = PromptType.REFINE
  inputVariables: string[] = ['queryStr', 'existingAnswer', 'contextMsg']

  constructor({
    template,
    langchainPrompt,
    langchainPromptSelector,
    stopToken,
    outputParser,
    promptKwargs = {},
    promptType,
    inputVariables
  }: {
    template?: string
    langchainPrompt?: BasePromptTemplate
    langchainPromptSelector?: ConditionalPromptSelector
    stopToken?: string
    outputParser?: BaseOutputParser
    promptKwargs?: any
    promptType?: PromptType
    inputVariables?: string[]
  }) {
    super({
      template,
      langchainPrompt,
      langchainPromptSelector,
      stopToken,
      outputParser,
      inputVariables: inputVariables || [
        'queryStr',
        'existingAnswer',
        'contextMsg'
      ],
      promptKwargs
    })
    this.promptType = promptType
    this.inputVariables = inputVariables
  }
}
