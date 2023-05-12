import ServiceContext from '../ServiceContext.js'
import {
  CompositeIndex,
  V2IndexStruct as IndexStruct
} from '../../data-struts/data-structure.js'
import { QueryBundle, QueryConfig, QueryMode } from './schema.js'
import { DocumentStore } from '../../DocumentStore.js'
import { IndexStructType } from '../../data-struts/IndexStructType.js'
import { RESPONSE_TYPE } from '../../response/schema.js'
import Node, { IndexNode, NodeWithScore } from '../../data-struts/Node.js'
import {
  BaseQueryTransform,
  IdentityQueryTransform
} from './query-transform/BaseQueryTransform.js'
import {
  BaseQueryCombiner,
  getDefaultQueryCombiner
} from './query-combiner/BaseQueryCombiner.js'
import { BaseGPTIndexQuery } from './BaseGPTIndexQuery.js'
import { INDEX_STRUT_TYPE_TO_QUERY_MAP } from '../../indices/registry.js'

type Dict = Record<string, any>
type QUERY_CONFIG_TYPE = any

// const logger = logging.getLogger(__name__);

class QueryConfigMap {
  constructor(
    public type_to_config_dict: Map<string, QueryConfig>,
    public id_to_config_dict: Map<string, QueryConfig>
  ) {}

  get(indexStruct: IndexStruct): QueryConfig {
    const indexStructId = indexStruct.indexId
    const indexStructType = indexStruct.getType()
    let config: QueryConfig

    if (this.id_to_config_dict.has(indexStructId)) {
      config = this.id_to_config_dict.get(indexStructId)!
    } else if (this.type_to_config_dict.has(indexStructType)) {
      config = this.type_to_config_dict.get(indexStructType)!
    } else {
      config = new QueryConfig({
        indexStructType,
        queryMode: QueryMode.DEFAULT
      })
    }

    return config
  }
}

function _get_query_config_map(
  queryConfigs: QUERY_CONFIG_TYPE[] = null
): QueryConfigMap {
  let type_to_config_dict: Map<string, QueryConfig> = new Map()
  let id_to_config_dict: Map<string, QueryConfig> = new Map()
  let query_config_objs: Array<QueryConfig> = []

  if (queryConfigs === null || queryConfigs.length === 0) {
    query_config_objs = []
    //@ts-ignore
  }
  //TODO
  // else if (queryConfigs[0] instanceof Dict) {
  //   query_config_objs = queryConfigs.map((qc: Dict) =>
  //     QueryConfig.fromDict(qc)
  //   )
  // }
  else {
    query_config_objs = queryConfigs.map((q: QueryConfig) => q)
  }
  for (const qc of query_config_objs) {
    type_to_config_dict.set(qc.indexStructType, qc)
    if (qc.indexStructId !== null) {
      id_to_config_dict.set(qc.indexStructId, qc)
    }
  }
  return new QueryConfigMap(type_to_config_dict, id_to_config_dict)
}

export default class QueryRunner {
  private _indexStruct: IndexStruct
  private _serviceContext: ServiceContext
  private _docstore: DocumentStore
  private _queryConfigMap: QueryConfigMap
  private _queryTransform: BaseQueryTransform
  private _queryCombiner: BaseQueryCombiner | null
  private _recursive: boolean
  // private _useAsync: boolean

  constructor({
    indexStruct,
    serviceContext,
    docstore,
    queryConfigs = null,
    queryTransform = null,
    queryCombiner = null,
    recursive = false
  }: // useAsync = false
  {
    indexStruct: IndexStruct
    serviceContext: ServiceContext
    docstore: DocumentStore
    queryConfigs: Array<QUERY_CONFIG_TYPE>
    queryTransform: BaseQueryTransform
    queryCombiner?: BaseQueryCombiner
    recursive: boolean
    useAsync: boolean
  }) {
    this._indexStruct = indexStruct
    this._serviceContext = serviceContext
    this._docstore = docstore
    this._queryConfigMap = _get_query_config_map(queryConfigs)
    this._queryTransform = queryTransform || new IdentityQueryTransform()
    this._queryCombiner = queryCombiner
    this._recursive = recursive
    // this._useAsync = useAsync
  }

  private _getQueryKwargs(config: QueryConfig): Dict {
    const queryKwargs: Dict = { ...config.queryKwargs }
    if (!('serviceContext' in queryKwargs)) {
      queryKwargs['serviceContext'] = this._serviceContext
    }
    return queryKwargs
  }

  private _getQueryTransform(indexStruct: IndexStruct): BaseQueryTransform {
    const config = this._queryConfigMap.get(indexStruct)
    let queryTransform: BaseQueryTransform
    if (config.queryTransform !== null) {
      queryTransform = config.queryTransform as BaseQueryTransform
    } else {
      queryTransform = this._queryTransform
    }

    return queryTransform
  }

