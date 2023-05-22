import Node from 'data-struts/Node.js'
import {
  SimilarityTracker,
  getTopKEmbeddings
} from '../../indices/query/embeddingUtils.js'
import { QueryBundle } from '../../indices/query/schema.js'
import { BaseGPTListIndexQuery } from './query.js'

export default class GPTListIndexEmbeddingQuery extends BaseGPTListIndexQuery {
  private similarityTopK: number

  constructor({ indexStruct: IndexList, similarityTopK = 1, ...restArgs }) {
    // @ts-ignore
    super({ indexStruct, ...restArgs })
    this.similarityTopK = similarityTopK
  }

  async _retrieve(
    queryBundle: QueryBundle,
    similarityTracker?: SimilarityTracker
  ) {
    let nodeIds = this.indexStruct.nodes
    let nodes = this._docstore.getNodes(nodeIds)
    let [queryEmbedding, nodeEmbeddings] = await this.getEmbeddings(
      queryBundle,
      nodes
    )

    // Assuming getTopKEmbeddings is a function imported from somewhere
    let [topSimilarities, topIdxs] = getTopKEmbeddings({
      queryEmbedding,
      embeddings: nodeEmbeddings,
      similarityTopK: this.similarityTopK,
      embeddingIds: Array.from(Array(nodes.length).keys())
    })

    let topKNodes = topIdxs.map(i => nodes[i])

    if (similarityTracker) {
      for (let i = 0; i < topKNodes.length; i++) {
        similarityTracker.add(topKNodes[i], topSimilarities[i])
      }
    }

    console.debug(`> Top ${topIdxs.length} nodes:\n`)
    console.debug(`${topKNodes.map(n => n.getText()).join('\n')}`)
    return topKNodes
  }

  private async getEmbeddings(
    queryBundle: QueryBundle,
    nodes: Node[]
  ): Promise<[number[], number[][]]> {
    if (!queryBundle.embedding) {
      queryBundle.embedding =
        await this._serviceContext.embedModel.getAggEmbeddingFromQueries(
          queryBundle.embeddingStrs
        )
    }

    let nodeEmbeddings: Array<Array<number>> = []

    for (let node of nodes) {
      if (!node.embedding) {
        node.embedding = await this._serviceContext.embedModel.getTextEmbedding(
          node.getText()
        )
      }
      nodeEmbeddings.push(node.embedding)
    }

    return [queryBundle.embedding, nodeEmbeddings]
  }
}
