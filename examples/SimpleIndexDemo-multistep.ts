import * as dotenv from 'dotenv'
import { SimpleDirectoryReader } from '../src/readers/file/SimpleDirectoryReader.js'
import { GPTSimpleVectorIndex } from '../src/vector_stores/GPTSimpleVectorIndex.js'
import LLMPredictor from '../src/llm_predictor/LLMPredictor.js'
import ServiceContext from '../src/indices/ServiceContext.js'
import { OpenAI } from 'langchain/llms/openai'
import { StepDecomposeQueryTransform } from '../src/indices/query/query-transform/StepDecomposeQueryTransform.js'

dotenv.config()
const documents = new SimpleDirectoryReader('examples/data').loadData()
documents.then(async docs => {
  const llmPredictorGpt3 = new LLMPredictor(
    new OpenAI(
      { temperature: 0, modelName: 'text-davinci-003' },
      {
        basePath: process.env.BASE_PATH || 'https://api.openai.com/v1'
      }
    )
  )
  const serviceContext = ServiceContext.fromDefaults({
    llmPredictor: llmPredictorGpt3
  })
  const index = await GPTSimpleVectorIndex.fromDocuments({
    documents: docs
  })
  const stepDecomposeTransform = new StepDecomposeQueryTransform(
    llmPredictorGpt3,
    undefined,
    true
  )
  index.indexStruct.summary = 'Used to answer questions about the author'
  const responseGpt3 = await index.query({
    queryStr: 'In which city did the author found his first company, Viaweb?',
    queryTransform: stepDecomposeTransform,
    serviceContext: serviceContext
  })
  console.log(responseGpt3)
})
