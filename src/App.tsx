import { listen } from "@tauri-apps/api/event";
import { Fragment, useEffect } from "react";
import { AscAiPanel } from "./components/AscAiPanel";
import { ClayTopBar } from "./components/ClayTopBar";
import { ConnectionDialog } from "./components/ConnectionDialog";
import { DefinitionDialog } from "./components/DefinitionDialog";
import { IdeSidebar } from "./components/IdeSidebar";
import { InspectorPanel } from "./components/InspectorPanel";
import { PollGrid } from "./components/PollGrid";
import { PythonPanel } from "./components/PythonPanel";
import { SettingsModal } from "./components/SettingsModal";
import { TelemetryCards } from "./components/TelemetryCards";
import { ToolsDrawer } from "./components/ToolsDrawer";
import { TrafficPanel } from "./components/TrafficPanel";
import { WriteDialog } from "./components/WriteDialog";
import {
  DockId,
  MainSectionId,
  PollStats,
  TrafficEntry,
  useStudioStore,
} from "./stores/useStudioStore";

export function App() {
  const {
    theme,
    fontSize,
    dockOrder,
    mainOrder,
    sidebarWidth,
    inspectorWidth,
    setSidebarWidth,
    setInspectorWidth,
    showSidebar,
    showInspector,
    showTelemetry,
    pollMaximized,
    connected,
    polling,
    transportMode,
    tcpHost,
    tcpPort,
    rtuPort,
    rtuBaud,
    stats,
    refreshSerialPorts,
    applyPollData,
    appendTraffic,
    applyStats,
    setConnectionOpen,
    setDefinitionOpen,
    testAiConnection,
  } = useStudioStore();

  useEffect(() => {
    void testAiConnection();
    const timer = window.setInterval(() => {
      void testAiConnection();
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [testAiConnection]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F3") {
        e.preventDefault();
        setConnectionOpen(true);
      } else if (e.key === "F8") {
        e.preventDefault();
        setDefinitionOpen(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [setConnectionOpen, setDefinitionOpen]);

  useEffect(() => {
    refreshSerialPorts();

    let unlistenPoll: (() => void) | undefined;
    let unlistenTraffic: (() => void) | undefined;
    let unlistenStats: (() => void) | undefined;

    (async () => {
      try {
        unlistenPoll = await listen<{
          window_id: string;
          values: number[];
          error: string | null;
        }>("modbus://poll-data", (e) => applyPollData(e.payload));

        unlistenTraffic = await listen<TrafficEntry>("modbus://traffic", (e) =>
          appendTraffic(e.payload)
        );

        unlistenStats = await listen<PollStats>("modbus://stats", (e) =>
          applyStats(e.payload)
        );
      } catch {
        // Ignore when running outside Tauri webview
      }
    })();

    return () => {
      unlistenPoll?.();
      unlistenTraffic?.();
      unlistenStats?.();
    };
  }, [refreshSerialPorts, applyPollData, appendTraffic, applyStats]);

  const startDockResize = (target: "sidebar" | "inspector", e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = target === "sidebar" ? sidebarWidth : inspectorWidth;
    const sign = target === "sidebar" ? 1 : -1;
    const onMove = (ev: MouseEvent) => {
      const next = startW + (ev.clientX - startX) * sign;
      if (target === "sidebar") setSidebarWidth(next);
      else setInspectorWidth(next);
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const renderMainSection = (id: MainSectionId) => {
    if (pollMaximized && id !== "poll") return null;
    if (id === "telemetry") return showTelemetry ? <TelemetryCards key={id} /> : null;
    if (id === "poll") return <PollGrid key={id} />;
    return <TrafficPanel key={id} />;
  };

  const visibleDocks = dockOrder.filter(
    (d) =>
      d === "main" ||
      (!pollMaximized && d === "sidebar" && showSidebar) ||
      (!pollMaximized && d === "inspector" && showInspector)
  );

  const renderDock = (dock: DockId) => {
    if (dock === "sidebar") return <IdeSidebar />;
    if (dock === "inspector") return <InspectorPanel />;
    return (
      <main className="flex min-w-0 flex-1 flex-col gap-3">
        {mainOrder.map(renderMainSection)}
      </main>
    );
  };

  const totalErr = stats.crc_errors + stats.timeouts + stats.exception_count;

  return (
    <div
      style={{ fontSize }}
      className={`${
        theme === "light" ? "clay-light" : "clay-dark"
      } flex h-screen w-screen flex-col gap-3 bg-(--clay-bg) p-3 text-(--clay-ink) transition-colors duration-200`}
    >
      <ClayTopBar />

      <div className="flex min-h-0 flex-1 gap-1.5">
        {visibleDocks.map((dock, idx) => (
          <Fragment key={dock}>
            {renderDock(dock)}
            {idx < visibleDocks.length - 1 && (
              <div
                onMouseDown={(e) =>
                  startDockResize(
                    dock === "sidebar" || visibleDocks[idx + 1] === "sidebar"
                      ? "sidebar"
                      : "inspector",
                    e
                  )
                }
                title="Drag to resize panel"
                className="w-1.5 shrink-0 cursor-col-resize rounded-full hover:bg-sky-500/35"
              />
            )}
          </Fragment>
        ))}
      </div>

      {/* Tactile Clay Status Bar */}
      <footer className="clay-panel flex h-8 shrink-0 items-center justify-between px-4 font-mono-tabular text-[11px] text-(--clay-ink-muted)">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 font-semibold text-(--clay-ink)">
            <span
              className={`h-2 w-2 rounded-full ${
                connected ? "bg-emerald-500" : "bg-slate-400"
              }`}
            />
            {connected ? "Connected" : "Disconnected"}
          </span>
          <span>
            {transportMode === "TCP"
              ? `TCP · ${tcpHost}:${tcpPort}`
              : `${transportMode} · ${rtuPort || "none"} @ ${rtuBaud}`}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span>TX: {stats.tx_count}</span>
          <span>RX: {stats.rx_valid_count}</span>
          <span>Err: {totalErr}</span>
          <span>{polling && connected ? "Polling" : "Idle"}</span>
        </div>
      </footer>

      <SettingsModal />
      <PythonPanel />
      <WriteDialog />
      <ConnectionDialog />
      <DefinitionDialog />
      <ToolsDrawer />
      <AscAiPanel />
    </div>
  );
}

export default App;
