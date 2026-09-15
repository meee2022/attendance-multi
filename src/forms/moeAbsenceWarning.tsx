import type { ReactNode } from "react";
import type { FormProps } from "./formKit";
import { FORM_HEADER } from "./formConfig";

/**
 * «إنذار — غياب بدون عذر» with the guardian's «إقرار وتعهد», copied from the
 * ministry's official forms (3, 5, 7, 8, 10, 11, 13 and 14 days). Wording,
 * table numbering and layout follow the printed originals; only the blanks
 * are filled from the student's record, and every filled blank stays editable.
 */

/** The ministerial decision's four thresholds; each form quotes the one it is heading towards. */
const STAGES = [
    { upTo: 5, exam: "منتصف الفصل الدراسي الاول", warnLimit: "خمسة أيام تمدرس", pledgeLimit: "خمس أيام تمدرس", warnVerb: "دخول", pledgeVerb: "تقديم" },
    { upTo: 8, exam: "نهاية الفصل الدراسي الاول", warnLimit: "ثمان أيام تمدرس", pledgeLimit: "ثمان أيام تمدرس", warnVerb: "دخول", pledgeVerb: "تقديم" },
    { upTo: 11, exam: "منتصف الفصل الدراسي الثاني", warnLimit: "احدى عشر يومًا تمدرس", pledgeLimit: "إحدى عشر يومًا تمدرس", warnVerb: "تقديم", pledgeVerb: "دخول" },
    { upTo: Infinity, exam: "نهاية الفصل الدراسي الثاني", warnLimit: "خمس عشر يومًا تمدرس", pledgeLimit: "خمس عشر يومًا تمدرس", warnVerb: "تقديم", pledgeVerb: "تقديم" },
];

/** Quirks of individual originals, kept so each print matches its paper form. */
const STUDENT_IN_PARENS = new Set([5, 11, 13]);
const DATE_BESIDE_TITLE = new Set([8, 10, 11, 13]);

/** The originals grow the table by appending rows, so numbering runs down the right, then the left. */
const RIGHT_ROWS = [1, 2, 3, 7, 9, 11, 13, 15, 17, 19];
const LEFT_ROWS = [4, 5, 6, 8, 10, 12, 14, 16, 18, 20];

const WEEKDAYS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const GRADE_NAMES = ["", "الأول", "الثاني", "الثالث", "الرابع", "الخامس", "السادس", "السابع", "الثامن", "التاسع", "العاشر", "الحادي عشر", "الثاني عشر"];

function weekday(date?: string) {
    if (!date) return "";
    const d = new Date(`${date}T12:00:00`);
    return Number.isNaN(d.getTime()) ? "" : WEEKDAYS[d.getDay()];
}

/** "2026-09-14" → "14/09/2026". */
function dmy(date?: string) {
    if (!date) return "";
    const [y, m, d] = date.split("-");
    return d && m && y ? `${d}/${m}/${y}` : date;
}

/** A dotted blank that can be typed into on screen; prefilled blanks can be corrected before printing. */
function Blank({ children, width }: { children?: ReactNode; width?: string }) {
    return (
        <span className="moe-blank" style={width ? { minWidth: width } : undefined}
            contentEditable suppressContentEditableWarning spellCheck={false}>
            {children}
        </span>
    );
}

type Side = "right" | "left";

function DatesHead({ side = "right" }: { side?: Side }) {
    return <><th className={`is-num ${side === "left" ? "is-left" : ""}`}>م</th><th>اليوم</th><th>التاريخ</th></>;
}

/** One half of a row; a half with no day left is shaded grey, as on the originals. */
function DateCells({ n, date, side = "right" }: { n?: number; date?: string; side?: Side }) {
    if (n === undefined) return <td colSpan={3} className="is-empty" />;
    return (
        <>
            <td className={`is-num ${side === "left" ? "is-left" : ""}`}>{n}</td>
            <td><Blank>{weekday(date)}</Blank></td>
            <td><Blank><bdi dir="ltr">{dmy(date)}</bdi></Blank></td>
        </>
    );
}

function AbsenceDatesTable({ count, dates }: { count: number; dates: string[] }) {
    if (count <= 3) {
        return (
            <table className="moe-table moe-dates is-single">
                <thead><tr><DatesHead /></tr></thead>
                <tbody>
                    {Array.from({ length: count }, (_, i) => (
                        <tr key={i}><DateCells n={i + 1} date={dates[i]} /></tr>
                    ))}
                </tbody>
            </table>
        );
    }

    const right = RIGHT_ROWS.filter(n => n <= count);
    const left = LEFT_ROWS.filter(n => n <= count);
    const rowCount = Math.max(right.length, left.length);
    return (
        <table className={`moe-table moe-dates ${rowCount > 5 ? "is-dense" : ""}`}>
            <colgroup>
                <col className="c-num" /><col className="c-day" /><col className="c-date" />
                <col className="c-num" /><col className="c-day" /><col className="c-date" />
            </colgroup>
            <thead><tr><DatesHead /><DatesHead side="left" /></tr></thead>
            <tbody>
                {Array.from({ length: rowCount }, (_, i) => (
                    <tr key={i}>
                        <DateCells n={right[i]} date={dates[right[i] - 1]} />
                        <DateCells n={left[i]} date={dates[left[i] - 1]} side="left" />
                    </tr>
                ))}
            </tbody>
        </table>
    );
}

