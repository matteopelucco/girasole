import { PDFDocument, PDFName, PDFRawStream, PDFRef, decodePDFRawStream } from 'pdf-lib';

// Solo per i test unitari dei PDF.
// Testo disegnato in una pagina: pdf-lib emette le stringhe di
// Helvetica come esadecimale <...> negli operatori Tj.
export async function testoPagina(bytes: Uint8Array, indice: number): Promise<string> {
  const doc = await PDFDocument.load(bytes);
  const contents = doc.getPage(indice).node.get(PDFName.of('Contents'));
  const refs = Array.isArray((contents as { asArray?: () => unknown[] }).asArray?.())
    ? (contents as unknown as { asArray: () => PDFRef[] }).asArray()
    : [contents as PDFRef];
  return refs
    .map((ref) => {
      const stream = doc.context.lookup(ref) as PDFRawStream;
      const raw = Buffer.from(decodePDFRawStream(stream).decode()).toString('latin1');
      return [...raw.matchAll(/<([0-9A-Fa-f]+)>\s*Tj/g)]
        .map((m) => Buffer.from(m[1], 'hex').toString('latin1'))
        .join('\n');
    })
    .join('\n');
}

