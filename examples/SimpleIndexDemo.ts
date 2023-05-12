import * as dotenv from 'dotenv'
import { SimpleDirectoryReader } from '../src/readers/file/SimpleDirectoryReader.js'
import { GPTSimpleVectorIndex } from '../src/vector_stores/GPTSimpleVectorIndex.js'

dotenv.config()
const documents = new SimpleDirectoryReader('examples/data').loadData()
documents.then(async docs => {
  // STEP1
  let index = await GPTSimpleVectorIndex.fromDocuments({ documents: docs })
  index.saveToDisk('examples/index_simple.json')

  // STEP2
  index = GPTSimpleVectorIndex.loadFromDisk('examples/index_simple.json')
  const response = await index.query('What did the author do growing up?')
  console.log(response)
})