export function MoeAbsenceWarning({ data }: FormProps) {
    const n = data.count;
    const stage = STAGES.find(s => n <= s.upTo)!;
    const unit = n <= 10 ? "أيام" : "يوم";
    const unitInText = n <= 10 ? "أيام" : "يومًا";
    const [, section = ""] = data.className.split("-");
    const grade = data.grade ? GRADE_NAMES[data.grade] ?? String(data.grade) : "";
    const dates = [...data.absenceDates].sort().slice(0, n);
    const [y, m, d] = data.issueDate.split("-");
    const student = STUDENT_IN_PARENS.has(n) ? "(الطالب)" : "الطالب";

    const guardianLine = (lead: string) => (
        <p className="moe-line">
            {lead} <Blank width="15em">{data.studentName}</Blank>{" "}
            الصف: <Blank width="5em">{grade}</Blank>{" "}
            الشعبة: <Blank width="5em">{section}</Blank>
        </p>
    );

    const dateLine = (
        <div className="moe-date">
            التاريخ <Blank width="2.2em">{d}</Blank> / <Blank width="2.2em">{m}</Blank> / <Blank width="3.4em">{y}</Blank> م
        </div>
    );

    return (
        <section className="form-sheet moe-sheet">
            {FORM_HEADER.moeHeaderUrl && <img className="moe-header" src={FORM_HEADER.moeHeaderUrl} alt="وزارة التربية والتعليم والتعليم العالي — إدارة شؤون المدارس والطلبة" />}

            {n === 3 && <div className="moe-series">استمارات سياسة تعزيز انضباط حضور الطلبة:</div>}

            <div className={`moe-title-row ${DATE_BESIDE_TITLE.has(n) ? "has-date" : ""}`}>
                <div className="moe-title">
                    <div>إنذار</div>
                    <div>غياب بدون عذر لعدد ({n} {unit})</div>
                </div>
                {DATE_BESIDE_TITLE.has(n) && dateLine}
            </div>
            {!DATE_BESIDE_TITLE.has(n) && dateLine}

            {guardianLine("الفاضل ولي امر الطالب:")}

            <p className="moe-line">
                نفيدكم علما بأن عدد أيام غياب ابنكم /ابنتكم عن المدرسة بدون عذر قد وصل مدة ({n} {unitInText}) بتاريخ:
            </p>

            <AbsenceDatesTable count={n} dates={dates} />

            <p className="moe-para">
                وكما تعلمون بأن تكرار الغياب يؤثر سلبا على مستوى التحصيل الأكاديمي للطالب، وفي حال تجاوز المدة المسموح بها
                بالغياب سيتم تطبيق القرار الوزاري رقم (23) لسنة 2014م والذي يقضي:{" "}
                <u>بعدم {stage.warnVerb} الطالب المتغيب بدون عذر اختبار ({stage.exam}) إذا تجاوز مدة غيابه بدون عذر مقبول ({stage.warnLimit}).</u>
            </p>

            <h2 className="moe-pledge-title">إقرار وتعهد</h2>

            {guardianLine("اتعهد أنا ولي أمر الطالب:")}

            <p className="moe-para">
                بعدم تجاوز {student} أيام الغياب المحددة ({stage.pledgeLimit}) والتي تؤدي الى تطبيق القرار الوزاري رقم (23) لسنة 2014
                بعدم {stage.pledgeVerb} اختبار ({stage.exam}) في حالة الغياب بدون عذر مقبول للأيام المحددة في القرار.
            </p>

            <table className="moe-table moe-signatures">
                <colgroup><col className="c-label" /><col className="c-value" /><col className="c-mid" /><col className="c-end" /></colgroup>
                <tbody>
                    <tr>
                        <th>الطالب</th>
                        <td colSpan={3} className="is-center"><Blank width="24em">{data.studentName}</Blank></td>
                    </tr>
                    <tr>
                        <th>توقيع ولي الأمر</th>
                        <td className="is-center"><Blank width="8em" /></td>
                        <td>اليوم: <Blank width="9em" /></td>
                        <td>التاريخ: <Blank width="1.6em" /> / <Blank width="1.6em" /> /</td>
                    </tr>
                    <tr>
                        <th>منسق شؤون الطلبة</th>
                        <td className="is-center"><Blank width="8em" /></td>
                        <td>نائب المدير للشؤون الإدارية وشؤون الطلاب</td>
                        <td className="is-center"><Blank width="8em" /></td>
                    </tr>
                    <tr>
                        <th colSpan={2}>مدير المدرسة</th>
                        <td colSpan={2} className="is-center"><Blank width="14em" /></td>
                    </tr>
                </tbody>
            </table>

            <div className="moe-note">
                <span className="moe-note-label">ملاحظة:</span> في حال رفض ولي الأمر <u>التوقيع أو الحضور</u> يتم اعتماده من قبل
                كل من المشرف الإداري ومنسق شؤون الطلبة والنائب الإداري ومدير المدرسة وارسال <u>رسالة نصية لولي الأمر</u> تثبت ذلك.
            </div>
        </section>
    );
}
