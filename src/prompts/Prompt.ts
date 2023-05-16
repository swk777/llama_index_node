// import { BasePromptTemplate, PromptTemplate, ConditionalPromptSelector, BaseLanguageModel } from "langchain";
import { BasePromptTemplate, PromptTemplate } from 'langchain/prompts'
import { BaseLanguageModel } from 'langchain/base_language'

import { ConditionalPromptSelector } from './PromptSelector.js'
import { PromptType } from '../data-struts/Prompt.js'
import { BaseOutputParser } from '../output_parser/output-parser.js'

type PMT = Prompt

export class Prompt {
  inputVariables: string[]
  promptType?: string = PromptType.CUSTOM
  promptSelector?: ConditionalPromptSelector
  prompt?: BasePromptTemplate
  partialDict?: { [key: string]: any } = {}
  promptKwargs?: any
  stopToken?: string
  outputParser?: BaseOutputParser

  constructor({
    template,
    langchainPrompt,
    langchainPromptSelector,
    stopToken,
    outputParser,
    inputVariables,
    promptKwargs = {}
  }: {
    template?: string
    langchainPrompt?: BasePromptTemplate
    langchainPromptSelector?: ConditionalPromptSelector
    stopToken?: string
    outputParser?: BaseOutputParser
    inputVariables?: string[]
    promptKwargs?: any
  }) {
    this.inputVariables = inputVariables
    // first check if langchainPromptSelector is provided
    if (langchainPromptSelector) {
      this.promptSelector = langchainPromptSelector
      this.prompt = this.promptSelector.defaultPrompt
    }
    // then check if template is provided
    else if (!langchainPrompt) {
      // hacking point
      // if (!template) {
      //   throw new Error(
      //     'template must be specified if langchainPrompt is None'
      //   )
      // }
      this.prompt = new PromptTemplate({
        inputVariables: this.inputVariables || ['contextStr', 'queryStr'],
        template,
        ...promptKwargs
      })
      this.promptSelector = new ConditionalPromptSelector(this.prompt)
    }
    // finally, check if langchainPrompt is provided
    else {
      if (template) {
        throw new Error(
          'Both template and langchainPrompt are provided, only one should be.'
        )
      }
      this.prompt = langchainPrompt
      this.promptSelector = new ConditionalPromptSelector(this.prompt)
    }

    this.promptKwargs = promptKwargs
    this.stopToken = stopToken
    this.outputParser = outputParser
  }

  static from_langchain_prompt(
    prompt: BasePromptTemplate,
    restArgs: any = {}
  ): PMT {
    return new Prompt({ langchainPrompt: prompt, promptKwargs: restArgs })
  }

  static fromLangchainPromptSelector(
    promptSelector: ConditionalPromptSelector,
    restArgs: any = {}
  ): PMT {
    return new Prompt({
      langchainPromptSelector: promptSelector,
      promptKwargs: restArgs
    })
  }

  partialFormat(args: any): PMT {
    // hacking point
    const copyObj = new Prompt({ template: '' })
    Object.assign(copyObj, this)
    Object.assign(copyObj.partialDict, args)
    return copyObj
  }

  static async from_prompt(prompt: Prompt, llm?: BaseLanguageModel) {
    const lcPrompt = prompt.getLangchainPrompt(llm)
    const tmplVars = lcPrompt.inputVariables
    const format_dict: { [key: string]: string } = {}

    tmplVars.forEach((vars: string) => {
      if (!(vars in prompt.partialDict)) {
        format_dict[vars] = `{${vars}}`
      }
    })
    const templateStr = await prompt.format(llm, format_dict)

    return new Prompt({
      template: templateStr,
      promptKwargs: prompt.promptKwargs
    })
  }

  getLangchainPrompt(llm?: BaseLanguageModel): BasePromptTemplate {
    if (!llm) {
      return this.promptSelector!.defaultPrompt
    }
    return this.promptSelector!.getPrompt(llm)
  }

  async format(llm?: BaseLanguageModel, restArgs: any = {}) {
    const lcPrompt = this.getLangchainPrompt(llm)
    return await lcPrompt.format({ ...this.partialDict, ...restArgs })
  }

  getFullFormatArgs(restArgs: { [key: string]: any }): { [key: string]: any } {
    const args = { ...this.partialDict, ...restArgs }
    if (this.stopToken) {
      args['stop'] = this.stopToken
    }
    return args
  }
}

export class QuestionAnswerPrompt extends Prompt {
  constructor(template: string, ...promptKwargs: any[]) {
    super({ template, ...promptKwargs })
    this.promptType = PromptType.QUESTION_ANSWER
    this.inputVariables = ['contextStr', 'queryStr']
  }
}
