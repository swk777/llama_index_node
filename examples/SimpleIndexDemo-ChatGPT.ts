import * as dotenv from 'dotenv'
import { SimpleDirectoryReader } from '../src/readers/file/SimpleDirectoryReader.js'
import { GPTSimpleVectorIndex } from '../src/vector_stores/GPTSimpleVectorIndex.js'
import LLMPredictor from '../src/llm_predictor/LLMPredictor.js'
import { ChatOpenAI } from 'langchain/chat_models/openai'
import ServiceContext from '../src/indices/ServiceContext.js'

dotenv.config()
const documents = new SimpleDirectoryReader('examples/data').loadData()
documents.then(async docs => {
  const llmPredictor = new LLMPredictor(
    new ChatOpenAI(
      { temperature: 0, modelName: 'gpt-3.5-turbo' },
      {
        basePath: process.env.BASE_PATH || 'https://api.openai.com/v1'
      }
    )
  )
  const serviceContext = ServiceContext.fromDefaults({
    llmPredictor,
    chunkSizeLimit: 512
  })
  const index = await GPTSimpleVectorIndex.fromDocuments({
    documents: docs,
    serviceContext
  })
  const response = await index.query({
    queryStr: 'What did the author do growing up?',
    serviceContext,
    similarityTopK: 3
  })
  console.log(response)
})
