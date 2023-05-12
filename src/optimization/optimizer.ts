import { QueryBundle } from 'indices/query/schema.js'

export abstract class BaseTokenUsageOptimizer {
  abstract optimize(queryBundle: QueryBundle, text: string): string
}
