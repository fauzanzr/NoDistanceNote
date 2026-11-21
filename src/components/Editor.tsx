"use client";
import { useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Bold, Code, Eye, Heading2, ImagePlus, Italic, List, ListChecks, ListOrdered, Pencil,
  Table as TableIcon, Plus, Minus, Trash2,
} from "lucide-react";

type Props = {
  value: string;
  onChange: (v: string) => void;
  onUpload: (file: File) => Promise<string>;
  onError: (msg: string) => void;
  header?: React.ReactNode;
};

// ---------- Markdown table helpers ----------
const isRow = (l: string) => l.trim().startsWith("|");
const cells = (l: string) => l.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
const fmt = (c: string[]) => "| " + c.join(" | ") + " |";

function tableInfo(text: string, pos: number) {
  const lines = text.split("\n");
  const offs: number[] = [];
  let off = 0, idx = -1;
  for (let i = 0; i < lines.length; i++) {
    offs.push(off);
    if (idx < 0 && pos <= off + lines[i].length) idx = i;
    off += lines[i].length + 1;
  }
  if (idx < 0) idx = lines.length - 1;
  if (!isRow(lines[idx])) return null;
  let s = idx, e = idx;
  while (s > 0 && isRow(lines[s - 1])) s--;
  while (e < lines.length - 1 && isRow(lines[e + 1])) e++;
  if (e - s < 1) return null;
  const before = lines[idx].slice(0, Math.max(0, pos - offs[idx]));
  const col = Math.max(0, (before.match(/\|/g)?.length ?? 1) - 1);
  return { lines, offs, s, e, idx, col };
}

