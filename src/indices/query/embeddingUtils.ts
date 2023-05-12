// embedding-utils.ts
import { createHash } from 'crypto'
import Node, { NodeWithScore } from '../../data-struts/Node.js'
import { similarity } from '../../embeddings/BaseEmbedding.js'

type SimilarityFunction = (a: number[], b: number[]) => number

interface GetTopKEmbeddingsParams {
  queryEmbedding: number[]
  embeddings: number[][]
  similarityFn?: SimilarityFunction
  similarityTopK?: number
  embeddingIds?: number[]
  similarityCutoff?: number
}

export function getTopKEmbeddings({
  queryEmbedding,
  embeddings,
  similarityFn,
  similarityTopK,
  embeddingIds,
  similarityCutoff
}: GetTopKEmbeddingsParams): [number[], number[]] {
  if (!embeddingIds) {
    embeddingIds = Array.from({ length: embeddings.length }, (_, i) => i)
  }
  if (!similarityFn) {
    similarityFn = similarity
  }

  const similarities = embeddings.map(emb => similarityFn(queryEmbedding, emb))
  let sortedTups = similarities
    .map(
      (similarity, index) =>
        [similarity, embeddingIds[index]] as [number, number]
    )
    .sort((a, b) => b[0] - a[0])

  if (similarityCutoff) {
    sortedTups = sortedTups.filter(tup => tup[0] > similarityCutoff)
  }

  similarityTopK = similarityTopK || sortedTups.length
  const resultTups = sortedTups.slice(0, similarityTopK)

  const resultSimilarities = resultTups.map(tup => tup[0])
  const resultIds = resultTups.map(tup => tup[1])

  return [resultSimilarities, resultIds]
}
export class SimilarityTracker {
  // Helper class to manage node similarities during lifecycle of a single query.

  private lookup: { [key: string]: number } = {}

  private hash(node: Node): string {
    // Generate a unique key for each node.
    // TODO: Better way to get unique identifier of a node
    // hacking point
    // return Math.abs(node.getText().hashCode()).toString()
    return createHash('sha256').update(node.getText()).digest('hex')
  }

  add(node: Node, similarity: number): void {
    const nodeHash = this.hash(node)
    this.lookup[nodeHash] = similarity
  }

  find(node: Node): number | null {
    const nodeHash = this.hash(node)
    if (this.lookup[nodeHash] === undefined) {
      return null
    }
    return this.lookup[nodeHash]
  }

  getZippedNodes(nodes: Node[]): NodeWithScore[] {
    const similarities = nodes.map(node => this.find(node))
    const output: NodeWithScore[] = []
    nodes.forEach((node, index) => {
      output.push(new NodeWithScore(node, similarities[index]))
    })
    return output
  }
}
