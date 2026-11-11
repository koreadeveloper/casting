// 브라우저에서만 쓴다: 프로필 PDF가 너무 크면 올리기 전에 줄인다.
//
// 1단계: PDF 안의 사진만 다시 압축한다(긴 변을 줄이고 JPEG로). 글자·도형은 그대로라 AI도 글자를 읽는다.
// 2단계: 1단계로도 한도를 넘을 때만, 페이지를 통째로 그림으로 바꿔 새 PDF를 만든다(글자가 그림이 된다).
// 두 도구(pdf-lib, pdfjs-dist)는 PDF를 고를 때만 불러온다. pdf.js는 예전 휴대폰 브라우저에서도 돌도록 legacy 판을 쓴다. 어느 단계든 실패하면 원본을 그대로 돌려준다.

import type { PDFDocument, PDFRef } from 'pdf-lib';

export type ShrinkGoal = {
  /** 이 크기 아래로 줄이려고 한다(사진 압축만으로). */
  goal: number;
  /** 넘으면 올릴 수 없는 크기. 사진 압축으로 여기도 못 맞추면 페이지를 그림으로 바꾼다. */
  limit: number;
};

const PHOTO_LEVELS = [
  { side: 2000, quality: 0.8 },
  { side: 1500, quality: 0.72 },
  { side: 1100, quality: 0.65 },
];
const PAGE_LEVELS = [
  { side: 1800, quality: 0.75 },
  { side: 1300, quality: 0.65 },
];

/** 줄인 새 File을, 줄일 필요가 없거나 더 작아지지 않으면 원본을 돌려준다. */
export async function shrinkPdf(
  file: File,
  goal: ShrinkGoal,
  onStatus?: (message: string) => void,
): Promise<File> {
  if (file.size <= goal.goal) return file;
  const original = new Uint8Array(await file.arrayBuffer());
  let best: Uint8Array = original;

  onStatus?.('PDF가 커서 사진을 줄이는 중이에요…');
  try {
    for (const level of PHOTO_LEVELS) {
      const out = await recompressPhotos(original, level.side, level.quality);
      if (out && out.byteLength < best.byteLength) best = out;
      if (best.byteLength <= goal.goal) break;
    }
  } catch {
    // 읽지 못하는 PDF(암호 등)는 아래 단계로 넘어가거나 원본을 쓴다.
  }

  if (best.byteLength > goal.limit) {
    onStatus?.('아직 커서 페이지를 그림으로 바꿔 줄이는 중이에요…');
    try {
      for (const level of PAGE_LEVELS) {
        const out = await rasterizePages(original, level.side, level.quality);
        if (out && out.byteLength < best.byteLength) best = out;
        if (best.byteLength <= goal.limit) break;
      }
    } catch {
      // 이 브라우저에서 페이지를 그리지 못하면 지금까지의 결과를 쓴다.
    }
  }

  if (best === original) return file;
  return new File([best as BlobPart], file.name, { type: 'application/pdf' });
}

/* ---------------- 1단계: 사진만 다시 압축 ---------------- */

