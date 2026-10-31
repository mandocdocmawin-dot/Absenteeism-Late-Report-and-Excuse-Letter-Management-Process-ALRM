import { EVIDENCE } from "./constants.js";

export async function compressImage(file, { maxSize = 1600, quality = 0.8 } = {}) {
  if (!file.type.startsWith("image/")) return file;

  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
    if (!bitmap.width || !bitmap.height || bitmap.width * bitmap.height > EVIDENCE.maxImagePixels) {
      throw new Error("Choose an image with no more than 20 million pixels.");
    }
    const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);

    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fff"; 
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality),
    );
    if (!blob) throw new Error("Unable to process this image. Choose another file.");

    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", {
      type: "image/jpeg",
    });
  } catch (error) {
    throw new Error(error?.message || "Unable to process this image. Choose a valid JPG or PNG.", { cause: error });
  } finally {
    bitmap?.close();
  }
}
