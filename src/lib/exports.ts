import type { FontEntry } from "../types";

const encoder = new TextEncoder();
function table(size: number) {
  const bytes = new Uint8Array(size),
    view = new DataView(bytes.buffer);
  return {
    bytes,
    u16: (o: number, n: number) => view.setUint16(o, n),
    i16: (o: number, n: number) => view.setInt16(o, n),
    u32: (o: number, n: number) => view.setUint32(o, n),
  };
}
function checksum(bytes: Uint8Array) {
  let sum = 0;
  for (let i = 0; i < bytes.length; i += 4)
    sum =
      (sum +
        (bytes[i] || 0) * 0x1000000 +
        ((bytes[i + 1] || 0) << 16) +
        ((bytes[i + 2] || 0) << 8) +
        (bytes[i + 3] || 0)) >>>
      0;
  return sum;
}
export function makeFont(
  input: FontEntry[],
  family: string,
  licence: string,
  revision = 1,
) {
  const entries = [...input].sort((a, b) => a.codePoint - b.codePoint);
  if (!entries.length || entries.length > 65000)
    throw Error("Choose between 1 and 65000 font characters.");
  if (new Set(entries.map((g) => g.codePoint)).size !== entries.length)
    throw Error("Font character codes must be unique.");
  const tables: Record<string, Uint8Array<ArrayBuffer>> = {},
    glyphs: Uint8Array<ArrayBuffer>[] = [],
    boxes: number[][] = [],
    offsets = [0, 0];
  let glyphLength = 0,
    maxPoints = 0,
    maxContours = 0;
  for (const entry of entries) {
    if (
      !Number.isInteger(entry.codePoint) ||
      entry.codePoint < 0 ||
      entry.codePoint > 0x10ffff ||
      (entry.codePoint >= 0xd800 && entry.codePoint <= 0xdfff)
    )
      throw Error("Invalid font character code.");
    const contours = entry.contours,
      all = contours.flat(),
      count = all.length;
    if (!count || count > 32000 || contours.length > 2000)
      throw Error(
        "A character has too much detail. Simplify it or export SVG.",
      );
    let box = [Infinity, Infinity, -Infinity, -Infinity];
    for (const p of all) {
      if (
        !Number.isFinite(p[0]) ||
        !Number.isFinite(p[1]) ||
        [p[0], p[1]].some((n) => n < -32768 || n > 32767)
      )
        throw Error("Invalid glyph coordinates.");
      box = [
        Math.min(box[0], p[0]),
        Math.min(box[1], p[1]),
        Math.max(box[2], p[0]),
        Math.max(box[3], p[1]),
      ];
    }
    box = box.map(Math.round);
    boxes.push(box);
    maxPoints = Math.max(maxPoints, count);
    maxContours = Math.max(maxContours, contours.length);
    const glyf = table(12 + contours.length * 2 + count * 5);
    glyf.i16(0, contours.length);
    box.forEach((n, i) => glyf.i16(2 + i * 2, n));
    let cursor = 10,
      end = -1;
    for (const c of contours) {
      end += c.length;
      glyf.u16(cursor, end);
      cursor += 2;
    }
    glyf.u16(cursor, 0);
    cursor += 2;
    for (const p of all) glyf.bytes[cursor++] = p[2] === false ? 0 : 1;
    for (const axis of [0, 1] as const) {
      let previous = 0;
      for (const p of all) {
        const value = Math.round(p[axis]);
        glyf.i16(cursor, value - previous);
        previous = value;
        cursor += 2;
      }
    }
    glyphs.push(glyf.bytes);
    glyphLength += Math.ceil(glyf.bytes.length / 4) * 4;
    offsets.push(glyphLength);
  }
  const glyf = new Uint8Array(glyphLength);
  let offset = 0;
  for (const bytes of glyphs) {
    glyf.set(bytes, offset);
    offset += Math.ceil(bytes.length / 4) * 4;
  }
  tables.glyf = glyf;
  const loca = table(offsets.length * 4);
  offsets.forEach((n, i) => loca.u32(i * 4, n));
  tables.loca = loca.bytes;
  const box = boxes.reduce((a, b) => [
    Math.min(a[0], b[0]),
    Math.min(a[1], b[1]),
    Math.max(a[2], b[2]),
    Math.max(a[3], b[3]),
  ]);
  const head = table(54);
  head.u32(0, 0x10000);
  head.u32(4, Math.round((1 + Math.min(revision, 60000) / 65536) * 65536));
  head.u32(12, 0x5f0f3cf5);
  head.u16(16, 3);
  head.u16(18, 2048);
  box.forEach((n, i) => head.i16(36 + i * 2, n));
  head.u16(46, 8);
  head.i16(48, 2);
  head.i16(50, 1);
  tables.head = head.bytes;
  const hhea = table(36);
  hhea.u32(0, 0x10000);
  hhea.i16(4, 2048);
  hhea.u16(10, 2048);
  hhea.i16(16, 2048);
  hhea.i16(18, 1);
  hhea.u16(34, entries.length + 1);
  tables.hhea = hhea.bytes;
  const maxp = table(32);
  maxp.u32(0, 0x10000);
  maxp.u16(4, entries.length + 1);
  maxp.u16(6, maxPoints);
  maxp.u16(8, maxContours);
  maxp.u16(14, 2);
  tables.maxp = maxp.bytes;
  const hmtx = table((entries.length + 1) * 4);
  hmtx.u16(0, 2048);
  boxes.forEach((b, i) => {
    hmtx.u16((i + 1) * 4, 2048);
    hmtx.i16((i + 1) * 4 + 2, b[0]);
  });
  tables.hmtx = hmtx.bytes;
  const bmp = entries
      .map((g, i) => ({ ...g, id: i + 1 }))
      .filter((g) => g.codePoint < 0xffff),
    segments = bmp.length + 1;
  const has4 = segments < 8190,
    size4 = has4 ? 16 + 8 * segments : 0,
    size12 = 16 + entries.length * 12,
    header = has4 ? 20 : 12;
  const cmap = table(header + size4 + size12);
  cmap.u16(2, has4 ? 2 : 1);
  if (has4) {
    cmap.u16(4, 3);
    cmap.u16(6, 1);
    cmap.u32(8, header);
  }
  const rec = has4 ? 12 : 4;
  cmap.u16(rec, 3);
  cmap.u16(rec + 2, 10);
  cmap.u32(rec + 4, header + size4);
  if (has4) {
    const p = header,
      search = 2 ** Math.floor(Math.log2(segments));
    cmap.u16(p, 4);
    cmap.u16(p + 2, size4);
    cmap.u16(p + 6, segments * 2);
    cmap.u16(p + 8, search * 2);
    cmap.u16(p + 10, Math.log2(search));
    cmap.u16(p + 12, segments * 2 - search * 2);
    [...bmp, { codePoint: 0xffff, id: 0 }].forEach((g, i) => {
      cmap.u16(p + 14 + i * 2, g.codePoint);
      cmap.u16(p + 16 + segments * 2 + i * 2, g.codePoint);
      cmap.u16(p + 16 + segments * 4 + i * 2, (g.id - g.codePoint) & 0xffff);
    });
  }
  let p = header + size4;
  cmap.u16(p, 12);
  cmap.u32(p + 4, size12);
  cmap.u32(p + 12, entries.length);
  entries.forEach((g, i) => {
    cmap.u32(p + 16 + i * 12, g.codePoint);
    cmap.u32(p + 20 + i * 12, g.codePoint);
    cmap.u32(p + 24 + i * 12, i + 1);
  });
  tables.cmap = cmap.bytes;
  const os = table(96);
  os.u16(0, 4);
  os.i16(2, 2048);
  os.u16(4, 400);
  os.u16(6, 5);
  let range0 = 0,
    range1 = 0,
    range2 = 0;
  for (const g of entries) {
    const c = g.codePoint;
    if (c >= 0xe000 && c <= 0xf8ff) range1 |= 1 << 28;
    if (c >= 0x4e00 && c <= 0x9fff) range1 |= 1 << 27;
    if (c >= 0x3040 && c <= 0x309f) range1 |= 1 << 17;
    if (c >= 0x30a0 && c <= 0x30ff) range1 |= 1 << 18;
    if (c <= 0x7f) range0 |= 1;
    if (c > 0xffff) range1 |= 1 << 25;
  }
  os.u32(42, range0);
  os.u32(46, range1);
  os.u32(50, range2);
  os.bytes.set(encoder.encode("KMKR"), 58);
  os.u16(62, 64 | 128);
  os.u16(64, Math.min(0xffff, entries[0].codePoint));
  os.u16(66, Math.min(0xffff, entries.at(-1)!.codePoint));
  os.i16(68, 2048);
  os.u16(74, 2048);
  os.u32(78, 1);
  os.i16(86, 1024);
  os.i16(88, 1536);
  os.u16(94, 1);
  tables["OS/2"] = os.bytes;
  const post = table(32);
  post.u32(0, 0x30000);
  tables.post = post.bytes;
  const names: [number, string][] = [
    [1, family],
    [2, "Regular"],
    [3, `${family};${revision};${Date.now()}`],
    [4, family],
    [5, `Version 1.${String(revision).padStart(3, "0")}`],
    [6, family.replace(/[^A-Za-z0-9-]/g, "").slice(0, 60)],
    [13, licence],
  ];
  const encoded = names.map(([, text]) => {
    const bytes = new Uint8Array(text.length * 2),
      view = new DataView(bytes.buffer);
    for (let i = 0; i < text.length; i++)
      view.setUint16(i * 2, text.charCodeAt(i));
    return bytes;
  });
  const name = table(
    6 + names.length * 12 + encoded.reduce((n, b) => n + b.length, 0),
  );
  name.u16(2, names.length);
  name.u16(4, 6 + names.length * 12);
  offset = 0;
  names.forEach(([id], i) => {
    const p = 6 + i * 12;
    name.u16(p, 3);
    name.u16(p + 2, 1);
    name.u16(p + 4, 0x409);
    name.u16(p + 6, id);
    name.u16(p + 8, encoded[i].length);
    name.u16(p + 10, offset);
    name.bytes.set(encoded[i], 6 + names.length * 12 + offset);
    offset += encoded[i].length;
  });
  tables.name = name.bytes;
  const tags = Object.keys(tables).sort(),
    num = tags.length,
    search = 2 ** Math.floor(Math.log2(num)),
    size =
      12 +
      num * 16 +
      tags.reduce((n, t) => n + Math.ceil(tables[t].length / 4) * 4, 0),
    output = table(size);
  output.u32(0, 0x10000);
  output.u16(4, num);
  output.u16(6, search * 16);
  output.u16(8, Math.log2(search));
  output.u16(10, num * 16 - search * 16);
  offset = 12 + num * 16;
  let headOffset = 0;
  tags.forEach((tag, i) => {
    const p = 12 + i * 16,
      bytes = tables[tag];
    output.bytes.set(encoder.encode(tag), p);
    output.u32(p + 4, checksum(bytes));
    output.u32(p + 8, offset);
    output.u32(p + 12, bytes.length);
    output.bytes.set(bytes, offset);
    if (tag === "head") headOffset = offset;
    offset += Math.ceil(bytes.length / 4) * 4;
  });
  output.u32(headOffset + 8, (0xb1b0afba - checksum(output.bytes)) >>> 0);
  return output.bytes;
}
const xml = (value: unknown) =>
  String(value)
    .replace(
      /[<>&"']/g,
      (c) =>
        ({
          "<": "&lt;",
          ">": "&gt;",
          "&": "&amp;",
          '"': "&quot;",
          "'": "&apos;",
        })[c]!,
    )
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "");
const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main",
  R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
  P = "http://schemas.openxmlformats.org/package/2006/relationships";
