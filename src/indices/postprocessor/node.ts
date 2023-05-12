import Node from '../../data-struts/Node.js'

export abstract class BaseNodePostprocessor {
  public abstract postprocessNodes(
    nodes: Node[],
    extraInfo?: { [key: string]: any }
  ): Node[]
  // Note: the return type of this function needs to be Array<Node>.
  // In TypeScript, we can use '[]' or 'Array<T>' to represent an array.
  // We could also use 'Node[] | undefined' to indicate that the value may be undefined.
}
