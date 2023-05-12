export interface StructuredOutput {
  rawOutput: string
  parsedOutput: any | null
}

export interface BaseOutputParser {
  parse(output: string): any
  format(output: string): string
}
