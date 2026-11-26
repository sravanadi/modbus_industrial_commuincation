import {
  Calculator,
  Plus,
  RotateCcw,
  Settings,
  Sparkles,
  Table2,
  Terminal,
  TerminalSquare,
  X,
} from "lucide-react";
import { SidebarSectionId, useStudioStore } from "../stores/useStudioStore";
import { ContainerHeader } from "./ContainerHeader";

export function IdeSidebar() {
  const {
    sidebarWidth,
    sidebarOrder,
    minimized,
    transportMode,
    tcpHost,
    tcpPort,
    rtuPort,
    rtuBaud,
    connected,
    connectionError,
    pollWindows,
    activeWindowId,
    setActiveWindow,
    addPollWindow,
    removePollWindow,
    toggleTrafficCollapsed,
    resetStats,
    setSettingsOpen,
    setPythonOpen,
    setAscAiOpen,
    openTools,
  } = useStudioStore();

  const isDockMin = !!minimized["sidebar"];

  const renderSection = (sec: SidebarSectionId) => {
    const isMin = !!minimized[sec];
    if (sec === "transport") {
      return (
        <div key={sec} className="clay-card flex flex-col gap-2 p-2.5">
          <ContainerHeader id="transport" zone="sidebar" title="Transport" />
          {!isMin && (
            <div className="flex flex-col gap-1 px-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold">
                  {transportMode === "TCP"
                    ? "Modbus TCP/IP"
                    : transportMode === "ASCII"
                      ? "Modbus ASCII"
                      : "Modbus RTU"}
                </span>
                <span
                  className={`h-2 w-2 rounded-full ${
                    connected ? "bg-emerald-500" : "bg-slate-400"
                  }`}
                />
              </div>
              <div className="font-mono-tabular text-[11px] text-(--clay-ink-muted)">
                {transportMode === "TCP"
                  ? `${tcpHost}:${tcpPort}`
                  : rtuPort
                    ? `${rtuPort} @ ${rtuBaud}`
                    : "No serial port selected"}
              </div>
              {connectionError && (
                <div className="mt-1 text-[11px] font-medium text-rose-500">
                  {connectionError}
                </div>
              )}
            </div>
          )}
        </div>
      );
    }

    if (sec === "windows") {
      return (
        <div key={sec} className="clay-card flex min-h-0 flex-col gap-2 p-2.5">
          <ContainerHeader
            id="windows"
            zone="sidebar"
            title="Poll Windows"
            badge={String(pollWindows.length)}
          >
            <button
              type="button"
              onClick={addPollWindow}
              title="Add Poll Window"
              className="clay-btn flex h-6 w-6 items-center justify-center"
            >
              <Plus className="h-3.5 w-3.5 text-sky-500" />
            </button>
          </ContainerHeader>
          {!isMin && (
            <div className="flex max-h-56 flex-col gap-1.5 overflow-auto">
              {pollWindows.map((win) => {
                const isActive = win.id === activeWindowId;
                return (
                  <div
                    key={win.id}
                    className={`flex items-center gap-1 px-2 py-1.5 ${
                      isActive ? "clay-inset ring-2 ring-sky-500/40" : "clay-btn opacity-85"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setActiveWindow(win.id)}
                      className="flex min-w-0 flex-1 items-center gap-2 px-1 py-0.5 text-left"
                    >
                      <Table2 className="h-3.5 w-3.5 shrink-0 text-sky-500" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-xs font-semibold">{win.title}</div>
                        <div className="font-mono-tabular text-[10px] text-(--clay-ink-muted)">
                          ID {win.slaveId} · FC0{win.functionCode} · {win.quantity} qty
                        </div>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => removePollWindow(win.id)}
                      title={`Remove ${win.title}`}
                      aria-label={`Remove ${win.title}`}
                      className="rounded p-1 text-(--clay-ink-muted) opacity-60 hover:bg-rose-500/15 hover:text-rose-500 hover:opacity-100"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      );
    }

    return (
      <div key={sec} className="clay-card flex flex-col gap-2 p-2.5">
        <ContainerHeader id="tools" zone="sidebar" title="IDE Tools" />
        {!isMin && (
          <div className="flex flex-col gap-1.5">
            <button
              type="button"
              onClick={() => setAscAiOpen(true)}
              className="clay-btn flex items-center gap-2 px-2.5 py-1.5 text-xs font-semibold"
            >
              <Sparkles className="h-3.5 w-3.5 text-sky-500" />
              ASC AI
            </button>
            <button
              type="button"
              onClick={() => openTools("calc")}
              className="clay-btn flex items-center gap-2 px-2.5 py-1.5 text-xs font-medium"
            >
              <Calculator className="h-3.5 w-3.5 text-violet-500" />
              Hex Calculator
            </button>
            <button
              type="button"
              onClick={() => setPythonOpen(true)}
              className="clay-btn flex items-center gap-2 px-2.5 py-1.5 text-xs font-medium"
            >
              <Terminal className="h-3.5 w-3.5 text-emerald-500" />
              Python Runner
            </button>
            <button
              type="button"
              onClick={toggleTrafficCollapsed}
              className="clay-btn flex items-center gap-2 px-2.5 py-1.5 text-xs font-medium"
            >
              <TerminalSquare className="h-3.5 w-3.5 text-indigo-500" />
              Toggle Traffic
            </button>
            <button
              type="button"
              onClick={resetStats}
              className="clay-btn flex items-center gap-2 px-2.5 py-1.5 text-xs font-medium"
            >
              <RotateCcw className="h-3.5 w-3.5 text-amber-500" />
              Reset Counters
            </button>
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className="clay-btn flex items-center gap-2 px-2.5 py-1.5 text-xs font-medium"
            >
              <Settings className="h-3.5 w-3.5 text-sky-500" />
              Settings &amp; Sizing
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <aside
      style={{ width: isDockMin ? 48 : sidebarWidth }}
      className="clay-panel flex shrink-0 flex-col gap-3 overflow-hidden p-3 transition-[width] duration-150"
    >
      <ContainerHeader id="sidebar" zone="dock" title={isDockMin ? "" : "Explorer"} />
      {!isDockMin && (
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto">
          {sidebarOrder.map(renderSection)}
        </div>
      )}
    </aside>
  );
}
