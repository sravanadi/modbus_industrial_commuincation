import { useEffect, useState } from "react";
import { Send } from "lucide-react";
import { formatRegisterValue } from "../lib/decode";
import { useStudioStore, WordOrder } from "../stores/useStudioStore";
import { ContainerHeader } from "./ContainerHeader";

export function InspectorPanel() {
  const {
    inspectorWidth,
    minimized,
    pollWindows,
    activeWindowId,
    selectedAddress,
    setWordOrder,
    updateRowMeta,
    writeValue,
    maskWriteBit,
    connected,
  } = useStudioStore();

  const isDockMin = !!minimized["inspector"];

  const activeWin = pollWindows.find((w) => w.id === activeWindowId);
  const selectedRow =
    selectedAddress !== null
      ? activeWin?.rows.find((r) => r.address === selectedAddress)
      : undefined;

  const [writeInput, setWriteInput] = useState("");

  useEffect(() => {
    if (selectedRow && selectedRow.rawValue !== null) {
      setWriteInput(String(selectedRow.rawValue));
    } else {
      setWriteInput("");
    }
  }, [selectedRow?.address, selectedRow?.rawValue]);

  const wordOrders: WordOrder[] = ["AB CD", "CD AB", "BA DC", "DC BA"];

  const handleWrite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWin || !selectedRow) return;
    const num = Number(writeInput);
    if (!Number.isNaN(num)) {
      await writeValue(activeWin.id, selectedRow.address, num);
    }
  };

  const raw = selectedRow?.rawValue ?? null;
  const signedVal = raw === null ? null : raw > 32767 ? raw - 65536 : raw;
  const rowIndex = activeWin?.rows.findIndex((r) => r.address === selectedAddress) ?? -1;
  const rawSeries = activeWin?.rows.map((r) => r.rawValue) ?? [];
  const float32Val =
    activeWin && rowIndex >= 0
      ? formatRegisterValue(rawSeries, rowIndex, "Float32", activeWin.wordOrder, activeWin.functionCode)
      : "—";
  const int32Val =
    activeWin && rowIndex >= 0
      ? formatRegisterValue(rawSeries, rowIndex, "Int32", activeWin.wordOrder, activeWin.functionCode)
      : "—";

  const isWritable =
    activeWin?.functionCode === 1 || activeWin?.functionCode === 3;

  return (
    <aside
      style={{ width: isDockMin ? 48 : inspectorWidth }}
      className="clay-panel flex shrink-0 flex-col gap-3.5 overflow-hidden p-3.5 transition-[width] duration-150"
    >
      <ContainerHeader
        id="inspector"
        zone="dock"
        title={isDockMin ? "" : "Register Inspector"}
        badge={!isDockMin ? (selectedRow ? `#${selectedRow.address}` : "None") : undefined}
      />

      {!isDockMin && (!selectedRow ? (
        <div className="clay-inset flex flex-1 items-center justify-center p-4 text-center text-xs text-(--clay-ink-muted)">
          Select a register row in the grid to inspect raw formats and write values.
        </div>
      ) : (
        <>
          <div className="clay-card p-3">
            <div className="text-xs font-bold">
              Address {selectedRow.address} (FC0{activeWin?.functionCode})
            </div>
            <div className="mt-1 font-mono-tabular text-xl font-bold text-sky-500">
              {raw !== null ? raw : "—"}
            </div>
          </div>

          {/* Multi-Format Breakdown */}
          <div className="clay-inset flex flex-col gap-1.5 p-3 font-mono-tabular text-xs">
            <div className="flex justify-between">
              <span className="text-(--clay-ink-muted)">Signed</span>
              <span className="font-semibold">{signedVal ?? "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-(--clay-ink-muted)">Unsigned</span>
              <span className="font-semibold">{raw ?? "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-(--clay-ink-muted)">Hex</span>
              <span className="font-semibold">
                {raw !== null
                  ? "0x" + raw.toString(16).toUpperCase().padStart(4, "0")
                  : "—"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-(--clay-ink-muted)">Binary</span>
              <span className="text-[11px] font-semibold">
                {raw !== null ? raw.toString(2).padStart(16, "0") : "—"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-(--clay-ink-muted)">Int32</span>
              <span className="font-semibold">{int32Val}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-(--clay-ink-muted)">Float32</span>
              <span className="font-semibold">{float32Val}</span>
            </div>
          </div>

          {/* 16-Bit Interactive Toggle (FC22 Mask Write) */}
          {activeWin && activeWin.functionCode === 3 && raw !== null && (
            <div>
              <div className="mb-1 px-1 text-[11px] font-semibold text-(--clay-ink-muted)">
                16-Bit Toggle (FC22 Mask Write)
              </div>
              <div className="grid grid-cols-8 gap-1 font-mono-tabular text-[10px]">
                {Array.from({ length: 16 }, (_, idx) => 15 - idx).map((bit) => {
                  const isOn = ((raw >> bit) & 1) === 1;
                  return (
                    <button
                      key={bit}
                      type="button"
                      disabled={!connected}
                      onClick={() =>
                        maskWriteBit(activeWin.id, selectedRow.address, bit, !isOn)
                      }
                      title={`Bit ${bit} = ${isOn ? 1 : 0} (click to flip)`}
                      className={`py-1 font-bold disabled:opacity-40 ${
                        isOn ? "clay-btn-primary" : "clay-btn"
                      }`}
                    >
                      {bit}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Byte / Word Order */}
          {activeWin && (
            <div>
              <div className="mb-1.5 px-1 text-[11px] font-semibold text-(--clay-ink-muted)">
                32/64-bit Byte/Word Swap
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {wordOrders.map((order) => (
                  <button
                    key={order}
                    type="button"
                    onClick={() => setWordOrder(activeWin.id, order)}
                    className={`px-2 py-1.5 font-mono-tabular text-[11px] font-semibold ${
                      activeWin.wordOrder === order ? "clay-btn-primary" : "clay-btn"
                    }`}
                  >
                    {order}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Scaling, Unit & Alarm Thresholds */}
          {activeWin && (
            <div className="grid grid-cols-3 gap-1.5 text-[11px]">
              <label className="flex flex-col gap-0.5">
                <span className="text-(--clay-ink-muted)">Scale</span>
                <input
                  type="number"
                  step="any"
                  value={selectedRow.scale}
                  onChange={(e) =>
                    updateRowMeta(activeWin.id, selectedRow.address, {
                      scale: Number(e.target.value) || 1,
                    })
                  }
                  className="clay-inset px-2 py-1 font-mono-tabular outline-none"
                />
              </label>
              <label className="flex flex-col gap-0.5">
                <span className="text-(--clay-ink-muted)">Offset</span>
                <input
                  type="number"
                  step="any"
                  value={selectedRow.offset}
                  onChange={(e) =>
                    updateRowMeta(activeWin.id, selectedRow.address, {
                      offset: Number(e.target.value) || 0,
                    })
                  }
                  className="clay-inset px-2 py-1 font-mono-tabular outline-none"
                />
              </label>
              <label className="flex flex-col gap-0.5">
                <span className="text-(--clay-ink-muted)">Unit</span>
                <input
                  type="text"
                  value={selectedRow.unit}
                  onChange={(e) =>
                    updateRowMeta(activeWin.id, selectedRow.address, {
                      unit: e.target.value,
                    })
                  }
                  className="clay-inset px-2 py-1 outline-none"
                />
              </label>
              <label className="flex flex-col gap-0.5">
                <span className="text-(--clay-ink-muted)">Min Alarm</span>
                <input
                  type="number"
                  placeholder="—"
                  value={selectedRow.minAlarm ?? ""}
                  onChange={(e) =>
                    updateRowMeta(activeWin.id, selectedRow.address, {
                      minAlarm: e.target.value === "" ? null : Number(e.target.value),
                    })
                  }
                  className="clay-inset px-2 py-1 font-mono-tabular outline-none"
                />
              </label>
              <label className="flex flex-col gap-0.5">
                <span className="text-(--clay-ink-muted)">Max Alarm</span>
                <input
                  type="number"
                  placeholder="—"
                  value={selectedRow.maxAlarm ?? ""}
                  onChange={(e) =>
                    updateRowMeta(activeWin.id, selectedRow.address, {
                      maxAlarm: e.target.value === "" ? null : Number(e.target.value),
                    })
                  }
                  className="clay-inset px-2 py-1 font-mono-tabular outline-none"
                />
              </label>
            </div>
          )}

          {/* Quick Write Form */}
          <form onSubmit={handleWrite} className="mt-auto flex flex-col gap-2">
            <label
              htmlFor="quick-write-input"
              className="px-1 text-[11px] font-semibold text-(--clay-ink-muted)"
            >
              {isWritable
                ? `Quick Write (${activeWin?.functionCode === 1 ? "FC05" : "FC06"})`
                : `Read-Only (FC0${activeWin?.functionCode})`}
            </label>
            <div className="flex gap-2">
              <input
                id="quick-write-input"
                type="number"
                disabled={!connected || !isWritable}
                value={writeInput}
                onChange={(e) => setWriteInput(e.target.value)}
                className="clay-inset min-w-0 flex-1 px-3 py-1.5 font-mono-tabular text-xs outline-none disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!connected || !isWritable}
                className="clay-btn-primary flex items-center gap-1 px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
              >
                <Send className="h-3.5 w-3.5" />
                Write
              </button>
            </div>
          </form>
        </>
      ))}
    </aside>
  );
}
