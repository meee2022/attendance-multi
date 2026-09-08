import * as xlsx from "xlsx";

/**
 * Parsing for student roster sheets (سجل القيد and friends).
 *
 * Official exports rarely put the header on row 1 — there are usually logo,
 * ministry name and date rows above it — and the column captions vary between
 * exports. So instead of trusting row 1 and matching captions exactly, we scan
 * the top of the sheet for the row that best looks like a header, and match
 * captions by normalized keyword.
 */

export type ParsedRow = { fullName: string; className: string; phones: string };

export type ColumnKind = "name" | "grade" | "section" | "class" | "phone";

export type SheetShape = {
    /** Raw rows, as arrays of cell strings. */
    rows: string[][];
    /** Index into `rows` of the detected header row, or -1 when there is none. */
    headerIndex: number;
    /** True when the sheet carries no caption row and data starts at row 0. */
    headerless: boolean;
    /** First row of actual data. */
    dataStart: number;
    /** Column captions — synthesised for a header-less sheet. */
    headers: string[];
    /** A sample value per column, to help a human confirm the mapping. */
    samples: string[];
    /** Detected column index per kind; -1 when absent. */
    mapping: Record<ColumnKind, number>;
};

/** Arabic-insensitive normalization: unify alef/ya/ta-marbuta, drop diacritics and padding. */
export function normalizeArabic(value: unknown): string {
    return String(value ?? "")
        .replace(/[ً-ٰٟـ]/g, "") // diacritics + tatweel
        .replace(/[​-‏‪-‮ ]/g, " ") // zero-width / bidi / nbsp
        .replace(/[أإآٱ]/g, "ا")
        .replace(/ى/g, "ي")
        .replace(/ة/g, "ه")
        .replace(/[^\p{L}\p{N}]+/gu, " ")
        .trim()
        .toLowerCase();
}

/**
 * Keyword sets per column kind. Order matters: the first kind whose keywords
 * match wins, so more specific kinds are listed before broader ones.
 */
const KEYWORDS: { kind: ColumnKind; any: string[]; not?: string[] }[] = [
    { kind: "phone", any: ["هاتف", "جوال", "موبايل", "تليفون", "تلفون", "phone", "mobile", "رقم ولي"] },
    { kind: "section", any: ["شعبه", "الشعبه", "section"], not: ["صف"] },
    { kind: "class", any: ["الشعبه الصفيه", "شعبه صفيه", "صف شعبه", "class"] },
    { kind: "grade", any: ["صف", "المرحله", "grade", "level"] },
    { kind: "name", any: ["اسم", "الطالب", "name", "student"], not: ["معلم", "مدرس", "ولي", "الاب", "الام", "مستخدم"] },
];

function classifyHeader(caption: string): ColumnKind | null {
    const n = normalizeArabic(caption);
    if (!n) return null;
    for (const { kind, any, not } of KEYWORDS) {
        if (not?.some(k => n.includes(normalizeArabic(k)))) continue;
        if (any.some(k => n.includes(normalizeArabic(k)))) return kind;
    }
    return null;
}

function buildMapping(headers: string[]): Record<ColumnKind, number> {
    const mapping: Record<ColumnKind, number> = { name: -1, grade: -1, section: -1, class: -1, phone: -1 };
    headers.forEach((caption, index) => {
        const kind = classifyHeader(caption);
        // Keep the first match for each kind — later duplicate captions are noise.
        if (kind && mapping[kind] === -1) mapping[kind] = index;
    });
    return mapping;
}

/** A header row must at least identify the student name plus some class info. */
function mappingScore(mapping: Record<ColumnKind, number>): number {
    const hasName = mapping.name !== -1;
    const hasClass = mapping.class !== -1 || mapping.section !== -1 || mapping.grade !== -1;
    if (!hasName || !hasClass) return 0;
    return Object.values(mapping).filter(i => i !== -1).length;
}

const HEADER_SEARCH_DEPTH = 30;
const CONTENT_SAMPLE = 60;

/** "02/1", "10-3" — a grade/section pair. */
function looksLikeClass(value: string): boolean {
    return /^\s*\d{1,2}\s*[\/\-]\s*\d{1,3}\s*$/.test(value);
}

/** One or more phone numbers, possibly comma-separated. */
function looksLikePhone(value: string): boolean {
    const digits = value.replace(/\D/g, "");
    return digits.length >= 7 && /^[\d\s,،+\-()]+$/.test(value);
}

/** A person's name: letters, no digits. */
function looksLikeName(value: string): boolean {
    return /\p{L}{2,}/u.test(value) && !/\d/.test(value);
}

/** Share of non-empty sampled values in `column` satisfying `test`. */
function columnScore(rows: string[][], column: number, test: (v: string) => boolean): number {
    let seen = 0, hits = 0;
    for (const row of rows.slice(0, CONTENT_SAMPLE)) {
        const value = (row[column] ?? "").trim();
        if (!value) continue;
        seen++;
        if (test(value)) hits++;
    }
    return seen === 0 ? 0 : hits / seen;
}

/**
 * Infer the columns of a sheet that has no captions at all — an export that is
 * pure data, like the ministry's سجل القيد. Decided by what the values look
 * like, most distinctive kind first so the loose "name" test cannot steal a
 * column from the class or phone.
 */
