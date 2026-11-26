import { invoke } from "@tauri-apps/api/core";
import { create } from "zustand";
import { DisplayFormat, WordOrder } from "../lib/decode";

export type { DisplayFormat, WordOrder };
export type TransportKind = "TCP" | "RTU_TCP" | "UDP" | "RTU" | "ASCII";

export interface AlarmEntry {
  id: string;
  timestamp: string;
  windowTitle: string;
  address: number;
  alias: string;
  value: number;
  limit: string;
}

export interface SerialPortInfo {
  port_name: string;
  description: string;
}

export type AiProviderKind =
  | "freellm"
  | "local"
  | "openai"
  | "groq"
  | "openrouter"
  | "custom";

export const AI_PROVIDER_PRESETS: Record<
  AiProviderKind,
  { label: string; endpoint: string; model: string }
> = {
  freellm: {
    label: "FreeLLM / Local Router",
    endpoint: "http://127.0.0.1:31415/v1",
    model: "auto",
  },
  local: {
    label: "Local AI (Ollama)",
    endpoint: "http://localhost:11434/v1/chat/completions",
    model: "llama3.2",
  },
  openai: {
    label: "OpenAI Cloud",
    endpoint: "https://api.openai.com/v1/chat/completions",
    model: "gpt-4o-mini",
  },
  groq: {
    label: "Groq Cloud",
    endpoint: "https://api.groq.com/openai/v1/chat/completions",
    model: "llama-3.3-70b-versatile",
  },
  openrouter: {
    label: "OpenRouter Cloud",
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    model: "openai/gpt-4o-mini",
  },
  custom: {
    label: "Custom Online / Cloud API",
    endpoint: "",
    model: "",
  },
};

export interface RegisterCell {
  address: number;
  alias: string;
  unit: string;
  scale: number;
  offset: number;
  minAlarm: number | null;
  maxAlarm: number | null;
  rawValue: number | null;
  changed: boolean;
  error?: string;
}

export interface PollWindow {
  id: string;
  title: string;
  slaveId: number;
  functionCode: 1 | 2 | 3 | 4;
  startAddress: number;
  quantity: number;
  scanRateMs: number;
  addressBase: 0 | 1;
  plcAddressing: boolean;
  displayFormat: DisplayFormat;
  wordOrder: WordOrder;
  rows: RegisterCell[];
  lastError?: string;
}

export interface TrafficEntry {
  id: string;
  timestamp: string;
  direction: "TX" | "RX";
  transport: string;
  hex: string;
  decoded: string;
  is_error: boolean;
}

export interface PollStats {
  tx_count: number;
  rx_valid_count: number;
  crc_errors: number;
  timeouts: number;
  exception_count: number;
  min_ms: number;
  avg_ms: number;
  max_ms: number;
}

export interface PythonRunResult {
  stdout: string;
  stderr: string;
  exit_code: number | null;
  duration_ms: number;
}

const DEFAULT_PYTHON_SCRIPT = `import sys, socket, struct

print("Python:", sys.version.split()[0])
`;

export type DockId = "sidebar" | "main" | "inspector";
export type MainSectionId = "telemetry" | "poll" | "traffic";
export type SidebarSectionId = "transport" | "windows" | "tools";

interface StudioState {
  theme: "light" | "dark";
  fontSize: number;
  sidebarWidth: number;
  inspectorWidth: number;
  trafficHeight: number;
  dockOrder: DockId[];
  mainOrder: MainSectionId[];
  sidebarOrder: SidebarSectionId[];
  minimized: Record<string, boolean>;
  showSidebar: boolean;
  showInspector: boolean;
  showTelemetry: boolean;
  pollMaximized: boolean;
  gridRowHeight: number;
  autoReconnect: boolean;
  confirmBeforeWrite: boolean;
  settingsOpen: boolean;
  pythonOpen: boolean;
  writeDialogOpen: boolean;
  connectionOpen: boolean;
  definitionOpen: boolean;
  toolsOpen: boolean;
  ascAiOpen: boolean;
  toolsTab: "hex" | "scan" | "graph" | "sim" | "calc" | "alarms";
  trendPaused: boolean;
  trendHistory: Record<number, number[]>;
  alarmLog: AlarmEntry[];

