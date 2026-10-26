// SQL engine for TheHauData Lab: DuckDB-WASM runs the query, sqlglot (in Pyodide) translates T-SQL to DuckDB.
//
// The host only lets the page fetch its own files, so neither engine may fetch a blob: URL:
//  - DuckDB gets its wasm over postMessage into a small wrapper worker that answers the engine's fetch itself.
//  - Pyodide gets python_stdlib.zip from a temporary fetch override.
// Binary files are published as base64 .txt files (the host serves a fixed list of file types).
import * as duckdb from "../vendor/duckdb-browser.mjs";

let db, conn, py, manifest;
const listeners = new Set();
const status = { phase: "idle", message: "", ready: false, error: null, pct: 0 };
const emit = () => listeners.forEach(f => f({ ...status }));
const setStatus = (p, m) => { Object.assign(status, { phase: p, message: m }); emit(); };
// Boot is six stages (wasm download, DuckDB start, stdlib download, Pyodide start, sqlglot, schema); status.pct counts them.
const STAGES = 6; let stagesDone = 0;
const tick = () => { stagesDone++; status.pct = Math.min(100, Math.round(100 * stagesDone / STAGES)); emit(); };

async function bytes(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  if (!url.endsWith(".txt")) return new Uint8Array(await r.arrayBuffer());
  const bin = atob((await r.text()).trim()), out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
async function gunzip(u8) {
  if (u8[0] !== 0x1f || u8[1] !== 0x8b) return u8;
  return new Uint8Array(await new Response(new Blob([u8]).stream().pipeThrough(new DecompressionStream("gzip"))).arrayBuffer());
}

async function bootDuck() {
  const wasm = await gunzip(await bytes("vendor/duckdb-eh.wasm.gz.txt"));
  tick();
  const WASM_URL = "https://duckdb.invalid/duckdb-eh.wasm";
  const real = new URL("vendor/duckdb-browser-eh.worker.js", document.baseURI).href;
  const src = `(function () {
    let bytes = null; const realFetch = self.fetch.bind(self);
    self.fetch = (u, o) => (u && u.url || String(u)) === ${JSON.stringify(WASM_URL)}
      ? Promise.resolve(new Response(bytes, { status: 200, headers: { "Content-Type": "application/wasm" } })) : realFetch(u, o);
    self.addEventListener("message", e => { if (e.data && e.data.__wasm) { bytes = e.data.__wasm; e.stopImmediatePropagation(); self.postMessage({ __wasmReady: true }); } });
    importScripts(${JSON.stringify(real)});
  })();`;
  const worker = new Worker(URL.createObjectURL(new Blob([src], { type: "text/javascript" })));
  const ready = new Promise((res, rej) => {
    worker.addEventListener("message", e => { if (e.data && e.data.__wasmReady) { e.stopImmediatePropagation(); res(); } });
    worker.addEventListener("error", e => rej(new Error("DuckDB worker failed: " + (e.message || "blocked"))));
  });
  worker.postMessage({ __wasm: wasm.buffer }, [wasm.buffer]);
  await ready;
  db = new duckdb.AsyncDuckDB(new duckdb.VoidLogger(), worker);
  await db.instantiate(WASM_URL);
  tick();
  conn = await db.connect();
  await conn.query("SET default_collation = 'NOCASE'");   // SQL Server compares text case-insensitively
}

async function bootPy() {
  const realFetch = window.fetch;
  try {
    const stdlib = await bytes("vendor/python_stdlib.zip.txt");
    tick();
    window.fetch = (u, o) => String(u).endsWith("python_stdlib.zip")
      ? Promise.resolve(new Response(stdlib, { status: 200, headers: { "Content-Type": "application/zip" } })) : realFetch(u, o);
    py = await loadPyodide({ indexURL: new URL("vendor/", document.baseURI).href });
  } finally { window.fetch = realFetch; }
  tick();
  py.unpackArchive(await bytes("vendor/sqlglot.zip.txt"), "zip", { extractDir: "/home/pyodide/lib" });
  py.runPython("import sys; sys.path.insert(0, '/home/pyodide/lib')");
  py.runPython(await (await fetch("py/transpile.py.txt")).text());
  tick();
}

let startPromise = null;
export function start() {
  if (startPromise) return startPromise;
  startPromise = (async () => {
    try {
      const t0 = performance.now();
      setStatus("loading", "Loading the SQL engine");
      await Promise.all([bootDuck(), bootPy()]);
      manifest = await (await fetch("data/schema.json")).json();
      tick();
      status.ready = true;
      setStatus("ready", `SQL engine ready (${((performance.now() - t0) / 1000).toFixed(1)}s)`);
    } catch (e) {
      status.error = String(e.message || e);
      setStatus("error", "The SQL engine could not start: " + status.error);
      throw e;
    }
  })();
  return startPromise;
}
export function onStatus(f) { listeners.add(f); f({ ...status }); return () => listeners.delete(f); }
export const getStatus = () => ({ ...status });
export const ready = () => startPromise || start();

// ---- datasets -----------------------------------------------------------------------------------------
// Two profiles of the same tables: hw = class database as in SQL Server (text NULL kept), cs = cleaned tables for case studies.
const files = new Set(), created = new Set();
let currentProfile = null;
export const tablesFor = (profile, keys) => manifest.tables.filter(t => keys.includes(t.ds)).map(t => ({ name: t.name, ds: t.ds, cols: t["cols_" + profile] }));

// Table files are downloaded ahead of time (prefetch) so the first query on a dataset does not wait on the network.
const dataCache = new Map();
const dataBytes = url => { if (!dataCache.has(url)) dataCache.set(url, bytes(url)); return dataCache.get(url); };
export async function prefetch(keys) {
  await ready();
  for (const t of manifest.tables) {
    if (!keys.includes(t.ds) || files.has(`f_${t.name}.csv`)) continue;
    try { await dataBytes(t.file); } catch (e) { dataCache.delete(t.file); }
  }
}

export async function use(profile, keys) {
  await ready();
  await conn.query(`CREATE SCHEMA IF NOT EXISTS ${profile}`);
  for (const t of manifest.tables) {
    if (!keys.includes(t.ds) || created.has(profile + ":" + t.name)) continue;
    const f = `f_${t.name}.csv`;
    if (!files.has(f)) { await db.registerFileBuffer(f, await dataBytes(t.file)); files.add(f); dataCache.delete(t.file); }
    await conn.query(t[profile].replace("{S}", profile).replace("{F}", f));
    created.add(profile + ":" + t.name);
  }
  if (currentProfile !== profile) { await conn.query(`SET schema = '${profile}'`); currentProfile = profile; }
}

// ---- running a query ----------------------------------------------------------------------------------
function decimalText(v, scale) {
  let s = String(v); const neg = s.startsWith("-"); if (neg) s = s.slice(1);
  s = s.padStart(scale + 1, "0");
  return (neg ? "-" : "") + (scale ? s.slice(0, -scale) + "." + s.slice(-scale) : s);
}
// Arrow typeIds: Decimal 7, Date 8, Timestamp 10.
function display(v, type) {
  if (v === null || v === undefined) return null;
  if (type.typeId === 7) return decimalText(v, type.scale);
  if (type.typeId === 8 || type.typeId === 10) return new Date(Number(v)).toISOString().slice(0, type.typeId === 8 ? 10 : 19).replace("T", " ");
  if (typeof v === "bigint") return v.toString();
  if (typeof v === "number") return Number.isInteger(v) ? String(v) : String(Math.round(v * 1e6) / 1e6);
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v);
}

