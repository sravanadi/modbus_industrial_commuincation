import {
  Cpu,
  FileDown,
  FolderOpen,
  Moon,
  Pause,
  Play,
  Plug,
  Plus,
  RefreshCw,
  Save,
  Server,
  Settings,
  Sparkles,
  Sun,
  Terminal,
  Unplug,
  Wrench,
} from "lucide-react";
import { TransportKind, useStudioStore } from "../stores/useStudioStore";

export function ClayTopBar() {
  const {
    theme,
    toggleTheme,
    adjustFontSize,
    setSettingsOpen,
    setPythonOpen,
    setConnectionOpen,
    setAscAiOpen,
    openTools,
    transportMode,
    setTransportMode,
    tcpHost,
    tcpPort,
    setTcpConfig,
    rtuPort,
    rtuBaud,
    rtuParity,
    setRtuConfig,
    serialPorts,
    refreshSerialPorts,
    connected,
    polling,
    simRunning,
    csvLogging,
    csvPath,
    projectPath,
    connect,
    disconnect,
    startPolling,
    stopPolling,
    toggleSlaveSim,
    toggleCsvLogging,
    saveProject,
    loadProject,
    addPollWindow,
  } = useStudioStore();

  return (
    <header className="clay-panel flex h-14 shrink-0 items-center justify-between gap-3 px-4">
      {/* Brand + Live Transport Config */}
      <div className="flex items-center gap-3">
        <div className="clay-btn-primary flex h-9 w-9 shrink-0 items-center justify-center rounded-xl">
          <Cpu className="h-4.5 w-4.5" />
        </div>
        <div className="shrink-0">
          <span className="text-sm font-bold tracking-tight">Modbus Studio</span>
          <p className="text-[11px] text-(--clay-ink-muted)">Real-Time Master</p>
        </div>

        <div className="mx-1 h-6 w-px bg-(--clay-ink-muted)/20" />

        {/* Transport Selector */}
        <div className="clay-inset flex items-center gap-2 px-2.5 py-1.5 text-xs">
          <span
            className={`h-2.5 w-2.5 shrink-0 rounded-full ${
              connected
                ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.75)]"
                : "bg-slate-400"
            }`}
          />
          <select
            aria-label="Transport Type"
            disabled={connected}
            value={transportMode}
            onChange={(e) => setTransportMode(e.target.value as TransportKind)}
            className="bg-transparent font-semibold outline-none disabled:opacity-60"
          >
            <option value="TCP" className="text-slate-900">TCP/IP</option>
            <option value="RTU_TCP" className="text-slate-900">RTU / TCP</option>
            <option value="UDP" className="text-slate-900">UDP/IP</option>
            <option value="RTU" className="text-slate-900">Serial RTU</option>
            <option value="ASCII" className="text-slate-900">Serial ASCII</option>
          </select>

          {transportMode === "TCP" || transportMode === "RTU_TCP" || transportMode === "UDP" ? (
            <div className="flex items-center gap-1.5 font-mono-tabular">
              <input
                type="text"
                disabled={connected}
                value={tcpHost}
                onChange={(e) => setTcpConfig(e.target.value, tcpPort)}
                placeholder="127.0.0.1"
                className="w-28 bg-transparent outline-none disabled:opacity-60"
              />
              <span className="text-(--clay-ink-muted)">:</span>
              <input
                type="number"
                disabled={connected}
                value={tcpPort}
                onChange={(e) => setTcpConfig(tcpHost, Number(e.target.value) || 502)}
                className="w-14 bg-transparent outline-none disabled:opacity-60"
              />
            </div>
          ) : (
            <div className="flex items-center gap-1.5 font-mono-tabular">
              <select
                aria-label="Serial Port"
                disabled={connected}
                value={rtuPort}
                onChange={(e) => setRtuConfig(e.target.value, rtuBaud, rtuParity)}
                className="max-w-32 bg-transparent outline-none disabled:opacity-60"
              >
                {serialPorts.length === 0 ? (
                  <option value="" className="text-slate-900">No ports</option>
                ) : (
                  serialPorts.map((p) => (
                    <option key={p.port_name} value={p.port_name} className="text-slate-900">
                      {p.port_name}
                    </option>
                  ))
                )}
              </select>
              <button
                type="button"
                disabled={connected}
                onClick={refreshSerialPorts}
                title="Refresh Serial Ports"
                className="text-(--clay-ink-muted) hover:text-(--clay-ink) disabled:opacity-40"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
              <select
                aria-label="Baud Rate"
                disabled={connected}
                value={rtuBaud}
                onChange={(e) => setRtuConfig(rtuPort, Number(e.target.value), rtuParity)}
                className="bg-transparent outline-none disabled:opacity-60"
              >
                {[9600, 19200, 38400, 57600, 115200].map((b) => (
                  <option key={b} value={b} className="text-slate-900">
                    {b}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Action Controls */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setConnectionOpen(true)}
          title="Connection Setup (F3)"
          className="clay-btn px-2.5 py-2 text-xs font-semibold"
        >
          F3
        </button>

        <button
          type="button"
          onClick={connected ? disconnect : connect}
          className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold ${
            connected ? "clay-btn-danger" : "clay-btn-success"
          }`}
        >
          {connected ? (
            <>
              <Unplug className="h-3.5 w-3.5" />
              Disconnect
            </>
          ) : (
            <>
              <Plug className="h-3.5 w-3.5" />
              Connect
            </>
          )}
        </button>

        <button
          type="button"
          onClick={polling ? stopPolling : startPolling}
          disabled={!connected}
          className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold disabled:opacity-50 ${
            polling ? "clay-btn" : "clay-btn-primary"
          }`}
        >
          {polling ? (
            <>
              <Pause className="h-3.5 w-3.5 text-amber-500" />
              Stop Poll
            </>
          ) : (
            <>
              <Play className="h-3.5 w-3.5" />
              Start Poll
            </>
          )}
        </button>

        <button
          type="button"
          onClick={toggleSlaveSim}
          title="Toggle Built-in TCP Slave Simulator"
          className={`flex items-center gap-1 px-2.5 py-2 text-xs font-semibold ${
            simRunning ? "clay-btn-primary" : "clay-btn"
          }`}
        >
          <Server className="h-3.5 w-3.5" />
          Sim
        </button>

        <button
          type="button"
          onClick={addPollWindow}
          className="clay-btn flex items-center gap-1 px-2.5 py-2 text-xs font-semibold"
          title="Add Poll Window"
        >
          <Plus className="h-3.5 w-3.5 text-sky-500" />
          Poll
        </button>

        <button
          type="button"
          onClick={() => toggleCsvLogging(csvPath)}
          title={`Toggle CSV Logging (${csvPath})`}
          className={`flex items-center gap-1 px-2.5 py-2 text-xs font-semibold ${
            csvLogging ? "clay-btn-success" : "clay-btn"
          }`}
        >
          <FileDown className="h-3.5 w-3.5" />
          CSV
        </button>

        <button
          type="button"
          onClick={() => saveProject(projectPath)}
          title={`Save Workspace (${projectPath})`}
          className="clay-btn flex items-center gap-1 px-2 py-2 text-xs font-semibold"
        >
          <Save className="h-3.5 w-3.5 text-sky-500" />
        </button>

        <button
          type="button"
          onClick={() => loadProject(projectPath)}
          title={`Open Workspace (${projectPath})`}
          className="clay-btn flex items-center gap-1 px-2 py-2 text-xs font-semibold"
        >
          <FolderOpen className="h-3.5 w-3.5 text-amber-500" />
        </button>

        <button
          type="button"
          onClick={() => setAscAiOpen(true)}
          className="clay-btn flex items-center gap-1 px-2.5 py-2 text-xs font-semibold"
          title="ASC AI Assistant (Local AI / FreeLLM)"
        >
          <Sparkles className="h-3.5 w-3.5 text-sky-500" />
          ASC AI
        </button>

        <button
          type="button"
          onClick={() => openTools("hex")}
          className="clay-btn flex items-center gap-1 px-2.5 py-2 text-xs font-semibold"
          title="Raw Hex, Scanner, Trend Graph & Slave Sim"
        >
          <Wrench className="h-3.5 w-3.5 text-amber-500" />
          Tools
        </button>

        <button
          type="button"
          onClick={() => setPythonOpen(true)}
          className="clay-btn flex items-center gap-1 px-2.5 py-2 text-xs font-semibold"
          title="Python Script Runner"
        >
          <Terminal className="h-3.5 w-3.5 text-emerald-500" />
          Python
        </button>

        {/* Quick Font Size - / + */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => adjustFontSize(-1)}
            title="Decrease UI Size"
            className="clay-btn px-2 py-2 font-mono-tabular text-[11px] font-bold"
          >
            A-
          </button>
          <button
            type="button"
            onClick={() => adjustFontSize(1)}
            title="Increase UI Size"
            className="clay-btn px-2 py-2 font-mono-tabular text-[11px] font-bold"
          >
            A+
          </button>
        </div>

        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          aria-label="Open Settings"
          title="Settings"
          className="clay-btn flex h-9 w-9 items-center justify-center"
        >
          <Settings className="h-4 w-4 text-sky-500" />
        </button>

        <button
          type="button"
          onClick={toggleTheme}
          aria-label="Toggle Light/Dark Clay Theme"
          title="Toggle Light / Dark Clay Theme"
          className="clay-btn flex h-9 w-9 items-center justify-center"
        >
          {theme === "light" ? (
            <Moon className="h-4 w-4 text-indigo-500" />
          ) : (
            <Sun className="h-4 w-4 text-amber-400" />
          )}
        </button>
      </div>
    </header>
  );
}