  transportMode: TransportKind;
  tcpHost: string;
  tcpPort: number;
  rtuPort: string;
  rtuBaud: number;
  rtuDataBits: 7 | 8;
  rtuParity: "N" | "E" | "O";
  rtuStopBits: 1 | 2;
  timeoutMs: number;
  serialPorts: SerialPortInfo[];

  connected: boolean;
  polling: boolean;
  simRunning: boolean;
  csvLogging: boolean;
  csvPath: string;
  projectPath: string;
  connectionError: string | null;
  trafficCollapsed: boolean;
  trafficPaused: boolean;

  pollWindows: PollWindow[];
  activeWindowId: string | null;
  selectedAddress: number | null;
  trafficLog: TrafficEntry[];
  stats: PollStats;

  pythonCode: string;
  pythonRunning: boolean;
  pythonResult: PythonRunResult | null;
  pythonError: string | null;

  aiProvider: AiProviderKind;
  aiEndpoint: string;
  aiModel: string;
  aiApiKey: string;
  aiHealth: "untested" | "checking" | "healthy" | "error";
  aiHealthMsg: string | null;

  toggleTheme: () => void;
  adjustFontSize: (delta: number) => void;
  adjustSidebarWidth: (delta: number) => void;
  setSidebarWidth: (width: number) => void;
  adjustInspectorWidth: (delta: number) => void;
  setInspectorWidth: (width: number) => void;
  adjustTrafficHeight: (delta: number) => void;
  setTrafficHeight: (height: number) => void;
  toggleMinimized: (id: string) => void;
  reorderList: (zone: "dock" | "main" | "sidebar", fromId: string, toId: string) => void;
  resetLayout: () => void;
  toggleSection: (section: "showSidebar" | "showInspector" | "showTelemetry") => void;
  togglePollMaximized: () => void;
  adjustGridRowHeight: (delta: number) => void;
  setTimeoutMs: (ms: number) => void;
  toggleAutoReconnect: () => void;
  toggleConfirmBeforeWrite: () => void;
  setSettingsOpen: (open: boolean) => void;
  setPythonOpen: (open: boolean) => void;
  setWriteDialogOpen: (open: boolean) => void;
  setConnectionOpen: (open: boolean) => void;
  setDefinitionOpen: (open: boolean) => void;
  setAscAiOpen: (open: boolean) => void;
  openTools: (tab?: "hex" | "scan" | "graph" | "sim" | "calc" | "alarms") => void;
  closeTools: () => void;
  toggleTrendPaused: () => void;
  clearTrendHistory: () => void;
  clearAlarmLog: () => void;
  applyRegisterMap: (
    windowId: string,
    items: Array<{
      address: number;
      alias?: string;
      scale?: number;
      offset?: number;
      unit?: string;
      minAlarm?: number | null;
      maxAlarm?: number | null;
    }>
  ) => void;

  setTransportMode: (mode: TransportKind) => void;
  setTcpConfig: (host: string, port: number) => void;
  setRtuConfig: (
    port: string,
    baud: number,
    parity: "N" | "E" | "O",
    dataBits?: 7 | 8,
    stopBits?: 1 | 2
  ) => void;
  refreshSerialPorts: () => Promise<void>;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  startPolling: () => Promise<void>;
  stopPolling: () => Promise<void>;
  toggleSlaveSim: () => Promise<void>;

  setActiveWindow: (id: string) => void;
  setSelectedAddress: (address: number | null) => void;
  updatePollConfig: (
    windowId: string,
    patch: Partial<
      Pick<PollWindow, "slaveId" | "functionCode" | "startAddress" | "quantity" | "scanRateMs">
    >
  ) => void;
  setDisplayFormat: (windowId: string, format: DisplayFormat) => void;
  setWordOrder: (windowId: string, order: WordOrder) => void;
  setRowAlias: (windowId: string, address: number, alias: string) => void;
  updateRowMeta: (
    windowId: string,
    address: number,
    patch: Partial<Pick<RegisterCell, "alias" | "unit" | "scale" | "offset" | "minAlarm" | "maxAlarm">>
  ) => void;
  togglePlcAddressing: (windowId: string) => void;
  toggleAddressBase: (windowId: string) => void;
  addPollWindow: () => void;
  removePollWindow: (windowId: string) => void;

