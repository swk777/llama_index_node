export enum IndexStructType {
  NODE = 'node',
  TREE = 'tree',
  LIST = 'list',
  KEYWORD_TABLE = 'keyword_table',

  // Faiss
  DICT = 'dict',
  // Simple
  SIMPLE_DICT = 'simple_dict',
  WEAVIATE = 'weaviate',
  PINECONE = 'pinecone',
  QDRANT = 'qdrant',
  CHROMA = 'chroma',
  VECTOR_STORE = 'vectorStore',
  OPENSEARCH = 'opensearch',
  CHATGPT_RETRIEVAL_PLUGIN = 'chatgpt_retrieval_plugin',

  // For SQL index
  SQL = 'sql',
  // For KG index
  KG = 'kg',

  // EMPTY
  EMPTY = 'empty',
  COMPOSITE = 'composite',

  PANDAS = 'pandas'
}
