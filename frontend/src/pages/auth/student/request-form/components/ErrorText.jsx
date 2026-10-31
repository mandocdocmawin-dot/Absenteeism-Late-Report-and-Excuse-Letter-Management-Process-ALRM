export default function ErrorText({ message }) {
  if (!message) return null;

  return <p className="text-xs font-semibold text-red-600">{message}</p>;
}
