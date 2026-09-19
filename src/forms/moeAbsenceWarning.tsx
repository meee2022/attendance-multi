import type { ReactNode } from "react";
import type { FormProps } from "./formKit";
import "./moeAbsenceWarning.css";

/**
 * «إنذار — غياب بدون عذر» with the guardian's «إقرار وتعهد», copied from the
 * school's Word forms (انذار_غياب_N_يوم.docx for 3, 5, 7, 8, 10, 11, 13 and
 * 14 days). Wording, table numbering, column widths and borders follow those
 * files; the right-to-left glitches of the Word conversion (flipped brackets,
 * stray full stops) are not reproduced. Every filled blank stays editable.
 */

const HEADER_URL = "/forms/moe-header-wide.png";

/** The ministerial decision's four thresholds; each form quotes the one it is heading towards. */
const STAGES = [
    { upTo: 5, exam: "منتصف الفصل الدراسي الاول", warnLimit: "خمسة أيام تمدرس", pledgeLimit: "خمس أيام تمدرس", warnVerb: "دخول", pledgeVerb: "تقديم" },
    { upTo: 8, exam: "نهاية الفصل الدراسي الاول", warnLimit: "ثمان أيام تمدرس", pledgeLimit: "ثمان أيام تمدرس", warnVerb: "دخول", pledgeVerb: "تقديم" },
    { upTo: 11, exam: "منتصف الفصل الدراسي الثاني", warnLimit: "احدى عشر يوماً تمدرس", pledgeLimit: "إحدى عشر يوماً تمدرس", warnVerb: "تقديم", pledgeVerb: "دخول" },
    { upTo: Infinity, exam: "نهاية الفصل الدراسي الثاني", warnLimit: "خمس عشر يوماً تمدرس", pledgeLimit: "خمس عشر يوماً تمدرس", warnVerb: "تقديم", pledgeVerb: "تقديم" },
];

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

/** One half of a row of the dates table; a half with no day left is shaded grey, as on the originals. */
function DateCells({ n, date }: { n?: number; date?: string }) {
    if (n === undefined) return <><td className="is-empty" /><td className="is-empty" /><td className="is-empty" /></>;
    return (
        <>
            <td>{n}</td>
            <td><Blank>{weekday(date)}</Blank></td>
            <td><Blank><bdi dir="ltr">{dmy(date)}</bdi></Blank></td>
        </>
    );
}

function AbsenceDatesTable({ count, dates }: { count: number; dates: string[] }) {
    const head = <><th>م</th><th>اليوم</th><th>التاريخ</th></>;

    if (count <= 3) {
        return (
            <table className="moe-table moe-dates is-single">
                <colgroup><col className="c-num" /><col className="c-day" /><col className="c-date" /></colgroup>
                <thead><tr>{head}</tr></thead>
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
        <table className="moe-table moe-dates">
            <colgroup>
                <col className="c-num" /><col className="c-day" /><col className="c-date" />
                <col className="c-num" /><col className="c-day" /><col className="c-date" />
            </colgroup>
            <thead><tr>{head}{head}</tr></thead>
            <tbody>
                {Array.from({ length: rowCount }, (_, i) => (
                    <tr key={i}>
                        <DateCells n={right[i]} date={dates[right[i] - 1]} />
                        <DateCells n={left[i]} date={dates[left[i] - 1]} />
                    </tr>
                ))}
            </tbody>
        </table>
    );
}

export function MoeAbsenceWarning({ data }: FormProps) {
    const n = data.count;
    const stage = STAGES.find(s => n <= s.upTo)!;
    const titleUnit = n <= 10 ? "أيام" : "يوم";
    const textUnit = n <= 8 ? "أيام" : "يوماً";
    const [, section = ""] = data.className.split("-");
    const grade = data.grade ? GRADE_NAMES[data.grade] ?? String(data.grade) : "";
    const dates = [...data.absenceDates].sort().slice(0, n);
    const [y, m, d] = data.issueDate.split("-");

    const guardianLine = (lead: string) => (
        <p className="moe-center">
            {lead} <Blank width="11em">{data.studentName}</Blank>{" "}
            الصف: <Blank width="3.5em">{grade}</Blank>{" "}
            الشعبة: <Blank width="3.5em">{section}</Blank>
        </p>
    );

    return (
        <section className="form-sheet moe-sheet">
            <img className="moe-header" src={HEADER_URL} alt="وزارة التربية والتعليم والتعليم العالي — إدارة شؤون المدارس والطلبة، قسم حماية ورعاية الطلبة" />

            {n === 3 && <div className="moe-series">استمارات سياسة تعزيز انضباط حضور الطلبة</div>}

            <div className="moe-top">
                <div className="moe-title-cell">
                    <div className="moe-title">
                        <div>إنذار</div>
                        <div>غياب بدون عذر لعدد ({n} {titleUnit})</div>
                    </div>
                </div>
                <div className="moe-date">
                    التاريخ <Blank width="1.6em">{d}</Blank> / <Blank width="1.6em">{m}</Blank> / <Blank width="2.8em">{y}</Blank> م
                </div>
            </div>

            {guardianLine("الفاضل ولي امر الطالب:")}

            <p className="moe-center">
                نفيدكم علما بأن عدد أيام غياب ابنكم /ابنتكم عن المدرسة بدون عذر قد وصل مدة ({n} {textUnit}) بتاريخ:
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
                بعدم تجاوز (الطالب) أيام الغياب المحددة ({stage.pledgeLimit}) والتي تؤدي الى تطبيق القرار الوزاري رقم (23) لسنة 2014
                بعدم {stage.pledgeVerb} اختبار ({stage.exam}) في حالة الغياب بدون عذر مقبول للأيام المحددة في القرار.
            </p>

            <table className="moe-table moe-signatures">
                <colgroup><col className="c-1" /><col className="c-2" /><col className="c-3" /><col className="c-4" /></colgroup>
                <tbody>
                    <tr>
                        <th>الطالب</th>
                        <td colSpan={3} className="is-center"><Blank width="14em">{data.studentName}</Blank></td>
                    </tr>
                    <tr>
                        <th>توقيع ولي الأمر</th>
                        <td className="is-center"><Blank width="7em" /></td>
                        <td>اليوم: <Blank width="5em" /></td>
                        <td>التاريخ <Blank width="1.4em" /> / <Blank width="1.4em" /> /</td>
                    </tr>
                    <tr>
                        <th>منسق شؤون الطلبة</th>
                        <td className="is-center"><Blank width="7em" /></td>
                        <td className="is-center">المشرفة الادارية</td>
                        <td className="is-center"><Blank width="7em" /></td>
                    </tr>
                    <tr>
                        <th className="is-wrap">نائب المدير للشؤون الإدارية وشؤون الطلاب</th>
                        <td colSpan={3} className="is-center"><Blank width="14em" /></td>
                    </tr>
                    <tr className="moe-note">
                        <td colSpan={4}>
                            <u>ملاحظة</u>: في حال رفض ولي الأمر <u>التوقيع أو الحضور</u> يتم اعتماده من قبل كل من المشرف الإداري
                            ومنسق شؤون الطلبة والنائب الإداري ومدير المدرسة وارسال رسالة <u>نصية لولي الأمر</u> تثبت ذلك.
                        </td>
                    </tr>
                </tbody>
            </table>
        </section>
    );
}
