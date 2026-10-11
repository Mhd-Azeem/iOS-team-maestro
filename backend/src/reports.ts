import {parseReportFilters,type AttendanceRecord} from '../../shared/reports';
export type ReportAuth={schoolId:number;userId:number;role:string};
export async function readAttendanceReport(db:D1Database,auth:ReportAuth,params:URLSearchParams){
  let filters;
  try { filters=parseReportFilters(params); }
  catch(error) { return {error:error instanceof Error ? error.message : 'Invalid report filters.',status:400} as const; }
  if(!['SUPER_ADMIN','SCHOOL_ADMIN','SECTION_HEAD','TEACHER'].includes(auth.role))return {error:'Report access denied.',status:403} as const;
  if(filters.classId){
    const allowed=await db.prepare(`SELECT c.id FROM classes c WHERE c.id=? AND c.school_id=?
      ${auth.role==='TEACHER'?'AND c.id IN (SELECT class_id FROM teacher_class_assignments WHERE school_id=? AND teacher_id=?)':''}`).bind(filters.classId,auth.schoolId,...(auth.role==='TEACHER'?[auth.schoolId,auth.userId]:[])).first();
    if(!allowed)return {error:'You cannot access this class.',status:403} as const;
  }
  if(filters.gradeId&&!await db.prepare('SELECT id FROM grades WHERE id=? AND school_id=?').bind(filters.gradeId,auth.schoolId).first())return {error:'You cannot access this grade.',status:403} as const;
  const sql=`SELECT sess.date,c.display_name class_name,c.id class_id,g.name grade_name,
    st.id student_id,st.admission_number,st.full_name,ar.status
    FROM attendance_records ar
    JOIN attendance_sessions sess ON sess.id=ar.session_id AND sess.school_id=ar.school_id
    JOIN classes c ON c.id=sess.class_id AND c.school_id=sess.school_id
    LEFT JOIN grades g ON g.id=c.grade_id AND g.school_id=c.school_id
    JOIN students st ON st.id=ar.student_id AND st.school_id=ar.school_id
    WHERE ar.school_id=? AND sess.date BETWEEN ? AND ? AND (?=0 OR c.id=?) AND (?=0 OR c.grade_id=?)
    ${auth.role==='TEACHER'?'AND c.id IN (SELECT class_id FROM teacher_class_assignments WHERE school_id=? AND teacher_id=?)':''}
    ORDER BY c.display_name,c.id,sess.date DESC,st.admission_number LIMIT 5001`;
  const args=[auth.schoolId,filters.start,filters.end,filters.classId,filters.classId,filters.gradeId,filters.gradeId];
  if(auth.role==='TEACHER')args.push(auth.schoolId,auth.userId);
  const result=await db.prepare(sql).bind(...args).all<AttendanceRecord>();
  if(result.results.length>5000)return {error:'Too many records. Select a shorter date range or class (maximum 5,000 records).',status:413} as const;
  return {rows:result.results,...filters};
}
