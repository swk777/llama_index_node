import { PromptType } from '../../../data-struts/Prompt.js'
import { Prompt } from '../../../prompts/Prompt.js'

export class StepDecomposeQueryTransformPrompt extends Prompt {
  constructor(
    public template: string,
    public promptKwargs?: Record<string, any>
  ) {
    super({
      template,
      promptKwargs,
      inputVariables: ['context_str', 'query_str', 'prev_reasoning']
    })
    this.promptType = PromptType.CUSTOM
    this.inputVariables = ['context_str', 'query_str', 'prev_reasoning']
  }
}

const DEFAULT_STEP_DECOMPOSE_QUERY_TRANSFORM_TMPL: string = `
  The original question is as follows: {query_str}
  We have an opportunity to answer some, or all of the question from a 
  knowledge source. 
  Context information for the knowledge source is provided below, as 
  well as previous reasoning steps.
  Given the context and previous reasoning, return a question that can 
  be answered from 
  the context. This question can be the same as the original question, 
  or this question can represent a subcomponent of the overall question.
  It should not be irrelevant to the original question.
  If we cannot extract more information from the context, provide 'None' 
  as the answer. 
  Some examples are given below:

  Question: How many Grand Slam titles does the winner of the 2020 Australian 
  Open have?
  Knowledge source context: Provides names of the winners of the 2020 
  Australian Open
  Previous reasoning: None
  Next question: Who was the winner of the 2020 Australian Open? 

  Question: Who was the winner of the 2020 Australian Open?
  Knowledge source context: Provides names of the winners of the 2020 
  Australian Open
  Previous reasoning: None.
  New question: Who was the winner of the 2020 Australian Open? 

  Question: How many Grand Slam titles does the winner of the 2020 Australian 
  Open have?
  Knowledge source context: Provides information about the winners of the 2020 
  Australian Open
  Previous reasoning:
  - Who was the winner of the 2020 Australian Open? 
  - The winner of the 2020 Australian Open was Novak Djokovic.
  New question: None

  Question: How many Grand Slam titles does the winner of the 2020 Australian 
  Open have?
  Knowledge source context: Provides information about the winners of the 2020 
  Australian Open - includes biographical information for each winner
  Previous reasoning:
  - Who was the winner of the 2020 Australian Open? 
  - The winner of the 2020 Australian Open was Novak Djokovic.
  New question: How many Grand Slam titles does Novak Djokovic have? 

  Question: {query_str}
  Knowledge source context: {context_str}
  Previous reasoning: {prev_reasoning}
  New question: 
`

export const DEFAULT_STEP_DECOMPOSE_QUERY_TRANSFORM_PROMPT: StepDecomposeQueryTransformPrompt =
  new StepDecomposeQueryTransformPrompt(
    DEFAULT_STEP_DECOMPOSE_QUERY_TRANSFORM_TMPL
  )
