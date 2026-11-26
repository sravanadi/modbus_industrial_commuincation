import { useState } from "react";
import { Send, X } from "lucide-react";
import { useStudioStore } from "../stores/useStudioStore";

type WriteFc = 5 | 6 | 15 | 16;

export function WriteDialog() {
  const {
    writeDialogOpen,
    setWriteDialogOpen,
    pollWindows,
    activeWindowId,
    connected,
    writeValue,
    writeMultipleRegisters,
    writeMultipleCoils,
  } = useStudioStore();

  const activeWin = pollWindows.find((w) => w.id === activeWindowId);
  const [fc, setFc] = useState<WriteFc>(16);
  const [slaveId, setSlaveId] = useState(activeWin?.slaveId ?? 1);
  const [startAddr, setStartAddr] = useState(activeWin?.startAddress ?? 0);
  const [valuesText, setValuesText] = useState("0");
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  if (!writeDialogOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg(null);
    setIsError(false);

    const parts = valuesText
      .split(",")
      .map((s) => Number(s.trim()))
      .filter((n) => !Number.isNaN(n));

    if (parts.length === 0) {
      setStatusMsg("Enter one or more comma-separated numbers.");
      setIsError(true);
      return;
    }

    try {
      if (fc === 5 || fc === 6) {
        if (activeWin) {
          await writeValue(activeWin.id, startAddr, parts[0]);
        }
      } else if (fc === 15) {
        await writeMultipleCoils(
          slaveId,
          startAddr,
          parts.map((n) => n !== 0)
        );
      } else {
        await writeMultipleRegisters(slaveId, startAddr, parts);
      }
      setStatusMsg(`FC${fc} write succeeded (${parts.length} item(s) @ ${startAddr}).`);
    } catch (err) {
      setStatusMsg(String(err));
      setIsError(true);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
      <form
        onSubmit={handleSubmit}
        className="clay-panel flex w-full max-w-md flex-col gap-3.5 p-5"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold">Write Coils / Registers</h2>
          <button
            type="button"
            onClick={() => setWriteDialogOpen(false)}
            className="clay-btn flex h-8 w-8 items-center justify-center"
            aria-label="Close Write Dialog"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2.5 text-xs">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] text-(--clay-ink-muted)">Function</span>
            <select
              value={fc}
              onChange={(e) => setFc(Number(e.target.value) as WriteFc)}
              className="clay-inset px-2 py-1.5 font-semibold outline-none"
            >
              <option value={5} className="text-slate-900">FC05 Single Coil</option>
              <option value={6} className="text-slate-900">FC06 Single Reg</option>
              <option value={15} className="text-slate-900">FC15 Multi Coils</option>
              <option value={16} className="text-slate-900">FC16 Multi Regs</option>
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[11px] text-(--clay-ink-muted)">Slave ID</span>
            <input
              type="number"
              min={1}
              max={247}
              value={slaveId}
              onChange={(e) => setSlaveId(Number(e.target.value) || 1)}
              className="clay-inset px-2.5 py-1.5 font-mono-tabular outline-none"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[11px] text-(--clay-ink-muted)">Start Addr</span>
            <input
              type="number"
              min={0}
              max={65535}
              value={startAddr}
              onChange={(e) => setStartAddr(Number(e.target.value) || 0)}
              className="clay-inset px-2.5 py-1.5 font-mono-tabular outline-none"
            />
          </label>
        </div>

        <label className="flex flex-col gap-1 text-xs">
          <span className="text-[11px] text-(--clay-ink-muted)">
            Values (comma-separated, e.g. 100, 200, 300 or 1, 0, 1)
          </span>
          <input
            type="text"
            value={valuesText}
            onChange={(e) => setValuesText(e.target.value)}
            className="clay-inset px-3 py-2 font-mono-tabular outline-none"
          />
        </label>

        {statusMsg && (
          <div
            className={`rounded-xl px-3 py-2 text-xs font-medium ${
              isError ? "bg-rose-500/15 text-rose-500" : "bg-emerald-500/15 text-emerald-500"
            }`}
          >
            {statusMsg}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={() => setWriteDialogOpen(false)}
            className="clay-btn px-3.5 py-2 text-xs font-semibold"
          >
            Close
          </button>
          <button
            type="submit"
            disabled={!connected}
            className="clay-btn-primary flex items-center gap-1.5 px-4 py-2 text-xs font-semibold disabled:opacity-50"
          >
            <Send className="h-3.5 w-3.5" />
            Send Write
          </button>
        </div>
      </form>
    </div>
  );
}
