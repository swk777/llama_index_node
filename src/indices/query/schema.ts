import DataClassJsonMixin from '../../helpers/DataClassJsonMixin.js'

export enum QueryMode {
  DEFAULT = 'default',
  RETRIEVE = 'retrieve',
  EMBEDDING = 'embedding',
  SUMMARIZE = 'summarize',
  SIMPLE = 'simple',
  RAKE = 'rake',
  RECURSIVE = 'recursive',
  SQL = 'sql'
}

export class QueryConfig extends DataClassJsonMixin {
  indexStructType: string
  queryMode: QueryMode
  queryKwargs: { [key: string]: any }
  indexStructId?: string | null
  queryTransform?: any | null
  queryCombiner?: any | null

  constructor({
    indexStructType,
    queryMode,
    queryKwargs = {},
    indexStructId = null,
    queryTransform = null,
    queryCombiner = null
  }: {
    indexStructType: string
    queryMode: QueryMode
    queryKwargs?: { [key: string]: any }
    indexStructId?: string | null
    queryTransform?: any | null
    queryCombiner?: any | null
  }) {
    super()
    this.indexStructType = indexStructType
    this.queryMode = queryMode
    this.queryKwargs = queryKwargs
    this.indexStructId = indexStructId
    this.queryTransform = queryTransform
    this.queryCombiner = queryCombiner
  }
}

export class QueryBundle extends DataClassJsonMixin {
  queryStr: string
  customEmbeddingStrs?: string[] | null
  embedding?: number[] | null

  constructor(
    queryStr: string,
    customEmbeddingStrs: string[] | null = null,
    embedding: number[] | null = null
  ) {
    super()
    this.queryStr = queryStr
    this.customEmbeddingStrs = customEmbeddingStrs
    this.embedding = embedding
  }

  get embeddingStrs(): string[] {
    if (this.customEmbeddingStrs === null) {
      return [this.queryStr]
    } else {
      return this.customEmbeddingStrs
    }
  }
}
// type QueryBundleProps = {
//   queryStr: string
//   customEmbeddingStrs?: string[] | null
//   embedding?: number[] | null
// }

// export class QueryBundle {
//   queryStr: string
//   customEmbeddingStrs: string[] | null
//   embedding: number[] | null

//   constructor(props: QueryBundleProps) {
//     this.queryStr = props.queryStr
//     this.customEmbeddingStrs = props.customEmbeddingStrs || null
//     this.embedding = props.embedding || null
//   }

//   get embeddingStrs(): string[] {
//     if (this.customEmbeddingStrs === null) {
//       return [this.queryStr]
//     } else {
//       return this.customEmbeddingStrs
//     }
//   }
// }
