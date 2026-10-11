export type AttendanceRecord = {
  student_id:number; date:string; class_name:string; class_id:number; grade_name:string|null;
  admission_number:string; full_name:string; status:'PRESENT'|'ABSENT';
};
export type ReportType = 'attendance'|'students'|'classes';
export const reportTitles:Record<ReportType,string>={attendance:'Student Attendance Report',students:'Individual Student Summaries',classes:'Class Attendance Comparisons'};
export function validDate(value:string):boolean {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
  const parsed=new Date(value+'T00:00:00Z');
  return Number.isFinite(parsed.getTime())&&parsed.toISOString().slice(0,10)===value;
}
export function parseReportFilters(params:URLSearchParams){
  const start=params.get('start')||'',end=params.get('end')||'';
  if(!validDate(start)||!validDate(end)||start>end)throw new Error('Select a valid start and end date.');
  const id=(key:string)=>{const raw=params.get(key)||'0';if(!/^\d+$/.test(raw)||!Number.isSafeInteger(Number(raw)))throw new Error('Invalid '+key+' filter.');return Number(raw)};
  const type=params.get('type')||'attendance';
  if(type==='notes')throw new Error('Student notes require a backend data model and permission policy before reporting is available.');
  if(!Object.hasOwn(reportTitles,type))throw new Error('Unsupported report type.');
  return {start,end,classId:id('class_id'),gradeId:id('grade_id'),type:type as ReportType};
}
export function summarizeAttendance(rows:AttendanceRecord[]){
  const totals={total:0,present:0,absent:0,percentage:0};
  const students=new Map<number,{student_id:number;admission_number:string;full_name:string;total:number;present:number;absent:number;percentage:number}>();
  const classes=new Map<number,{class_id:number;class_name:string;grade_name:string|null;total:number;present:number;absent:number;percentage:number}>();
  const increment=(value:typeof totals,status:string)=>{value.total++;if(status==='PRESENT')value.present++;else if(status==='ABSENT')value.absent++;else throw new Error('Invalid attendance status.');value.percentage=Math.round(value.present/value.total*1000)/10};
  for(const row of rows){
    if(!students.has(row.student_id))students.set(row.student_id,{student_id:row.student_id,admission_number:row.admission_number,full_name:row.full_name,...{total:0,present:0,absent:0,percentage:0}});
    if(!classes.has(row.class_id))classes.set(row.class_id,{class_id:row.class_id,class_name:row.class_name,grade_name:row.grade_name,...{total:0,present:0,absent:0,percentage:0}});
    increment(totals,row.status);increment(students.get(row.student_id)!,row.status);increment(classes.get(row.class_id)!,row.status);
  }
  return {totals,students:[...students.values()].sort((a,b)=>a.admission_number.localeCompare(b.admission_number)),classes:[...classes.values()].sort((a,b)=>a.class_name.localeCompare(b.class_name))};
}
export function reportSections(rows:AttendanceRecord[],type:ReportType){
  const analytics=summarizeAttendance(rows);
  if(type==='students')return [{title:reportTitles.students,headers:['Admission','Name','Recorded days','Present','Absent','Attendance %'],rows:analytics.students.map(r=>[r.admission_number,r.full_name,String(r.total),String(r.present),String(r.absent),r.percentage.toFixed(1)+'%'])}];
  if(type==='classes')return [{title:reportTitles.classes,headers:['Grade','Class','Records','Present','Absent','Attendance %'],rows:analytics.classes.map(r=>[r.grade_name||'—',r.class_name,String(r.total),String(r.present),String(r.absent),r.percentage.toFixed(1)+'%'])}];
  const groups=new Map<string,AttendanceRecord[]>();
  for(const row of [...rows].sort((a,b)=>a.class_name.localeCompare(b.class_name)||a.class_id-b.class_id||b.date.localeCompare(a.date)||a.admission_number.localeCompare(b.admission_number))){const key=row.class_id+'|'+row.date;if(!groups.has(key))groups.set(key,[]);groups.get(key)!.push(row)}
  return [...groups.values()].map(group=>({title:'Grade: '+(group[0].grade_name||'—')+'    Class: '+group[0].class_name+'    Date: '+group[0].date,headers:['Admission','Name','Status'],rows:group.map(r=>[r.admission_number,r.full_name,r.status])}));
}
