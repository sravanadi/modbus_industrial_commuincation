import { Plug, RefreshCw, Unplug, X } from "lucide-react";
import { TransportKind, useStudioStore } from "../stores/useStudioStore";

export function ConnectionDialog() {
  const {
    connectionOpen,
    setConnectionOpen,
    transportMode,
    setTransportMode,
    tcpHost,
    tcpPort,
    setTcpConfig,
    rtuPort,
    rtuBaud,
    rtuDataBits,
    rtuParity,
    rtuStopBits,
    setRtuConfig,
    timeoutMs,
    setTimeoutMs,
    serialPorts,
    refreshSerialPorts,
    connected,
    connectionError,
    connect,
    disconnect,
  } = useStudioStore();

  if (!connectionOpen) return null;

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    await connect();
    if (useStudioStore.getState().connected) {
      setConnectionOpen(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
      <form
        onSubmit={handleConnect}
        className="clay-panel flex w-full max-w-md flex-col gap-3.5 p-5"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold">Connection Setup (F3)</h2>
          <button
            type="button"
            onClick={() => setConnectionOpen(false)}
            className="clay-btn flex h-8 w-8 items-center justify-center"
            aria-label="Close Connection Setup"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <label className="flex flex-col gap-1 text-xs">
          <span className="text-[11px] text-(--clay-ink-muted)">Connection Type</span>
          <select
            disabled={connected}
            value={transportMode}
            onChange={(e) => setTransportMode(e.target.value as TransportKind)}
            className="clay-inset px-3 py-2 font-semibold outline-none disabled:opacity-60"
          >
            <option value="TCP" className="text-slate-900">Modbus TCP/IP</option>
            <option value="RTU_TCP" className="text-slate-900">Modbus RTU over TCP</option>
            <option value="UDP" className="text-slate-900">Modbus UDP/IP</option>
            <option value="RTU" className="text-slate-900">Serial Port (Modbus RTU)</option>
            <option value="ASCII" className="text-slate-900">Serial Port (Modbus ASCII)</option>
          </select>
        </label>

        {transportMode === "TCP" || transportMode === "RTU_TCP" || transportMode === "UDP" ? (
          <div className="grid grid-cols-3 gap-2.5 text-xs">
            <label className="col-span-2 flex flex-col gap-1">
              <span className="text-[11px] text-(--clay-ink-muted)">IP Address / Host</span>
              <input
                type="text"
                disabled={connected}
                value={tcpHost}
                onChange={(e) => setTcpConfig(e.target.value, tcpPort)}
                className="clay-inset px-3 py-2 font-mono-tabular outline-none disabled:opacity-60"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] text-(--clay-ink-muted)">Port</span>
              <input
                type="number"
                disabled={connected}
                value={tcpPort}
                onChange={(e) => setTcpConfig(tcpHost, Number(e.target.value) || 502)}
                className="clay-inset px-3 py-2 font-mono-tabular outline-none disabled:opacity-60"
              />
            </label>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5 text-xs">
            <div className="flex items-end gap-2">
              <label className="flex flex-1 flex-col gap-1">
                <span className="text-[11px] text-(--clay-ink-muted)">Serial Port (COMx / ttyUSB*)</span>
                <select
                  disabled={connected}
                  value={rtuPort}
                  onChange={(e) => setRtuConfig(e.target.value, rtuBaud, rtuParity)}
                  className="clay-inset px-3 py-2 font-mono-tabular outline-none disabled:opacity-60"
                >
                  {serialPorts.length === 0 ? (
                    <option value="" className="text-slate-900">No ports detected</option>
                  ) : (
                    serialPorts.map((p) => (
                      <option key={p.port_name} value={p.port_name} className="text-slate-900">
                        {p.port_name} — {p.description}
                      </option>
                    ))
                  )}
                </select>
              </label>
              <button
                type="button"
                disabled={connected}
                onClick={refreshSerialPorts}
                title="Refresh Ports"
                className="clay-btn flex h-9 w-9 items-center justify-center disabled:opacity-50"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-4 gap-2">
              <label className="flex flex-col gap-1">
                <span className="text-[11px] text-(--clay-ink-muted)">Baud</span>
                <select
                  disabled={connected}
                  value={rtuBaud}
                  onChange={(e) => setRtuConfig(rtuPort, Number(e.target.value), rtuParity)}
                  className="clay-inset px-2 py-1.5 font-mono-tabular outline-none"
                >
                  {[2400, 4800, 9600, 19200, 38400, 57600, 115200].map((b) => (
                    <option key={b} value={b} className="text-slate-900">{b}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] text-(--clay-ink-muted)">Data Bits</span>
                <select
                  disabled={connected}
                  value={rtuDataBits}
                  onChange={(e) =>
                    setRtuConfig(rtuPort, rtuBaud, rtuParity, Number(e.target.value) as 7 | 8)
                  }
                  className="clay-inset px-2 py-1.5 font-mono-tabular outline-none"
                >
                  <option value={8} className="text-slate-900">8</option>
                  <option value={7} className="text-slate-900">7</option>
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] text-(--clay-ink-muted)">Parity</span>
                <select
                  disabled={connected}
                  value={rtuParity}
                  onChange={(e) =>
                    setRtuConfig(rtuPort, rtuBaud, e.target.value as "N" | "E" | "O")
                  }
                  className="clay-inset px-2 py-1.5 font-mono-tabular outline-none"
                >
                  <option value="N" className="text-slate-900">None</option>
                  <option value="E" className="text-slate-900">Even</option>
                  <option value="O" className="text-slate-900">Odd</option>
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] text-(--clay-ink-muted)">Stop Bits</span>
                <select
                  disabled={connected}
                  value={rtuStopBits}
                  onChange={(e) =>
                    setRtuConfig(
                      rtuPort,
                      rtuBaud,
                      rtuParity,
                      rtuDataBits,
                      Number(e.target.value) as 1 | 2
                    )
                  }
                  className="clay-inset px-2 py-1.5 font-mono-tabular outline-none"
                >
                  <option value={1} className="text-slate-900">1</option>
                  <option value={2} className="text-slate-900">2</option>
                </select>
              </label>
            </div>
          </div>
        )}

        <label className="flex flex-col gap-1 text-xs">
          <span className="text-[11px] text-(--clay-ink-muted)">Response Timeout (ms)</span>
          <input
            type="number"
            min={100}
            max={30000}
            step={100}
            value={timeoutMs}
            onChange={(e) => setTimeoutMs(Number(e.target.value) || 1000)}
            className="clay-inset px-3 py-1.5 font-mono-tabular outline-none"
          />
        </label>

        {connectionError && (
          <div className="rounded-xl bg-rose-500/15 px-3 py-2 text-xs font-medium text-rose-500">
            {connectionError}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          {connected ? (
            <button
              type="button"
              onClick={disconnect}
              className="clay-btn-danger flex items-center gap-1.5 px-4 py-2 text-xs font-semibold"
            >
              <Unplug className="h-3.5 w-3.5" />
              Disconnect
            </button>
          ) : (
            <button
              type="submit"
              className="clay-btn-success flex items-center gap-1.5 px-4 py-2 text-xs font-semibold"
            >
              <Plug className="h-3.5 w-3.5" />
              Connect
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
