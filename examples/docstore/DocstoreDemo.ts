import * as dotenv from 'dotenv'
import { ChatOpenAI } from 'langchain/chat_models/openai'

import { SimpleDirectoryReader } from '../../src/readers/file/SimpleDirectoryReader.js'
import SimpleNodeParser from '../../src/node_parser/SimpleNodeParser.js'
import { DocumentStore } from '../../src/DocumentStore.js'
import GPTListIndex from '../../src/indices/list/GPTListIndex.js'
import LLMPredictor from '../../src/llm_predictor/LLMPredictor.js'
import ServiceContext from '../../src/indices/ServiceContext.js'
import GPTSimpleKeywordTableIndex from '../../src/indices/keyword_table/GPTSimpleKeywordTableIndex.js'

dotenv.config()
// Load Documents
const documents = new SimpleDirectoryReader('examples/data').loadData()
documents.then(async docs => {
  // Parse into Nodes
  const nodes = await new SimpleNodeParser().getNodesFromDocuments(docs)
  // Add to Docstore
  const docstore = new DocumentStore()
  docstore.addDocuments(nodes)

  // Define Multiple Indexes
  // Each index uses the same underlying Node.
  // @ts-ignore
  const listIndex = await new GPTListIndex({ nodes, docstore })

  // Test out some Queries
  const llmPredictorChatgpt = new LLMPredictor(
    new ChatOpenAI(
      { temperature: 0, modelName: 'gpt-3.5-turbo' },
      {
        basePath: process.env.BASE_PATH || 'https://api.openai.com/v1'
      }
    )
  )
  const serviceContextChatgpt = ServiceContext.fromDefaults({
    llmPredictor: llmPredictorChatgpt,
    chunkSizeLimit: 1024
  })

  // List response
  const responseList = await listIndex.query({
    queryStr: 'What is a summary of this document?',
    // @ts-ignore
    serviceContext: serviceContextChatgpt
  })
  console.log(responseList)

  const keywordTableIndex = await new GPTSimpleKeywordTableIndex({
    nodes,
    //@ts-ignore
    docstore
  })

  // Keyword response
  const responseKeyword = await keywordTableIndex.query({
    queryStr: 'What did the author do after his time at YC?',
    // @ts-ignore
    serviceContext: serviceContextChatgpt
  })
  console.log(responseKeyword)
})
