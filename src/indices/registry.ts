import { IndexStructType } from '../data-struts/IndexStructType.js'
// import { GPTSimpleVectorIndex } from '../vector_stores/GPTSimpleVectorIndex.js'
import { BaseGPTIndexQuery } from './query/BaseGPTIndexQuery.js'
import { QueryMode } from './query/schema.js'
import { GPTSimpleVectorIndexQuery } from './vector-store/queries.js'
// import { GPTVectorStoreIndex } from './GPTVectorStoreIndex.js'
import GPTVectorStoreIndexQuery from './vector-store/GPTVectorStoreIndexQuery.js'
import {
  CompositeIndex,
  IndexDict,
  SimpleIndexDict,
  V2IndexStruct
} from '../data-struts/data-structure.js'
import { TYPE_KEY, DATA_KEY } from '../constants.js'

// export const INDEX_STRUCT_TYPE_TO_INDEX_CLASS = {
//   //   [IndexStructType.TREE]: GPTTreeIndex,
//   //   [IndexStructType.LIST]: GPTListIndex
//   [IndexStructType.SIMPLE_DICT]: GPTSimpleVectorIndex,
//   [IndexStructType.VECTOR_STORE]: GPTVectorStoreIndex
//   // Add the rest of the index types and their corresponding index classes here
// }
export type QueryMap = { [key: string]: typeof BaseGPTIndexQuery }
// export const INDEX_STRUT_TYPE_TO_QUERY_MAP: {
//   [key in IndexStructType]: QueryMap
// } = {} as any
// for (const indexType in INDEX_STRUCT_TYPE_TO_INDEX_CLASS) {
//   console.log(INDEX_STRUCT_TYPE_TO_INDEX_CLASS[indexType as IndexStructType])
//   INDEX_STRUT_TYPE_TO_QUERY_MAP[indexType as IndexStructType] =
//     INDEX_STRUCT_TYPE_TO_INDEX_CLASS[indexType as IndexStructType].getQueryMap()
// }
// TODO
export const INDEX_STRUT_TYPE_TO_QUERY_MAP = {
  [IndexStructType.SIMPLE_DICT]: {
    [QueryMode.DEFAULT]: GPTSimpleVectorIndexQuery,
    [QueryMode.EMBEDDING]: GPTSimpleVectorIndexQuery
  },
  [IndexStructType.VECTOR_STORE]: {
    [QueryMode.DEFAULT]: GPTVectorStoreIndexQuery,
    [QueryMode.EMBEDDING]: GPTVectorStoreIndexQuery
  }
}
// @ts-ignore
const INDEX_STRUCT_TYPE_TO_INDEX_STRUCT_CLASS: {
  [key in IndexStructType]: new (...args: any[]) => V2IndexStruct
} = {
  [IndexStructType.SIMPLE_DICT]: SimpleIndexDict,
  [IndexStructType.VECTOR_STORE]: IndexDict,
  [IndexStructType.COMPOSITE]: CompositeIndex
}
export function loadIndexStructFromDict(structDict: {
  [key: string]: any
}): V2IndexStruct {
  const type = structDict[TYPE_KEY]
  const dataDict = structDict[DATA_KEY]
  const cls = INDEX_STRUCT_TYPE_TO_INDEX_STRUCT_CLASS[type]
  if (type === IndexStructType.COMPOSITE) {
    const structDicts: { [key: string]: any } = dataDict['all_index_structs']
    const rootId = dataDict['root_id']
    const allIndexStructs = Object.fromEntries(
      Object.entries(structDicts).map(([id, structDict]) => [
        id,
        loadIndexStructFromDict(structDict)
      ])
    )
    return new CompositeIndex(allIndexStructs, rootId)
  } else {
    return cls.fromDict(dataDict)
  }
}
