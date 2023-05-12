// import { QueryBundle } from './schema' // Assuming the schema is in a separate file.

import { QueryBundle } from '../schema.js'

type ExtraInfo = Record<string, unknown>

export abstract class BaseQueryTransform {
  protected abstract _run(
    queryBundle: QueryBundle,
    extraInfo: ExtraInfo
  ): QueryBundle

  run(
    queryBundleOrStr: string | QueryBundle,
    extraInfo?: ExtraInfo
  ): QueryBundle {
    extraInfo = extraInfo || {}
    let queryBundle: QueryBundle

    if (typeof queryBundleOrStr === 'string') {
      queryBundle = new QueryBundle(queryBundleOrStr, [queryBundleOrStr])
    } else {
      queryBundle = queryBundleOrStr
    }

    return this._run(queryBundle, extraInfo)
  }

  call(
    queryBundleOrStr: string | QueryBundle,
    extraInfo?: ExtraInfo
  ): QueryBundle {
    return this.run(queryBundleOrStr, extraInfo)
  }
}

export class IdentityQueryTransform extends BaseQueryTransform {
  protected _run(
    queryBundle: QueryBundle,
    extraInfo: Record<string, unknown>
  ): QueryBundle {
    return queryBundle
  }
}
