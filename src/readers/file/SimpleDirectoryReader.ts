import * as fs from 'fs/promises'
import * as path from 'path'
import * as glob from 'glob'
import BaseReader from '../BaseReader.js'
import { BaseParser, ImageParserOutput } from './BaseParser.js'
import Document, { ImageDocument } from '../schema/Document.js'
import {
  CSVParser,
  DocxParser,
  ImageParser,
  MarkdownParser,
  PDFParser
} from './DocParser.js'

// Update the DEFAULT_FILE_EXTRACTOR object with the appropriate parsers
const DEFAULT_FILE_EXTRACTOR: Record<string, BaseParser> = {
  // @ts-ignore
  '.pdf': new PDFParser(),
  // @ts-ignore
  '.docx': new DocxParser(),
  // @ts-ignore
  '.pptx': new DocxParser(),
  // @ts-ignore
  '.jpg': new ImageParser(),
  // @ts-ignore
  '.png': new ImageParser(),
  // @ts-ignore
  '.csv': new CSVParser(),
  // @ts-ignore
  '.md': new MarkdownParser()
}

export class SimpleDirectoryReader extends BaseReader {
  private inputDir?: string
  private inputFiles?: string[]
  private exclude?: string[]
  private excludeHidden: boolean
  private errors: string
  private recursive: boolean
  private requiredExts?: string[]
  private fileExtractor: Record<string, BaseParser>
  private numFilesLimit?: number
  private fileMetadata?: (filename: string) => Record<string, unknown>

  constructor(
    inputDir: string | null = null,
    inputFiles: string[] | null = null,
    exclude: string[] | null = null,
    excludeHidden: boolean = true,
    errors: string = 'ignore',
    recursive: boolean = false,
    requiredExts: string[] | null = null,
    fileExtractor: Record<string, BaseParser> | null = null,
    numFilesLimit: number | null = null,
    fileMetadata: ((filename: string) => Record<string, unknown>) | null = null
  ) {
    super()
    if (!inputDir && !inputFiles) {
      throw new Error('Must provide either `inputDir` or `inputFiles`.')
    }

    this.errors = errors

    this.exclude = exclude
    this.recursive = recursive
    this.excludeHidden = excludeHidden
    this.requiredExts = requiredExts
    this.numFilesLimit = numFilesLimit
    if (inputFiles) {
      this.inputFiles = inputFiles
    } else if (inputDir) {
      this.inputDir = inputDir
      this.exclude = exclude
      this.inputFiles = this._addFiles(this.inputDir)
    }

    this.fileExtractor = fileExtractor || DEFAULT_FILE_EXTRACTOR
    this.fileMetadata = fileMetadata
  }

  private _addFiles(inputDir: string) {
    const allFiles = new Set<string>()
    const rejectedFiles = new Set<string>()

    if (this.exclude !== null) {
      for (const excludedPattern of this.exclude) {
        const foundFiles = glob.sync(excludedPattern, {
          cwd: inputDir,
          absolute: true,
          nodir: true,
          ignore: this.excludeHidden ? '.*' : ''
        })

        for (const file of foundFiles) {
          rejectedFiles.add(file)
        }
      }
    }

    const filePattern = this.recursive ? '**/*' : '*'
    const fileRefs = glob.sync(filePattern, {
      cwd: inputDir,
      absolute: true,
      nodir: true,
      ignore: this.excludeHidden ? '.*' : ''
    })
    for (const file of fileRefs) {
      if (
        !rejectedFiles.has(file) &&
        (this.requiredExts === null ||
          this.requiredExts.includes(path.extname(file)))
      ) {
        allFiles.add(file)
      }
    }
    const newInputFiles = Array.from(allFiles).sort()

    if (this.numFilesLimit !== null && this.numFilesLimit > 0) {
      newInputFiles.splice(this.numFilesLimit)
    }
    return newInputFiles
  }
  async loadData(concatenate: boolean = false): Promise<Document[]> {
    if (!this.inputFiles) {
      throw new Error('Input files not set.')
    }
    const dataList: any[] = []
    const metadataList: (Record<string, unknown> | null)[] = []
    const imageDocs: ImageDocument[] = []
    for (const inputFile of this.inputFiles) {
      const ext = path.extname(inputFile)
      let data: any
      if (this.fileExtractor[ext]) {
        const parser = this.fileExtractor[ext]
        data = await parser.parseFile(inputFile, this.errors)
      } else {
        try {
          data = await fs.readFile(inputFile, {
            encoding: 'utf8',
            flag: 'r'
          })
        } catch (err) {
          console.error(`Error reading file ${inputFile}: ${err}`)
        }
      }

      let metadata: Record<string, unknown> | null = null
      if (this.fileMetadata !== null) {
        metadata = this.fileMetadata(inputFile)
      }

      if (data instanceof ImageParserOutput) {
        imageDocs.push(
          new ImageDocument({
            text: data.text,
            extraInfo: metadata,
            image: data.image
          })
        )
      } else if (Array.isArray(data)) {
        dataList.push(data)
        metadataList.push(metadata)
      } else if (typeof data === 'string') {
        dataList.push(data)
        metadataList.push(metadata)
      }
    }

    let textDocs: Document[]
    if (concatenate) {
      textDocs = [new Document({ text: dataList.join('\n') })]
    } else if (this.fileMetadata !== null) {
      textDocs = dataList.map(
        (d, i) => new Document({ text: d, extraInfo: metadataList[i] })
      )
    } else {
      textDocs = dataList.map(d => new Document({ text: d }))
    }
    return [...textDocs, ...imageDocs]
  }
}
