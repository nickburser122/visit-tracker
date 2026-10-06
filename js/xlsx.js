const XL = (() => {
  const u16 = (d, o) => d[o] | d[o + 1] << 8;
  const u32 = (d, o) => (d[o] | d[o + 1] << 8 | d[o + 2] << 16 | d[o + 3] << 24) >>> 0;
  const td = new TextDecoder();

  async function inflate(b) {
    const s = new Blob([b]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
    return new Uint8Array(await new Response(s).arrayBuffer());
  }

  function unzip(buf) {
    const d = new Uint8Array(buf);
    let e = d.length - 22;
    while (e >= 0 && u32(d, e) !== 0x06054b50) e--;
    if (e < 0) throw new Error("not-zip");
    const n = u16(d, e + 10);
    let p = u32(d, e + 16);
    const out = {};
    for (let i = 0; i < n; i++) {
      const m = u16(d, p + 10), cs = u32(d, p + 20), nl = u16(d, p + 28), el = u16(d, p + 30), cl = u16(d, p + 32), lo = u32(d, p + 42);
      const name = td.decode(d.subarray(p + 46, p + 46 + nl));
      const ds = lo + 30 + u16(d, lo + 26) + u16(d, lo + 28);
      const raw = d.subarray(ds, ds + cs);
      out[name] = async () => td.decode(m ? await inflate(raw) : raw);
      p += 46 + nl + el + cl;
    }
    return out;
  }

  const un = s => String(s || "")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, c) => String.fromCodePoint(parseInt(c, 16)))
    .replace(/&#(\d+);/g, (_, c) => String.fromCodePoint(+c)).replace(/&amp;/g, "&");
  const attr = (s, k) => (s.match(new RegExp("(?:^|\\s)" + k + '="([^"]*)"')) || [])[1];
  const texts = x => [...x.replace(/<rPh\b[\s\S]*?<\/rPh>/g, "").matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map(m => un(m[1])).join("");

  function colIndex(ref) {
    let c = 0;
    for (const ch of ref.replace(/[^A-Z]/gi, "").toUpperCase()) c = c * 26 + ch.charCodeAt(0) - 64;
    return c - 1;
  }

  const DATE_IDS = new Set([14, 15, 16, 17, 22, 27, 30, 36, 50, 57]);
  function dateStyles(xml) {
    const fmts = {};
    for (const m of xml.matchAll(/<numFmt\b[^>]*>/g)) fmts[+attr(m[0], "numFmtId")] = un(attr(m[0], "formatCode") || "");
    const isDate = id => {
      if (DATE_IDS.has(id)) return true;
      const f = fmts[id];
      if (!f) return false;
      const s = f.replace(/"[^"]*"|\[[^\]]*\]|\\./g, "");
      return /[dy]/i.test(s) || /m.*[dy]|[dy].*m/i.test(s);
    };
    const out = new Set();
    const xfs = (xml.match(/<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/) || [])[1] || "";
    let i = 0;
    for (const m of xfs.matchAll(/<xf\b[^>]*>/g)) { if (isDate(+attr(m[0], "numFmtId"))) out.add(i); i++; }
    return out;
  }
  const serialIso = v => new Date(Math.round((v - 25569) * 864e5)).toISOString().slice(0, 10);

  function parseSheet(x, ss, ds) {
    const rows = [];
    let last = -1;
    for (const rm of x.matchAll(/<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g)) {
      const rn = +attr(rm[1], "r") || last + 2;
      while (rows.length < rn - 1) rows.push([]);
      const r = [];
      let auto = 0;
      if (rm[2]) for (const cm of rm[2].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const a = cm[1], ref = attr(a, "r"), t = attr(a, "t"), b = cm[2] || "", sty = attr(a, "s");
        const ci = ref ? colIndex(ref) : auto;
        auto = ci + 1;
        let v = (b.match(/<v>([\s\S]*?)<\/v>/) || [])[1];
        if (t === "s") v = ss[+v];
        else if (t === "inlineStr") v = texts(b);
        else if (t === "str" || t === "e") v = un(v);
        else if (t === "b") v = v === "1";
        else if (t === "d") v = un(v);
        else if (v !== undefined && v !== "") { v = +v; if (ds && sty != null && ds.has(+sty) && v >= 1 && v < 2958466) v = serialIso(v); }
        if (ci >= 0 && v !== undefined) r[ci] = v;
      }
      rows[rn - 1] = r;
      last = rn - 1;
    }
    for (const mm of x.matchAll(/<mergeCell\b[^>]*ref="([A-Z]+)(\d+):([A-Z]+)(\d+)"/g)) {
      const c0 = colIndex(mm[1]), r0 = +mm[2] - 1, c1 = colIndex(mm[3]), r1 = +mm[4] - 1;
      if (r1 - r0 > 5000 || c1 - c0 > 60 || !rows[r0]) continue;
      const v = rows[r0][c0];
      if (v === undefined || v === "") continue;
      for (let i = r0; i <= r1; i++) {
        const row = rows[i] || (rows[i] = []);
        for (let j = c0; j <= c1; j++) if (row[j] === undefined || row[j] === "") row[j] = v;
      }
    }
    return rows;
  }

  async function read(buf) {
    const z = unzip(buf);
    if (!z["xl/workbook.xml"]) throw new Error("no-workbook");
    const wb = await z["xl/workbook.xml"]();
    const rl = z["xl/_rels/workbook.xml.rels"] ? await z["xl/_rels/workbook.xml.rels"]() : "";
    const ss = z["xl/sharedStrings.xml"]
      ? [...(await z["xl/sharedStrings.xml"]()).matchAll(/<si\b[^>]*?(?:\/>|>([\s\S]*?)<\/si>)/g)].map(m => texts(m[1] || ""))
      : [];
    const ds = z["xl/styles.xml"] ? dateStyles(await z["xl/styles.xml"]()) : null;
    const tg = {};
    for (const m of rl.matchAll(/<Relationship\b[^>]*>/g)) tg[attr(m[0], "Id")] = attr(m[0], "Target");
    const sheets = [];
    for (const m of wb.matchAll(/<sheet\b[^>]*>/g)) {
      const target = (tg[attr(m[0], "r:id")] || "").replace(/^\/?(xl\/)?/, "");
      const path = "xl/" + target;
      if (!z[path]) continue;
      sheets.push({ name: un(attr(m[0], "name") || ""), rows: parseSheet(await z[path](), ss, ds) });
    }
    return sheets;
  }

  function csv(t) {
    t = t.replace(/^\uFEFF/, "");
    const first = t.split(/\r?\n/)[0] || "";
    const sep = [",", ";", "\t"].sort((a, b) => first.split(b).length - first.split(a).length)[0];
    const rows = [];
    let r = [], c = "", q = false;
    for (let i = 0; i < t.length; i++) {
      const ch = t[i];
      if (q) {
        if (ch === '"') { if (t[i + 1] === '"') { c += '"'; i++; } else q = false; }
        else c += ch;
      } else if (ch === '"') q = true;
      else if (ch === sep) { r.push(c); c = ""; }
      else if (ch === "\n" || ch === "\r") {
        if (ch === "\r" && t[i + 1] === "\n") i++;
        r.push(c); rows.push(r); r = []; c = "";
      } else c += ch;
    }
    if (c || r.length) { r.push(c); rows.push(r); }
    return [{ name: "CSV", rows }];
  }

  const enc = new TextEncoder();
  const crcT = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc = b => { let c = ~0; for (let i = 0; i < b.length; i++) c = crcT[(c ^ b[i]) & 255] ^ (c >>> 8); return (~c) >>> 0; };

  function zip(files) {
    const parts = [], central = [];
    let off = 0;
    for (const [name, str] of files) {
      const nb = enc.encode(name), d = enc.encode(str), c = crc(d);
      const h = new DataView(new ArrayBuffer(30));
      h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(12, 0x21, true);
      h.setUint32(14, c, true); h.setUint32(18, d.length, true); h.setUint32(22, d.length, true); h.setUint16(26, nb.length, true);
      parts.push(new Uint8Array(h.buffer), nb, d);
      const cd = new DataView(new ArrayBuffer(46));
      cd.setUint32(0, 0x02014b50, true); cd.setUint16(4, 20, true); cd.setUint16(6, 20, true); cd.setUint16(8, 0x0800, true); cd.setUint16(14, 0x21, true);
      cd.setUint32(16, c, true); cd.setUint32(20, d.length, true); cd.setUint32(24, d.length, true); cd.setUint16(28, nb.length, true); cd.setUint32(42, off, true);
      central.push(new Uint8Array(cd.buffer), nb);
      off += 30 + nb.length + d.length;
    }
    const cs = central.reduce((s, a) => s + a.length, 0);
    const e = new DataView(new ArrayBuffer(22));
    e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, cs, true); e.setUint32(16, off, true);
    return new Blob([...parts, ...central, new Uint8Array(e.buffer)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  }

  const xesc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "");
  const colName = i => { let s = ""; i++; while (i) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; };
  const NS = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"';
  const RNS = 'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
  const HEAD_XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';

  function write(sheets) {
    const files = [];
    sheets.forEach((sh, si) => {
      const total = sh.total ? sh.rows.length - 1 : -1;
      const rows = sh.rows.map((r, ri) => '<row r="' + (ri + 1) + '">' + r.map((v, ci) => {
        if (v == null || v === "") return "";
        const ref = colName(ci) + (ri + 1);
        const st = ri === 0 ? ' s="1"' : ri === total ? ' s="2"' : typeof v === "number" ? ' s="3"' : "";
        if (typeof v === "number" && isFinite(v)) return '<c r="' + ref + '"' + st + "><v>" + v + "</v></c>";
        if (typeof v === "boolean") return '<c r="' + ref + '" t="b"' + st + "><v>" + (v ? 1 : 0) + "</v></c>";
        return '<c r="' + ref + '" t="inlineStr"' + st + '><is><t xml:space="preserve">' + xesc(v) + "</t></is></c>";
      }).join("") + "</row>").join("");
      const cols = sh.cols ? "<cols>" + sh.cols.map((w, i) => '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + w + '" customWidth="1"/>').join("") + "</cols>" : "";
      files.push(["xl/worksheets/sheet" + (si + 1) + ".xml", HEAD_XML + "<worksheet " + NS + '><sheetViews><sheetView rightToLeft="1" workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' + cols + "<sheetData>" + rows + "</sheetData></worksheet>"]);
    });
    files.push(["[Content_Types].xml", HEAD_XML + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' + sheets.map((_, i) => '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>').join("") + "</Types>"]);
    files.push(["_rels/.rels", HEAD_XML + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>']);
    files.push(["xl/workbook.xml", HEAD_XML + "<workbook " + NS + " " + RNS + "><sheets>" + sheets.map((s, i) => '<sheet name="' + xesc(String(s.name).slice(0, 31)) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>').join("") + "</sheets></workbook>"]);
    files.push(["xl/_rels/workbook.xml.rels", HEAD_XML + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + sheets.map((_, i) => '<Relationship Id="rId' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>').join("") + '<Relationship Id="rId' + (sheets.length + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>']);
    files.push(["xl/styles.xml", HEAD_XML + "<styleSheet " + NS + '><numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0.##"/></numFmts><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1D1D1B"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFEFEBE2"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="4"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="3" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="164" fontId="1" fillId="3" borderId="0" xfId="0" applyFont="1" applyFill="1" applyNumberFormat="1"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs></styleSheet>']);
    return zip(files);
  }

  return { read, csv, write };
})();
