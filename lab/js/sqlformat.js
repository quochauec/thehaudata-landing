// Light T-SQL formatter for the "Format SQL" button. It is deliberately conservative:
//  - strings, comments and [bracketed names] are never touched;
//  - the learner's own spacing and line breaks stay, only a missing break before a main clause is added;
//  - keywords are upper-cased, names and aliases keep their case.
// Pure functions, no DOM, so it can be unit tested with node.

const UPPER = new Set(("SELECT FROM WHERE GROUP ORDER BY HAVING JOIN INNER LEFT RIGHT FULL OUTER CROSS ON AS AND OR NOT IN IS NULL LIKE BETWEEN EXISTS " +
  "CASE WHEN THEN ELSE END UNION ALL DISTINCT TOP WITH OVER PARTITION DESC ASC").split(" "));
const TOKEN = /--[^\n]*|\/\*[\s\S]*?\*\/|'(?:[^']|'')*'|\[[^\]]*\]|"[^"]*"|\s+|[A-Za-z_#@][A-Za-z0-9_#@$]*|\d+(?:\.\d+)?|[\s\S]/g;
const isWord = t => /^[A-Za-z_]/.test(t);
const hasNl = t => t.indexOf("\n") !== -1;

export function formatSql(src) {
  const toks = src.match(TOKEN) || [];
  const sig = [];   // indexes of significant tokens (not whitespace, not comments)
  toks.forEach((t, i) => { if (!/^\s+$/.test(t) && !t.startsWith("--") && !t.startsWith("/*")) sig.push(i); });
  const up = i => toks[i].toUpperCase();
  const nextSig = i => { const k = sig.indexOf(i); return k >= 0 && k + 1 < sig.length ? sig[k + 1] : -1; };
  const prevSig = i => { const k = sig.indexOf(i); return k > 0 ? sig[k - 1] : -1; };

  const out = toks.slice();
  const stack = [];   // one entry per open "(": true when it opens an OVER( ... ) window
  let first = true;
  for (const i of sig) {
    const t = toks[i];
    if (t === "(") { const p = prevSig(i); stack.push(p >= 0 && up(p) === "OVER"); continue; }
    if (t === ")") { stack.pop(); continue; }
    if (!isWord(t)) continue;
    const u = t.toUpperCase();
    if (UPPER.has(u)) out[i] = u;

    const inOver = stack.length && stack[stack.length - 1];
    const p = prevSig(i), pu = p >= 0 ? up(p) : "", n = nextSig(i), nu = n >= 0 ? up(n) : "";
    let brk = false;
    if (!inOver) {
      if (u === "FROM" || u === "WHERE" || u === "HAVING") brk = true;
      else if ((u === "GROUP" || u === "ORDER") && nu === "BY") brk = true;
      else if (u === "UNION") brk = true;
      else if (u === "JOIN") brk = !/^(INNER|LEFT|RIGHT|FULL|CROSS|OUTER)$/.test(pu);
      else if (/^(INNER|LEFT|RIGHT|FULL|CROSS)$/.test(u)) brk = nu === "JOIN" || nu === "OUTER";
      else if (u === "SELECT") brk = !first && pu !== "(" && pu !== "AS";
    }
    if (u === "SELECT" || u === "WITH") first = false;
    if (brk && i > 0 && p >= 0) {
      // the whitespace token right before this keyword
      const w = toks[i - 1];
      if (/^\s+$/.test(w)) { if (!hasNl(w)) out[i - 1] = "\n" + "    ".repeat(stack.length); }
      else out[i] = "\n" + "    ".repeat(stack.length) + out[i];
    }
  }
  return out.join("").replace(/[ \t]+$/gm, "").replace(/^\n+/, "");
}