function mappingFromContent(rows: string[][]): Record<ColumnKind, number> {
    const mapping: Record<ColumnKind, number> = { name: -1, grade: -1, section: -1, class: -1, phone: -1 };
    const width = rows.reduce((max, r) => Math.max(max, r.length), 0);
    const taken = new Set<number>();

    const claim = (kind: ColumnKind, test: (v: string) => boolean, threshold: number) => {
        let best = -1, bestScore = threshold;
        for (let c = 0; c < width; c++) {
            if (taken.has(c)) continue;
            const score = columnScore(rows, c, test);
            if (score > bestScore) { bestScore = score; best = c; }
        }
        if (best !== -1) { mapping[kind] = best; taken.add(best); }
    };

    claim("class", looksLikeClass, 0.6);
    claim("phone", looksLikePhone, 0.6);
    claim("name", looksLikeName, 0.5);
    return mapping;
}

/** Read a workbook and locate the header row + column mapping. */
export function inspectSheet(input: ArrayBuffer | string): SheetShape {
    const wb = xlsx.read(input, { type: typeof input === "string" ? "binary" : "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const raw = xlsx.utils.sheet_to_json<any[]>(ws, { header: 1, blankrows: false, defval: "" });
    const rows: string[][] = raw.map(r => (r ?? []).map(c => String(c ?? "").trim()));

    let headerIndex = -1;
    let best = 0;
    const depth = Math.min(rows.length, HEADER_SEARCH_DEPTH);
    for (let i = 0; i < depth; i++) {
        const score = mappingScore(buildMapping(rows[i]));
        if (score > best) { best = score; headerIndex = i; }
    }

    const width = rows.reduce((max, r) => Math.max(max, r.length), 0);
    const headerless = headerIndex === -1;
    const dataStart = headerless ? 0 : headerIndex + 1;

    const headers = headerless
        ? Array.from({ length: width }, (_, i) => `عمود ${i + 1}`)
        : rows[headerIndex];

    // First non-empty value under each column, shown next to the mapping menus.
    const samples = Array.from({ length: width }, (_, c) => {
        for (let r = dataStart; r < Math.min(rows.length, dataStart + CONTENT_SAMPLE); r++) {
            const value = (rows[r]?.[c] ?? "").trim();
            if (value) return value;
        }
        return "";
    });

    const mapping = headerless
        ? mappingFromContent(rows)
        : buildMapping(rows[headerIndex]);

    return { rows, headerIndex, headerless, dataStart, headers, samples, mapping };
}

const ARABIC_GRADES: Record<string, number> = {
    "الاول": 1, "الثاني": 2, "الثالث": 3, "الرابع": 4, "الخامس": 5, "السادس": 6,
    "السابع": 7, "الثامن": 8, "التاسع": 9, "العاشر": 10,
    "الحادي عشر": 11, "الثاني عشر": 12,
};

/** "الحادي عشر" -> "11"; "10" -> "10"; anything else passes through trimmed. */
function normalizeGrade(value: string): string {
    const digits = value.match(/\d+/);
    if (digits) return digits[0];
    const n = normalizeArabic(value);
    for (const [word, num] of Object.entries(ARABIC_GRADES)) {
        if (n.includes(normalizeArabic(word))) return String(num);
    }
    return value.trim();
}

/** A row that could not be imported, with the reason, for showing the user. */
export type SkippedRow = { rowNumber: number; fullName: string; reason: string };

export type ExtractResult = { rows: ParsedRow[]; skipped: SkippedRow[] };

/** A usable class name must carry at least one digit — "-" and "" do not. */
function isUsableClass(value: string): boolean {
    return /\d/.test(value);
}

/**
 * Turn the sheet into importable rows using `mapping`.
 * Grade and section may live in one column ("10-3") or two ("10" + "3").
 *
 * Rows missing a name or a class are reported rather than imported: a student
 * whose class cell is blank would otherwise create a junk class in the system.
 */
export function extractRows(shape: SheetShape, mapping = shape.mapping): ExtractResult {
    if (mapping.name === -1) return { rows: [], skipped: [] };
    const rows: ParsedRow[] = [];
    const skipped: SkippedRow[] = [];

    const cell = (row: string[], index: number) => (index === -1 ? "" : (row[index] ?? "").trim());

    for (let i = shape.dataStart; i < shape.rows.length; i++) {
        const row = shape.rows[i];
        const fullName = cell(row, mapping.name);
        // A wholly empty row is padding, not a problem worth reporting.
        if (!fullName) {
            if (row.some(c => c.trim())) {
                skipped.push({ rowNumber: i + 1, fullName: "—", reason: "بدون اسم" });
            }
            continue;
        }

        let className = cell(row, mapping.class).replace(/[\/\\s]+/g, "-");
        if (!className) {
            const grade = normalizeGrade(cell(row, mapping.grade));
            const section = cell(row, mapping.section).replace(/[\/\\s]+/g, "-");
            className = grade && section ? `${grade}-${section}` : grade || section;
        }
        if (!isUsableClass(className)) {
            skipped.push({ rowNumber: i + 1, fullName, reason: "الشعبة ناقصة أو غير مفهومة" });
            continue;
        }

        rows.push({ fullName, className, phones: cell(row, mapping.phone) });
    }
    return { rows, skipped };
}

export const COLUMN_LABELS: Record<ColumnKind, string> = {
    name: "اسم الطالب",
    class: "الشعبة الصفية (عمود واحد)",
    grade: "الصف",
    section: "الشعبة",
    phone: "رقم الهاتف",
};
