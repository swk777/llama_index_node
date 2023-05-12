// import { Path } from 'path'; // Assuming you have a package with Path type
import * as pdfjsLib from 'pdfjs-dist'
import { promises as fs } from 'fs'
import { BaseParser } from './BaseParser.js'

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
    // Read the file as ArrayBuffer
    const data = new Uint8Array(await fs.readFile(file))

    // Load the PDF document
    const pdfDocument = await pdfjsLib.getDocument({ data }).promise
    const numPages = pdfDocument.numPages
    const textList: string[] = []

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      // Get the page
      const page = await pdfDocument.getPage(pageNum)

      // Get the text content of the page
      const textContent = await page.getTextContent()

      // Extract the text from the text content
      // @ts-ignore
      const pageText = textContent.items.map(item => item.str).join(' ')
      textList.push(pageText)
    }

    const text = textList.join('\n')

    return text
  }
}

// Keep the DocxParser class unchanged
// class DocxParser extends BaseParser {
//     protected _initParser(): Record<string, unknown> {
//         return {};
//     }

//     async parseFile(file: Path, errors: 'ignore' | 'strict' = 'ignore'): Promise<string> {
//         try {
//             const docx2txt = await import('docx2txt');
//         } catch {
//             throw new Error(
//                 'docx2txt is required to read Microsoft Word files: ' +
//                 '`npm install docx2txt`'
//             );
//         }

//         const text = docx2txt.process(file);

//         return text;
//     }
// }
