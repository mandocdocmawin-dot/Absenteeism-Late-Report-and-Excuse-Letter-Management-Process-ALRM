import { EVIDENCE } from "./constants.js";

// Returns a file with its detected type. Images must still be decoded/re-encoded.
// Browser checks improve feedback. The upload endpoint must repeat validation.
export async function validateEvidenceFile(file) {
  const isImageName = /\.(jpe?g|png)$/i.test(file.name);
  const isPdfName = /\.pdf$/i.test(file.name);
  if (!isImageName && !isPdfName) {
    throw new Error("Only PDF, JPG, or PNG files are allowed.");
  }
  if (!file.size) throw new Error("The file is empty.");
  const limit = isPdfName ? EVIDENCE.maxBytes : EVIDENCE.maxInputBytes;
  if (file.size > limit) {
    throw new Error(isPdfName
      ? "PDF files must be no larger than 2MB."
      : "Choose an image no larger than 10MB. It will be resized to fit the 2MB upload limit.");
  }
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const signatures = {
    "image/jpeg": [0xff, 0xd8, 0xff],
    "image/png": [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
    "application/pdf": [0x25, 0x50, 0x44, 0x46, 0x2d],
  };
  const detectedType = Object.keys(signatures).find((type) =>
    signatures[type].every((byte, index) => bytes[index] === byte),
  );
  if (!detectedType) {
    const header = String.fromCharCode(...bytes);
    if (header.startsWith("RIFF") && header.slice(8, 12) === "WEBP") {
      throw new Error("This file is a WebP image renamed as JPG or PNG. Export it as a real JPG or PNG before attaching it.");
    }
    if (header.startsWith("GIF87a") || header.startsWith("GIF89a")) {
      throw new Error("This file is a GIF image renamed as JPG or PNG. Export it as a real JPG or PNG before attaching it.");
    }
    throw new Error("The file contents do not match its type. Choose a valid PDF, JPG, or PNG.");
  }

  // Only normalize between supported raster image formats, never between PDF and image.
  if (isPdfName !== (detectedType === "application/pdf")) {
    throw new Error("The file contents do not match its extension. Use a matching PDF or image file.");
  }
  const extension = { "image/jpeg": ".jpg", "image/png": ".png", "application/pdf": ".pdf" }[detectedType];
  return new File([file], file.name.replace(/\.[^.]+$/, extension), {
    type: detectedType,
    lastModified: file.lastModified,
  });
}
