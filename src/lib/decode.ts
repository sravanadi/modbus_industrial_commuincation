export type DisplayFormat =
  | "Signed"
  | "Unsigned"
  | "Hex"
  | "Binary"
  | "Int32"
  | "UInt32"
  | "Float32"
  | "Double64";

export type WordOrder = "AB CD" | "CD AB" | "BA DC" | "DC BA";

/** Reorders big-endian 16-bit register words into a DataView per Modbus byte/word swap. */
function buildSwappedView(regs: number[], order: WordOrder): DataView {
  const byteSwap = order === "BA DC" || order === "DC BA";
  const wordSwap = order === "CD AB" || order === "DC BA";
  const ordered = wordSwap ? [...regs].reverse() : regs;
  const buf = new ArrayBuffer(ordered.length * 2);
  const bytes = new Uint8Array(buf);

  ordered.forEach((reg, i) => {
    const hi = (reg >> 8) & 0xff;
    const lo = reg & 0xff;
    bytes[i * 2] = byteSwap ? lo : hi;
    bytes[i * 2 + 1] = byteSwap ? hi : lo;
  });

  return new DataView(buf);
}

export function formatRegisterValue(
  regs: Array<number | null>,
  index: number,
  format: DisplayFormat,
  wordOrder: WordOrder,
  fc: number
): string {
  const raw = regs[index] ?? null;
  if (raw === null) return "—";
  if (fc === 1 || fc === 2) {
    return raw !== 0 ? "1 (ON)" : "0 (OFF)";
  }

  switch (format) {
    case "Signed":
      return String(raw > 32767 ? raw - 65536 : raw);
    case "Unsigned":
      return String(raw);
    case "Hex":
      return "0x" + raw.toString(16).toUpperCase().padStart(4, "0");
    case "Binary":
      return raw.toString(2).padStart(16, "0");
    case "Int32":
    case "UInt32":
    case "Float32": {
      const r1 = regs[index + 1] ?? null;
      if (r1 === null) return "— (need 2 regs)";
      const view = buildSwappedView([raw, r1], wordOrder);
      if (format === "Int32") return String(view.getInt32(0, false));
      if (format === "UInt32") return String(view.getUint32(0, false));
      return view.getFloat32(0, false).toPrecision(6);
    }
    case "Double64": {
      const slice = regs.slice(index, index + 4);
      if (slice.length < 4 || slice.some((v) => v === null)) {
        return "— (need 4 regs)";
      }
      const view = buildSwappedView(slice as number[], wordOrder);
      return view.getFloat64(0, false).toPrecision(8);
    }
  }
}
