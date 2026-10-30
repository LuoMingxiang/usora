/** A ZIP32 STORE entry. Paths are relative POSIX paths; only regular files are supported. */
export type ZipEntry = { path: string; data: Buffer; mode?: number };

const MAX_ZIP32 = 0xffffffff;
const UTF8_FLAG = 0x800;
const FIXED_DOS_DATE = 0x5b7d;
const crcTable = new Uint32Array(256).map((_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});

function crc32(data: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of data) crc = crcTable[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/** Reject ZIP Slip, ambiguous Windows paths and names that collide on common filesystems. */
export function validateArchivePaths(paths: string[]): void {
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const file of paths) {
    const parts = file.split("/");
    if (
      !file ||
      Buffer.from(file, "utf8").toString("utf8") !== file ||
      /[\\:*?"<>|]/.test(file) ||
      [...file].some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127) ||
      Buffer.byteLength(file, "utf8") > 0xffff ||
      parts.some(
        (part) =>
          !part ||
          part === "." ||
          part === ".." ||
          /[. ]$/.test(part) ||
          /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part),
      )
    ) {
      throw Error(`ZIP_PATH: unsafe archive entry ${JSON.stringify(file)}`);
    }
    const key = file.normalize("NFC").toLowerCase();
    if (seen.has(key)) throw Error(`ZIP_DUPLICATE: duplicate archive entry ${JSON.stringify(file)}`);
    seen.add(key);
    normalized.push(key);
  }
  for (const file of normalized) {
    const parts = file.split("/");
    for (let end = 1; end < parts.length; end++) {
      if (seen.has(parts.slice(0, end).join("/"))) {
        throw Error(`ZIP_PATH: file/directory collision for ${JSON.stringify(file)}`);
      }
    }
  }
}

/**
 * Deterministic, dependency-free ZIP32 STORE writer, shared with plugin packaging. Fixed timestamps, codepoint ordering
 * and explicit UTF-8 names make repeat exports byte-identical.
 */
export function deterministicZip(entries: readonly ZipEntry[]): Buffer {
  if (entries.length > 0xffff) throw Error("ZIP_LIMIT: ZIP32 supports at most 65535 files");
  validateArchivePaths(entries.map((entry) => entry.path));
  const ordered = [...entries].sort((left, right) => (left.path < right.path ? -1 : left.path > right.path ? 1 : 0));
  const chunks: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  let centralSize = 0;
  for (const entry of ordered) {
    const name = Buffer.from(entry.path, "utf8");
    const data = entry.data;
    if (!Buffer.isBuffer(data) || data.length > MAX_ZIP32) throw Error("ZIP_LIMIT: invalid ZIP32 file size");
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(UTF8_FLAG, 6);
    local.writeUInt16LE(FIXED_DOS_DATE, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);

    const directory = Buffer.alloc(46);
    directory.writeUInt32LE(0x02014b50, 0);
    directory.writeUInt16LE((3 << 8) | 20, 4);
    directory.writeUInt16LE(20, 6);
    directory.writeUInt16LE(UTF8_FLAG, 8);
    directory.writeUInt16LE(FIXED_DOS_DATE, 14);
    directory.writeUInt32LE(crc, 16);
    directory.writeUInt32LE(data.length, 20);
    directory.writeUInt32LE(data.length, 24);
    directory.writeUInt16LE(name.length, 28);
    directory.writeUInt32LE(((0o100000 | ((entry.mode ?? 0o644) & 0o777)) << 16) >>> 0, 38);
    directory.writeUInt32LE(offset, 42);

    chunks.push(local, name, data);
    central.push(directory, name);
    offset += local.length + name.length + data.length;
    centralSize += directory.length + name.length;
    if (offset + centralSize + 22 > MAX_ZIP32) throw Error("ZIP_LIMIT: ZIP32 archive exceeds 4 GiB");
  }
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...chunks, ...central, end]);
}
