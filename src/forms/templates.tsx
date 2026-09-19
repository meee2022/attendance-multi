import { ACTOR_LABELS } from "../lib/discipline";
import {
    FormSheet, StudentInfo, DatesTable, HistoryTable, InfoTable, GuardianReceipt,
    Fill, Lines, SectionTitle, stepPhrase, countPhrase,
    type FormProps,
} from "./formKit";

/**
 * Wording and layout of each printed form.
 *
 * These are interim drafts. When the ministry's approved forms arrive, rewrite
 * the component for that form here to match them — the data every form
 * receives (FormData in formKit.tsx) stays the same, so nothing else changes.
 */

const isAbsence = (p: FormProps) => p.data.kind === "absence";

// ─── تعهد الطالبة ───────────────────────────────────────────────────────────
export function StudentPledge(props: FormProps) {
    const { data } = props;
    const absence = isAbsence(props);
    return (
        <FormSheet
            data={data}
            title={absence ? "تعهد طالبة بالانتظام في الحضور" : "تعهد طالبة بالالتزام بموعد الحضور الصباحي"}
            subtitle={stepPhrase(data)}
            signatures={["الطالبة", "المشرفة الإدارية"]}
        >
            <StudentInfo data={data} />
            <p>
                أتعهد أنا الطالبة / <b>{data.studentName}</b> بالصف <bdi dir="ltr">{data.className}</bdi>{" "}
                {absence
                    ? "بالانتظام في الحضور اليومي إلى المدرسة، وعدم التغيب إلا لعذر مقبول أُقدّمه للمدرسة في حينه."
                    : "بالحضور إلى المدرسة في الموعد المحدد صباحاً، والالتزام بموعد الطابور الصباحي والحصة الأولى."}
            </p>
            <p>
                وقد بلغ {absence ? "عدد أيام غيابي" : "عدد مرات تأخري"} منذ بداية الفصل الدراسي {countPhrase(data)} وفق
                البيان أدناه، وأعلم أن تكرار ذلك يترتب عليه اتخاذ الإجراءات المتبعة في المدرسة.
            </p>
            <DatesTable data={data} />
        </FormSheet>
    );
}

// ─── تعهد ولي الأمر ─────────────────────────────────────────────────────────
export function GuardianPledge(props: FormProps) {
    const { data } = props;
    const absence = isAbsence(props);
    return (
        <FormSheet
            data={data}
            title="تعهد ولي أمر"
            subtitle={stepPhrase(data)}
            signatures={["ولي الأمر", "منسقة شؤون الطلاب"]}
        >
            <InfoTable rows={[
                ["اسم ولي الأمر", <Fill wide />],
                ["صلة القرابة", <Fill />],
                ["رقم الجوال", data.guardianPhone ? <bdi dir="ltr">{data.guardianPhone}</bdi> : <Fill />],
            ]} />
            <StudentInfo data={data} />
            <p>
                أتعهد أنا ولي أمر الطالبة / <b>{data.studentName}</b> بالصف <bdi dir="ltr">{data.className}</bdi> بمتابعة
                ابنتي والحرص على {absence ? "انتظامها في الحضور اليومي إلى المدرسة" : "حضورها إلى المدرسة في الموعد المحدد صباحاً"}،
                والتعاون مع المدرسة في كل ما يخدم مصلحتها وتحصيلها الدراسي.
            </p>
            <p>
                وذلك بعد أن بلغ {absence ? "عدد أيام غيابها" : "عدد مرات تأخرها"} منذ بداية الفصل الدراسي {countPhrase(data)} وفق
                البيان أدناه، وقد اطّلعت على الإجراءات المتبعة في حال التكرار.
            </p>
            <DatesTable data={data} />
        </FormSheet>
    );
}

// «إنذار لولي الأمر» is the ministry's official form — see moeAbsenceWarning.tsx.

// ─── إشعار من المنسقة لولي الأمر ────────────────────────────────────────────
export function GuardianNotice(props: FormProps) {
    const { data } = props;
    const absence = isAbsence(props);
    return (
        <FormSheet
            data={data}
            title="إشعار لولي الأمر"
            subtitle={stepPhrase(data)}
            signatures={["منسقة شؤون الطلاب"]}
        >
            <p>المكرّم ولي أمر الطالبة / <b>{data.studentName}</b> &nbsp;&nbsp; المحترم</p>
            <p>السلام عليكم ورحمة الله وبركاته، وبعد:</p>
            <p>
                نحيطكم علماً بأن ابنتكم الطالبة بالصف <bdi dir="ltr">{data.className}</bdi> قد بلغ{" "}
                {absence ? "عدد أيام غيابها" : "عدد مرات تأخرها"} منذ بداية الفصل الدراسي {countPhrase(data)}، ونأمل التواصل مع
                منسقة شؤون الطلاب بالمدرسة لمتابعة وضعها والتعاون على معالجة أسباب {absence ? "الغياب" : "التأخر"}.
            </p>
            <p>شاكرين لكم حسن تعاونكم.</p>
            <DatesTable data={data} />
            <GuardianReceipt />
        </FormSheet>
    );
}