export default function Editor({ value, onChange, onUpload, onError, header }: Props) {
  const ta = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState(false);
  const [inTable, setInTable] = useState(false);

  const probe = () => {
    const el = ta.current;
    setInTable(!!el && !!tableInfo(el.value, el.selectionStart));
  };

  function edit(fn: (v: string, s: number, e: number) => { text: string; start: number; end: number }) {
    const el = ta.current;
    if (!el) return;
    const r = fn(el.value, el.selectionStart, el.selectionEnd);
    onChange(r.text);
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(r.start, r.end); probe(); });
  }

  const wrap = (a: string, b = a, ph = "text") => () =>
    edit((v, s, e) => {
      const sel = v.slice(s, e) || ph;
      return { text: v.slice(0, s) + a + sel + b + v.slice(e), start: s + a.length, end: s + a.length + sel.length };
    });

  const linePrefix = (p: string | ((i: number) => string)) => () =>
    edit((v, s, e) => {
      const ls = v.lastIndexOf("\n", s - 1) + 1;
      const le = v.indexOf("\n", e) === -1 ? v.length : v.indexOf("\n", e);
      const out = v.slice(ls, le).split("\n").map((l, i) => (typeof p === "string" ? p : p(i)) + l).join("\n");
      return { text: v.slice(0, ls) + out + v.slice(le), start: ls, end: ls + out.length };
    });

  const codeBlock = () =>
    edit((v, s, e) => {
      const sel = v.slice(s, e) || "code";
      const pre = "```\n";
      return { text: v.slice(0, s) + pre + sel + "\n```" + v.slice(e), start: s + pre.length, end: s + pre.length + sel.length };
    });

  const insertTable = () =>
    edit((v, s, e) => {
      const lead = s > 0 && v[s - 1] !== "\n" ? "\n\n" : "";
      const md = `${lead}| Column 1 | Column 2 | Column 3 |\n| --- | --- | --- |\n|  |  |  |\n|  |  |  |\n`;
      return { text: v.slice(0, s) + md + v.slice(e), start: s + lead.length + 2, end: s + lead.length + 10 };
    });

  function tableOp(op: "addRow" | "delRow" | "addCol" | "delCol" | "delTable") {
    const el = ta.current;
    if (!el) return;
    const info = tableInfo(el.value, el.selectionStart);
    if (!info) return;
    const { lines, s, e, idx } = info;
    let rows = lines.slice(s, e + 1).map(cells);
    const n = rows[0].length;
    rows = rows.map((r) => [...r, ...Array(Math.max(0, n - r.length)).fill("")].slice(0, n));
    const r = idx - s;
    const c = Math.min(info.col, n - 1);
    let focusRow = r;

    if (op === "delTable") {
      const out = [...lines.slice(0, s), ...lines.slice(e + 1)].join("\n");
      onChange(out);
      return;
    }
    if (op === "addRow") {
      focusRow = Math.max(r, 1) + 1;
      rows.splice(focusRow, 0, Array(n).fill(""));
    } else if (op === "delRow") {
      if (r < 2) return onError("Place the cursor in a body row to delete it");
      rows.splice(r, 1);
      focusRow = Math.min(r, rows.length - 1);
    } else if (op === "addCol") {
      rows.forEach((row, i) => row.splice(c + 1, 0, i === 1 ? "---" : ""));
    } else {
      if (n <= 1) return onError("A table needs at least one column");
      rows.forEach((row) => row.splice(c, 1));
    }
    const newLines = [...lines.slice(0, s), ...rows.map(fmt), ...lines.slice(e + 1)];
    let pos = 0;
    for (let i = 0; i < s + focusRow; i++) pos += newLines[i].length + 1;
    onChange(newLines.join("\n"));
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(pos + 2, pos + 2); probe(); });
  }

  async function insertImages(files: File[]) {
    for (const f of files) {
      try {
        const url = await onUpload(f);
        edit((v, s, e) => {
          const md = `\n![${f.name || "image"}](${url})\n`;
          return { text: v.slice(0, s) + md + v.slice(e), start: s + md.length, end: s + md.length };
        });
      } catch (err) {
        onError(err instanceof Error ? err.message : "Upload failed");
      }
    }
  }

  const imgs = (list: DataTransferItemList | FileList | null) =>
    Array.from((list ?? []) as ArrayLike<DataTransferItem | File>)
      .map((i) => (i instanceof File ? i : i.kind === "file" ? i.getAsFile() : null))
      .filter((f): f is File => !!f && f.type.startsWith("image/"));

  const tools = [
    { i: Bold, t: "Bold (Ctrl+B)", f: wrap("**") },
    { i: Italic, t: "Italic (Ctrl+I)", f: wrap("*") },
    { i: Heading2, t: "Heading", f: linePrefix("## ") },
    { i: List, t: "Bullet list", f: linePrefix("- ") },
    { i: ListOrdered, t: "Numbered list", f: linePrefix((i) => `${i + 1}. `) },
    { i: ListChecks, t: "Checklist", f: linePrefix("- [ ] ") },
    { i: Code, t: "Code block", f: codeBlock },
    { i: TableIcon, t: "Insert table", f: insertTable },
    { i: ImagePlus, t: "Upload image", f: () => fileRef.current?.click() },
  ];

  const tblBtns = [
    { l: "Row", I: Plus, op: "addRow" as const, t: "Add row below" },
    { l: "Row", I: Minus, op: "delRow" as const, t: "Delete current row" },
    { l: "Column", I: Plus, op: "addCol" as const, t: "Add column to the right" },
    { l: "Column", I: Minus, op: "delCol" as const, t: "Delete current column" },
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mx-auto w-full max-w-3xl px-6 pt-10 md:px-0 md:pt-14">{header}</div>
      <div className="mx-auto flex w-full max-w-3xl items-center gap-0.5 border-b border-zinc-200 px-6 py-1.5 dark:border-zinc-800 md:px-0">
        {tools.map(({ i: Icon, t, f }) => (
          <button key={t} title={t} className="btn" onClick={f} disabled={preview}>
            <Icon size={16} />
          </button>
        ))}
        <input
          ref={fileRef} type="file" accept="image/*" multiple hidden
          onChange={(e) => { insertImages(imgs(e.target.files)); e.target.value = ""; }}
        />
        <div className="ml-auto flex rounded-md bg-zinc-100 p-0.5 text-xs dark:bg-zinc-800">
          {[{ p: false, l: "Write", I: Pencil }, { p: true, l: "Preview", I: Eye }].map(({ p, l, I }) => (
            <button
              key={l}
              onClick={() => setPreview(p)}
              className={`flex items-center gap-1 rounded px-2 py-1 transition ${preview === p ? "bg-white shadow-sm dark:bg-zinc-700" : "text-zinc-500"}`}
            >
              <I size={12} /> <span className="hidden sm:inline">{l}</span>
            </button>
          ))}
        </div>
      </div>

      {inTable && !preview && (
        <div className="anim-in mx-auto flex w-full max-w-3xl flex-wrap items-center gap-1 px-6 py-1.5 text-xs md:px-0">
          <span className="mr-1 text-zinc-400">Table</span>
          {tblBtns.map(({ l, I, op, t }) => (
            <button
              key={op}
              title={t}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => tableOp(op)}
              className="flex items-center gap-1 rounded-md border border-zinc-200 px-2 py-1 text-zinc-600 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              <I size={12} /> {l}
            </button>
          ))}
          <button
            title="Delete table"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => tableOp("delTable")}
            className="flex items-center gap-1 rounded-md border border-zinc-200 px-2 py-1 text-red-500 transition hover:bg-red-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            <Trash2 size={12} /> Delete table
          </button>
        </div>
      )}

      {preview ? (
        <article className="prose prose-zinc mx-auto min-h-0 w-full max-w-3xl flex-1 overflow-y-auto px-6 py-6 dark:prose-invert md:px-0">
          {value.trim() ? <ReactMarkdown remarkPlugins={[remarkGfm]}>{value}</ReactMarkdown> : <p className="text-zinc-400">Nothing here yet.</p>}
        </article>
      ) : (
        <textarea
          ref={ta}
          value={value}
          onChange={(e) => { onChange(e.target.value); probe(); }}
          onSelect={probe}
          placeholder="Start writing… (Markdown supported, paste images with Ctrl+V)"
          spellCheck={false}
          className="mx-auto min-h-0 w-full max-w-3xl flex-1 resize-none bg-transparent px-6 py-6 text-[16px] leading-7 outline-none placeholder:text-zinc-400 md:px-0"
          onPaste={(e) => {
            const f = imgs(e.clipboardData.items);
            if (f.length) { e.preventDefault(); insertImages(f); }
          }}
          onDrop={(e) => {
            const f = imgs(e.dataTransfer.files);
            if (f.length) { e.preventDefault(); insertImages(f); }
          }}
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === "b") { e.preventDefault(); wrap("**")(); }
            if ((e.ctrlKey || e.metaKey) && e.key === "i") { e.preventDefault(); wrap("*")(); }
            if (e.key === "Tab") { e.preventDefault(); edit((v, s, en) => ({ text: v.slice(0, s) + "  " + v.slice(en), start: s + 2, end: s + 2 })); }
          }}
        />
      )}
    </div>
  );
}
