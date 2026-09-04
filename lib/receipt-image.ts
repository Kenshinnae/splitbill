/**
 * Normalize phone camera photos for Firebase Storage + OpenAI.
 * iPhone HEIC / huge JPEGs often cause flaky uploads.
 */
const MAX_EDGE_RECEIPT = 2048;
const MAX_EDGE_QR = 1200;
const JPEG_QUALITY_RECEIPT = 0.85;
const JPEG_QUALITY_QR = 0.92;

async function canvasToJpegFile(
  file: File,
  maxEdge: number,
  quality: number,
  nameSuffix: string,
): Promise<File> {
  if (typeof createImageBitmap !== "function") {
    return file;
  }

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return file;
    }
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", quality);
    });
    if (!blob) return file;

    const base = file.name.replace(/\.[^.]+$/, "") || nameSuffix;
    return new File([blob], `${base}.jpg`, {
      type: "image/jpeg",
      lastModified: Date.now(),
    });
  } catch {
    return file;
  }
}

export async function normalizeReceiptImage(file: File): Promise<File> {
  return canvasToJpegFile(
    file,
    MAX_EDGE_RECEIPT,
    JPEG_QUALITY_RECEIPT,
    "receipt",
  );
}

/** Keep QR codes sharper than receipt compression. */
export async function normalizePaymentQrImage(file: File): Promise<File> {
  return canvasToJpegFile(file, MAX_EDGE_QR, JPEG_QUALITY_QR, "payment-qr");
}