// ─── استدعاء ولي الأمر ──────────────────────────────────────────────────────
export function GuardianSummons(props: FormProps) {
    const { data, options } = props;
    const absence = isAbsence(props);
    const meetingWith = options?.meetingWith ?? "إدارة المدرسة";
    return (
        <FormSheet
            data={data}
            title="استدعاء ولي أمر"
            subtitle={stepPhrase(data)}
            signatures={["منسقة شؤون الطلاب", "مديرة المدرسة"]}
        >
            <p>المكرّم ولي أمر الطالبة / <b>{data.studentName}</b> &nbsp;&nbsp; المحترم</p>
            <p>السلام عليكم ورحمة الله وبركاته، وبعد:</p>
            <p>
                نأمل التكرم بالحضور إلى المدرسة يوم <Fill placeholder="اليوم" /> الموافق <Fill placeholder="التاريخ" /> الساعة{" "}
                <Fill placeholder="الساعة" />، لمقابلة <b>{meetingWith}</b>، وذلك لمناقشة تكرار {absence ? "غياب" : "تأخر"} ابنتكم
                الطالبة بالصف <bdi dir="ltr">{data.className}</bdi>، حيث بلغ {absence ? "عدد أيام غيابها" : "عدد مرات تأخرها"} منذ
                بداية الفصل الدراسي {countPhrase(data)}.
            </p>
            <p>
                وتقديراً لحرصكم على مصلحة ابنتكم، نأمل الالتزام بالموعد المحدد، وفي حال تعذّر الحضور يُرجى التواصل مع المدرسة
                لتحديد موعد بديل.
            </p>
            <DatesTable data={data} />
            <GuardianReceipt />
        </FormSheet>
    );
}

// ─── نموذج تحويل طالبة ──────────────────────────────────────────────────────
export function Referral(props: FormProps) {
    const { data, options } = props;
    const absence = isAbsence(props);
    const from = ACTOR_LABELS[data.actor] ?? data.actor;
    const to = options?.to ? ACTOR_LABELS[options.to] ?? options.to : "";
    return (
        <FormSheet
            data={data}
            title="نموذج تحويل طالبة"
            subtitle={stepPhrase(data)}
            signatures={[from, to || "الجهة المحوَّل إليها"]}
        >
            <InfoTable rows={[
                ["من", <b>{from}</b>],
                ["إلى", to ? <b>{to}</b> : <Fill wide />],
                ["تاريخ التحويل", <bdi dir="ltr">{data.issueDate}</bdi>],
            ]} />
            <StudentInfo data={data} />
            <p>
                <b>سبب التحويل:</b> تكرار {absence ? "الغياب" : "التأخير الصباحي"}، حيث بلغ{" "}
                {absence ? "عدد أيام الغياب" : "عدد مرات التأخير"} منذ بداية الفصل الدراسي {countPhrase(data)}.
            </p>
            <DatesTable data={data} />
            <SectionTitle>الإجراءات المتخذة سابقاً</SectionTitle>
            <HistoryTable data={data} />
            <SectionTitle>ملاحظات الجهة المحوِّلة</SectionTitle>
            <Lines count={2} />
            <SectionTitle>إفادة الجهة المحوَّل إليها والإجراء المتخذ</SectionTitle>
            <Lines count={3} />
        </FormSheet>
    );
}

// ─── إشعار بعدم تقديم اختبار ────────────────────────────────────────────────
export function ExamNotice(props: FormProps) {
    const { data } = props;
    return (
        <FormSheet
            data={data}
            title="إشعار بعدم تقديم اختبار"
            signatures={["منسقة شؤون الطلاب", "مديرة المدرسة"]}
        >
            <p>المكرّم ولي أمر الطالبة / <b>{data.studentName}</b> &nbsp;&nbsp; المحترم</p>
            <p>السلام عليكم ورحمة الله وبركاته، وبعد:</p>
            <p>
                نفيدكم بأن ابنتكم الطالبة بالصف <bdi dir="ltr">{data.className}</bdi> لم تتقدم لأداء اختبار مادة{" "}
                <Fill wide placeholder="اسم المادة" /> المقرر بتاريخ <Fill placeholder="التاريخ" />، وذلك بسبب غيابها عن المدرسة.
            </p>
            <p>
                ونأمل مراجعة المدرسة خلال <Fill placeholder="المدة" /> لتوضيح سبب الغياب وتقديم ما يثبته، ليتسنى النظر في وضعها
                وفق الإجراءات المتبعة.
            </p>
            <StudentInfo data={data} />
            <GuardianReceipt />
        </FormSheet>
    );
}
