import BaseDocument from '../readers/schema/BaseDocument.js'
import { ImageDocument } from '../readers/schema/Document.js'
import Node, { DocumentRelationship, ImageNode } from '../data-struts/Node.js'
import TokenTextSplitter, {
  TextSplit,
  TextSplitter
} from '../langchain_helpers/TextSplitter.js'

async function getTextSplitsFromDocument(
  document: BaseDocument,
  textSplitter: TextSplitter,
  includeExtraInfo: boolean = true
) {
  let textSplits: TextSplit[] = []
  if (textSplitter instanceof TokenTextSplitter) {
    textSplits = await Promise.resolve(
      textSplitter.splitTextWithOverlaps(
        document.getText(),
        includeExtraInfo ? document.extraInfoStr : null
      )
    )
  } else {
    const textChunks = await textSplitter.splitText(document.getText())
    textSplits = textChunks.map(textChunk => new TextSplit(textChunk))
  }

  return textSplits
}

export async function getNodesFromDocument(
  document: BaseDocument,
  textSplitter: TextSplitter,
  includeExtraInfo: boolean = true
) {
  const textSplits = await getTextSplitsFromDocument(
    document,
    textSplitter,
    includeExtraInfo
  )

  const nodes: Node[] = []
  let indexCounter = 0
  for (let i = 0; i < textSplits.length; i++) {
    const textSplit = textSplits[i]
    const textChunk = textSplit.textChunk
    let indexPosInfo = null
    if (textSplit.numCharOverlap !== null) {
      indexPosInfo = {
        start: indexCounter - textSplit.numCharOverlap,
        end: indexCounter - textSplit.numCharOverlap + textChunk.length
      }
    }
    indexCounter += textChunk.length + 1

    if (document instanceof ImageDocument) {
      const imageNode = new ImageNode(
        textChunk,
        undefined,
        document.embedding,
        undefined,
        includeExtraInfo ? document.extraInfo : null,
        indexPosInfo,
        { [DocumentRelationship.SOURCE]: document.getDocId() }
      )
      nodes.push(imageNode)
    } else {
      const node = new Node(
        textChunk,
        undefined,
        document.embedding,
        undefined,
        includeExtraInfo ? document.extraInfo : null,
        indexPosInfo,
        { [DocumentRelationship.SOURCE]: document.getDocId() }
      )
      nodes.push(node)
    }
  }

  return nodes
}
