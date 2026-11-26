import { useRef, useState } from "react";
import {
  Download,
  Edit3,
  FileSpreadsheet,
  Maximize2,
  Minimize2,
  Minus,
  Plus,
  Send,
  SlidersHorizontal,
  Upload,
  X,
} from "lucide-react";
import { formatRegisterValue } from "../lib/decode";
import { downloadExcelXml } from "../lib/excel";
import {
  DisplayFormat,
  PollWindow,
  useStudioStore,
} from "../stores/useStudioStore";
import { ContainerHeader } from "./ContainerHeader";

function toPlcAddress(win: PollWindow, addr: number): string {
  const base = addr + win.addressBase;
  switch (win.functionCode) {
    case 1:
      return String(base + 1).padStart(5, "0");
    case 2:
      return String(10001 + base);
    case 3:
      return String(40001 + base);
    case 4:
      return String(30001 + base);
  }
}

export function PollGrid() {
  const {
    pollWindows,
    activeWindowId,
    setActiveWindow,
    addPollWindow,
    removePollWindow,
    selectedAddress,
    setSelectedAddress,
    updatePollConfig,
    setDisplayFormat,
    setRowAlias,
    applyRegisterMap,
    togglePlcAddressing,
    toggleAddressBase,
    writeValue,
    setWriteDialogOpen,
    setDefinitionOpen,
    connected,
    minimized,
    pollMaximized,
    togglePollMaximized,
    gridRowHeight,
    adjustGridRowHeight,
  } = useStudioStore();

  const [editingAddr, setEditingAddr] = useState<number | null>(null);
  const [draftValue, setDraftValue] = useState("");
  const [scrollTop, setScrollTop] = useState(0);
  const profileInputRef = useRef<HTMLInputElement | null>(null);
  const ROW_HEIGHT = gridRowHeight;
  const VISIBLE_COUNT = 28;

  const activeWin = pollWindows.find((w) => w.id === activeWindowId);
  const isMin = !!minimized["poll"];

  if (isMin) {
    return (
      <section className="clay-panel flex shrink-0 flex-col p-3">
        <ContainerHeader
          id="poll"
          zone="main"
          title="Poll Grid"
          badge={activeWin?.title ?? "0"}
        />
      </section>
    );
  }

  if (!activeWin) {
    return (
      <section className="clay-panel flex min-h-0 flex-1 flex-col items-center justify-center gap-3 p-6">
        <p className="text-xs text-(--clay-ink-muted)">
          No active poll windows. Add one to start polling registers or coils.
        </p>
        <button
          type="button"
          onClick={addPollWindow}
          className="clay-btn-primary flex items-center gap-1.5 px-4 py-2 text-xs font-semibold"
        >
          <Plus className="h-4 w-4" />
          Add Poll Window
        </button>
      </section>
    );
  }

  const isWritable = activeWin.functionCode === 1 || activeWin.functionCode === 3;

  const startEdit = (addr: number, currentVal: number | null) => {
    if (!connected || !isWritable) return;
    setEditingAddr(addr);
    setDraftValue(String(currentVal ?? 0));
  };

  const commitEdit = async (addr: number) => {
    const parsed = Number(draftValue);
    if (!Number.isNaN(parsed)) {
      await writeValue(activeWin.id, addr, parsed);
    }
    setEditingAddr(null);
  };

  const formats: DisplayFormat[] = [
    "Signed",
    "Unsigned",
    "Hex",
    "Binary",
    "Int32",
    "UInt32",
    "Float32",
    "Double64",
  ];
  const rawSeries = activeWin.rows.map((r) => r.rawValue);

  return (
    <section className="clay-panel flex min-h-0 flex-1 flex-col gap-2.5 p-3.5">
      <ContainerHeader
        id="poll"
        zone="main"
        title="Poll Grid"
        badge={`${pollWindows.length} tabs`}
      >
        <button
          type="button"
          onClick={() => adjustGridRowHeight(-4)}
          title="Reduce Poll Grid Row Size"
          className="clay-btn flex h-6 w-6 items-center justify-center"
        >
          <Minus className="h-3 w-3" />
        </button>
        <button
          type="button"
          onClick={() => adjustGridRowHeight(4)}
          title="Increase Poll Grid Row Size"
          className="clay-btn flex h-6 w-6 items-center justify-center"
        >
          <Plus className="h-3 w-3" />
        </button>
        <button
          type="button"
          onClick={togglePollMaximized}
          title={pollMaximized ? "Restore Poll Grid Size" : "Maximize Poll Grid"}
          aria-label={pollMaximized ? "Restore Poll Grid Size" : "Maximize Poll Grid"}
          className="clay-btn flex h-6 w-6 items-center justify-center"
        >
          {pollMaximized ? (
            <Minimize2 className="h-3.5 w-3.5 text-sky-500" />
          ) : (
            <Maximize2 className="h-3.5 w-3.5 text-sky-500" />
          )}
        </button>
      </ContainerHeader>
      {/* MDI Tabs + Poll Definition Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {pollWindows.map((win) => (
            <div
              key={win.id}
              className={`flex items-center gap-1 px-2 py-1 text-xs font-semibold ${
                win.id === activeWindowId ? "clay-btn-primary" : "clay-btn"
              }`}
            >
              <button
                type="button"
                onClick={() => setActiveWindow(win.id)}
                className="px-1 py-0.5"
              >
                {win.title}
              </button>
              <button
                type="button"
                onClick={() => removePollWindow(win.id)}
                title={`Remove ${win.title}`}
                aria-label={`Remove ${win.title}`}
                className="rounded p-0.5 opacity-75 hover:bg-black/15 hover:opacity-100"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addPollWindow}
            title="Add Poll Window"
            className="clay-btn flex h-7 w-7 items-center justify-center"
          >
            <Plus className="h-3.5 w-3.5 text-sky-500" />
          </button>
        </div>

        {/* Live Poll Definition Controls */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <label className="clay-inset flex items-center gap-1 px-2 py-1 font-mono-tabular text-[11px]">
            <span className="text-(--clay-ink-muted)">Slave ID</span>
            <input
              type="number"
              min={1}
              max={247}
              value={activeWin.slaveId}
              onChange={(e) =>
                updatePollConfig(activeWin.id, { slaveId: Number(e.target.value) || 1 })
              }
              className="w-10 bg-transparent font-semibold outline-none"
            />
          </label>

          <select
            aria-label="Function Code"
            value={activeWin.functionCode}
            onChange={(e) =>
              updatePollConfig(activeWin.id, {
                functionCode: Number(e.target.value) as 1 | 2 | 3 | 4,
              })
            }
            className="clay-inset px-2 py-1 text-[11px] font-semibold outline-none"
          >
            <option value={1} className="text-slate-900">FC01 Coils</option>
            <option value={2} className="text-slate-900">FC02 Discrete</option>
            <option value={3} className="text-slate-900">FC03 Holding</option>
            <option value={4} className="text-slate-900">FC04 Input</option>
          </select>

          <label className="clay-inset flex items-center gap-1 px-2 py-1 font-mono-tabular text-[11px]">
            <span className="text-(--clay-ink-muted)">Addr</span>
            <input
              type="number"
              min={0}
              max={65535}
              value={activeWin.startAddress}
              onChange={(e) =>
                updatePollConfig(activeWin.id, {
                  startAddress: Number(e.target.value) || 0,
                })
              }
              className="w-12 bg-transparent font-semibold outline-none"
            />
          </label>

          <label className="clay-inset flex items-center gap-1 px-2 py-1 font-mono-tabular text-[11px]">
            <span className="text-(--clay-ink-muted)">Qty</span>
            <input
              type="number"
              min={1}
              max={1000}
              value={activeWin.quantity}
              onChange={(e) =>
                updatePollConfig(activeWin.id, {
                  quantity: Number(e.target.value) || 1,
                })
              }
              className="w-12 bg-transparent font-semibold outline-none"
            />
          </label>

          <button
            type="button"
            onClick={() => toggleAddressBase(activeWin.id)}
            className="clay-btn px-2 py-1 font-mono-tabular text-[11px]"
          >
            Base: {activeWin.addressBase}
          </button>

          <button
            type="button"
            onClick={() => togglePlcAddressing(activeWin.id)}
            className={`px-2 py-1 text-[11px] font-semibold ${
              activeWin.plcAddressing ? "clay-btn-primary" : "clay-btn"
            }`}
          >
            PLC {activeWin.plcAddressing ? "ON" : "OFF"}
          </button>

          <select
            aria-label="Display Format"
            value={activeWin.displayFormat}
            onChange={(e) =>
              setDisplayFormat(activeWin.id, e.target.value as DisplayFormat)
            }
            className="clay-inset px-2 py-1 text-[11px] font-semibold outline-none"
          >
            {formats.map((f) => (
              <option key={f} value={f} className="text-slate-900">
                {f}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => {
              const profile = {
                slaveId: activeWin.slaveId,
                functionCode: activeWin.functionCode,
                startAddress: activeWin.startAddress,
                quantity: activeWin.quantity,
                rows: activeWin.rows.map((r) => ({
                  address: r.address,
                  alias: r.alias,
                  scale: r.scale,
                  offset: r.offset,
                  unit: r.unit,
                  minAlarm: r.minAlarm,
                  maxAlarm: r.maxAlarm,
                })),
              };
              const blob = new Blob([JSON.stringify(profile, null, 2)], {
                type: "application/json",
              });
              const a = document.createElement("a");
              a.href = URL.createObjectURL(blob);
              a.download = `${activeWin.title.replace(/\W+/g, "_")}.mbprofile.json`;
              a.click();
              URL.revokeObjectURL(a.href);
            }}
            title="Export Device Register Profile (.json)"
            className="clay-btn flex items-center gap-1 px-2 py-1 text-[11px] font-semibold"
          >
            <Download className="h-3 w-3 text-sky-500" />
            Profile
          </button>

          <button
            type="button"
            onClick={() => profileInputRef.current?.click()}
            title="Import Device Register Profile (.json)"
            className="clay-btn flex items-center gap-1 px-2 py-1 text-[11px] font-semibold"
          >
            <Upload className="h-3 w-3 text-indigo-500" />
            Import
          </button>
          <input
            ref={profileInputRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              try {
                const parsed = JSON.parse(await file.text());
                if (parsed.slaveId || parsed.functionCode || parsed.quantity) {
                  updatePollConfig(activeWin.id, {
                    slaveId: parsed.slaveId,
                    functionCode: parsed.functionCode,
                    startAddress: parsed.startAddress,
                    quantity: parsed.quantity,
                  });
                }
                if (Array.isArray(parsed.rows)) {
                  applyRegisterMap(activeWin.id, parsed.rows);
                }
              } catch {
                // ignore malformed profile
              }
              e.target.value = "";
            }}
          />

          <button
            type="button"
            onClick={() => {
              const rows = activeWin.rows.map((r, i) => [
                r.address + activeWin.addressBase,
                toPlcAddress(activeWin, r.address),
                r.alias,
                r.rawValue !== null
                  ? "0x" + r.rawValue.toString(16).toUpperCase().padStart(4, "0")
                  : "",
                formatRegisterValue(
                  rawSeries,
                  i,
                  activeWin.displayFormat,
                  activeWin.wordOrder,
                  activeWin.functionCode
                ),
                r.rawValue !== null ? Number((r.rawValue * r.scale + r.offset).toFixed(4)) : "",
                r.unit,
                r.error ? "Error" : r.rawValue !== null ? "Live" : "Waiting",
              ]);
              downloadExcelXml(
                `modbus-${activeWin.title.replace(/\W+/g, "_")}`,
                "PollGrid",
                ["Address", "PLC", "Alias", "Raw Hex", "Value", "Scaled", "Unit", "Status"],
                rows
              );
            }}
            title="Download Poll Grid as Excel (.xls)"
            className="clay-btn flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold"
          >
            <FileSpreadsheet className="h-3 w-3 text-emerald-500" />
            Excel
          </button>

          <button
            type="button"
            onClick={() => setDefinitionOpen(true)}
            title="Read/Write Definition (F8)"
            className="clay-btn flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold"
          >
            <SlidersHorizontal className="h-3 w-3 text-sky-500" />
            Def (F8)
          </button>

          <button
            type="button"
            disabled={!isWritable}
            onClick={() => setWriteDialogOpen(true)}
            className="clay-btn-primary flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold disabled:opacity-45"
          >
            <Send className="h-3 w-3" />
            {isWritable ? "Write…" : "Read-Only"}
          </button>
        </div>
      </div>

      {activeWin.lastError && (
        <div className="mb-2 rounded-xl bg-rose-500/15 px-3 py-1.5 text-xs font-medium text-rose-500">
          {activeWin.lastError}
        </div>
      )}

      {/* Recessed Clay Table Well (Virtualized for 1000+ rows) */}
      <div
        onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
        className="clay-inset min-h-0 flex-1 overflow-auto p-1.5"
      >
        <table className="w-full border-collapse text-left">
          <thead className="sticky top-0 z-10 bg-(--clay-inset) text-[11px] font-bold uppercase tracking-wider text-(--clay-ink-muted)">
            <tr>
              <th className="px-3 py-2">Addr</th>
              {activeWin.plcAddressing && <th className="px-3 py-2">PLC</th>}
              <th className="px-3 py-2">Alias</th>
              <th className="px-3 py-2">Raw Hex</th>
              <th className="px-3 py-2">
                Value ({activeWin.displayFormat} · {activeWin.wordOrder})
              </th>
              <th className="px-3 py-2">Scaled</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2 text-right">Write</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-(--clay-ink-muted)/10 font-mono-tabular text-xs">
            {(() => {
              const total = activeWin.rows.length;
              const startIdx = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - 4);
              const endIdx = Math.min(total, startIdx + VISIBLE_COUNT + 8);
              const topPad = startIdx * ROW_HEIGHT;
              const botPad = Math.max(0, (total - endIdx) * ROW_HEIGHT);

              return (
                <>
                  {topPad > 0 && (
                    <tr style={{ height: topPad }}>
                      <td colSpan={8} />
                    </tr>
                  )}
                  {activeWin.rows.slice(startIdx, endIdx).map((row, localIdx) => {
                    const idx = startIdx + localIdx;
                    const isSelected = row.address === selectedAddress;
                    const scaledNum =
                      row.rawValue !== null ? row.rawValue * row.scale + row.offset : null;
                    const isAlarm =
                      scaledNum !== null &&
                      ((row.minAlarm !== null && scaledNum < row.minAlarm) ||
                        (row.maxAlarm !== null && scaledNum > row.maxAlarm));

                    return (
                      <tr
                        key={row.address}
                        style={{ height: ROW_HEIGHT }}
                        onClick={() => setSelectedAddress(row.address)}
                        onDoubleClick={() => startEdit(row.address, row.rawValue)}
                        className={`cursor-pointer transition-colors ${
                          isSelected
                            ? "bg-(--clay-row-selected)"
                            : "hover:bg-(--clay-row-hover)"
                        } ${isAlarm ? "bg-rose-500/15 text-rose-500" : row.changed ? "font-semibold text-sky-500" : ""}`}
                      >
                        <td className="px-3 py-1.5 text-(--clay-ink-muted)">
                          {row.address + activeWin.addressBase}
                        </td>
                        {activeWin.plcAddressing && (
                          <td className="px-3 py-1.5 text-(--clay-ink-muted)">
                            {toPlcAddress(activeWin, row.address)}
                          </td>
                        )}
                        <td className="px-3 py-1 font-sans">
                          <input
                            type="text"
                            value={row.alias}
                            placeholder="Alias…"
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) =>
                              setRowAlias(activeWin.id, row.address, e.target.value)
                            }
                            className="w-28 bg-transparent text-xs font-medium outline-none placeholder:text-(--clay-ink-muted)/45"
                          />
                        </td>
                        <td className="px-3 py-1.5 text-(--clay-ink-muted)">
                          {row.rawValue !== null
                            ? "0x" + row.rawValue.toString(16).toUpperCase().padStart(4, "0")
                            : "—"}
                        </td>
                        <td className="px-3 py-1.5 font-semibold">
                          {editingAddr === row.address ? (
                            <input
                              autoFocus
                              type="number"
                              value={draftValue}
                              onChange={(e) => setDraftValue(e.target.value)}
                              onBlur={() => commitEdit(row.address)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") commitEdit(row.address);
                                if (e.key === "Escape") setEditingAddr(null);
                              }}
                              className="clay-inset w-24 px-2 py-0.5 text-xs outline-none"
                            />
                          ) : (
                            formatRegisterValue(
                              rawSeries,
                              idx,
                              activeWin.displayFormat,
                              activeWin.wordOrder,
                              activeWin.functionCode
                            )
                          )}
                        </td>
                        <td className="px-3 py-1.5">
                          {scaledNum !== null
                            ? `${Number(scaledNum.toFixed(3))} ${row.unit}`.trim()
                            : "—"}
                        </td>
                        <td className="px-3 py-1.5 font-sans text-[11px]">
                          {row.error ? (
                            <span className="text-rose-500">Error</span>
                          ) : isAlarm ? (
                            <span className="font-semibold text-rose-500">Alarm</span>
                          ) : row.rawValue !== null ? (
                            <span className="text-emerald-500">Live</span>
                          ) : (
                            <span className="text-(--clay-ink-muted)">Waiting</span>
                          )}
                        </td>
                        <td className="px-3 py-1.5 text-right">
                          <button
                            type="button"
                            disabled={!connected || !isWritable}
                            onClick={(e) => {
                              e.stopPropagation();
                              startEdit(row.address, row.rawValue);
                            }}
                            title={isWritable ? "Edit & Write Value" : "Read-Only (FC02/FC04)"}
                            className="clay-btn inline-flex items-center gap-1 px-2 py-0.5 font-sans text-[11px] disabled:opacity-40"
                          >
                            <Edit3 className="h-3 w-3 text-sky-500" />
                            {isWritable ? "Edit" : "RO"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {botPad > 0 && (
                    <tr style={{ height: botPad }}>
                      <td colSpan={8} />
                    </tr>
                  )}
                </>
              );
            })()}
          </tbody>
        </table>
      </div>
    </section>
  );
}
