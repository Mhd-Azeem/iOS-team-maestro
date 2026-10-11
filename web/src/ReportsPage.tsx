import {useEffect,useRef,useState} from 'react';
import {exportDetailedAttendance,type DetailedAttendanceRecord} from './report-export';
import {reportSections,reportTitles,summarizeAttendance,type ReportType} from '../../shared/reports';
type ClassOption={id:number;grade_id:number|null;display_name:string;grade_name?:string};
type Report={rows:DetailedAttendanceRecord[];start:string;end:string;type:ReportType};
export default function ReportsPage({api}:{api:(path:string)=>Promise<any>}){
  const today=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')};
  const[dates,setDates]=useState({start:today().slice(0,4)+'-01-01',end:today()});
  const[type,setType]=useState<ReportType>('attendance');
  const[classId,setClassId]=useState('0'),[gradeId,setGradeId]=useState('0');
  const[classes,setClasses]=useState<ClassOption[]>([]),[grades,setGrades]=useState<{id:number;name:string}[]>([]);
  const[report,setReport]=useState<Report|null>(null),[loading,setLoading]=useState(false);
  const[exporting,setExporting]=useState<'pdf'|'docx'|null>(null),[expanded,setExpanded]=useState(false),[error,setError]=useState('');
  const version=useRef(0);
  useEffect(()=>{let alive=true;Promise.all([api('/api/classes'),api('/api/grades')]).then(([c,g])=>{if(alive){setClasses(c);setGrades(g)}}).catch(e=>{if(alive)setError(e.message)});return()=>{alive=false;version.current++}},[api]);
  const invalidate=()=>{version.current++;setReport(null);setExpanded(false);setError('');setLoading(false)};
  async function generate(){
    const current=++version.current;setError('');setReport(null);setExpanded(false);setLoading(true);
    try{
      const params=new URLSearchParams({...dates,class_id:classId,grade_id:gradeId,type});
      const data=await api('/api/reports/preview?'+params);
      if(current!==version.current)return;
      if(!Array.isArray(data.rows))throw new Error('The server did not return a valid report.');
      setReport({rows:data.rows,start:dates.start,end:dates.end,type});
    }catch(e:any){if(current===version.current)setError(e.message||'Could not generate report.')}
    finally{if(current===version.current)setLoading(false)}
  }
  async function download(format:'pdf'|'docx'){
    if(!report||exporting)return;setError('');setExporting(format);
    try{await exportDetailedAttendance(format,report.start,report.end,report.rows,report.type)}catch(e:any){setError(e.message||'Unable to export report.')}
    finally{setExporting(null)}
  }
  const analytics=report?summarizeAttendance(report.rows):null;
  return <div className="reportsPage reportGenerator">
    <div className="reportIntro"><h2>Reports</h2><p>Filter attendance, preview student records, and save PDF or editable Word reports.</p></div>
    <section className="card reportFilterCard">
      <label>Start Date<input type="date" value={dates.start} max={dates.end} onChange={e=>{setDates(d=>({...d,start:e.target.value}));invalidate()}}/></label>
      <label>End Date<input type="date" value={dates.end} min={dates.start} onChange={e=>{setDates(d=>({...d,end:e.target.value}));invalidate()}}/></label>
      <label>Grade<select value={gradeId} onChange={e=>{setGradeId(e.target.value);setClassId('0');invalidate()}}><option value="0">All Grades</option>{grades.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}</select></label>
      <label>Class<select value={classId} onChange={e=>{setClassId(e.target.value);invalidate()}}><option value="0">All Classes</option>{classes.filter(c=>gradeId==='0'||String(c.grade_id)===gradeId).map(c=><option key={c.id} value={c.id}>{c.display_name}</option>)}</select></label>
      <label>Report Type<select value={type} onChange={e=>{setType(e.target.value as ReportType);invalidate()}}>{Object.entries(reportTitles).map(([key,title])=><option key={key} value={key}>{title}</option>)}<option disabled value="notes">Student Notes — unavailable</option></select></label>
      <p className="settingsHint">Student notes require backend storage and a permission policy before reports can be enabled.</p>
      <button className="reportGenerateButton" onClick={()=>void generate()} disabled={loading||!!exporting}>{loading?'Generating report…':'Generate Report'}</button>
    </section>
    {error&&<div className="error reportError" role="alert">{error}</div>}
    {report&&analytics&&<>
      <section className="card reportResultCard" aria-live="polite">
        <div className="reportResultHeading"><strong>{reportTitles[report.type]}</strong><small>{report.start} → {report.end} · {report.rows.length} records</small></div>
        <div className="reportTotals"><span>Present <b>{analytics.totals.present}</b></span><span>Absent <b>{analytics.totals.absent}</b></span><span>Attendance <b>{analytics.totals.percentage.toFixed(1)}%</b></span></div>
        <p className="settingsHint">Percentages use submitted student attendance records. Unrecorded days are excluded. Class totals count student records, not school days.</p>
        <button className="reportExpandButton" aria-expanded={expanded} aria-controls="report-export-menu" onClick={()=>setExpanded(v=>!v)} disabled={!report.rows.length}>Export <span aria-hidden="true">{expanded?'▴':'▾'}</span></button>
        {expanded&&<div id="report-export-menu" className="reportExportMenu"><button onClick={()=>void download('docx')} disabled={!!exporting}>{exporting==='docx'?'Preparing document…':'Editable Word'} <small>.docx</small></button><button onClick={()=>void download('pdf')} disabled={!!exporting}>{exporting==='pdf'?'Preparing PDF…':'PDF'} <small>.pdf</small></button></div>}
        {!report.rows.length&&<p>No attendance records were found for the chosen filters.</p>}
      </section>
      {reportSections(report.rows,report.type).filter(s=>s.rows.length).map((section,index)=><section className="card reportPreviewCard" key={index}><div className="reportPreviewMeta">{section.meta?<><div>Grade: <b>{section.meta.grade}</b></div><div>Class: <b>{section.meta.className}</b></div><div>Date: <b>{section.meta.date}</b></div></>:section.title}</div><div className="reportTableScroll"><table className="reportPreviewTable"><thead><tr>{section.headers.map(h=><th key={h} scope="col">{h}</th>)}</tr></thead><tbody>{section.rows.map((row,i)=><tr key={i}>{row.map((v,j)=><td key={j} className={v==='PRESENT'?'reportPresent':v==='ABSENT'?'reportAbsent':undefined}>{v}</td>)}</tr>)}</tbody></table></div></section>)}
      {report.rows.length>0&&report.type==='attendance'&&<details className="card"><summary>Student summaries and class comparisons</summary>{(['students','classes'] as ReportType[]).flatMap(t=>reportSections(report.rows,t)).map(section=><div key={section.title}><h3>{section.title}</h3><div className="reportTableScroll"><table className="reportPreviewTable"><thead><tr>{section.headers.map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{section.rows.map((row,i)=><tr key={i}>{row.map((v,j)=><td key={j}>{v}</td>)}</tr>)}</tbody></table></div></div>)}</details>}
    </>}
  </div>
}
