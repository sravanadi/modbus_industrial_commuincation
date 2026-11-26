import { invoke } from "@tauri-apps/api/core";
import { useRef, useState } from "react";
import {
  Activity,
  Bell,
  Calculator,
  Download,
  FileSpreadsheet,
  Play,
  Radar,
  Send,
  Server,
  Trash2,
  X,
} from "lucide-react";
import { downloadExcelXml } from "../lib/excel";
import { useStudioStore } from "../stores/useStudioStore";

const SERIES_COLORS = ["#0ea5e9", "#10b981", "#f59e0b", "#f43f5e", "#8b5cf6", "#ec4899"];

export function ToolsDrawer() {
  const {
    toolsOpen,
    toolsTab,
    openTools,
    closeTools,
    connected,
    simRunning,
    toggleSlaveSim,
    trendHistory,
    trendPaused,
    toggleTrendPaused,
    clearTrendHistory,
    alarmLog,
    clearAlarmLog,
    rtuPort,
    serialPorts,
  } = useStudioStore();

  // Raw Hex state
  const [rawUnit, setRawUnit] = useState(1);
  const [rawHex, setRawHex] = useState("03 00 00 00 0A");
  const [rawRes, setRawRes] = useState<{ tx_hex: string; rx_hex: string; decoded: string } | null>(
    null
  );
  const [rawErr, setRawErr] = useState<string | null>(null);

  // Scanner state
  const [scanStart, setScanStart] = useState(1);
  const [scanEnd, setScanEnd] = useState(16);
  const [scanFc, setScanFc] = useState(3);
  const [scanAddr, setScanAddr] = useState(0);
  const [scanning, setScanning] = useState(false);
  const [foundIds, setFoundIds] = useState<number[] | null>(null);
  const [scanErr, setScanErr] = useState<string | null>(null);
  const [discoverHits, setDiscoverHits] = useState<
    Array<{ baud: number; parity: string; slave_id: number; fc: number; note: string }> | null
  >(null);
  const [discovering, setDiscovering] = useState(false);

  // Slave Sim state
  const [simAddr, setSimAddr] = useState(0);
  const [simVal, setSimVal] = useState(123);
  const [delayMs, setDelayMs] = useState(0);
  const [forceExc, setForceExc] = useState("");
  const [dropResp, setDropResp] = useState(false);
  const [simMsg, setSimMsg] = useState<string | null>(null);

  // Hex Calculator state
  const [calcVal, setCalcVal] = useState(0x0437);
  const [calcMask, setCalcMask] = useState("0x00FF");
  const [crcInput, setCrcInput] = useState("01 03 00 00 00 0A");

  const svgRef = useRef<SVGSVGElement | null>(null);

  if (!toolsOpen) return null;

  const handleSendRaw = async (e: React.FormEvent) => {
    e.preventDefault();
    setRawErr(null);
    try {
      const res = await invoke<{ tx_hex: string; rx_hex: string; decoded: string }>(
        "send_raw_hex",
        { unitId: rawUnit, pduHex: rawHex }
      );
      setRawRes(res);
    } catch (err) {
      setRawErr(String(err));
    }
  };

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    setScanErr(null);
    setScanning(true);
    try {
      const ids = await invoke<number[]>("scan_slave_ids", {
        startId: scanStart,
        endId: scanEnd,
        fc: scanFc,
        address: scanAddr,
      });
      setFoundIds(ids);
    } catch (err) {
      setScanErr(String(err));
    } finally {
      setScanning(false);
    }
  };

  const handleSetSimReg = async () => {
    try {
      await invoke("set_sim_register", { address: simAddr, value: simVal });
      setSimMsg(`Holding Reg[${simAddr}] = ${simVal}`);
    } catch (err) {
      setSimMsg(String(err));
    }
  };

  const handleSetSimFaults = async () => {
    try {
      const excNum = forceExc.trim() ? Number(forceExc) : null;
      await invoke("set_sim_faults", {
        delayMs,
        forceException: excNum,
        dropResponse: dropResp,
      });
      setSimMsg("Fault injection updated.");
    } catch (err) {
      setSimMsg(String(err));
    }
  };

  const handleExportPng = () => {
    const svg = svgRef.current;
    if (!svg) return;
    const xml = new XMLSerializer().serializeToString(svg);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 720;
      canvas.height = 280;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const a = document.createElement("a");
      a.download = `modbus-trend-${Date.now()}.png`;
      a.href = canvas.toDataURL("image/png");
      a.click();
    };
    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(xml)));
  };

  const seriesEntries = Object.entries(trendHistory);
  const allVals = seriesEntries.flatMap(([, arr]) => arr);
  const minVal = allVals.length ? Math.min(...allVals) : 0;
  const maxVal = allVals.length ? Math.max(...allVals) : 100;
  const span = Math.max(1, maxVal - minVal);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
      <div className="clay-panel flex h-[78vh] w-full max-w-3xl flex-col gap-3.5 p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {(
              [
                ["hex", "Raw Hex", Send],
                ["scan", "Scanner", Radar],
                ["graph", "Trend Graph", Activity],
                ["sim", "Slave Sim", Server],
                ["calc", "Hex Calc", Calculator],
                ["alarms", `Alarms (${alarmLog.length})`, Bell],
              ] as const
            ).map(([id, label, Icon]) => (
              <button
                key={id}
                type="button"
                onClick={() => openTools(id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold ${
                  toolsTab === id ? "clay-btn-primary" : "clay-btn"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={closeTools}
            className="clay-btn flex h-8 w-8 items-center justify-center"
            aria-label="Close Tools"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tab 1: Raw Hex Frame Sender */}
        {toolsTab === "hex" && (
          <form onSubmit={handleSendRaw} className="flex flex-1 flex-col gap-3">
            <div className="grid grid-cols-4 gap-2.5 text-xs">
              <label className="flex flex-col gap-1">
                <span className="text-[11px] text-(--clay-ink-muted)">Unit / Slave ID</span>
                <input
                  type="number"
                  min={0}
                  max={255}
                  value={rawUnit}
                  onChange={(e) => setRawUnit(Number(e.target.value) || 1)}
                  className="clay-inset px-3 py-2 font-mono-tabular outline-none"
                />
              </label>
              <label className="col-span-3 flex flex-col gap-1">
                <span className="text-[11px] text-(--clay-ink-muted)">
                  PDU Hex Bytes (MBAP/CRC/LRC auto-added)
                </span>
                <input
                  type="text"
                  value={rawHex}
                  onChange={(e) => setRawHex(e.target.value)}
                  className="clay-inset px-3 py-2 font-mono-tabular outline-none"
                />
              </label>
            </div>
            <button
              type="submit"
              disabled={!connected}
              className="clay-btn-primary self-start px-4 py-2 text-xs font-semibold disabled:opacity-50"
            >
              Send Raw Frame
            </button>
            <div className="clay-inset flex-1 overflow-auto p-3 font-mono-tabular text-xs">
              {rawErr && <div className="text-rose-500">{rawErr}</div>}
              {rawRes && (
                <div className="flex flex-col gap-2">
                  <div>
                    <span className="text-sky-500">TX:</span> {rawRes.tx_hex}
                  </div>
                  <div>
                    <span className="text-emerald-500">RX:</span> {rawRes.rx_hex}
                  </div>
                  <div className="text-(--clay-ink-muted)">{rawRes.decoded}</div>
                </div>
              )}
            </div>
          </form>
        )}

        {/* Tab 2: Slave ID Scanner */}
        {toolsTab === "scan" && (
          <form onSubmit={handleScan} className="flex flex-1 flex-col gap-3">
            <div className="grid grid-cols-4 gap-2.5 text-xs">
              <label className="flex flex-col gap-1">
                <span className="text-[11px] text-(--clay-ink-muted)">Start ID</span>
                <input
                  type="number"
                  min={1}
                  max={247}
                  value={scanStart}
                  onChange={(e) => setScanStart(Number(e.target.value) || 1)}
                  className="clay-inset px-3 py-1.5 font-mono-tabular outline-none"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] text-(--clay-ink-muted)">End ID</span>
                <input
                  type="number"
                  min={1}
                  max={247}
                  value={scanEnd}
                  onChange={(e) => setScanEnd(Number(e.target.value) || 16)}
                  className="clay-inset px-3 py-1.5 font-mono-tabular outline-none"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] text-(--clay-ink-muted)">Function</span>
                <select
                  value={scanFc}
                  onChange={(e) => setScanFc(Number(e.target.value))}
                  className="clay-inset px-2 py-1.5 font-semibold outline-none"
                >
                  <option value={3} className="text-slate-900">FC03 Holding</option>
                  <option value={4} className="text-slate-900">FC04 Input</option>
                  <option value={1} className="text-slate-900">FC01 Coils</option>
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] text-(--clay-ink-muted)">Test Addr</span>
                <input
                  type="number"
                  min={0}
                  max={65535}
                  value={scanAddr}
                  onChange={(e) => setScanAddr(Number(e.target.value) || 0)}
                  className="clay-inset px-3 py-1.5 font-mono-tabular outline-none"
                />
              </label>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={!connected || scanning}
                className="clay-btn-primary flex items-center gap-1.5 px-4 py-2 text-xs font-semibold disabled:opacity-50"
              >
                <Play className="h-3.5 w-3.5" />
                {scanning ? "Scanning..." : "Scan Active Bus"}
              </button>
              <button
                type="button"
                disabled={discovering || (!rtuPort && serialPorts.length === 0)}
                onClick={async () => {
                  const port = rtuPort || serialPorts[0]?.port_name;
                  if (!port) return;
                  setScanErr(null);
                  setDiscovering(true);
                  try {
                    const hits = await invoke<
                      Array<{ baud: number; parity: string; slave_id: number; fc: number; note: string }>
                    >("auto_discover_serial", {
                      portName: port,
                      startId: scanStart,
                      endId: scanEnd,
                    });
                    setDiscoverHits(hits);
                  } catch (err) {
                    setScanErr(String(err));
                  } finally {
                    setDiscovering(false);
                  }
                }}
                className="clay-btn flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold disabled:opacity-50"
              >
                <Radar className="h-3.5 w-3.5 text-sky-500" />
                {discovering ? "Discovering..." : `Auto-Discover Serial (${rtuPort || serialPorts[0]?.port_name || "COM"})`}
              </button>
            </div>
            <div className="clay-inset flex-1 overflow-auto p-3 font-mono-tabular text-xs">
              {scanErr && <div className="text-rose-500">{scanErr}</div>}
              {foundIds !== null && (
                <div className="mb-2">
                  Responding Slave IDs:{" "}
                  {foundIds.length ? (
                    <span className="font-bold text-emerald-500">{foundIds.join(", ")}</span>
                  ) : (
                    <span className="text-(--clay-ink-muted)">None responded</span>
                  )}
                </div>
              )}
              {discoverHits !== null && (
                <div className="flex flex-col gap-1">
                  <div className="text-(--clay-ink-muted)">Serial Auto-Discover Results:</div>
                  {discoverHits.length === 0 ? (
                    <div className="text-(--clay-ink-muted)">No responses found.</div>
                  ) : (
                    discoverHits.map((h, i) => (
                      <div key={i} className="text-emerald-500">
                        {h.baud} 8{h.parity}1 · Slave ID {h.slave_id} · {h.note}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </form>
        )}

        {/* Tab 3: Real-Time Trend Graph */}
        {toolsTab === "graph" && (
          <div className="flex flex-1 flex-col gap-3">
            <div className="flex items-center justify-between text-xs">
              <div className="flex flex-wrap items-center gap-3">
                {seriesEntries.map(([addr], i) => (
                  <span key={addr} className="flex items-center gap-1 font-mono-tabular">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: SERIES_COLORS[i % SERIES_COLORS.length] }}
                    />
                    Addr {addr}
                  </span>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={toggleTrendPaused}
                  className="clay-btn px-2.5 py-1 text-[11px] font-semibold"
                >
                  {trendPaused ? "Resume" : "Pause"}
                </button>
                <button
                  type="button"
                  onClick={clearTrendHistory}
                  className="clay-btn flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold"
                >
                  <Trash2 className="h-3 w-3 text-rose-500" />
                  Clear
                </button>
                <button
                  type="button"
                  onClick={handleExportPng}
                  className="clay-btn-primary flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold"
                >
                  <Download className="h-3 w-3" />
                  PNG
                </button>
              </div>
            </div>
            <div className="clay-inset flex min-h-0 flex-1 items-center justify-center p-3">
              <svg ref={svgRef} viewBox="0 0 720 260" className="h-full w-full">
                {seriesEntries.map(([addr, pts], idx) => {
                  const poly = pts
                    .map((v, i) => {
                      const x = (i / Math.max(1, pts.length - 1)) * 700 + 10;
                      const y = 245 - ((v - minVal) / span) * 225;
                      return `${x.toFixed(1)},${y.toFixed(1)}`;
                    })
                    .join(" ");
                  return (
                    <polyline
                      key={addr}
                      fill="none"
                      stroke={SERIES_COLORS[idx % SERIES_COLORS.length]}
                      strokeWidth="2.5"
                      points={poly}
                    />
                  );
                })}
              </svg>
            </div>
          </div>
        )}

        {/* Tab 4: Slave Simulator & Fault Injection */}
        {toolsTab === "sim" && (
          <div className="flex flex-1 flex-col gap-3 text-xs">
            <div className="flex items-center justify-between">
              <span>Built-in TCP Slave Simulator (1024 regs/coils)</span>
              <button
                type="button"
                onClick={toggleSlaveSim}
                className={`px-4 py-1.5 font-semibold ${
                  simRunning ? "clay-btn-danger" : "clay-btn-success"
                }`}
              >
                {simRunning ? "Stop Simulator" : "Start Simulator"}
              </button>
            </div>

            <div className="clay-card grid grid-cols-3 items-end gap-2.5 p-3">
              <label className="flex flex-col gap-1">
                <span className="text-[11px] text-(--clay-ink-muted)">Holding Addr</span>
                <input
                  type="number"
                  min={0}
                  max={1023}
                  value={simAddr}
                  onChange={(e) => setSimAddr(Number(e.target.value) || 0)}
                  className="clay-inset px-2.5 py-1.5 font-mono-tabular outline-none"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] text-(--clay-ink-muted)">Value (0–65535)</span>
                <input
                  type="number"
                  min={0}
                  max={65535}
                  value={simVal}
                  onChange={(e) => setSimVal(Number(e.target.value) || 0)}
                  className="clay-inset px-2.5 py-1.5 font-mono-tabular outline-none"
                />
              </label>
              <button
                type="button"
                onClick={handleSetSimReg}
                className="clay-btn-primary py-1.5 font-semibold"
              >
                Set Register
              </button>
            </div>

            <div className="clay-card grid grid-cols-4 items-end gap-2.5 p-3">
              <label className="flex flex-col gap-1">
                <span className="text-[11px] text-(--clay-ink-muted)">Delay (ms)</span>
                <input
                  type="number"
                  min={0}
                  max={10000}
                  value={delayMs}
                  onChange={(e) => setDelayMs(Number(e.target.value) || 0)}
                  className="clay-inset px-2.5 py-1.5 font-mono-tabular outline-none"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] text-(--clay-ink-muted)">Exception (hex/dec)</span>
                <input
                  type="text"
                  placeholder="none (e.g. 2)"
                  value={forceExc}
                  onChange={(e) => setForceExc(e.target.value)}
                  className="clay-inset px-2.5 py-1.5 font-mono-tabular outline-none"
                />
              </label>
              <button
                type="button"
                onClick={() => setDropResp(!dropResp)}
                className={`py-1.5 font-semibold ${dropResp ? "clay-btn-danger" : "clay-btn"}`}
              >
                Drop: {dropResp ? "ON" : "OFF"}
              </button>
              <button
                type="button"
                onClick={handleSetSimFaults}
                className="clay-btn-primary py-1.5 font-semibold"
              >
                Apply Faults
              </button>
            </div>

            {simMsg && (
              <div className="clay-inset px-3 py-2 font-mono-tabular text-emerald-500">
                {simMsg}
              </div>
            )}
          </div>
        )}

        {/* Tab 5: Hex & Modbus CRC/LRC Calculator */}
        {toolsTab === "calc" && (
          <div className="flex flex-1 flex-col gap-3 text-xs">
            <div className="clay-card grid grid-cols-2 gap-2.5 p-3">
              <label className="flex flex-col gap-1">
                <span className="text-[11px] text-(--clay-ink-muted)">Hex (0x0000–0xFFFF)</span>
                <input
                  type="text"
                  value={"0x" + (calcVal & 0xffff).toString(16).toUpperCase().padStart(4, "0")}
                  onChange={(e) => {
                    const n = parseInt(e.target.value.replace(/^0x/i, ""), 16);
                    if (!Number.isNaN(n)) setCalcVal(n & 0xffff);
                  }}
                  className="clay-inset px-2.5 py-1.5 font-mono-tabular outline-none"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] text-(--clay-ink-muted)">Unsigned (0–65535)</span>
                <input
                  type="number"
                  value={calcVal & 0xffff}
                  onChange={(e) => setCalcVal((Number(e.target.value) || 0) & 0xffff)}
                  className="clay-inset px-2.5 py-1.5 font-mono-tabular outline-none"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] text-(--clay-ink-muted)">Signed Int16</span>
                <input
                  type="number"
                  value={(calcVal & 0xffff) > 32767 ? (calcVal & 0xffff) - 65536 : calcVal & 0xffff}
                  onChange={(e) => setCalcVal((Number(e.target.value) || 0) & 0xffff)}
                  className="clay-inset px-2.5 py-1.5 font-mono-tabular outline-none"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] text-(--clay-ink-muted)">Binary (16-bit)</span>
                <input
                  type="text"
                  value={(calcVal & 0xffff).toString(2).padStart(16, "0")}
                  onChange={(e) => {
                    const n = parseInt(e.target.value, 2);
                    if (!Number.isNaN(n)) setCalcVal(n & 0xffff);
                  }}
                  className="clay-inset px-2.5 py-1.5 font-mono-tabular outline-none"
                />
              </label>
            </div>

            <div className="clay-card flex flex-wrap items-center gap-2 p-3">
              <input
                type="text"
                value={calcMask}
                onChange={(e) => setCalcMask(e.target.value)}
                placeholder="Mask (e.g. 0x00FF)"
                className="clay-inset w-28 px-2.5 py-1 font-mono-tabular outline-none"
              />
              {(
                [
                  ["AND", () => calcVal & (parseInt(calcMask, 16) || 0)],
                  ["OR", () => calcVal | (parseInt(calcMask, 16) || 0)],
                  ["XOR", () => calcVal ^ (parseInt(calcMask, 16) || 0)],
                  ["NOT", () => ~calcVal & 0xffff],
                  ["<< 1", () => (calcVal << 1) & 0xffff],
                  [">> 1", () => (calcVal >>> 1) & 0xffff],
                  ["Swap Bytes", () => ((calcVal & 0xff) << 8) | ((calcVal >> 8) & 0xff)],
                ] as const
              ).map(([label, fn]) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => setCalcVal(fn() & 0xffff)}
                  className="clay-btn px-2.5 py-1 font-mono-tabular text-[11px] font-semibold"
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="clay-card flex flex-col gap-2 p-3">
              <span className="text-[11px] font-semibold text-(--clay-ink-muted)">
                Modbus CRC-16 &amp; LRC Checksum Calculator
              </span>
              <input
                type="text"
                value={crcInput}
                onChange={(e) => setCrcInput(e.target.value)}
                placeholder="01 03 00 00 00 0A"
                className="clay-inset px-3 py-1.5 font-mono-tabular outline-none"
              />
              {(() => {
                const bytes = crcInput
                  .trim()
                  .split(/\s+/)
                  .map((s) => parseInt(s, 16))
                  .filter((n) => !Number.isNaN(n) && n >= 0 && n <= 255);
                let crc = 0xffff;
                let sum = 0;
                for (const b of bytes) {
                  sum = (sum + b) & 0xff;
                  crc ^= b;
                  for (let i = 0; i < 8; i++) {
                    crc = crc & 1 ? (crc >> 1) ^ 0xa001 : crc >> 1;
                  }
                }
                const lrc = ((~sum + 1) & 0xff).toString(16).toUpperCase().padStart(2, "0");
                const lo = (crc & 0xff).toString(16).toUpperCase().padStart(2, "0");
                const hi = ((crc >> 8) & 0xff).toString(16).toUpperCase().padStart(2, "0");
                return (
                  <div className="clay-inset flex flex-col gap-1 p-2.5 font-mono-tabular text-[11px]">
                    <div>
                      CRC-16: <span className="font-bold text-sky-500">0x{hi}{lo}</span> · Wire:{" "}
                      <span className="font-bold">{lo} {hi}</span> · LRC:{" "}
                      <span className="font-bold text-emerald-500">0x{lrc}</span>
                    </div>
                    <div className="text-(--clay-ink-muted)">
                      RTU Frame: {bytes.map((b) => b.toString(16).toUpperCase().padStart(2, "0")).join(" ")} {lo} {hi}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* Tab 6: Alarm History */}
        {toolsTab === "alarms" && (
          <div className="flex flex-1 flex-col gap-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-(--clay-ink-muted)">
                Live threshold breaches ({alarmLog.length})
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    downloadExcelXml(
                      `modbus-alarms-${Date.now()}`,
                      "Alarms",
                      ["Time", "Window", "Addr", "Alias", "Value", "Limit"],
                      alarmLog.map((a) => [
                        a.timestamp,
                        a.windowTitle,
                        a.address,
                        a.alias,
                        a.value,
                        a.limit,
                      ])
                    )
                  }
                  className="clay-btn flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold"
                >
                  <FileSpreadsheet className="h-3 w-3 text-emerald-500" />
                  Excel
                </button>
                <button
                  type="button"
                  onClick={clearAlarmLog}
                  className="clay-btn flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold"
                >
                  <Trash2 className="h-3 w-3 text-rose-500" />
                  Clear
                </button>
              </div>
            </div>
            <div className="clay-inset min-h-0 flex-1 overflow-auto p-2 font-mono-tabular text-[11px]">
              {alarmLog.length === 0 ? (
                <div className="flex h-full items-center justify-center text-(--clay-ink-muted)">
                  No alarms recorded. Set Min/Max Alarm in the Register Inspector.
                </div>
              ) : (
                alarmLog.map((a) => (
                  <div key={a.id} className="flex items-center gap-3 px-2 py-1 text-rose-500">
                    <span className="text-(--clay-ink-muted)">{a.timestamp}</span>
                    <span>{a.windowTitle}</span>
                    <span>#{a.address} {a.alias}</span>
                    <span className="font-bold">{a.value} ({a.limit})</span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
