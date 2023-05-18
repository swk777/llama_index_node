import { promises as fs } from 'fs'
import { BaseParser, ImageParserOutput } from './BaseParser.js'
import pdf from 'pdf-parse/lib/pdf-parse.js'
import officeParser from 'officeParser'
import Tesseract from 'Tesseract.js'
import Papa from 'papaparse'

export class PDFParser extends BaseParser {
  protected _initParser(): Record<string, unknown> {
    return {}
  }

  // @ts-ignore
  async parseFile(
    file: string
    // hacking point
    // errors: 'ignore' | 'strict' = 'ignore'
  ): Promise<string> {
    const dataBuffer = await fs.readFile(file)

    // Load the PDF document
    const pdfDocument = await pdf(dataBuffer)
    return pdfDocument.text
  }
}

export class DocxParser extends BaseParser {
  protected _initParser(): Record<string, unknown> {
    return {}
  }
  // @ts-ignore
  async parseFile(
    file: string
    // errors: 'ignore' | 'strict' = 'ignore'
  ): Promise<string> {
    let docxTxt = ''
    try {
      docxTxt = await officeParser.parseOfficeAsync(file)
    } catch {
      throw new Error('docx2txt is required to read Microsoft Word files: ')
    }
    return docxTxt
  }
}

export class ImageParser {
  private keepImage: boolean
  private parseText: boolean

  constructor(keepImage: boolean = false, parseText: boolean = true) {
    this.keepImage = keepImage
    this.parseText = parseText
  }
  public async parseFile(
    file: string,
    errors: string = 'ignore'
  ): Promise<any> {
    // Encode image into base64 string and keep in document
    let imageStr: string | null = null
    const imageBuffer = await fs.readFile(file)
    if (this.keepImage) {
      imageStr = imageBuffer.toString('base64')
    }

    // Parse image into text
    let textStr: string = ''
    if (this.parseText) {
      textStr = (await Tesseract.recognize(imageBuffer, 'eng'))?.data?.text
    }
    return new ImageParserOutput(textStr, imageStr)
  }
}

export class CSVParser {
  private concatRows: boolean
  private colJoiner: string
  private rowJoiner: string

  constructor(
    concatRows: boolean = true,
    colJoiner: string = ', ',
    rowJoiner: string = '\n'
  ) {
    this.concatRows = concatRows
    this.colJoiner = colJoiner
    this.rowJoiner = rowJoiner
  }

  public async parseFile(
    file: string,
    errors: string = 'ignore'
  ): Promise<string | string[]> {
    const fileContent = await fs.readFile(file, 'utf-8')
    const result = Papa.parse(fileContent)
    const textList = result.data.map((row: any) => {
      const rowValues = Object.values(row).map(value => value.toString())
      return rowValues.join(this.colJoiner)
    })

    if (this.concatRows) {
      return textList.join(this.rowJoiner)
    } else {
      return textList
    }
  }
}

export class MarkdownParser {
  private removeHyperlinks: boolean
  private removeImages: boolean

  constructor(removeHyperlinks: boolean = true, removeImages: boolean = true) {
    this.removeHyperlinks = removeHyperlinks
    this.removeImages = removeImages
  }

  private markdownToTups(markdownText: string): [string | null, string][] {
    const markdownTups: [string | null, string][] = []
    const lines = markdownText.split('\n')

    let currentHeader: string | null = null
    let currentText = ''

    for (const line of lines) {
      const headerMatch = line.match(/^#+\s/)
      if (headerMatch) {
        if (currentHeader !== null) {
          if (currentText === '' || currentText === null) {
            continue
          }
          markdownTups.push([currentHeader, currentText])
        }

        currentHeader = line
        currentText = ''
      } else {
        currentText += line + '\n'
      }
    }
    markdownTups.push([currentHeader, currentText])

    return markdownTups
  }

  private getRemoveImages(content: string): string {
    const pattern = /!\[\[(.*)\]\]/g
    return content.replace(pattern, '')
  }

  private getRemoveHyperlinks(content: string): string {
    const pattern = /\[(.*?)\]\((.*?)\)/g
    return content.replace(pattern, '$1')
  }

  public async parseTups(
    filepath: string,
    errors: string = 'ignore'
  ): Promise<[string | null, string][]> {
    const content = await fs.readFile(filepath, 'utf-8')
    let processedContent = content
    if (this.removeHyperlinks) {
      processedContent = this.getRemoveHyperlinks(processedContent)
    }
    if (this.removeImages) {
      processedContent = this.getRemoveImages(processedContent)
    }
    return this.markdownToTups(processedContent)
  }

  public async parseFile(filepath: string, errors: string = 'ignore') {
    const tups = await this.parseTups(filepath, errors)
    const results: string[] = []
    for (const [header, value] of tups) {
      if (header === null) {
        results.push(value)
      } else {
        results.push(`\n\n${header}\n${value}`)
      }
    }
    return results
  }
}
