import BaseEmbedding from './BaseEmbedding.js'
import Openai from '../openai/Openai.js'
enum OpenAIEmbeddingMode {
  SIMILARITY_MODE = 'similarity',
  TEXT_SEARCH_MODE = 'text_search'
}

enum OpenAIEmbeddingModelType {
  DAVINCI = 'davinci',
  CURIE = 'curie',
  BABBAGE = 'babbage',
  ADA = 'ada',
  TEXT_EMBED_ADA_002 = 'text-embedding-ada-002'
}

enum OpenAIEmbeddingModeModel {
  TEXT_SIMILARITY_DAVINCI = 'text-similarity-davinci-001',
  TEXT_SEARCH_DAVINCI_QUERY = 'text-search-davinci-query-001',
  TEXT_SEARCH_DAVINCI_DOC = 'text-search-davinci-doc-001',

  TEXT_SIMILARITY_CURIE = 'text-similarity-curie-001',
  TEXT_SEARCH_CURIE_QUERY = 'text-search-curie-query-001',
  TEXT_SEARCH_CURIE_DOC = 'text-search-curie-doc-001',

  TEXT_SIMILARITY_BABBAGE = 'text-similarity-babbage-001',
  TEXT_SEARCH_BABBAGE_QUERY = 'text-search-babbage-query-001',
  TEXT_SEARCH_BABBAGE_DOC = 'text-search-babbage-doc-001',

  TEXT_SIMILARITY_ADA = 'text-similarity-ada-001',
  TEXT_SEARCH_ADA_QUERY = 'text-search-ada-query-001',
  TEXT_SEARCH_ADA_DOC = 'text-search-ada-doc-001',

  TEXT_EMBED_ADA_002 = 'text-embedding-ada-002'
}

const OAEM = OpenAIEmbeddingMode
// const OAEMT = OpenAIEmbeddingModelType
const OAEMM = OpenAIEmbeddingModeModel

// const EMBED_MAX_TOKEN_LIMIT = 2048

const QUERY_MODE_MODEL_DICT: Record<string, OpenAIEmbeddingModeModel> = {
  [`${OAEM.SIMILARITY_MODE},davinci`]: OAEMM.TEXT_SIMILARITY_DAVINCI,
  [`${OAEM.SIMILARITY_MODE},curie`]: OAEMM.TEXT_SIMILARITY_CURIE,
  [`${OAEM.SIMILARITY_MODE},babbage`]: OAEMM.TEXT_SIMILARITY_BABBAGE,
  [`${OAEM.SIMILARITY_MODE},ada`]: OAEMM.TEXT_SIMILARITY_ADA,
  [`${OAEM.SIMILARITY_MODE},text-embedding-ada-002`]: OAEMM.TEXT_EMBED_ADA_002,
  [`${OAEM.TEXT_SEARCH_MODE},davinci`]: OAEMM.TEXT_SEARCH_DAVINCI_QUERY,
  [`${OAEM.TEXT_SEARCH_MODE},curie`]: OAEMM.TEXT_SEARCH_CURIE_QUERY,
  [`${OAEM.TEXT_SEARCH_MODE},babbage`]: OAEMM.TEXT_SEARCH_BABBAGE_QUERY,
  [`${OAEM.TEXT_SEARCH_MODE},ada`]: OAEMM.TEXT_SEARCH_ADA_QUERY,
  [`${OAEM.TEXT_SEARCH_MODE},text-embedding-ada-002`]: OAEMM.TEXT_EMBED_ADA_002
}

const TEXT_MODE_MODEL_DICT: Record<string, OpenAIEmbeddingModeModel> = {
  [`${OAEM.SIMILARITY_MODE},davinci`]: OAEMM.TEXT_SIMILARITY_DAVINCI,
  [`${OAEM.SIMILARITY_MODE},curie`]: OAEMM.TEXT_SIMILARITY_CURIE,
  [`${OAEM.SIMILARITY_MODE},babbage`]: OAEMM.TEXT_SIMILARITY_BABBAGE,
  [`${OAEM.SIMILARITY_MODE},ada`]: OAEMM.TEXT_SIMILARITY_ADA,
  [`${OAEM.SIMILARITY_MODE},text-embedding-ada-002`]: OAEMM.TEXT_EMBED_ADA_002,
  [`${OAEM.TEXT_SEARCH_MODE},davinci`]: OAEMM.TEXT_SEARCH_DAVINCI_DOC,
  [`${OAEM.TEXT_SEARCH_MODE},curie`]: OAEMM.TEXT_SEARCH_CURIE_DOC,
  [`${OAEM.TEXT_SEARCH_MODE},babbage`]: OAEMM.TEXT_SEARCH_BABBAGE_DOC,
  [`${OAEM.TEXT_SEARCH_MODE},ada`]: OAEMM.TEXT_SEARCH_ADA_DOC,
  [`${OAEM.TEXT_SEARCH_MODE},text-embedding-ada-002`]: OAEMM.TEXT_EMBED_ADA_002
}

