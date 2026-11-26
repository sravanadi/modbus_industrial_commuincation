import { Minus, Plus, Settings, X } from "lucide-react";
import {
  AI_PROVIDER_PRESETS,
  AiProviderKind,
  useStudioStore,
} from "../stores/useStudioStore";

export function SettingsModal() {
  const {
    settingsOpen,
    setSettingsOpen,
    theme,
    toggleTheme,
    fontSize,
    adjustFontSize,
    sidebarWidth,
    adjustSidebarWidth,
    inspectorWidth,
    adjustInspectorWidth,
    trafficHeight,
    adjustTrafficHeight,
    showSidebar,
    showInspector,
    showTelemetry,
    trafficCollapsed,
    toggleSection,
    toggleTrafficCollapsed,
    timeoutMs,
    setTimeoutMs,
    autoReconnect,
    toggleAutoReconnect,
    confirmBeforeWrite,
    toggleConfirmBeforeWrite,
    resetLayout,
    aiProvider,
    aiEndpoint,
    aiModel,
    aiApiKey,
    aiHealth,
    aiHealthMsg,
    setAiConfig,
    testAiConnection,
  } = useStudioStore();

  if (!settingsOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
      <div className="clay-panel flex max-h-[85vh] w-full max-w-lg flex-col gap-4 overflow-auto p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings className="h-4.5 w-4.5 text-sky-500" />
            <h2 className="text-sm font-bold">IDE &amp; Protocol Settings</h2>
          </div>
          <button
            type="button"
            onClick={() => setSettingsOpen(false)}
            className="clay-btn flex h-8 w-8 items-center justify-center"
            aria-label="Close Settings"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Section 1: Appearance & Sizing */}
        <div className="clay-card flex flex-col gap-3 p-4">
          <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--clay-ink-muted)]">
            Appearance &amp; Panel Sizes
          </div>

          <div className="flex items-center justify-between text-xs">
            <span>Theme</span>
            <button
              type="button"
              onClick={toggleTheme}
              className="clay-btn px-3 py-1 font-semibold"
            >
              {theme === "light" ? "Light Clay" : "Dark Clay"}
            </button>
          </div>

          <SizeControl
            label="UI Font Size"
            value={`${fontSize} px`}
            onDecrease={() => adjustFontSize(-1)}
            onIncrease={() => adjustFontSize(1)}
          />
          <SizeControl
            label="Sidebar Width"
            value={`${sidebarWidth} px`}
            onDecrease={() => adjustSidebarWidth(-20)}
            onIncrease={() => adjustSidebarWidth(20)}
          />
          <SizeControl
            label="Inspector Width"
            value={`${inspectorWidth} px`}
            onDecrease={() => adjustInspectorWidth(-20)}
            onIncrease={() => adjustInspectorWidth(20)}
          />
          <SizeControl
            label="Traffic Monitor Height"
            value={`${trafficHeight} px`}
            onDecrease={() => adjustTrafficHeight(-24)}
            onIncrease={() => adjustTrafficHeight(24)}
          />
        </div>

        {/* Section 2: Visible Sections */}
        <div className="clay-card flex flex-col gap-2.5 p-4">
          <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--clay-ink-muted)]">
            Visible IDE Sections
          </div>

          <ToggleRow
            label="Explorer Sidebar"
            checked={showSidebar}
            onToggle={() => toggleSection("showSidebar")}
          />
          <ToggleRow
            label="Telemetry KPI Cards"
            checked={showTelemetry}
            onToggle={() => toggleSection("showTelemetry")}
          />
          <ToggleRow
            label="Register Inspector"
            checked={showInspector}
            onToggle={() => toggleSection("showInspector")}
          />
          <ToggleRow
            label="Traffic Monitor Expanded"
            checked={!trafficCollapsed}
            onToggle={toggleTrafficCollapsed}
          />
        </div>

        {/* Section 3: Protocol & Polling */}
        <div className="clay-card flex flex-col gap-3 p-4">
          <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--clay-ink-muted)]">
            Protocol &amp; Polling
          </div>

          <div className="flex items-center justify-between text-xs">
            <span>Response Timeout (ms)</span>
            <input
              type="number"
              min={100}
              max={30000}
              step={100}
              value={timeoutMs}
              onChange={(e) => setTimeoutMs(Number(e.target.value) || 1000)}
              className="clay-inset w-24 px-2.5 py-1 text-right font-mono-tabular outline-none"
            />
          </div>

          <ToggleRow
            label="Auto-Reconnect on Drop"
            checked={autoReconnect}
            onToggle={toggleAutoReconnect}
          />
          <ToggleRow
            label="Confirm Before Write"
            checked={confirmBeforeWrite}
            onToggle={toggleConfirmBeforeWrite}
          />
        </div>

        {/* Section 4: ASC AI Provider */}
        <div className="clay-card flex flex-col gap-2.5 p-4 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-(--clay-ink-muted)">
              ASC AI Provider
            </span>
            <span
              className={`font-mono-tabular text-[11px] font-semibold ${
                aiHealth === "healthy"
                  ? "text-emerald-500"
                  : aiHealth === "error"
                    ? "text-rose-500"
                    : "text-(--clay-ink-muted)"
              }`}
            >
              {aiHealth === "checking"
                ? "Testing…"
                : aiHealth === "healthy"
                  ? `● ${aiHealthMsg}`
                  : aiHealth === "error"
                    ? "● Connection Error"
                    : "● Not Tested"}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <label className="flex flex-col gap-1">
              <span className="text-[11px] text-(--clay-ink-muted)">Provider</span>
              <select
                value={aiProvider}
                onChange={(e) => {
                  const p = e.target.value as AiProviderKind;
                  const preset = AI_PROVIDER_PRESETS[p];
                  setAiConfig({
                    aiProvider: p,
                    ...(preset.endpoint ? { aiEndpoint: preset.endpoint } : {}),
                    ...(preset.model ? { aiModel: preset.model } : {}),
                  });
                }}
                className="clay-inset px-2 py-1.5 font-semibold outline-none"
              >
                {(Object.keys(AI_PROVIDER_PRESETS) as AiProviderKind[]).map((key) => (
                  <option key={key} value={key} className="text-slate-900">
                    {AI_PROVIDER_PRESETS[key].label}
                  </option>
                ))}
              </select>
            </label>
            <label className="col-span-2 flex flex-col gap-1">
              <span className="text-[11px] text-(--clay-ink-muted)">API Endpoint URL</span>
              <input
                type="text"
                value={aiEndpoint}
                onChange={(e) => setAiConfig({ aiEndpoint: e.target.value })}
                className="clay-inset px-2.5 py-1.5 font-mono-tabular outline-none"
              />
            </label>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <label className="flex flex-col gap-1">
              <span className="text-[11px] text-(--clay-ink-muted)">Model</span>
              <input
                type="text"
                value={aiModel}
                onChange={(e) => setAiConfig({ aiModel: e.target.value })}
                className="clay-inset px-2.5 py-1.5 font-mono-tabular outline-none"
              />
            </label>
            <label className="col-span-2 flex flex-col gap-1">
              <span className="text-[11px] text-(--clay-ink-muted)">API Key</span>
              <input
                type="password"
                placeholder="Optional for local AI…"
                value={aiApiKey}
                onChange={(e) => setAiConfig({ aiApiKey: e.target.value })}
                className="clay-inset px-2.5 py-1.5 font-mono-tabular outline-none"
              />
            </label>
          </div>

          {aiHealth === "error" && aiHealthMsg && (
            <div className="rounded-xl bg-rose-500/15 px-3 py-1.5 font-mono-tabular text-[11px] text-rose-500">
              {aiHealthMsg}
            </div>
          )}

          <button
            type="button"
            disabled={aiHealth === "checking"}
            onClick={testAiConnection}
            className="clay-btn-primary self-end px-3.5 py-1.5 text-xs font-semibold disabled:opacity-50"
          >
            {aiHealth === "checking" ? "Checking…" : "Save & Test Connection"}
          </button>
        </div>

        <button
          type="button"
          onClick={resetLayout}
          className="clay-btn py-2 text-xs font-semibold"
        >
          Reset Panel Order &amp; Sizes
        </button>
      </div>
    </div>
  );
}

function SizeControl({
  label,
  value,
  onDecrease,
  onIncrease,
}: {
  label: string;
  value: string;
  onDecrease: () => void;
  onIncrease: () => void;
}) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span>{label}</span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onDecrease}
          className="clay-btn flex h-7 w-7 items-center justify-center"
          aria-label={`Decrease ${label}`}
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <span className="clay-inset w-16 py-1 text-center font-mono-tabular text-[11px] font-semibold">
          {value}
        </span>
        <button
          type="button"
          onClick={onIncrease}
          className="clay-btn flex h-7 w-7 items-center justify-center"
          aria-label={`Increase ${label}`}
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  checked,
  onToggle,
}: {
  label: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span>{label}</span>
      <button
        type="button"
        onClick={onToggle}
        className={`px-3 py-1 text-[11px] font-semibold ${
          checked ? "clay-btn-primary" : "clay-btn"
        }`}
      >
        {checked ? "Visible" : "Hidden"}
      </button>
    </div>
  );
}