async function recompressPhotos(bytes: Uint8Array, maxSide: number, quality: number) {
  const lib = await import('pdf-lib');
  const { PDFName, PDFRawStream, PDFDict, PDFArray, PDFNumber, PDFRef: Ref } = lib;
  const doc = await lib.PDFDocument.load(bytes, { updateMetadata: false });
  const context = doc.context;
  const name = (value: string) => PDFName.of(value);

  // 다른 사진의 투명도(SMask·Mask)로 쓰이는 사진은 건드리지 않는다.
  const maskRefs = new Set<string>();
  const objects = context.enumerateIndirectObjects();
  for (const [, object] of objects) {
    if (!(object instanceof PDFRawStream)) continue;
    for (const key of ['SMask', 'Mask']) {
      const value = object.dict.get(name(key));
      if (value instanceof Ref) maskRefs.add(value.toString());
    }
  }

  let changed = 0;
  for (const [ref, object] of objects) {
    if (!(object instanceof PDFRawStream) || maskRefs.has(ref.toString())) continue;
    const dict = object.dict;
    if (dict.lookup(name('Subtype')) !== name('Image')) continue;
    if (dict.get(name('ImageMask')) || dict.get(name('Decode'))) continue;

    const width = numberOf(dict.lookup(name('Width')), PDFNumber);
    const height = numberOf(dict.lookup(name('Height')), PDFNumber);
    if (!width || !height || width * height < 200 * 200) continue;

    const filters = filterNames(dict.lookup(name('Filter')), PDFName, PDFArray);
    const components = colorComponents(dict.lookup(name('ColorSpace')), context, lib);
    if (components !== 1 && components !== 3) continue;

    const scale = Math.min(1, maxSide / Math.max(width, height));
    // 이미 작은 JPEG는 다시 압축해도 거의 안 줄고 화질만 떨어진다.
    if (scale === 1 && filters[0] === 'DCTDecode' && object.contents.byteLength < 300 * 1024)
      continue;

    let bitmap: ImageBitmap | null = null;
    try {
      if (filters.length === 1 && filters[0] === 'DCTDecode') {
        bitmap = await createImageBitmap(
          new Blob([object.contents as BlobPart], { type: 'image/jpeg' }),
        );
      } else if (filters.length === 1 && filters[0] === 'FlateDecode') {
        const bits = numberOf(dict.lookup(name('BitsPerComponent')), PDFNumber);
        if (bits !== 8) continue;
        const params = dict.lookup(name('DecodeParms'));
        const predictor =
          params instanceof PDFDict ? numberOf(params.lookup(name('Predictor')), PDFNumber) : 1;
        const raw = await inflate(object.contents);
        const pixels = unpredict(raw, width, height, components, predictor || 1);
        if (!pixels) continue;
        bitmap = await createImageBitmap(toImageData(pixels, width, height, components));
      } else continue;

      const jpeg = await encodeJpeg(bitmap, scale, quality);
      if (!jpeg || jpeg.byteLength > object.contents.byteLength * 0.9) continue;

      const next = dict.clone(context);
      for (const key of ['Filter', 'DecodeParms', 'Length', 'ColorSpace', 'BitsPerComponent'])
        next.delete(name(key));
      next.set(name('Filter'), name('DCTDecode'));
      next.set(name('ColorSpace'), name('DeviceRGB'));
      next.set(name('BitsPerComponent'), PDFNumber.of(8));
      next.set(name('Width'), PDFNumber.of(jpeg.width));
      next.set(name('Height'), PDFNumber.of(jpeg.height));
      context.assign(ref as PDFRef, PDFRawStream.of(next, jpeg.bytes));
      changed += 1;
    } catch {
      // 이 사진만 그대로 둔다.
    } finally {
      bitmap?.close();
    }
  }

  if (!changed) return null;
  return saveDoc(doc);
}

function saveDoc(doc: PDFDocument) {
  return doc.save({ useObjectStreams: true, updateFieldAppearances: false });
}

function numberOf(value: unknown, PDFNumber: typeof import('pdf-lib').PDFNumber) {
  return value instanceof PDFNumber ? value.asNumber() : 0;
}

function filterNames(
  value: unknown,
  PDFName: typeof import('pdf-lib').PDFName,
  PDFArray: typeof import('pdf-lib').PDFArray,
) {
  if (value instanceof PDFName) return [value.decodeText()];
  if (value instanceof PDFArray)
    return value.asArray().map((item) => (item instanceof PDFName ? item.decodeText() : '?'));
  return [];
}

/** 사진의 색 채널 수. 흑백 1, 컬러 3, 그 밖(CMYK·팔레트 등)은 0이라 건드리지 않는다. */
function colorComponents(
  value: unknown,
  context: PDFDocument['context'],
  lib: typeof import('pdf-lib'),
): number {
  const { PDFName, PDFArray, PDFRawStream, PDFNumber } = lib;
  if (value instanceof PDFName) {
    const text = value.decodeText();
    if (text === 'DeviceRGB' || text === 'CalRGB') return 3;
    if (text === 'DeviceGray' || text === 'CalGray') return 1;
    return 0;
  }
  if (value instanceof PDFArray) {
    const kind = value.lookup(0);
    if (!(kind instanceof PDFName)) return 0;
    const text = kind.decodeText();
    if (text === 'CalRGB') return 3;
    if (text === 'CalGray') return 1;
    if (text === 'ICCBased') {
      const profile = context.lookup(value.get(1));
      if (profile instanceof PDFRawStream) {
        const n = profile.dict.lookup(PDFName.of('N'));
        return n instanceof PDFNumber && (n.asNumber() === 1 || n.asNumber() === 3)
          ? n.asNumber()
          : 0;
      }
    }
  }
  return 0;
}