  private _getQueryCombiner(
    indexStruct: IndexStruct,
    queryTransform: BaseQueryTransform
  ): BaseQueryCombiner {
    const config = this._queryConfigMap.get(indexStruct)
    let queryCombiner: BaseQueryCombiner = null

    if (config.queryCombiner !== null) {
      queryCombiner = config.queryCombiner as BaseQueryCombiner
    } else {
      queryCombiner = this._queryCombiner
    }

    if (queryCombiner === null) {
      const extra_kwargs = {
        serviceContext: this._serviceContext
      }
      queryCombiner = getDefaultQueryCombiner(
        indexStruct,
        queryTransform,
        this,
        extra_kwargs
      )
    }

    return queryCombiner as BaseQueryCombiner
  }

  private _getQueryObj(
    indexStruct: IndexStruct
  ): BaseGPTIndexQuery<IndexStruct> {
    const indexStructType = indexStruct.getType()
    if (indexStructType === IndexStructType.COMPOSITE) {
      throw new Error('Cannot get query object for composite index struct.')
    }
    const config = this._queryConfigMap.get(indexStruct)
    const mode = config.queryMode || QueryMode.DEFAULT
    const query_cls = INDEX_STRUT_TYPE_TO_QUERY_MAP[indexStructType][mode]
    const queryKwargs = this._getQueryKwargs(config)
    // @ts-ignore
    const queryObj = new query_cls({
      indexStruct,
      docstore: this._docstore,
      ...queryKwargs
    })

    return queryObj
  }

  async queryTransformed(
    queryBundle: QueryBundle,
    indexStruct: IndexStruct,
    level: number = 0
  ): Promise<RESPONSE_TYPE> {
    const queryObj = this._getQueryObj(indexStruct)
    if (this._recursive) {
      console.debug(`> Query level : ${level} on ${indexStruct.getType()}`)
      const nodes = await queryObj.retrieve(queryBundle)
      const nodesForSynthesis = []
      const additionalSourceNodes = []

      for (const nodeWithScore of nodes) {
        const [newNodeWithScore, sourceNodes] =
          await this._afetchRecursiveNodes(nodeWithScore, queryBundle, level)
        nodesForSynthesis.push(newNodeWithScore)
        additionalSourceNodes.push(...sourceNodes)
      }

      return await queryObj.asynthesize(
        queryBundle,
        nodesForSynthesis,
        additionalSourceNodes
      )
    } else {
      return await queryObj.aquery(queryBundle)
    }
  }

  async _afetchRecursiveNodes(
    nodeWithScore: NodeWithScore,
    queryBundle: QueryBundle,
    level: number
  ): Promise<[NodeWithScore, NodeWithScore[]]> {
    if (nodeWithScore.node instanceof IndexNode) {
      const indexNode = nodeWithScore.node
      const response = await this.aquery(
        queryBundle,
        indexNode.indexId,
        level + 1
      )
      //@ts-ignore
      const newNode = new Node(response.toString())
      const newNodeWithScore = new NodeWithScore(newNode, nodeWithScore.score)
      return [newNodeWithScore, response.sourceNodes]
    } else {
      return [nodeWithScore, []]
    }
  }

  private _prepareQueryObjects(
    queryStrOrBundle: string | QueryBundle,
    indexId: string = null
  ): [BaseQueryCombiner, QueryBundle] {
    let indexStruct: IndexStruct = this._indexStruct
    if (this._indexStruct instanceof CompositeIndex) {
      if (indexId === null) {
        indexId = this._indexStruct.rootId
      }
      indexStruct = this._indexStruct.allIndexStructs[indexId]
    } else {
      if (indexId !== null) {
        throw new Error('indexId should be used with composite graph')
      }
      indexStruct = this._indexStruct
    }

    let queryBundle: QueryBundle
    if (typeof queryStrOrBundle === 'string') {
      queryBundle = new QueryBundle(queryStrOrBundle, [queryStrOrBundle])
    } else {
      queryBundle = queryStrOrBundle
    }

    const queryTransform = this._getQueryTransform(indexStruct)
    const queryCombiner = this._getQueryCombiner(indexStruct, queryTransform)
    return [queryCombiner, queryBundle]
  }

  async query(
    queryStrOrBundle: string | QueryBundle,
    indexId: string = null,
    level: number = 0
  ) {
    const [queryCombiner, queryBundle] = this._prepareQueryObjects(
      queryStrOrBundle,
      indexId
    )
    return await queryCombiner.run(queryBundle, level)
  }

  async aquery(
    queryStrOrBundle: string | QueryBundle,
    indexId: string = null,
    level: number = 0
  ): Promise<RESPONSE_TYPE> {
    const [queryCombiner, queryBundle] = this._prepareQueryObjects(
      queryStrOrBundle,
      indexId
    )
    return await queryCombiner.arun(queryBundle, level)
  }
}
