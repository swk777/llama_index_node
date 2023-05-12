// import ServiceContext from '../indices/ServiceContext'

export function llmTokenCounter(methodNameStr: string) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    // hacking point
    console.log(target, propertyKey, methodNameStr)
    // if (!descriptor) {
    //   descriptor = Object.getOwnPropertyDescriptor(target, propertyKey)
    // }
    // const originalMethod = descriptor.value

    // descriptor.value = async function (...args: any[]) {
    //   const serviceContext: ServiceContext = this._serviceContext
    //   if (!(serviceContext instanceof ServiceContext)) {
    //     throw new Error(
    //       'Cannot use llmTokenCounter on an instance without a service context.'
    //     )
    //   }

    //   const llmPredictor = serviceContext.llm_predictor
    //   const embedModel = serviceContext.embedModel

    //   const startTokenCt = llmPredictor.totalTokensUsed
    //   const startEmbedTokenCt = embedModel.totalTokensUsed

    //   const result = originalMethod.apply(this, args)

    //   // If the result is a Promise, wait for it to resolve.
    //   const resolvedResult = result instanceof Promise ? await result : result

    //   const netTokens = llmPredictor.totalTokensUsed - startTokenCt
    //   llmPredictor.lastTokenUsage = netTokens
    //   const netEmbedTokens = embedModel.totalTokensUsed - startEmbedTokenCt
    //   embedModel.totalTokensUsed = netEmbedTokens

    //   console.info(
    //     `> [${methodNameStr}] Total LLM token usage: ${netTokens} tokens`
    //   )
    //   console.info(
    //     `> [${methodNameStr}] Total embedding token usage: ${netEmbedTokens} tokens`
    //   )

    //   return resolvedResult
    // }

    return descriptor
  }
}
