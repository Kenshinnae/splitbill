/** Decode and shrink phone photos before Storage/vision, including WebKit fallback. */
const MAX_BYTES = 15 * 1024 * 1024;
const SUPPORTED_IMAGE = /^image\/(jpeg|png|webp)$/i;
const UNSUPPORTED = "Choose a JPEG, PNG or WebP image. For HEIC, save as JPEG or use a screenshot.";

type DecodedImage = { source: CanvasImageSource; width: number; height: number; dispose: () => void };

async function decodeImage(file: File): Promise<DecodedImage> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file);
      return { source: bitmap, width: bitmap.width, height: bitmap.height, dispose: () => bitmap.close() };
    } catch { /* WebKit may decode the same photo through an <img> instead. */ }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      const timer = setTimeout(() => { image.src = ""; reject(new Error("Image decode timed out")); }, 20_000);
      image.onload = () => { clearTimeout(timer); resolve(image); };
      image.onerror = () => { clearTimeout(timer); reject(new Error("Image decode failed")); };
      image.src = url;
    });
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, dispose: () => { img.src = ""; URL.revokeObjectURL(url); } };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}

async function canvasToJpegFile(file: File, maxEdge: number, quality: number): Promise<File> {
  let decoded: DecodedImage | undefined;
  let canvas: HTMLCanvasElement | undefined;
  try {
    decoded = await decodeImage(file);
    if (!decoded.width || !decoded.height) throw new Error("Empty image");
    const scale = Math.min(1, maxEdge / Math.max(decoded.width, decoded.height));
    canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(decoded.width * scale));
    canvas.height = Math.max(1, Math.round(decoded.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas unavailable");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(decoded.source, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas!.toBlob((value) => value ? resolve(value) : reject(new Error("JPEG conversion failed")), "image/jpeg", quality);
    });
    if (blob.size > MAX_BYTES) throw new Error("Image too large");
    return new File([blob], `${file.name.replace(/\.[^.]+$/, "") || "photo"}.jpg`, { type: "image/jpeg", lastModified: Date.now() });
  } catch {
    // Never disguise unsupported bytes (e.g. HEIC) as JPEG. Small supported images
    // can still be uploaded when canvas is unavailable.
    if (!SUPPORTED_IMAGE.test(file.type)) throw new Error(UNSUPPORTED);
    if (file.size > MAX_BYTES) throw new Error("This image is too large. Choose a smaller photo (up to 15 MB).");
    if (!file.size) throw new Error("Could not prepare this photo. Try a JPEG or a screenshot.");
    return file;
  } finally {
    decoded?.dispose();
    if (canvas) { canvas.width = 0; canvas.height = 0; }
  }
}

export function normalizeReceiptImage(file: File): Promise<File> {
  return canvasToJpegFile(file, 2048, 0.85);
}

export function normalizePaymentQrImage(file: File): Promise<File> {
  return canvasToJpegFile(file, 1200, 0.92);
}
