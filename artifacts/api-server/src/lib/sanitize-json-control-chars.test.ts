/**
 * Unit tests for sanitizeJsonControlChars.
 *
 * Run with:  npx tsx artifacts/api-server/src/lib/sanitize-json-control-chars.test.ts
 *
 * These cover the exact failure class observed in production: the NVIDIA
 * code-generation model writing raw LF/CR/TAB bytes inside JSON string values,
 * causing JSON.parse to throw "Bad control character in string literal".
 */

// ─── Inline the function under test ──────────────────────────────────────────
// We replicate it here so the test file is self-contained and runnable without
// building the full server bundle.  Keep this in sync with the implementation
// in website-v2-code-generator.ts.
function sanitizeJsonControlChars(raw: string): string {
  let result = "";
  let inString = false;
  let escaped = false;

  for (let i = 0; i < raw.length; i++) {
    const char = raw[i];
    const code = raw.charCodeAt(i);

    if (escaped) {
      result += char;
      escaped = false;
      continue;
    }

    if (inString && char === "\\") {
      result += char;
      escaped = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      result += char;
      continue;
    }

    if (inString && code < 0x20) {
      if      (code === 0x0a) result += "\\n";
      else if (code === 0x0d) result += "\\r";
      else if (code === 0x09) result += "\\t";
      else result += `\\u${code.toString(16).padStart(4, "0")}`;
      continue;
    }

    result += char;
  }

  return result;
}

// ─── Minimal test harness ─────────────────────────────────────────────────────
let passed = 0;
let failed = 0;

function test(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${String(err)}`);
    failed++;
  }
}

function expect(actual: unknown) {
  return {
    toBe(expected: unknown) {
      if (actual !== expected) {
        throw new Error(`Expected:\n  ${JSON.stringify(expected)}\nReceived:\n  ${JSON.stringify(actual)}`);
      }
    },
    toEqual(expected: unknown) {
      const a = JSON.stringify(actual);
      const b = JSON.stringify(expected);
      if (a !== b) throw new Error(`Expected:\n  ${b}\nReceived:\n  ${a}`);
    },
    not: {
      toThrow() { /* used via wrapper */ }
    }
  };
}

function expectParseable(json: string): void {
  const sanitized = sanitizeJsonControlChars(json);
  JSON.parse(sanitized); // throws if still broken
}

// ─── Tests ────────────────────────────────────────────────────────────────────

console.log("\nsanitizeJsonControlChars\n");

// ── 1. Primary regression: raw LF inside a string value ──────────────────────
test("raw LF inside a string value is replaced with \\n", () => {
  const raw = '{"code":"line1\nline2"}';
  const sanitized = sanitizeJsonControlChars(raw);
  expect(sanitized).toBe('{"code":"line1\\nline2"}');
  const obj = JSON.parse(sanitized) as Record<string, string>;
  expect(obj.code).toBe("line1\nline2");   // value round-trips correctly
});

// ── 2. Raw CR inside a string value ──────────────────────────────────────────
test("raw CR inside a string value is replaced with \\r", () => {
  const raw = '{"v":"foo\rbar"}';
  const sanitized = sanitizeJsonControlChars(raw);
  expect(sanitized).toBe('{"v":"foo\\rbar"}');
});

// ── 3. Raw TAB inside a string value ─────────────────────────────────────────
test("raw TAB inside a string value is replaced with \\t", () => {
  const raw = '{"v":"col1\tcol2"}';
  const sanitized = sanitizeJsonControlChars(raw);
  expect(sanitized).toBe('{"v":"col1\\tcol2"}');
});

// ── 4. Already-escaped sequences are preserved verbatim ──────────────────────
test("existing \\n \\r \\t escape sequences are preserved unchanged", () => {
  const raw = '{"v":"line1\\nline2\\r\\ttabbed"}';
  const sanitized = sanitizeJsonControlChars(raw);
  expect(sanitized).toBe('{"v":"line1\\nline2\\r\\ttabbed"}');
  JSON.parse(sanitized); // must still parse
});

// ── 5. Control characters outside strings are untouched ──────────────────────
test("LF outside a string (structural whitespace) is not modified", () => {
  // JSON allows whitespace between tokens at the top level
  const raw = '{\n"a":"b"\n}';
  const sanitized = sanitizeJsonControlChars(raw);
  expect(sanitized).toBe('{\n"a":"b"\n}');
  JSON.parse(sanitized);
});

// ── 6. Other control chars (< 0x20, not LF/CR/TAB) use \\uXXXX ──────────────
test("other control chars (e.g. 0x01) are escaped as \\u0001", () => {
  const raw = `{"v":"${String.fromCharCode(1)}"}`;
  const sanitized = sanitizeJsonControlChars(raw);
  expect(sanitized).toBe('{"v":"\\u0001"}');
  JSON.parse(sanitized);
});

// ── 7. Clean JSON with no control characters passes through unchanged ─────────
test("clean JSON with no control characters is returned unchanged", () => {
  const raw = '{"files":[{"path":"index.tsx","content":"export default function App() { return <div>Hello</div>; }"}]}';
  const sanitized = sanitizeJsonControlChars(raw);
  expect(sanitized).toBe(raw);
});

// ── 8. Multiline code block — the real-world failure case ────────────────────
test("multiline JSX content (real-world failure class) becomes parseable", () => {
  // Simulate what the model actually returns: a full file content with many
  // raw newlines embedded inside the "content" string value.
  const content = [
    "import React from 'react';",
    "",
    "export default function HeroSection() {",
    "  return (",
    "    <div className=\"hero\">",
    "      <h1>Hello World</h1>",
    "    </div>",
    "  );",
    "}",
  ].join("\n");                             // raw LF characters

  const raw = JSON.stringify({ files: [{ path: "Hero.tsx", content }] })
    .replace(/\\n/g, "\n");               // un-escape to simulate model output

  // Before sanitization this must fail
  let threw = false;
  try { JSON.parse(raw); } catch { threw = true; }
  if (!threw) throw new Error("Expected raw input to fail JSON.parse (precondition)");

  // After sanitization it must succeed
  const sanitized = sanitizeJsonControlChars(raw);
  const obj = JSON.parse(sanitized) as { files: Array<{ path: string; content: string }> };
  expect(obj.files[0].path).toBe("Hero.tsx");
  expect(obj.files[0].content).toBe(content);  // value round-trips exactly
});

// ── 9. Mixed: raw LF inside string, LF outside string, escaped \\n inside ────
test("mixed raw/escaped newlines in same payload are each handled correctly", () => {
  // Structural LF after colon (fine), raw LF in value (bad), escaped \n in another key (fine)
  const raw = '{\n"a":"line1\nline2",\n"b":"escaped\\nok"\n}';
  const sanitized = sanitizeJsonControlChars(raw);
  const obj = JSON.parse(sanitized) as Record<string, string>;
  expect(obj.a).toBe("line1\nline2");
  expect(obj.b).toBe("escaped\nok");
});

// ── 10. Empty string input ────────────────────────────────────────────────────
test("empty string returns empty string", () => {
  expect(sanitizeJsonControlChars("")).toBe("");
});

// ─── Summary ──────────────────────────────────────────────────────────────────
console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