async function inflate(bytes: Uint8Array) {
  const stream = new Blob([bytes as BlobPart])
    .stream()
    .pipeThrough(new DecompressionStream('deflate'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** PNG 예측(Predictor 10~15)을 풀어 픽셀만 남긴다. 예측이 없으면(1) 그대로. */
function unpredict(
  data: Uint8Array,
  width: number,
  height: number,
  components: number,
  predictor: number,
) {
  const rowBytes = width * components;
  if (predictor === 1) return data.byteLength >= rowBytes * height ? data : null;
  if (predictor < 10) return null;
  const out = new Uint8Array(rowBytes * height);
  let input = 0;
  for (let row = 0; row < height; row += 1) {
    if (input + 1 + rowBytes > data.byteLength) return null;
    const type = data[input];
    input += 1;
    const start = row * rowBytes;
    for (let i = 0; i < rowBytes; i += 1) {
      const raw = data[input + i];
      const left = i >= components ? out[start + i - components] : 0;
      const up = row > 0 ? out[start - rowBytes + i] : 0;
      const upLeft = row > 0 && i >= components ? out[start - rowBytes + i - components] : 0;
      let value = raw;
      if (type === 1) value = raw + left;
      else if (type === 2) value = raw + up;
      else if (type === 3) value = raw + ((left + up) >> 1);
      else if (type === 4) {
        const p = left + up - upLeft;
        const pa = Math.abs(p - left);
        const pb = Math.abs(p - up);
        const pc = Math.abs(p - upLeft);
        value = raw + (pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft);
      } else if (type !== 0) return null;
      out[start + i] = value & 0xff;
    }
    input += rowBytes;
  }
  return out;
}

function toImageData(pixels: Uint8Array, width: number, height: number, components: number) {
  const rgba = new Uint8ClampedArray(width * height * 4);
  for (let i = 0, j = 0; i < width * height; i += 1, j += components) {
    const r = pixels[j];
    rgba[i * 4] = r;
    rgba[i * 4 + 1] = components === 3 ? pixels[j + 1] : r;
    rgba[i * 4 + 2] = components === 3 ? pixels[j + 2] : r;
    rgba[i * 4 + 3] = 255;
  }
  return new ImageData(rgba, width, height);
}

async function encodeJpeg(
  source: CanvasImageSource & { width: number; height: number },
  scale: number,
  quality: number,
) {
  const width = Math.max(1, Math.round(source.width * scale));
  const height = Math.max(1, Math.round(source.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) return null;
  context.fillStyle = '#fff';
  context.fillRect(0, 0, width, height);
  context.drawImage(source, 0, 0, width, height);
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', quality),
  );
  canvas.width = canvas.height = 0;
  if (!blob) return null;
  return { bytes: new Uint8Array(await blob.arrayBuffer()), width, height, byteLength: blob.size };
}

/* ---------------- 2단계: 페이지를 그림으로 ---------------- */

async function rasterizePages(bytes: Uint8Array, maxSide: number, quality: number) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  if (!pdfjs.GlobalWorkerOptions.workerSrc)
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/legacy/build/pdf.worker.min.mjs',
      import.meta.url,
    ).toString();
  const lib = await import('pdf-lib');
  // pdf.js는 넘긴 데이터를 가져가 버리므로 복사본을 준다.
  const task = pdfjs.getDocument({ data: bytes.slice() });
  const source = await task.promise;
  try {
    const out = await lib.PDFDocument.create();
    for (let number = 1; number <= source.numPages; number += 1) {
      const page = await source.getPage(number);
      const base = page.getViewport({ scale: 1 });
      const scale = maxSide / Math.max(base.width, base.height);
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      const context = canvas.getContext('2d');
      if (!context) return null;
      context.fillStyle = '#fff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvas, canvasContext: context, viewport }).promise;
      const jpeg = await encodeJpeg(canvas, 1, quality);
      page.cleanup();
      if (!jpeg) return null;
      const image = await out.embedJpg(jpeg.bytes);
      const target = out.addPage([base.width, base.height]);
      target.drawImage(image, { x: 0, y: 0, width: base.width, height: base.height });
    }
    return saveDoc(out);
  } finally {
    await task.destroy();
  }
}
