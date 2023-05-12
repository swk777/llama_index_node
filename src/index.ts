import * as dotenv from 'dotenv'

// import SimpleNodeParser from './node_parser/SimpleNodeParser.js'
import { SimpleDirectoryReader } from './readers/file/SimpleDirectoryReader.js'
import { GPTSimpleVectorIndex } from './vector_stores/GPTSimpleVectorIndex.js'
// import { QueryBundle } from '../src/indices/query/schema.js'
// import SimpleDirectoryReader from './SimpleDirectoryReader'

dotenv.config()
const documents = new SimpleDirectoryReader('./examples/data').loadData()
documents.then(async docs => {
  // const nodes = await new SimpleNodeParser().getNodesFromDocuments(docs)
  const index = await GPTSimpleVectorIndex.fromDocuments({ documents: docs })
  index.saveToDisk('index_simple.json')

  // const index = GPTSimpleVectorIndex.loadFromDisk('index_simple.json')
  // // const response = await index.query('What did the author do growing up?')

  // const query_bundle = new QueryBundle('What did the author do growing up?', [
  //   'The author grew up painting.'
  // ])
  // const response = index.query(query_bundle)
  // console.log(response)
})
