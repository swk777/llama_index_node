import { globalsHelper } from '../../utils.js'
import natural from 'natural'
import RAKE from 'node-rake'

function expandTokensWithSubtokens(tokens: string[]): string[] {
  const tokenizer = new natural.WordTokenizer()
  return tokens.flatMap(token => tokenizer.tokenize(token))
}

export function extractKeywordsGivenResponse(
  response: string,
  lowercase: boolean = true,
  startToken: string = ''
): Set<string> {
  let results: string[] = []
  response = response.trim() // Strip newlines from responses.

  if (response.startsWith(startToken)) {
    response = response.slice(startToken.length)
  }

  let keywords = response.split(',')
  for (let k of keywords) {
    let rk = k
    if (lowercase) {
      rk = rk.toLowerCase()
    }
    results.push(rk.trim())
  }

  // if keyword consists of multiple words, split into subwords
  // (removing stopwords)
  return new Set(expandTokensWithSubtokens(results))
}

// export function simpleExtractKeywords(
//   textChunk: string,
//   maxKeywords?: number,
//   filterStopwords: boolean = true
// ): Set<string> {
//   let tokens: string[] =
//     textChunk.match(/\w+/g)?.map(t => t.trim().toLowerCase()) ?? []

//   if (filterStopwords) {
//     tokens = tokens.filter(t => !globalsHelper.stopwords.includes(t))
//   }

//   const valueCounts: { [token: string]: number } = {}
//   tokens.forEach(token => {
//     valueCounts[token] = (valueCounts[token] || 0) + 1
//   })

//   const sortedKeywords: string[] = Object.keys(valueCounts).sort(
//     (a, b) => valueCounts[b] - valueCounts[a]
//   )
//   const keywords: string[] = maxKeywords
//     ? sortedKeywords.slice(0, maxKeywords)
//     : sortedKeywords

//   return new Set(keywords)
// }

export function countValues(arr: string[]): string[] {
  const counts: { [key: string]: number } = {}
  for (let i = 0; i < arr.length; i++) {
    if (!counts[arr[i]]) {
      counts[arr[i]] = 1
    } else {
      counts[arr[i]]++
    }
  }
  return Object.keys(counts).sort((a, b) => counts[b] - counts[a])
}
export function simpleExtractKeywords(
  textChunk: string,
  maxKeywords: number | null = null,
  filterStopwords: boolean = true
): Set<string> {
  // Extract keywords with simple algorithm.
  let tokens = textChunk.match(/\b(\w+)\b/g)
  // @ts-ignore
  tokens = tokens ? tokens.map(token => token.toLowerCase().trim()) : []
  if (filterStopwords) {
    const stopwords = globalsHelper.stopwords
    // @ts-ignore
    tokens = tokens.filter(token => !stopwords.has(token))
  }
  const valueCounts = countValues(tokens)
  const keywords = valueCounts.slice(0, maxKeywords)
  return new Set(keywords)
}

export function rakeExtractKeywords(
  textChunk: string,
  maxKeywords: number | null = null,
  expandWithSubtokens: boolean = true
): Set<string> {
  const keywords = RAKE.generate(textChunk)
  const limitedKeywords = maxKeywords
    ? keywords.slice(0, maxKeywords)
    : keywords

  if (expandWithSubtokens) {
    return new Set(expandTokensWithSubtokens(limitedKeywords))
  } else {
    return new Set(limitedKeywords)
  }
}
