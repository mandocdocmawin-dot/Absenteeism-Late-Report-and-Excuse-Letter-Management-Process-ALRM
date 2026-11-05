import ClassForm from "./ClassForm";

function openDialog(element) {
  if (element && !element.open) element.showModal();
}

export default function ClassFormDialog({ item, programs, saving, onCancel, onSave }) {
  function close(event) {
    event.preventDefault();
    if (!saving) onCancel();
  }

  return <dialog ref={openDialog} aria-modal="true" aria-labelledby="class-form-title" aria-busy={saving}
    onCancel={close}
    onClick={event => { if (event.target === event.currentTarget) close(event); }}
    className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-5xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-1 shadow-xl backdrop:bg-black/40">
    <ClassForm item={item} programs={programs} saving={saving} onCancel={onCancel} onSave={onSave} />
  </dialog>;
}