export async function run(sql, profile, keys) {
  await use(profile, keys);
  py.globals.set("user_sql", sql);
  py.globals.set("schema_json", JSON.stringify(Object.fromEntries(manifest.tables.filter(t => created.has(profile + ":" + t.name)).map(t => [t.name, t["cols_" + profile]]))));
  py.globals.set("profile", profile);
  const duck = py.runPython("import json; to_duckdb(user_sql, json.loads(schema_json), profile)");
  const t0 = performance.now();
  const res = await conn.query(duck);
  const fields = res.schema.fields;
  const rows = res.toArray().map(r => { const o = r.toJSON(); return fields.map(f => display(o[f.name], f.type)); });
  return { duck, names: fields.map(f => f.name), numeric: fields.map(f => [2, 3, 7].includes(f.type.typeId)), rows, ms: performance.now() - t0 };
}

// ---- grading ------------------------------------------------------------------------------------------
// A result is described by its row count and one hash per column (the column's values, sorted). A student result
// matches when the row count is equal and every required column of the model appears among the student's columns,
// in any order, under any name. Extra columns are fine. Numbers compare at 2 decimals.
const num2 = c => { const x = Number(c), r = Math.round(x * 100 * (1 + Math.sign(x) * 1e-12)) / 100; return (Object.is(r, -0) ? 0 : r).toFixed(2); };
const norm = c => c === null ? "NULL" : /^-?\d+(\.\d+)?$/.test(c) ? num2(c) : c.replace(/ 00:00:00$/, "");
async function sha(text) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(d)].slice(0, 8).map(b => b.toString(16).padStart(2, "0")).join("");
}
export async function signature(rows) {
  const n = rows.length, k = n ? rows[0].length : 0, cols = [];
  for (let j = 0; j < k; j++) cols.push(await sha(rows.map(r => norm(r[j])).sort().join("\u0001")));
  return { n, cols };
}
export function matches(sig, spec) {
  if (sig.n !== spec.n) return { ok: false, rowsOk: false, got: sig.n, want: spec.n, found: 0, need: spec.req.length };
  const used = new Set();
  let found = 0;
  for (const i of spec.req) {
    const j = sig.cols.findIndex((h, jj) => !used.has(jj) && h === spec.cols[i]);
    if (j >= 0) { used.add(j); found++; }
  }
  return { ok: found === spec.req.length, rowsOk: true, got: sig.n, want: spec.n, found, need: spec.req.length };
}
