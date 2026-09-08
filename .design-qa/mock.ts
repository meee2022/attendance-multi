export const api=new Proxy({}, {get:(_,module)=>new Proxy({}, {get:(_,name)=>`${String(module)}.${String(name)}`})});
const classes=[{_id:'c1',name:'10-1',grade:10,isActive:true,track:'عام',capacity:30},{_id:'c2',name:'11-1',grade:11,isActive:true,track:'علمي',capacity:30}];
const students=['أحمد محمد عبدالله','عبدالرحمن خالد محمد آل عبدالله','يوسف علي سالم'].map((fullName,i)=>({_id:'s'+i,fullName,classId:'c1',phone:'00000000',nationalId:'',isActive:true}));
const clsStats=classes.map(c=>({...c,classId:c._id,className:c.name,total:30,totalStudents:30,studentsWithData:30,hasData:true,dayPresent:28,dayAbsent:2,presentPercentage:93.3,totalPresent:28,totalAbsent:2,tealTable:{present:28,absent:2},redTable:{present:28,absent:2},strictTable:{present:28,absent:2}}));
const gradeTotals=classes.map(c=>({grade:c.grade,total:30,present:28,absent:2,teal:{present:28,absent:2},red:{present:28,absent:2},strict:{present:28,absent:2}}));
const lates=[{_id:'l1',studentId:'s1',studentName:students[1].fullName,className:'10-1',classId:'c1',lateDaysCount:3,lateDates:['2026-09-01','2026-09-06','2026-09-08']}];
const data={
 'setup.getInitialData':{schools:[{_id:'school',name:'مدرسة التجربة',periodsPerDay:5,dailyAbsenceThreshold:3}],classes,subjects:[{_id:'sub1',name:'الرياضيات',code:'MATH',isActive:true}]},
 'setup.getStudentCounts':{total:60,byClass:{c1:30,c2:30}},
 'students.getStudentsByClass':students,
 'attendance.getDailySummary':{classes:clsStats,summary:{totalStudents:60,totalCapacity:60,totalPresent:56,totalAbsent:4,percentage:93.3,classesImported:2,totalClasses:2}},
 'attendance.getAttendanceReport':{totalStudents:60,absentThreshold:3,gradeTotals,classStats:clsStats},
 'attendance.getMatrixReport':{classStats:[],gradeTotals:[],schoolTotal:{present:56,absent:4,total:60}},
 'attendance.getFrequentlyAbsentStudents':{threshold:3,students:[]},
 'attendance.getCumulativeAbsences':[],
 'attendance.getClassDetails':{cls:classes[0],periods:[{_id:'p1',periodNumber:1}],studentStats:students.map(s=>({...s,absentCount:1,attendances:[{periodId:'p1',status:'absent'}]}))},
 'attendance.getPeriodCountsByDate':{c1:1,c2:0},
 'attendance.getClassPeriodGrid':{rows:students.map((s,i)=>({studentId:s._id,studentName:s.fullName,index:i+1,classSection:'10-1',totalRecordedPeriods:1,presentCount:1,absentCount:0,excusedCount:0,periods:Array.from({length:5},(_,j)=>({periodNumber:j+1,status:j===0?'present':null})),guardianPhone:'00000000'})),periodSummary:Array.from({length:5},(_,i)=>({periodNumber:i+1,total:i===0?3:0,present:i===0?3:0,absent:0,excused:0}))},
 'tardiness.getLatesByDate':lates,
 'tardiness.getTardinessStats':lates,
 'messages.getTemplates':{defaultAbsent:'ولي أمر الطالب {{studentName}}، نود إشعاركم بغياب الطالب يوم {{date}} عن {{subjects}}. {{schoolName}}',defaultPresent:'حضر الطالب {{studentName}} يوم {{date}}. شكرًا لتعاونكم.'},
 'messages.getStudentsForMessages':{items:students.map(s=>({studentName:s.fullName,className:'10-1',phone:'00000000',subjects:'الرياضيات'})),total:3},
 'adminRecovery.getRecoveryOptions':{hasRecoveryCode:true,passwordRecoveryEnabled:true},
};
export function useQuery(key,args){if(args==='skip')return undefined; return data[key] ?? {};}
export function useMutation(key){return async()=> key==='superAdmin.listSchools'?{ok:true,schools:[{_id:'school',name:'مدرسة التجربة',code:'DEMO',classCount:2,studentCount:60,attendanceCount:30,hasPassword:true,hasRecoveryCode:true}]}:{ok:true};}
