import * as dotenv from 'dotenv'
import { SimpleDirectoryReader } from '../src/readers/file/SimpleDirectoryReader.js'
import { GPTSimpleVectorIndex } from '../src/vector_stores/GPTSimpleVectorIndex.js'
import { QueryBundle } from '../src/indices/query/schema.js'

dotenv.config()
const documents = new SimpleDirectoryReader('examples/data').loadData()
documents.then(async docs => {
  // STEP1
  let index = await GPTSimpleVectorIndex.fromDocuments({ documents: docs })
  index.saveToDisk('examples/index_simple.json')

  // STEP2
  index = GPTSimpleVectorIndex.loadFromDisk('examples/index_simple.json')
  let response = await index.query({
    queryStr: 'What did the author do growing up?'
  })
  console.log(response)

  // STEP3
  const queryBundle = new QueryBundle('What did the author do growing up?', [
    'The author grew up painting.'
  ])
  response = await index.query({ queryStr: queryBundle })
  console.log(response)
  console.log(response.getFormattedSources())
})