async function getEmbedding(
  text: string,
  engine?: string | null
): Promise<number[]> {
  text = text.replace('\n', ' ')
  const response = await Openai.getInstance().createEmbedding({
    input: [text],
    model: engine
  })
  return response.data?.data[0].embedding
}

async function agetEmbedding(
  text: string,
  engine?: string | null
): Promise<number[]> {
  text = text.replace('\n', ' ')
  const response = await Openai.getInstance().createEmbedding({
    input: [text],
    model: engine
  })
  return response.data?.data[0].embedding
}

async function getEmbeddings(list_of_text: string[], engine?: string | null) {
  if (list_of_text.length > 2048) {
    throw new Error('The batch size should not be larger than 2048.')
  }

  list_of_text = list_of_text.map(text => text.replace('\n', ' '))

  const response = await Openai.getInstance().createEmbedding({
    input: list_of_text,
    model: engine
  })
  const data = response.data?.data?.sort((a, b) => a.index - b.index)
  return data.map(d => d.embedding)
}

async function agetEmbeddings(list_of_text: string[], engine?: string | null) {
  if (list_of_text.length > 2048) {
    throw new Error('The batch size should not be larger than 2048.')
  }

  list_of_text = list_of_text.map(text => text.replace('\n', ' '))

  const response = await Openai.getInstance().createEmbedding({
    input: list_of_text,
    model: engine
  })
  const data = response.data?.data?.sort((a, b) => a.index - b.index)
  return data.map(d => d.embedding)
}

type Optional<T> = T | null

export default class OpenAIEmbedding extends BaseEmbedding {
  mode: OpenAIEmbeddingMode
  model: OpenAIEmbeddingModelType
  deploymentName: Optional<string>

  constructor(
    mode: OpenAIEmbeddingMode = OpenAIEmbeddingMode.TEXT_SEARCH_MODE,
    model: OpenAIEmbeddingModelType = OpenAIEmbeddingModelType.TEXT_EMBED_ADA_002,
    deploymentName: Optional<string> = null,
    restArgs: any = {}
  ) {
    super(restArgs)
    this.mode = mode // OpenAIEmbeddingMode[mode as keyof typeof OpenAIEmbeddingMode]
    this.model = model
    this.deploymentName = deploymentName
  }

  async _getQueryEmbedding(query: string) {
    let engine: string
    if (this.deploymentName !== null) {
      engine = this.deploymentName
    } else {
      const key = `${this.mode},${this.model}`
      if (!QUERY_MODE_MODEL_DICT[key]) {
        throw new Error(`Invalid mode, model combination: ${key}`)
      }
      engine = QUERY_MODE_MODEL_DICT[key]
    }
    return await getEmbedding(query, engine)
  }

  _getTextEmbedding(text: string) {
    let engine: string
    if (this.deploymentName !== null) {
      engine = this.deploymentName
    } else {
      const key = `${this.mode},${this.model}`
      if (!TEXT_MODE_MODEL_DICT[key]) {
        throw new Error(`Invalid mode, model combination: ${key}`)
      }
      engine = TEXT_MODE_MODEL_DICT[key]
    }
    return getEmbedding(text, engine)
  }

  async _agetTextEmbedding(text: string): Promise<number[]> {
    let engine: string
    if (this.deploymentName !== null) {
      engine = this.deploymentName
    } else {
      const key = `${this.mode},${this.model}`
      if (!TEXT_MODE_MODEL_DICT[key]) {
        throw new Error(`Invalid mode, model combination: ${key}`)
      }
      engine = TEXT_MODE_MODEL_DICT[key]
    }
    return agetEmbedding(text, engine)
  }

  // @ts-ignore
  _getTextEmbeddings(texts: string[]) {
    let engine: string
    if (this.deploymentName !== null) {
      engine = this.deploymentName
    } else {
      const key = `${this.mode},${this.model}`
      if (!TEXT_MODE_MODEL_DICT[key]) {
        throw new Error(`Invalid mode, model combination: ${key}`)
      }
      engine = TEXT_MODE_MODEL_DICT[key]
    }
    return getEmbeddings(texts, engine)
  }

  async _agetTextEmbeddings(texts: string[]): Promise<number[][]> {
    let engine: string
    if (this.deploymentName !== null) {
      engine = this.deploymentName
    } else {
      const key = `${this.mode},${this.model}`
      if (!TEXT_MODE_MODEL_DICT[key]) {
        throw new Error(`Invalid mode, model combination: ${key}`)
      }
      engine = TEXT_MODE_MODEL_DICT[key]
    }
    return agetEmbeddings(texts, engine)
  }
}