const declaration = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const crcTable = Array.from({ length: 256 }, (_, n) => {
  for (let i = 0; i < 8; i++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1;
  return n >>> 0;
});
function zip(files: Record<string, string | Uint8Array<ArrayBuffer>>) {
  const local: Uint8Array<ArrayBuffer>[] = [],
    central: Uint8Array<ArrayBuffer>[] = [];
  let offset = 0;
  const bytes = (n: number, values: [number, number, number][]) => {
    const out = new Uint8Array(n),
      v = new DataView(out.buffer);
    for (const [at, value, size] of values)
      (size === 2 ? v.setUint16.bind(v) : v.setUint32.bind(v))(at, value, true);
    return out;
  };
  for (const [name, raw] of Object.entries(files)) {
    const data = typeof raw === "string" ? encoder.encode(raw) : raw,
      key = encoder.encode(name);
    let crc = 0xffffffff;
    for (const b of data) crc = crcTable[(crc ^ b) & 255] ^ (crc >>> 8);
    crc = (crc ^ 0xffffffff) >>> 0;
    const head = bytes(30, [
      [0, 0x04034b50, 4],
      [4, 20, 2],
      [6, 0x800, 2],
      [12, 0x21, 2],
      [14, crc, 4],
      [18, data.length, 4],
      [22, data.length, 4],
      [26, key.length, 2],
    ]);
    local.push(head, key, data);
    central.push(
      bytes(46, [
        [0, 0x02014b50, 4],
        [4, 20, 2],
        [6, 20, 2],
        [8, 0x800, 2],
        [14, 0x21, 2],
        [16, crc, 4],
        [20, data.length, 4],
        [24, data.length, 4],
        [28, key.length, 2],
        [42, offset, 4],
      ]),
      key,
    );
    offset += head.length + key.length + data.length;
  }
  const centralSize = central.reduce((n, b) => n + b.length, 0),
    count = Object.keys(files).length;
  const end = bytes(22, [
    [0, 0x06054b50, 4],
    [8, count, 2],
    [10, count, 2],
    [12, centralSize, 4],
    [16, offset, 4],
  ]);
  return new Blob([...local, ...central, end], {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
}
function obfuscateFont(bytes: Uint8Array<ArrayBuffer>, guid: string) {
  const key = guid
      .replace(/[{}-]/g, "")
      .match(/../g)!
      .map((v) => parseInt(v, 16))
      .reverse(),
    out = bytes.slice();
  for (let i = 0; i < 32; i++) out[i] ^= key[i % 16];
  return out;
}
export function makeDocx(
  fontBytes: Uint8Array<ArrayBuffer>,
  family: string,
  entries: { codePoint: number; name: string }[],
) {
  const guid = `{${crypto.randomUUID().toUpperCase()}}`,
    escaped = xml(family);
  const run = (text: string, size = 24, custom = false) =>
    `<w:r><w:rPr><w:rFonts w:ascii="${custom ? escaped : "Arial"}" w:hAnsi="${custom ? escaped : "Arial"}" w:eastAsia="${escaped}" w:cs="${custom ? escaped : "Arial"}"/><w:color w:val="000000"/><w:sz w:val="${size}"/><w:szCs w:val="${size}"/></w:rPr><w:t xml:space="preserve">${xml(text)}</w:t></w:r>`;
  const para = (text: string, size = 24, custom = false) =>
    `<w:p><w:pPr><w:spacing w:before="80" w:after="80"/></w:pPr>${run(text, size, custom)}</w:p>`;
  const cell = (content: string, width: number, header = false) =>
    `<w:tc><w:tcPr><w:tcW w:w="${width}" w:type="dxa"/><w:vAlign w:val="center"/>${header ? '<w:shd w:val="clear" w:fill="E8ECEF"/>' : ""}</w:tcPr>${content}</w:tc>`;
  const rows = [
    `<w:tr><w:trPr><w:tblHeader/></w:trPr>${cell(para("Character"), 1440, true)}${cell(para("Name"), 6000, true)}${cell(para("Code"), 1920, true)}</w:tr>`,
    ...entries.map(
      (g) =>
        `<w:tr><w:trPr><w:cantSplit/></w:trPr>${cell(`<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:before="100" w:after="100"/></w:pPr>${run(String.fromCodePoint(g.codePoint), 64, true)}</w:p>`, 1440)}${cell(para(g.name || "Untitled"), 6000)}${cell(para(`U+${g.codePoint.toString(16).toUpperCase()}`, 22), 1920)}</w:tr>`,
    ),
  ];
  const borders = ["top", "left", "bottom", "right", "insideH", "insideV"]
    .map((side) => `<w:${side} w:val="single" w:sz="4" w:color="D9D9D9"/>`)
    .join("");
  const document =
    declaration +
    `<w:document xmlns:w="${W}" xmlns:r="${R}"><w:body><w:p><w:pPr><w:pStyle w:val="Title"/><w:spacing w:after="180"/></w:pPr>${run("Custom Kanji Library", 40)}</w:p>${para("Saved characters, ready to use as editable text. The library font is embedded in this document.")}${para("For pasting into other documents, install the library font once and keep the source formatting. This document can be used without installing the font.", 22)}<w:tbl><w:tblPr><w:tblW w:w="9360" w:type="dxa"/><w:tblLayout w:type="fixed"/><w:tblBorders>${borders}</w:tblBorders><w:tblCellMar><w:top w:w="100" w:type="dxa"/><w:left w:w="140" w:type="dxa"/><w:bottom w:w="100" w:type="dxa"/><w:right w:w="140" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid><w:gridCol w:w="1440"/><w:gridCol w:w="6000"/><w:gridCol w:w="1920"/></w:tblGrid>${rows.join("")}</w:tbl><w:p/><w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr></w:body></w:document>`;
  const files = {
    "[Content_Types].xml":
      declaration +
      `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="odttf" ContentType="application/vnd.openxmlformats-officedocument.obfuscatedFont"/>${[
        ["document", "document.main"],
        ["styles", "styles"],
        ["settings", "settings"],
        ["fontTable", "fontTable"],
      ]
        .map(
          ([name, type]) =>
            `<Override PartName="/word/${name}.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.${type}+xml"/>`,
        )
        .join("")}</Types>`,
    "_rels/.rels":
      declaration +
      `<Relationships xmlns="${P}"><Relationship Id="rIdDocument" Type="${R}/officeDocument" Target="word/document.xml"/></Relationships>`,
    "word/document.xml": document,
    "word/_rels/document.xml.rels":
      declaration +
      `<Relationships xmlns="${P}">${["styles", "settings", "fontTable"].map((name) => `<Relationship Id="rId${name}" Type="${R}/${name}" Target="${name}.xml"/>`).join("")}</Relationships>`,
    "word/styles.xml":
      declaration +
      `<w:styles xmlns:w="${W}"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:eastAsia="${escaped}"/><w:color w:val="000000"/><w:sz w:val="24"/></w:rPr></w:rPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style><w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:rPr><w:color w:val="000000"/><w:sz w:val="40"/></w:rPr></w:style></w:styles>`,
    "word/settings.xml":
      declaration +
      `<w:settings xmlns:w="${W}"><w:embedTrueTypeFonts/><w:embedSystemFonts w:val="false"/><w:doNotHyphenateCaps/></w:settings>`,
    "word/fontTable.xml":
      declaration +
      `<w:fonts xmlns:w="${W}" xmlns:r="${R}"><w:font w:name="Arial"><w:family w:val="swiss"/></w:font><w:font w:name="${escaped}"><w:family w:val="auto"/><w:pitch w:val="default"/><w:embedRegular r:id="rIdGlyphFont" w:fontKey="${guid}" w:subsetted="false"/></w:font></w:fonts>`,
    "word/_rels/fontTable.xml.rels":
      declaration +
      `<Relationships xmlns="${P}"><Relationship Id="rIdGlyphFont" Type="${R}/font" Target="fonts/library.odttf"/></Relationships>`,
    "word/fonts/library.odttf": obfuscateFont(fontBytes, guid),
  };
  return zip(files);
}
export function clipboardHtml(character: string, family: string) {
  const f = xml(family);
  return `<!doctype html><html><head><meta charset="utf-8"></head><body><!--StartFragment--><span style="font-family:'${f}';mso-ascii-font-family:'${f}';mso-hansi-font-family:'${f}';mso-fareast-font-family:'${f}';mso-bidi-font-family:'${f}';font-size:20pt">${xml(character)}</span><!--EndFragment--></body></html>`;
}
