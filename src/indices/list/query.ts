import Node from '../../data-struts/Node.js'
import { IndexList } from '../../data-struts/data-structure.js'
import { BaseGPTIndexQuery } from '../../indices/query/BaseGPTIndexQuery.js'
import { SimilarityTracker } from '../../indices/query/embeddingUtils.js'
import { QueryBundle } from '../../indices/query/schema.js'

export abstract class BaseGPTListIndexQuery extends BaseGPTIndexQuery<IndexList> {}

export class GPTListIndexQuery extends BaseGPTListIndexQuery {
  _retrieve(
    query_bundle: QueryBundle,
    similarity_tracker?: SimilarityTracker
  ): Node[] {
    let nodeIds = this._indexStruct.nodes
    let nodes = this._docstore.getNodes(nodeIds)
    return nodes
  }
}
