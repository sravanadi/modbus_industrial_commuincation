import { ChevronDown, ChevronUp, GripVertical } from "lucide-react";
import { useStudioStore } from "../stores/useStudioStore";

interface ContainerHeaderProps {
  id: string;
  zone: "dock" | "main" | "sidebar";
  title: string;
  badge?: string;
  children?: React.ReactNode;
}

export function ContainerHeader({
  id,
  zone,
  title,
  badge,
  children,
}: ContainerHeaderProps) {
  const { minimized, toggleMinimized, reorderList } = useStudioStore();
  const isMin = !!minimized[id];

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", `${zone}:${id}`);
        e.dataTransfer.effectAllowed = "move";
      }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const raw = e.dataTransfer.getData("text/plain");
        const [srcZone, srcId] = raw.split(":");
        if (srcZone === zone && srcId) {
          reorderList(zone, srcId, id);
        }
      }}
      className="flex cursor-grab items-center justify-between gap-2 select-none active:cursor-grabbing"
    >
      <div className="flex min-w-0 items-center gap-1.5">
        <GripVertical className="h-3.5 w-3.5 shrink-0 text-(--clay-ink-muted)" />
        <span className="truncate text-[11px] font-bold uppercase tracking-wider text-(--clay-ink-muted)">
          {title}
        </span>
        {badge && (
          <span className="clay-inset px-1.5 py-0.5 font-mono-tabular text-[10px]">
            {badge}
          </span>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {children}
        <button
          type="button"
          onClick={() => toggleMinimized(id)}
          title={isMin ? `Expand ${title}` : `Minimize ${title}`}
          aria-label={isMin ? `Expand ${title}` : `Minimize ${title}`}
          className="clay-btn flex h-6 w-6 items-center justify-center"
        >
          {isMin ? (
            <ChevronDown className="h-3.5 w-3.5 text-sky-500" />
          ) : (
            <ChevronUp className="h-3.5 w-3.5 text-(--clay-ink-muted)" />
          )}
        </button>
      </div>
    </div>
  );
}
