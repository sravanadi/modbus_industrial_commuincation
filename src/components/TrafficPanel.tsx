import { FileSpreadsheet, Minus, Pause, Play, Plus, Trash2 } from "lucide-react";
import { downloadExcelXml } from "../lib/excel";
import { useStudioStore } from "../stores/useStudioStore";
import { ContainerHeader } from "./ContainerHeader";

export function TrafficPanel() {
  const {
    trafficLog,
    minimized,
    trafficPaused,
    trafficHeight,
    adjustTrafficHeight,
    setTrafficHeight,
    toggleTrafficPaused,
    clearTraffic,
  } = useStudioStore();

  const isMin = !!minimized["traffic"];

  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const startH = trafficHeight;
    const onMove = (ev: MouseEvent) => setTrafficHeight(startH + (startY - ev.clientY));
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  return (
    <section
      style={{ height: isMin ? 44 : trafficHeight }}
      className="clay-panel relative flex shrink-0 flex-col"
    >
      {!isMin && (
        <div
          onMouseDown={startResize}
          title="Drag to resize Traffic Monitor"
          className="h-1.5 w-full cursor-row-resize rounded-t-2xl hover:bg-sky-500/35"
        />
      )}

      <div className="px-3 py-2">
        <ContainerHeader
          id="traffic"
          zone="main"
          title="Traffic Monitor (TX / RX Hex)"
          badge={`${trafficLog.length}`}
        >
          {!isMin && (
            <>
              <button
                type="button"
                onClick={() => adjustTrafficHeight(-24)}
                title="Decrease Traffic Height"
                className="clay-btn flex h-6 w-6 items-center justify-center"
              >
                <Minus className="h-3 w-3" />
              </button>
              <button
                type="button"
                onClick={() => adjustTrafficHeight(24)}
                title="Increase Traffic Height"
                className="clay-btn flex h-6 w-6 items-center justify-center"
              >
                <Plus className="h-3 w-3" />
              </button>
            </>
          )}
          <button
            type="button"
            onClick={toggleTrafficPaused}
            className="clay-btn flex items-center gap-1 px-2 py-1 text-[11px] font-semibold"
          >
            {trafficPaused ? (
              <>
                <Play className="h-3 w-3 text-emerald-500" />
                Resume
              </>
            ) : (
              <>
                <Pause className="h-3 w-3 text-amber-500" />
                Pause
              </>
            )}
          </button>
          <button
            type="button"
            onClick={() =>
              downloadExcelXml(
                `modbus-traffic-${Date.now()}`,
                "TrafficLog",
                ["Timestamp", "Direction", "Transport", "Hex", "Decoded", "Error"],
                trafficLog.map((t) => [
                  t.timestamp,
                  t.direction,
                  t.transport,
                  t.hex,
                  t.decoded,
                  t.is_error ? "YES" : "NO",
                ])
              )
            }
            title="Download Traffic Logs as Excel (.xls)"
            className="clay-btn flex items-center gap-1 px-2 py-1 text-[11px] font-semibold"
          >
            <FileSpreadsheet className="h-3 w-3 text-emerald-500" />
            Excel
          </button>
          <button
            type="button"
            onClick={clearTraffic}
            className="clay-btn flex items-center gap-1 px-2 py-1 text-[11px] font-semibold"
          >
            <Trash2 className="h-3 w-3 text-rose-500" />
            Clear
          </button>
        </ContainerHeader>
      </div>

      {!isMin && (
        <div className="clay-inset mx-3 mb-3 min-h-0 flex-1 overflow-auto p-2 font-mono-tabular text-[11px]">
          {trafficLog.length === 0 ? (
            <div className="flex h-full items-center justify-center text-(--clay-ink-muted)">
              No frames captured yet.
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {trafficLog.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-baseline gap-3 rounded-lg px-2 py-1 hover:bg-(--clay-row-hover)"
                >
                  <span className="shrink-0 text-(--clay-ink-muted)">
                    {entry.timestamp}
                  </span>
                  <span
                    className={`w-7 shrink-0 rounded px-1 py-0.5 text-center text-[10px] font-bold ${
                      entry.direction === "TX"
                        ? "bg-sky-500/15 text-sky-500"
                        : "bg-emerald-500/15 text-emerald-500"
                    }`}
                  >
                    {entry.direction}
                  </span>
                  <span className="shrink-0 font-semibold">{entry.hex}</span>
                  <span className="truncate font-sans text-(--clay-ink-muted)">
                    {entry.decoded}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
