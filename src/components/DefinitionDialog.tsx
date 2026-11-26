import { useEffect, useState } from "react";
import { Check, X } from "lucide-react";
import { useStudioStore } from "../stores/useStudioStore";

export function DefinitionDialog() {
  const {
    definitionOpen,
    setDefinitionOpen,
    pollWindows,
    activeWindowId,
    updatePollConfig,
    toggleAddressBase,
    togglePlcAddressing,
    polling,
    startPolling,
  } = useStudioStore();

  const activeWin = pollWindows.find((w) => w.id === activeWindowId);
  const [slaveId, setSlaveId] = useState(1);
  const [fc, setFc] = useState<1 | 2 | 3 | 4>(3);
  const [startAddress, setStartAddress] = useState(0);
  const [quantity, setQuantity] = useState(10);
  const [scanRateMs, setScanRateMs] = useState(1000);

  useEffect(() => {
    if (activeWin) {
      setSlaveId(activeWin.slaveId);
      setFc(activeWin.functionCode);
      setStartAddress(activeWin.startAddress);
      setQuantity(activeWin.quantity);
      setScanRateMs(activeWin.scanRateMs);
    }
  }, [activeWin, definitionOpen]);

  if (!definitionOpen || !activeWin) return null;

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    updatePollConfig(activeWin.id, {
      slaveId: Math.max(1, Math.min(247, slaveId)),
      functionCode: fc,
      startAddress: Math.max(0, Math.min(65535, startAddress)),
      quantity: Math.max(1, Math.min(1000, quantity)),
      scanRateMs: Math.max(50, scanRateMs),
    });
    setDefinitionOpen(false);
    if (polling) {
      await startPolling();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
      <form
        onSubmit={handleApply}
        className="clay-panel flex w-full max-w-md flex-col gap-3.5 p-5"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold">Read/Write Definition (F8)</h2>
          <button
            type="button"
            onClick={() => setDefinitionOpen(false)}
            className="clay-btn flex h-8 w-8 items-center justify-center"
            aria-label="Close Read/Write Definition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <label className="flex flex-col gap-1 text-xs">
          <span className="text-[11px] text-(--clay-ink-muted)">Function Code</span>
          <select
            value={fc}
            onChange={(e) => setFc(Number(e.target.value) as 1 | 2 | 3 | 4)}
            className="clay-inset px-3 py-2 font-semibold outline-none"
          >
            <option value={1} className="text-slate-900">
              01: Read Coils (Read/Write)
            </option>
            <option value={2} className="text-slate-900">
              02: Read Discrete Inputs (Read-Only)
            </option>
            <option value={3} className="text-slate-900">
              03: Read Holding Registers (Read/Write)
            </option>
            <option value={4} className="text-slate-900">
              04: Read Input Registers (Read-Only)
            </option>
          </select>
        </label>

        <div className="grid grid-cols-2 gap-2.5 text-xs">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] text-(--clay-ink-muted)">Slave ID (1–247)</span>
            <input
              type="number"
              min={1}
              max={247}
              value={slaveId}
              onChange={(e) => setSlaveId(Number(e.target.value) || 1)}
              className="clay-inset px-3 py-1.5 font-mono-tabular outline-none"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] text-(--clay-ink-muted)">Scan Rate (ms)</span>
            <input
              type="number"
              min={50}
              step={50}
              value={scanRateMs}
              onChange={(e) => setScanRateMs(Number(e.target.value) || 1000)}
              className="clay-inset px-3 py-1.5 font-mono-tabular outline-none"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] text-(--clay-ink-muted)">Start Address</span>
            <input
              type="number"
              min={0}
              max={65535}
              value={startAddress}
              onChange={(e) => setStartAddress(Number(e.target.value) || 0)}
              className="clay-inset px-3 py-1.5 font-mono-tabular outline-none"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] text-(--clay-ink-muted)">Quantity (1–1000)</span>
            <input
              type="number"
              min={1}
              max={1000}
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value) || 1)}
              className="clay-inset px-3 py-1.5 font-mono-tabular outline-none"
            />
          </label>
        </div>

        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            onClick={() => toggleAddressBase(activeWin.id)}
            className="clay-btn px-3 py-1.5 font-mono-tabular text-xs"
          >
            Address Base: {activeWin.addressBase}
          </button>
          <button
            type="button"
            onClick={() => togglePlcAddressing(activeWin.id)}
            className={`px-3 py-1.5 text-xs font-semibold ${
              activeWin.plcAddressing ? "clay-btn-primary" : "clay-btn"
            }`}
          >
            PLC Addressing {activeWin.plcAddressing ? "ON" : "OFF"}
          </button>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={() => setDefinitionOpen(false)}
            className="clay-btn px-3.5 py-2 text-xs font-semibold"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="clay-btn-primary flex items-center gap-1.5 px-4 py-2 text-xs font-semibold"
          >
            <Check className="h-3.5 w-3.5" />
            Apply
          </button>
        </div>
      </form>
    </div>
  );
}
