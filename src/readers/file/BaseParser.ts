// Output from an image parser.
export class ImageParserOutput {
  // Output from an image parser.

  text: string = ''
  // base64 encoded image str
  image: string | null = null

  constructor(text, image) {
    this.text = text
    this.image = image
  }
}

// Base class for all parsers
export abstract class BaseParser {
  private _parserConfig?: Record<string, unknown>

  constructor(parserConfig?: Record<string, unknown>) {
    this._parserConfig = parserConfig
  }

  initParser(): void {
    const parserConfig = this._initParser()
    this._parserConfig = parserConfig
  }

  get parserConfigSet(): boolean {
    return this._parserConfig !== undefined
  }

  get parserConfig(): Record<string, unknown> {
    if (this._parserConfig === undefined) {
      throw new Error('Parser config not set.')
    }
    return this._parserConfig
  }

  protected abstract _initParser(): Record<string, unknown>

  abstract parseFile(
    file: string,
    errors?
  ): string | string[] | ImageParserOutput
}
