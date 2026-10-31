import { useEffect, useRef, useState } from "react";
import { CloudUpload, Eye, FileText, Info, RefreshCw, X } from "lucide-react";
import ErrorText from "../components/ErrorText";
import FormNavigation from "../components/FormNavigation";
import HeaderIdentity from "../components/HeaderIdentity";
import RequestShell from "../components/RequestShell";
import { EVIDENCE, proofOptions } from "../constants";
import { compressImage } from "../imageCompress";
import { validateEvidenceFile } from "../evidenceValidation";
import UploadProgress from "@/components/loading/UploadProgress";
import AttachmentPreview from "../components/AttachmentPreview";

export default function AttachmentStep({
  step,
  form,
  user,
  fieldErrors = {},
  updateField,
  toggleListField,
  onBack,
  onNext,
}) {
  const inputRef = useRef(null);
  const [fileError, setFileError] = useState("");
  const [processing, setProcessing] = useState(false);
  const processingRef = useRef(false);
  const previewUrls = useRef(new Set());
  const previewDialogRef = useRef(null);
  const previewImageRef = useRef(null);
  const imagePreviewUrlRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const dragDepth = useRef(0);
  const file = form.evidenceFile;
  const evidenceError = fileError || fieldErrors.evidenceFile;
  const fileTypeLabel = file?.type === "application/pdf" ? "PDF document" : file?.type === "image/png" ? "PNG image" : "JPG image";
  const actionClass = "inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-[#CCD6E8] bg-white px-3 text-sm font-semibold text-[#101C4A] transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-50";

  useEffect(() => {
    const urls = previewUrls.current;
    const imageUrl = imagePreviewUrlRef;
    return () => {
      for (const url of urls) URL.revokeObjectURL(url);
      urls.clear();
      if (imageUrl.current) URL.revokeObjectURL(imageUrl.current);
      imageUrl.current = null;
    };
  }, []);

  function openFile() {
    const file = form.evidenceFile;
    if (!file) return;
    const url = URL.createObjectURL(file);
    if (file.type.startsWith("image/")) {
      if (imagePreviewUrlRef.current) URL.revokeObjectURL(imagePreviewUrlRef.current);
      imagePreviewUrlRef.current = url;
      previewImageRef.current.src = url;
      previewDialogRef.current.showModal();
    } else {
      previewUrls.current.add(url);
      const link = document.createElement("a");
      link.href = url;
      link.download = file.name;
      link.click();
    }
  }

  function clearImagePreview() {
    previewImageRef.current?.removeAttribute("src");
    if (imagePreviewUrlRef.current) URL.revokeObjectURL(imagePreviewUrlRef.current);
    imagePreviewUrlRef.current = null;
  }

  function clearInput() {
    if (inputRef.current) inputRef.current.value = "";
  }

  async function selectFile(picked) {
    if (!picked || processingRef.current) return;
    processingRef.current = true;
    setProcessing(true);
    setFileError("");
    try {
      const validatedFile = await validateEvidenceFile(picked);
      const file = await compressImage(validatedFile);
      if (file.size > EVIDENCE.maxBytes) {
        throw new Error("File is too large after resizing. Maximum upload size is 2MB.");
      }
      updateField("evidenceFile", file);
    } catch (error) {
      const message = error?.message || "Unable to process this file. Choose another file.";
      setFileError(`Could not select "${picked.name}": ${message}${form.evidenceFile ? " Your previously selected file is still attached." : ""}`);
    } finally {
      clearInput();
      processingRef.current = false;
      setProcessing(false);
    }
  }

  function handleFileChange(event) {
    selectFile(event.target.files?.[0]);
  }

  function handleDrop(event) {
    event.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    if (processingRef.current) return;
    if (event.dataTransfer.files.length !== 1) {
      setFileError("Choose one file at a time.");
      return;
    }
    selectFile(event.dataTransfer.files[0]);
  }

  function removeFile() {
    setFileError("");
    clearInput();
    updateField("evidenceFile", null);
  }

  return (
    <RequestShell requestType={form.requestType} step={step}>
      <HeaderIdentity requestType={form.requestType} step={step} user={user} />

      {form.requestType === "absence" && (
        <section aria-labelledby="absence-proof-heading" className={`grid gap-4 rounded-md bg-[#F7F7F7] p-4 ${fieldErrors.proof_types ? "ring-2 ring-red-500" : ""}`}>
          <h2 id="absence-proof-heading" className="text-sm font-bold uppercase text-[#203B82]">Explanation</h2>
          <fieldset className="grid gap-3">
            <legend className="mb-4 text-sm font-bold text-[#203B82]">Supporting Documents/ Proof of Absence</legend>
            {proofOptions.map((proof) => (
              <label
                key={proof}
                className="flex items-center gap-2 text-sm text-slate-700"
              >
                <input
                  type="checkbox"
                  name="proof_types"
                  value={proof}
                  checked={(form.proof_types || []).includes(proof)}
                  onChange={() => toggleListField("proof_types", proof)}
                  aria-invalid={Boolean(fieldErrors.proof_types)}
                  className="accent-[#203B82]"
                />
                {proof}
              </label>
            ))}
          </fieldset>
          <ErrorText message={fieldErrors.proof_types} />
        </section>
      )}
      {form.requestType !== "absence" && <ErrorText message={fieldErrors.proof_types} />}

      <section aria-labelledby="attachment-heading" aria-busy={processing} className="grid gap-5 rounded-2xl border border-[#D8E0EF] bg-white p-4 shadow-[0_8px_30px_rgba(16,28,74,0.03)] sm:p-6">
        <div className="grid gap-2">
          <h2 id="attachment-heading" className="text-base font-bold leading-snug text-[#0B1229] sm:text-lg">
            Please attach any applicable supporting document(s):
          </h2>
          <p id="attachment-hint" className="text-sm text-[#7C8CAA]">Required &bull; Upload 1 file &bull; PDF, JPG, PNG &bull; Max 2 MB</p>
        </div>
        <div
          onDragEnter={(event) => {
            event.preventDefault();
            if (processingRef.current || !event.dataTransfer.types.includes("Files")) return;
            dragDepth.current += 1;
            setDragging(true);
          }}
          onDragOver={(event) => {
            event.preventDefault();
            event.dataTransfer.dropEffect = processingRef.current ? "none" : "copy";
          }}
          onDragLeave={(event) => {
            event.preventDefault();
            dragDepth.current = Math.max(0, dragDepth.current - 1);
            if (dragDepth.current === 0) setDragging(false);
          }}
          onDrop={handleDrop}
          className={`flex min-h-48 flex-col items-center justify-center gap-4 rounded-xl border border-dashed px-4 py-7 text-center transition-colors ${dragging ? "border-blue-600 bg-blue-50" : "border-[#B8C8E5] bg-[#F7F9FE]"}`}
        >
          {processing ? <UploadProgress label="Checking your file..." className="flex-col" /> : file ? <AttachmentPreview file={file} /> : <>
            <CloudUpload aria-hidden="true" className="size-12 text-[#66799E]" strokeWidth={1.7} />
            <p role="status" className="text-base font-medium text-[#0B1229]">
              {dragging ? "Drop your file here" : "Drag and drop your file here"}
            </p>
          </>}
          {!file && <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={processing}
            className="inline-flex h-11 items-center justify-center rounded-lg bg-[#1960F2] px-7 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Choose file
          </button>}
          <input
            ref={inputRef}
            type="file"
            accept={EVIDENCE.accept}
            aria-label="Choose supporting document"
            aria-required="true"
            aria-invalid={Boolean(evidenceError)}
            aria-describedby={evidenceError ? "attachment-error" : "attachment-hint"}
            className="hidden"
            disabled={processing}
            onChange={handleFileChange}
          />
        </div>
        {file && (
          <div className="flex flex-wrap items-center gap-4 rounded-xl border border-[#D8E0EF] bg-[#FDFEFF] p-4">
            <div className="min-w-0 flex-1 basis-28">
              <button type="button" onClick={openFile} disabled={processing} title={file.name} className="block max-w-full truncate text-left text-base font-bold text-[#0B1229] hover:text-blue-600 focus-visible:outline-2 focus-visible:outline-blue-600">
                {file.name}
              </button>
              <p className="mt-1 text-xs text-[#7183A5] sm:text-sm">{fileTypeLabel} &bull; Ready to upload</p>
            </div>
            <div className="flex w-full items-center gap-2 sm:w-auto">
            <button
              type="button"
              onClick={openFile}
              disabled={processing}
              title={file.type.startsWith("image/") ? "Preview image" : "Download PDF"}
              className={`${actionClass} flex-1 sm:flex-none`}
            >
              {file.type.startsWith("image/") ? <Eye aria-hidden="true" className="size-4" /> : <FileText aria-hidden="true" className="size-4" />}
              {file.type.startsWith("image/") ? "Preview" : "Download"}
            </button>
            <span aria-hidden="true" className="h-8 w-px bg-[#D4DDEE]" />
            <button type="button" onClick={() => inputRef.current?.click()} disabled={processing} className={`${actionClass} flex-1 sm:flex-none`}>
              <RefreshCw aria-hidden="true" className="size-4" />
              Change
            </button>
            <button
              type="button"
              onClick={removeFile}
              aria-label="Remove file"
              disabled={processing}
              className="flex size-10 shrink-0 items-center justify-center rounded-lg text-[#66799E] transition-colors hover:bg-red-50 hover:text-red-600 focus-visible:outline-2 focus-visible:outline-blue-600 disabled:opacity-50"
            >
              <X aria-hidden="true" className="size-6" />
            </button>
            </div>
          </div>
        )}
        {file && (
          <p className="flex items-start gap-3 text-xs leading-relaxed text-[#7C8CAA] sm:text-sm">
            <Info aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-[#1960F2]" />
            File selected. You can {file.type.startsWith("image/") ? "preview" : "download"}, change, or remove it before submitting.
          </p>
        )}
        {evidenceError && (
          <p id="attachment-error" role="alert" className="text-xs font-semibold text-red-600">{evidenceError}</p>
        )}
      </section>
      <dialog
        ref={previewDialogRef}
        aria-labelledby="attachment-preview-title"
        onClose={clearImagePreview}
        onClick={(event) => {
          if (event.target !== event.currentTarget) return;
          const bounds = event.currentTarget.getBoundingClientRect();
          if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) {
            event.currentTarget.close();
          }
        }}
        className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-3xl overflow-auto rounded-2xl border border-[#D8E0EF] bg-white p-0 text-[#0B1229] shadow-2xl backdrop:bg-slate-950/60 backdrop:backdrop-blur-sm"
      >
        <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div className="min-w-0">
            <h2 id="attachment-preview-title" className="text-lg font-bold">Attachment preview</h2>
            <p className="mt-1 truncate text-sm text-[#7183A5]" title={file?.name}>{file?.name}</p>
          </div>
          <button
            type="button"
            onClick={() => previewDialogRef.current?.close()}
            aria-label="Close preview"
            className="flex size-10 shrink-0 items-center justify-center rounded-lg text-[#66799E] hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-blue-600"
          >
            <X aria-hidden="true" className="size-6" />
          </button>
        </div>
        <div className="flex min-h-40 items-center justify-center bg-slate-50 p-4 sm:p-6">
          <img ref={previewImageRef} alt={file ? `Preview of ${file.name}` : "Attachment preview"} className="max-h-[65dvh] max-w-full rounded-lg object-contain" />
        </div>
      </dialog>
      <FormNavigation backDisabled={processing} nextDisabled={processing || !file} onBack={onBack} onNext={onNext} />
    </RequestShell>
  );
}
