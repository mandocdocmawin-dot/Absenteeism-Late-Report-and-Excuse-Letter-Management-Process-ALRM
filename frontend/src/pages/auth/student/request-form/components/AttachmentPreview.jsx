import { useEffect, useRef } from "react";
import { FileText } from "lucide-react";

export default function AttachmentPreview({ file }) {
  const imageRef = useRef(null);
  const isImage = file.type.startsWith("image/");

  useEffect(() => {
    if (!isImage) return;
    const url = URL.createObjectURL(file);
    if (imageRef.current) imageRef.current.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file, isImage]);

  if (isImage) {
    return <img ref={imageRef} alt={`Preview of ${file.name}`} className="h-64 w-full min-w-0 object-contain" />;
  }

  return <div role="img" aria-label={`Preview of ${file.name}`} className="grid w-full min-w-0 justify-items-center gap-3">
    <FileText aria-hidden="true" className="size-16 text-[#65799E]" />
    <p className="max-w-full break-words text-sm font-semibold text-[#101C4A] [overflow-wrap:anywhere]">{file.name}</p>
    <p className="text-sm text-slate-600">PDF document</p>
  </div>;
}
