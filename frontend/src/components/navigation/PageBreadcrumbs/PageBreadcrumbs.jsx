import { ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";

export default function PageBreadcrumbs({ items = [], className = "" }) {
  if (items.length < 2) return null;

  return (
    <nav aria-label="Breadcrumb" className={`min-w-0 text-sm font-medium ${className}`}>
      <ol className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
        {items.map((item, index) => (
          <li key={`${item.to || "current"}-${index}`} className="flex min-w-0 max-w-full items-center gap-2">
            {index > 0 && <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-slate-400" />}
            {index === items.length - 1 ? (
              <span aria-current="page" className="min-w-0 break-words [overflow-wrap:anywhere] text-slate-600">{item.label}</span>
            ) : (
              <Link to={item.to} className="min-w-0 break-words rounded-sm text-[#203B82] [overflow-wrap:anywhere] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#203B82]">{item.label}</Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
