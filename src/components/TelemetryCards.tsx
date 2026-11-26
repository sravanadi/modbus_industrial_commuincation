import { Activity, AlertTriangle, Gauge, Radio } from "lucide-react";
import { useStudioStore } from "../stores/useStudioStore";
import { ContainerHeader } from "./ContainerHeader";

export function TelemetryCards() {
  const { stats, pollWindows, activeWindowId, polling, connected, minimized } =
    useStudioStore();
  const activeWin = pollWindows.find((w) => w.id === activeWindowId);
  const isMin = !!minimized["telemetry"];

  const successRate =
    stats.tx_count > 0
      ? Math.round((stats.rx_valid_count / stats.tx_count) * 100)
      : 0;
  const totalErrors = stats.crc_errors + stats.timeouts + stats.exception_count;

  return (
    <section className="clay-panel flex shrink-0 flex-col gap-2.5 p-3">
      <ContainerHeader
        id="telemetry"
        zone="main"
        title="Telemetry"
        badge={`${stats.rx_valid_count}/${stats.tx_count}`}
      />
      {!isMin && (
        <div className="grid grid-cols-4 gap-3">
          <div className="clay-card flex items-center justify-between px-3.5 py-2.5">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-(--clay-ink-muted)">
                Transactions
              </div>
              <div className="mt-0.5 font-mono-tabular text-base font-bold">
                {stats.rx_valid_count}
                <span className="text-xs font-normal text-(--clay-ink-muted)">
                  {" "}
                  / {stats.tx_count}
                </span>
              </div>
              <div className="text-[11px] font-medium text-emerald-500">
                {stats.tx_count > 0 ? `${successRate}% valid RX` : "No traffic"}
              </div>
            </div>
            <div className="clay-inset flex h-9 w-9 items-center justify-center rounded-xl">
              <Activity className="h-4.5 w-4.5 text-emerald-500" />
            </div>
          </div>

          <div className="clay-card flex items-center justify-between px-3.5 py-2.5">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-(--clay-ink-muted)">
                Response Time
              </div>
              <div className="mt-0.5 font-mono-tabular text-base font-bold">
                {stats.avg_ms.toFixed(1)}
                <span className="text-xs font-normal text-(--clay-ink-muted)"> ms</span>
              </div>
              <div className="font-mono-tabular text-[11px] text-(--clay-ink-muted)">
                min {stats.min_ms.toFixed(1)} · max {stats.max_ms.toFixed(1)}
              </div>
            </div>
            <div className="clay-inset flex h-9 w-9 items-center justify-center rounded-xl">
              <Gauge className="h-4.5 w-4.5 text-sky-500" />
            </div>
          </div>

          <div className="clay-card flex items-center justify-between px-3.5 py-2.5">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-(--clay-ink-muted)">
                Errors &amp; Alerts
              </div>
              <div className="mt-0.5 font-mono-tabular text-base font-bold">
                {totalErrors}
              </div>
              <div className="font-mono-tabular text-[11px] text-(--clay-ink-muted)">
                CRC {stats.crc_errors} · TO {stats.timeouts} · Exc {stats.exception_count}
              </div>
            </div>
            <div className="clay-inset flex h-9 w-9 items-center justify-center rounded-xl">
              <AlertTriangle
                className={`h-4.5 w-4.5 ${
                  totalErrors > 0 ? "text-rose-500" : "text-amber-500"
                }`}
              />
            </div>
          </div>

          <div className="clay-card flex items-center justify-between px-3.5 py-2.5">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-(--clay-ink-muted)">
                Active Poll
              </div>
              <div className="mt-0.5 font-mono-tabular text-base font-bold">
                Slave #{activeWin?.slaveId ?? 1}
              </div>
              <div className="font-mono-tabular text-[11px] text-(--clay-ink-muted)">
                FC0{activeWin?.functionCode ?? 3} · {activeWin?.scanRateMs ?? 1000} ms ·{" "}
                {connected && polling ? "Live" : connected ? "Connected" : "Offline"}
              </div>
            </div>
            <div className="clay-inset flex h-9 w-9 items-center justify-center rounded-xl">
              <Radio
                className={`h-4.5 w-4.5 ${
                  connected && polling ? "text-sky-500 animate-pulse" : "text-slate-400"
                }`}
              />
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