  writeValue: (windowId: string, address: number, newValue: number) => Promise<void>;
  maskWriteBit: (windowId: string, address: number, bit: number, nextState: boolean) => Promise<void>;
  writeMultipleRegisters: (slaveId: number, startAddress: number, values: number[]) => Promise<void>;
  writeMultipleCoils: (slaveId: number, startAddress: number, values: boolean[]) => Promise<void>;
  toggleCsvLogging: (path?: string) => void;
  saveProject: (path: string) => Promise<void>;
  loadProject: (path: string) => Promise<void>;

  toggleTrafficCollapsed: () => void;
  toggleTrafficPaused: () => void;
  clearTraffic: () => void;
  resetStats: () => Promise<void>;

  setPythonCode: (code: string) => void;
  runPythonScript: () => Promise<void>;

  setAiConfig: (
    patch: Partial<Pick<StudioState, "aiProvider" | "aiEndpoint" | "aiModel" | "aiApiKey">>
  ) => void;
  testAiConnection: () => Promise<void>;

  applyPollData: (payload: { window_id: string; values: number[]; error: string | null }) => void;
  appendTraffic: (entry: TrafficEntry) => void;
  applyStats: (stats: PollStats) => void;
}

function buildEmptyRows(startAddress: number, quantity: number, prev?: RegisterCell[]): RegisterCell[] {
  return Array.from({ length: quantity }, (_, i) => {
    const addr = startAddress + i;
    const old = prev?.find((r) => r.address === addr);
    return {
      address: addr,
      alias: old?.alias ?? "",
      unit: old?.unit ?? "",
      scale: old?.scale ?? 1,
      offset: old?.offset ?? 0,
      minAlarm: old?.minAlarm ?? null,
      maxAlarm: old?.maxAlarm ?? null,
      rawValue: null,
      changed: false,
    };
  });
}

const emptyStats: PollStats = {
  tx_count: 0,
  rx_valid_count: 0,
  crc_errors: 0,
  timeouts: 0,
  exception_count: 0,
  min_ms: 0,
  avg_ms: 0,
  max_ms: 0,
};

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

const STORAGE_KEY = "modbus_studio_local_prefs_v1";

function loadLocalPrefs(): Partial<{
  theme: "light" | "dark";
  fontSize: number;
  aiProvider: AiProviderKind;
  aiEndpoint: string;
  aiModel: string;
  aiApiKey: string;
}> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveLocalPrefs(s: StudioState) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        theme: s.theme,
        fontSize: s.fontSize,
        aiProvider: s.aiProvider,
        aiEndpoint: s.aiEndpoint,
        aiModel: s.aiModel,
        aiApiKey: s.aiApiKey,
      })
    );
  } catch {
    // ignore storage quota errors
  }
}

const savedPrefs = loadLocalPrefs();

