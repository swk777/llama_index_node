import { SimpleDirectoryReader } from '../src/readers/file/SimpleDirectoryReader.js'

const documents = new SimpleDirectoryReader('examples/types').loadData()
documents.then(async docs => {
  console.log(docs)
})