export const useStudioStore = create<StudioState>((set, get) => ({
  theme: savedPrefs.theme ?? "light",
  fontSize: savedPrefs.fontSize ?? 13,
  sidebarWidth: 240,
  inspectorWidth: 288,
  trafficHeight: 176,
  dockOrder: ["sidebar", "main", "inspector"],
  mainOrder: ["telemetry", "poll", "traffic"],
  sidebarOrder: ["transport", "windows", "tools"],
  minimized: {},
  showSidebar: true,
  showInspector: true,
  showTelemetry: true,
  pollMaximized: false,
  gridRowHeight: 36,
  autoReconnect: false,
  confirmBeforeWrite: false,
  settingsOpen: false,
  pythonOpen: false,
  writeDialogOpen: false,
  connectionOpen: false,
  definitionOpen: false,
  toolsOpen: false,
  ascAiOpen: false,
  toolsTab: "hex",
  trendPaused: false,
  trendHistory: {},
  alarmLog: [],

  transportMode: "TCP",
  tcpHost: "127.0.0.1",
  tcpPort: 502,
  rtuPort: "",
  rtuBaud: 9600,
  rtuDataBits: 8,
  rtuParity: "N",
  rtuStopBits: 1,
  timeoutMs: 1000,
  serialPorts: [],

  connected: false,
  polling: false,
  simRunning: false,
  csvLogging: false,
  csvPath: "modbus-log.csv",
  projectPath: "workspace.mbproj",
  connectionError: null,
  trafficCollapsed: false,
  trafficPaused: false,

  pollWindows: [
    {
      id: "win-1",
      title: "Poll #1",
      slaveId: 1,
      functionCode: 3,
      startAddress: 0,
      quantity: 10,
      scanRateMs: 1000,
      addressBase: 0,
      plcAddressing: true,
      displayFormat: "Signed",
      wordOrder: "AB CD",
      rows: buildEmptyRows(0, 10),
    },
  ],
  activeWindowId: "win-1",
  selectedAddress: null,
  trafficLog: [],
  stats: emptyStats,

  pythonCode: DEFAULT_PYTHON_SCRIPT,
  pythonRunning: false,
  pythonResult: null,
  pythonError: null,

  aiProvider: savedPrefs.aiProvider ?? "freellm",
  aiEndpoint: savedPrefs.aiEndpoint ?? "http://127.0.0.1:31415/v1",
  aiModel: savedPrefs.aiModel ?? "auto",
  aiApiKey: savedPrefs.aiApiKey ?? "",
  aiHealth: "untested",
  aiHealthMsg: null,

  toggleTheme: () =>
    set((s) => {
      const next = { ...s, theme: (s.theme === "light" ? "dark" : "light") as "light" | "dark" };
      saveLocalPrefs(next);
      return { theme: next.theme };
    }),
  adjustFontSize: (delta) =>
    set((s) => {
      const fontSize = clamp(s.fontSize + delta, 11, 18);
      saveLocalPrefs({ ...s, fontSize });
      return { fontSize };
    }),
  adjustSidebarWidth: (delta) =>
    set((s) => ({ sidebarWidth: clamp(s.sidebarWidth + delta, 180, 460) })),
  setSidebarWidth: (width) => set({ sidebarWidth: clamp(width, 180, 460) }),
  adjustInspectorWidth: (delta) =>
    set((s) => ({ inspectorWidth: clamp(s.inspectorWidth + delta, 200, 480) })),
  setInspectorWidth: (width) => set({ inspectorWidth: clamp(width, 200, 480) }),
  adjustTrafficHeight: (delta) =>
    set((s) => ({ trafficHeight: clamp(s.trafficHeight + delta, 100, 460) })),
  setTrafficHeight: (height) => set({ trafficHeight: clamp(height, 100, 460) }),
  toggleMinimized: (id) =>
    set((s) => ({ minimized: { ...s.minimized, [id]: !s.minimized[id] } })),
  reorderList: (zone, fromId, toId) =>
    set((s) => {
      if (fromId === toId) return s;
      const swap = <T extends string>(arr: T[]): T[] => {
        const fi = arr.indexOf(fromId as T);
        const ti = arr.indexOf(toId as T);
        if (fi === -1 || ti === -1) return arr;
        const copy = [...arr];
        const [moved] = copy.splice(fi, 1);
        copy.splice(ti, 0, moved);
        return copy;
      };
      if (zone === "dock") return { dockOrder: swap(s.dockOrder) };
      if (zone === "main") return { mainOrder: swap(s.mainOrder) };
      return { sidebarOrder: swap(s.sidebarOrder) };
    }),
  resetLayout: () =>
    set({
      fontSize: 13,
      sidebarWidth: 240,
      inspectorWidth: 288,
      trafficHeight: 176,
      dockOrder: ["sidebar", "main", "inspector"],
      mainOrder: ["telemetry", "poll", "traffic"],
      sidebarOrder: ["transport", "windows", "tools"],
      minimized: {},
      showSidebar: true,
      showInspector: true,
      showTelemetry: true,
      trafficCollapsed: false,
    }),
  toggleSection: (section) => set((s) => ({ [section]: !s[section] })),
  togglePollMaximized: () => set((s) => ({ pollMaximized: !s.pollMaximized })),
  adjustGridRowHeight: (delta) =>
    set((s) => ({ gridRowHeight: clamp(s.gridRowHeight + delta, 26, 56) })),
  setTimeoutMs: (ms) => set({ timeoutMs: clamp(ms, 100, 30000) }),
  toggleAutoReconnect: () => set((s) => ({ autoReconnect: !s.autoReconnect })),
  toggleConfirmBeforeWrite: () =>
    set((s) => ({ confirmBeforeWrite: !s.confirmBeforeWrite })),
  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
  setPythonOpen: (pythonOpen) => set({ pythonOpen }),
  setWriteDialogOpen: (writeDialogOpen) => set({ writeDialogOpen }),
  setConnectionOpen: (connectionOpen) => set({ connectionOpen }),
  setDefinitionOpen: (definitionOpen) => set({ definitionOpen }),
  setAscAiOpen: (ascAiOpen) => set({ ascAiOpen }),
  openTools: (tab) => set((s) => ({ toolsOpen: true, toolsTab: tab ?? s.toolsTab })),
  closeTools: () => set({ toolsOpen: false }),
  toggleTrendPaused: () => set((s) => ({ trendPaused: !s.trendPaused })),
  clearTrendHistory: () => set({ trendHistory: {} }),
  clearAlarmLog: () => set({ alarmLog: [] }),
  applyRegisterMap: (windowId, items) =>
    set((s) => ({
      pollWindows: s.pollWindows.map((w) => {
        if (w.id !== windowId) return w;
        const byAddr = new Map(items.map((it) => [it.address, it]));
        return {
          ...w,
          rows: w.rows.map((r) => {
            const patch = byAddr.get(r.address);
            return patch ? { ...r, ...patch } : r;
          }),
        };
      }),
    })),

  setTransportMode: (transportMode) => set({ transportMode, connectionError: null }),
  setTcpConfig: (tcpHost, tcpPort) => set({ tcpHost, tcpPort }),
  setRtuConfig: (rtuPort, rtuBaud, rtuParity, dataBits, stopBits) =>
    set((s) => ({
      rtuPort,
      rtuBaud,
      rtuParity,
      rtuDataBits: dataBits ?? s.rtuDataBits,
      rtuStopBits: stopBits ?? s.rtuStopBits,
    })),

  refreshSerialPorts: async () => {
    try {
      const ports = await invoke<SerialPortInfo[]>("get_serial_ports");
      set((s) => ({
        serialPorts: ports,
        rtuPort: s.rtuPort || ports[0]?.port_name || "",
      }));
    } catch {
      // Running outside Tauri or no serial ports available
    }
  },

  connect: async () => {
    const {
      transportMode,
      tcpHost,
      tcpPort,
      rtuPort,
      rtuBaud,
      rtuDataBits,
      rtuParity,
      rtuStopBits,
      timeoutMs,
    } = get();
    set({ connectionError: null });
    try {
      if (transportMode === "TCP" || transportMode === "RTU_TCP" || transportMode === "UDP") {
        const cmd =
          transportMode === "RTU_TCP"
            ? "connect_rtu_over_tcp"
            : transportMode === "UDP"
              ? "connect_udp"
              : "connect_tcp";
        await invoke(cmd, {
          host: tcpHost.trim(),
          port: tcpPort,
          timeoutMs,
        });
      } else {
        if (!rtuPort) {
          set({ connectionError: "Select a serial port first." });
          return;
        }
        const cmd = transportMode === "ASCII" ? "connect_ascii" : "connect_rtu";
        await invoke(cmd, {
          portName: rtuPort,
          baudRate: rtuBaud,
          parity: rtuParity,
          dataBits: rtuDataBits,
          stopBits: rtuStopBits,
          timeoutMs,
        });
      }
      set({ connected: true, connectionError: null });
    } catch (err) {
      set({ connected: false, polling: false, connectionError: String(err) });
    }
  },

  disconnect: async () => {
    try {
      await invoke("disconnect");
    } catch {
      // ignore
    }
    set({ connected: false, polling: false });
  },

  startPolling: async () => {
    const { connected, pollWindows, autoReconnect } = get();
    if (!connected || pollWindows.length === 0) return;

    try {
      await invoke("start_poll", {
        configs: pollWindows.map((win) => ({
          window_id: win.id,
          slave_id: win.slaveId,
          function_code: win.functionCode,
          start_address: win.startAddress,
          quantity: win.quantity,
          scan_rate_ms: win.scanRateMs,
        })),
        autoReconnect,
      });
      set({ polling: true, connectionError: null });
    } catch (err) {
      set({ polling: false, connectionError: String(err) });
    }
  },

  stopPolling: async () => {
    try {
      await invoke("stop_poll");
    } catch {
      // ignore
    }
    set({ polling: false });
  },

  toggleSlaveSim: async () => {
    const { simRunning, tcpPort } = get();
    set({ connectionError: null });
    try {
      if (simRunning) {
        await invoke("stop_slave_sim");
        set({ simRunning: false });
      } else {
        await invoke("start_slave_sim", { port: tcpPort || 502 });
        set({ simRunning: true });
      }
    } catch (err) {
      set({ connectionError: String(err) });
    }
  },

  setActiveWindow: (activeWindowId) => set({ activeWindowId, selectedAddress: null }),
  setSelectedAddress: (selectedAddress) => set({ selectedAddress }),

  updatePollConfig: (windowId, patch) => {
    set((s) => ({
      pollWindows: s.pollWindows.map((w) => {
        if (w.id !== windowId) return w;
        const nextStart = patch.startAddress ?? w.startAddress;
        const nextQty = clamp(patch.quantity ?? w.quantity, 1, 1000);
        return {
          ...w,
          ...patch,
          quantity: nextQty,
          rows:
            patch.startAddress !== undefined || patch.quantity !== undefined
              ? buildEmptyRows(nextStart, nextQty, w.rows)
              : w.rows,
        };
      }),
    }));
    const { connected, polling, activeWindowId, startPolling } = get();
    if (connected && polling && activeWindowId === windowId) {
      void startPolling();
    }
  },

  setDisplayFormat: (windowId, displayFormat) =>
    set((s) => ({
      pollWindows: s.pollWindows.map((w) =>
        w.id === windowId ? { ...w, displayFormat } : w
      ),
    })),

  setWordOrder: (windowId, wordOrder) =>
    set((s) => ({
      pollWindows: s.pollWindows.map((w) =>
        w.id === windowId ? { ...w, wordOrder } : w
      ),
    })),

  setRowAlias: (windowId, address, alias) =>
    set((s) => ({
      pollWindows: s.pollWindows.map((w) =>
        w.id === windowId
          ? {
              ...w,
              rows: w.rows.map((r) => (r.address === address ? { ...r, alias } : r)),
            }
          : w
      ),
    })),

  updateRowMeta: (windowId, address, patch) =>
    set((s) => ({
      pollWindows: s.pollWindows.map((w) =>
        w.id === windowId
          ? {
              ...w,
              rows: w.rows.map((r) => (r.address === address ? { ...r, ...patch } : r)),
            }
          : w
      ),
    })),

  togglePlcAddressing: (windowId) =>
    set((s) => ({
      pollWindows: s.pollWindows.map((w) =>
        w.id === windowId ? { ...w, plcAddressing: !w.plcAddressing } : w
      ),
    })),

  toggleAddressBase: (windowId) =>
    set((s) => ({
      pollWindows: s.pollWindows.map((w) =>
        w.id === windowId ? { ...w, addressBase: w.addressBase === 0 ? 1 : 0 } : w
      ),
    })),

  addPollWindow: () =>
    set((s) => {
      const nextNum =
        s.pollWindows.reduce((max, w) => {
          const n = Number(w.id.replace("win-", ""));
          return Number.isNaN(n) ? max : Math.max(max, n);
        }, 0) + 1;
      const newWin: PollWindow = {
        id: `win-${nextNum}`,
        title: `Poll #${nextNum}`,
        slaveId: 1,
        functionCode: 3,
        startAddress: 0,
        quantity: 10,
        scanRateMs: 1000,
        addressBase: 0,
        plcAddressing: true,
        displayFormat: "Signed",
        wordOrder: "AB CD",
        rows: buildEmptyRows(0, 10),
      };
      return {
        pollWindows: [...s.pollWindows, newWin],
        activeWindowId: newWin.id,
        selectedAddress: null,
      };
    }),

  removePollWindow: (windowId) =>
    set((s) => {
      const idx = s.pollWindows.findIndex((w) => w.id === windowId);
      if (idx === -1) return s;
      const remaining = s.pollWindows.filter((w) => w.id !== windowId);
      let nextActive = s.activeWindowId;
      if (s.activeWindowId === windowId) {
        nextActive = remaining[Math.max(0, idx - 1)]?.id ?? null;
      }
      return {
        pollWindows: remaining,
        activeWindowId: nextActive,
        selectedAddress: null,
      };
    }),

  writeValue: async (windowId, address, newValue) => {
    const { pollWindows, confirmBeforeWrite } = get();
    const win = pollWindows.find((w) => w.id === windowId);
    if (!win) return;
    if (
      confirmBeforeWrite &&
      !window.confirm(`Write ${newValue} to Slave ${win.slaveId} Addr ${address}?`)
    ) {
      return;
    }
    try {
      if (win.functionCode === 1) {
        await invoke("write_single_coil", {
          slaveId: win.slaveId,
          address,
          value: newValue !== 0,
        });
      } else {
        const clamped = clamp(Math.round(newValue), 0, 65535);
        await invoke("write_single_register", {
          slaveId: win.slaveId,
          address,
          value: clamped,
        });
      }
      set({ connectionError: null });
    } catch (err) {
      set({ connectionError: String(err) });
    }
  },

  maskWriteBit: async (windowId, address, bit, nextState) => {
    const { pollWindows, confirmBeforeWrite } = get();
    const win = pollWindows.find((w) => w.id === windowId);
    if (!win) return;
    if (
      confirmBeforeWrite &&
      !window.confirm(`Set bit ${bit} = ${nextState ? 1 : 0} on Slave ${win.slaveId} Addr ${address}?`)
    ) {
      return;
    }
    const mask = 1 << bit;
    const andMask = ~mask & 0xffff;
    const orMask = nextState ? mask : 0;
    try {
      await invoke("mask_write_register", {
        slaveId: win.slaveId,
        address,
        andMask,
        orMask,
      });
      set({ connectionError: null });
    } catch (err) {
      set({ connectionError: String(err) });
    }
  },

  writeMultipleRegisters: async (slaveId, startAddress, values) => {
    await invoke("write_multiple_registers", {
      slaveId,
      startAddress,
      values: values.map((v) => clamp(Math.round(v), 0, 65535)),
    });
  },

  writeMultipleCoils: async (slaveId, startAddress, values) => {
    await invoke("write_multiple_coils", {
      slaveId,
      startAddress,
      values,
    });
  },

  toggleCsvLogging: (path) =>
    set((s) => ({
      csvLogging: !s.csvLogging,
      csvPath: path ?? s.csvPath,
    })),

  saveProject: async (path) => {
    const s = get();
    const payload = {
      version: 1,
      theme: s.theme,
      fontSize: s.fontSize,
      transportMode: s.transportMode,
      tcpHost: s.tcpHost,
      tcpPort: s.tcpPort,
      rtuPort: s.rtuPort,
      rtuBaud: s.rtuBaud,
      rtuParity: s.rtuParity,
      timeoutMs: s.timeoutMs,
      pollWindows: s.pollWindows.map((w) => ({
        ...w,
        rows: w.rows.map((r) => ({ address: r.address, alias: r.alias })),
      })),
    };
    await invoke("save_project", { path, json: JSON.stringify(payload, null, 2) });
    set({ projectPath: path, connectionError: null });
  },

  loadProject: async (path) => {
    const raw = await invoke<string>("load_project", { path });
    const data = JSON.parse(raw);
    const windows: PollWindow[] = (data.pollWindows ?? []).map((w: PollWindow) => ({
      ...w,
      rows: buildEmptyRows(w.startAddress, w.quantity, w.rows),
    }));
    set({
      projectPath: path,
      theme: data.theme ?? "light",
      fontSize: data.fontSize ?? 13,
      transportMode: data.transportMode ?? "TCP",
      tcpHost: data.tcpHost ?? "127.0.0.1",
      tcpPort: data.tcpPort ?? 502,
      rtuPort: data.rtuPort ?? "",
      rtuBaud: data.rtuBaud ?? 9600,
      rtuParity: data.rtuParity ?? "N",
      timeoutMs: data.timeoutMs ?? 1000,
      pollWindows: windows,
      activeWindowId: windows[0]?.id ?? null,
      selectedAddress: null,
      connectionError: null,
    });
  },

  toggleTrafficCollapsed: () => set((s) => ({ trafficCollapsed: !s.trafficCollapsed })),
  toggleTrafficPaused: () => set((s) => ({ trafficPaused: !s.trafficPaused })),
  clearTraffic: () => set({ trafficLog: [] }),

  resetStats: async () => {
    try {
      await invoke("reset_stats");
    } catch {
      // fallback
    }
    set({ stats: emptyStats });
  },

  setPythonCode: (pythonCode) => set({ pythonCode }),

  runPythonScript: async () => {
    const { pythonCode } = get();
    set({ pythonRunning: true, pythonError: null });
    try {
      const res = await invoke<PythonRunResult>("run_python_script", { code: pythonCode });
      set({ pythonRunning: false, pythonResult: res });
    } catch (err) {
      set({ pythonRunning: false, pythonError: String(err) });
    }
  },

  setAiConfig: (patch) =>
    set((s) => {
      const next = {
        ...s,
        ...patch,
        aiHealth:
          patch.aiEndpoint !== undefined ||
          patch.aiApiKey !== undefined ||
          patch.aiModel !== undefined
            ? ("untested" as const)
            : s.aiHealth,
        aiHealthMsg:
          patch.aiEndpoint !== undefined ||
          patch.aiApiKey !== undefined ||
          patch.aiModel !== undefined
            ? null
            : s.aiHealthMsg,
      };
      saveLocalPrefs(next);
      return next;
    }),

  testAiConnection: async () => {
    const { aiEndpoint, aiApiKey, aiModel } = get();
    set({ aiHealth: "checking", aiHealthMsg: null });
    const started = performance.now();
    try {
      await invoke<string>("asc_ai_health", {
        endpoint: aiEndpoint.trim(),
        apiKey: aiApiKey.trim(),
        model: aiModel.trim() || "auto",
      });
      const ms = Math.round(performance.now() - started);
      set({ aiHealth: "healthy", aiHealthMsg: `Healthy (${ms} ms)` });
    } catch (err) {
      set({ aiHealth: "error", aiHealthMsg: String(err) });
    }
  },

  applyPollData: ({ window_id, values, error }) => {
    const state = get();
    if (state.csvLogging && !error && values.length > 0) {
      const win = state.pollWindows.find((w) => w.id === window_id);
      if (win) {
        const ts = new Date().toISOString();
        const header = [
          "timestamp",
          "slave_id",
          "fc",
          ...win.rows.map((r) => r.alias || `addr_${r.address}`),
        ].join(",");
        const line = [ts, win.slaveId, win.functionCode, ...values].join(",");
        invoke("append_csv_log", { path: state.csvPath, line, header }).catch(() => {});
      }
    }

    set((s) => {
      const nextHistory = { ...s.trendHistory };
      const newAlarms: AlarmEntry[] = [];
      const ts = new Date().toLocaleTimeString();
      if (!error && values.length > 0) {
        const win = s.pollWindows.find((w) => w.id === window_id);
        if (win) {
          if (!s.trendPaused) {
            values.slice(0, 6).forEach((val, idx) => {
              const addr = win.startAddress + idx;
              const arr = nextHistory[addr] ?? [];
              nextHistory[addr] = [...arr.slice(-119), val];
            });
          }
          win.rows.forEach((r, idx) => {
            const raw = values[idx];
            if (raw === undefined) return;
            const scaled = raw * r.scale + r.offset;
            if (r.minAlarm !== null && scaled < r.minAlarm) {
              newAlarms.push({
                id: `${Date.now()}-${r.address}`,
                timestamp: ts,
                windowTitle: win.title,
                address: r.address,
                alias: r.alias,
                value: Number(scaled.toFixed(3)),
                limit: `< ${r.minAlarm}`,
              });
            } else if (r.maxAlarm !== null && scaled > r.maxAlarm) {
              newAlarms.push({
                id: `${Date.now()}-${r.address}`,
                timestamp: ts,
                windowTitle: win.title,
                address: r.address,
                alias: r.alias,
                value: Number(scaled.toFixed(3)),
                limit: `> ${r.maxAlarm}`,
              });
            }
          });
        }
      }
      return {
        trendHistory: nextHistory,
        alarmLog: newAlarms.length
          ? [...newAlarms, ...s.alarmLog].slice(0, 100)
          : s.alarmLog,
        pollWindows: s.pollWindows.map((w) => {
          if (w.id !== window_id) return w;
          if (error) {
            return {
              ...w,
              lastError: error,
              rows: w.rows.map((r) => ({ ...r, error, changed: false })),
            };
          }
          return {
            ...w,
            lastError: undefined,
            rows: w.rows.map((r, idx) => {
              const nextVal = values[idx] ?? null;
              const changed =
                r.rawValue !== null && nextVal !== null && r.rawValue !== nextVal;
              if (r.rawValue === nextVal && r.changed === changed && r.error === undefined) {
                return r;
              }
              return { ...r, rawValue: nextVal, changed, error: undefined };
            }),
          };
        }),
      };
    });
  },

  appendTraffic: (entry) =>
    set((s) =>
      s.trafficPaused
        ? s
        : { trafficLog: [entry, ...s.trafficLog.slice(0, 99)] }
    ),

  applyStats: (stats) => set({ stats }),
}));
