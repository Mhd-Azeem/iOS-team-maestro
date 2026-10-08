import {FormEvent,useEffect,useState} from "react";
const API=import.meta.env.VITE_API_BASE_URL||"http://localhost:8787";
async function api(path:string,options:RequestInit={}){const token=localStorage.getItem("sat_token"),headers=new Headers(options.headers||{});headers.set("Content-Type","application/json");if(token)headers.set("Authorization","Bearer "+token);const r=await fetch(API+path,{...options,headers}),d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||"Request failed.");return d}
async function prepareLogo(file:File):Promise<string>{
  if(!file.type.startsWith("image/"))throw new Error("Please select an image file.");
  if(file.size>8*1024*1024)throw new Error("Logo image must be smaller than 8 MB.");
  return await new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onerror=()=>reject(new Error("Could not read the selected logo."));
    reader.onload=()=>{
      const img=new Image();
      img.onerror=()=>reject(new Error("Could not open the selected logo."));
      img.onload=()=>{
        const max=512,scale=Math.min(1,max/Math.max(img.width,img.height));
        const canvas=document.createElement("canvas");
        canvas.width=Math.max(1,Math.round(img.width*scale));
        canvas.height=Math.max(1,Math.round(img.height*scale));
        const ctx=canvas.getContext("2d");
        if(!ctx)return reject(new Error("Could not prepare the selected logo."));
        ctx.drawImage(img,0,0,canvas.width,canvas.height);
        resolve(canvas.toDataURL("image/webp",0.86));
      };
      img.src=String(reader.result||"");
    };
    reader.readAsDataURL(file);
  });
}
type C={id:number;display_name:string;grade_id:number};type S={id:number;admission_number:string;full_name:string;grade_id:number|null;class_id:number|null;grade_name?:string|null;class_name?:string|null};
export default function App(){const[ready,setReady]=useState<boolean|null>(null),[me,setMe]=useState<any>(null),[error,setError]=useState(""),[page,setPage]=useState("home"),[dash,setDash]=useState<any>(null),[classes,setClasses]=useState<C[]>([]),[students,setStudents]=useState<S[]>([]),[success,setSuccess]=useState("");
async function boot(){setError("");setReady(null);const s=await api("/api/public/status");setReady(s.initialized);if(localStorage.getItem("sat_token"))try{const m=await api("/api/me");const localLogo=localStorage.getItem("sat_logo_"+m.school.id);const logoScale=Number(localStorage.getItem("sat_logo_scale_"+m.school.id)||"100");if(localLogo!==null)m.school={...m.school,logo_url:localLogo||null};m.school={...m.school,logo_scale:logoScale};setMe(m);document.documentElement.style.setProperty("--primary",m.school.primary_color||"#008759")}catch{localStorage.removeItem("sat_token")}}
useEffect(()=>{boot().catch(e=>setError(e?.message||"Unable to connect to the attendance server."))},[]);useEffect(()=>{if(me){api("/api/dashboard").then(setDash);api("/api/classes").then(setClasses)}},[me]);useEffect(()=>{document.documentElement.scrollLeft=0;document.body.scrollLeft=0;window.scrollTo({left:0,top:window.scrollY,behavior:"auto"})},[page]);
async function setup(e:FormEvent<HTMLFormElement>){e.preventDefault();setError("");const f=new FormData(e.currentTarget),password=String(f.get("password")||""),confirm=String(f.get("confirmPassword")||"");if(password!==confirm){setError("Passwords do not match.");return}try{const d=await api("/api/register",{method:"POST",body:JSON.stringify({schoolName:f.get("schoolName"),shortName:f.get("shortName"),motto:f.get("motto"),appName:f.get("appName"),adminName:f.get("adminName"),username:f.get("username"),password})});if(d.status==="PENDING"){setError("School registration received. Your account will be available after verification and approval.");return}if(!d.token)throw new Error("Registration did not return a valid session.");localStorage.setItem("sat_token",d.token);await boot()}catch(x:any){setError(x.message)}}
async function login(e:FormEvent<HTMLFormElement>){e.preventDefault();const f=new FormData(e.currentTarget);try{const d=await api("/api/login",{method:"POST",body:JSON.stringify({username:f.get("username"),password:f.get("password")})});localStorage.setItem("sat_token",d.token);await boot()}catch(x:any){setError(x.message)}}
async function logout(){try{await api("/api/logout",{method:"POST"})}catch{}localStorage.removeItem("sat_token");setMe(null)}
async function chooseClass(id:number){setStudents(id?await api("/api/students?class_id="+id):[])}
if(ready===null)return <div className="splash">{error?<div><h2>Connection problem</h2><p>{error}</p><button onClick={()=>boot().catch(e=>setError(e?.message||"Unable to connect to the attendance server."))}>Retry</button></div>:<div>Loading…</div>}</div>;
if(!me)return <AuthPortal initialized={!!ready} error={error} onLogin={login} onRegister={setup}/>;
const isAdmin=["SUPER_ADMIN","SCHOOL_ADMIN","SECTION_HEAD"].includes(me.user.role);const isTeacher=me.user.role==="TEACHER";const nav=[["home","Home","home"],...(isTeacher?[["attendance","Attendance","check"]]:[]),["history","History","history"],...(isAdmin?[["students","Students","students"],["settings","Settings","settings"]]:[]),["profile","Profile","profile"],["privacy","Privacy","profile"],["security","Security","profile"]];
return <div className="shell"><aside><div className="school"><div className="schoolmark">{me.school.logo_url?<img src={me.school.logo_url} alt="School logo" style={{width:(me.school.logo_scale||100)+"%",height:(me.school.logo_scale||100)+"%"}}/>:(me.school.short_name||me.school.name).slice(0,2).toUpperCase()}</div><div><b>{me.school.name}</b><small>{me.school.app_name}</small></div></div><nav>{nav.map(n=><button className={page===n[0]?"active":""} onClick={()=>setPage(n[0])} key={n[0]}><Icon name={n[2]}/><span>{n[1]}</span></button>)}</nav><button className="logoutBtn" onClick={logout}><Icon name="logout"/><span>Logout</span></button></aside><main><header className="pageHead"><div><span className="eyebrow">{me.school.short_name||"School Attendance"}</span><h1>{page[0].toUpperCase()+page.slice(1)}</h1><p>{me.user.full_name} · {me.user.role.replaceAll("_"," ")}</p></div><div className="avatar">{me.user.full_name.slice(0,1).toUpperCase()}</div></header>{error&&<div className="error">{error}</div>}
{page==="home"&&<><section className="hero"><div className="heroMark">{me.school.logo_url?<img src={me.school.logo_url} alt="School logo" style={{width:(me.school.logo_scale||100)+"%",height:(me.school.logo_scale||100)+"%"}}/>:(me.school.short_name||me.school.name).slice(0,2).toUpperCase()}</div><div className="heroText"><span className="eyebrow light">Welcome back</span><h2>{me.school.app_name}</h2><p>{me.school.motto||me.school.name}</p></div><div className="heroBadge"><Icon name="calendar"/><span>{new Date().toLocaleDateString(undefined,{weekday:"short",day:"numeric",month:"short"})}</span></div></section><div className="stats"><Card t="Total Students" v={dash?.totalStudents||0} icon="students"/><Card t="Present Today" v={dash?.presentToday||0} icon="present"/><Card t="Absent Today" v={dash?.absentToday||0} icon="absent"/><Card t="Submitted" v={dash?(dash.submitted+"/"+dash.totalClasses):"0/0"} icon="classes"/></div><div className="card sectionCard"><div className="sectionTitle"><div><span className="eyebrow">Today</span><h3>Class Status</h3></div><span className="countPill">{classes.length} classes</span></div>{classes.length?classes.map(c=>{const pending=dash?.pending?.some((x:any)=>x.id===c.id);return <div className="row classRow" key={c.id}><div className="classIdentity"><span className="classDot">{c.display_name.slice(0,2)}</span><span>{c.display_name}</span></div><span className={pending?"status pending":"status done"}>{pending?"Not submitted":"Submitted"}</span></div>}):<div className="emptyState"><Icon name="classes"/><b>No classes yet</b><span>Set up grades and classes from Settings.</span></div>}</div></>}
{page==="attendance"&&isTeacher&&<TeacherAttendancePortal classes={classes} students={students} chooseClass={chooseClass} done={m=>{setSuccess(m);api("/api/dashboard").then(setDash)}}/>}
{page==="history"&&<History/>}{page==="students"&&isAdmin&&<StudentsPage classes={classes} done={m=>{setSuccess(m);api("/api/dashboard").then(setDash)}}/>}{page==="settings"&&isAdmin&&<SettingsPage classes={classes} school={me.school} refresh={()=>api("/api/classes").then(setClasses)} onSchoolUpdated={school=>setMe((current:any)=>({...current,school}))} done={m=>setSuccess(m)}/>}
{page==="privacy"&&<PrivacyPage isAdmin={isAdmin}/>}{page==="security"&&<SecurityPage/>}{page==="profile"&&<div className="card profileCard"><div className="profileAvatar">{me.user.full_name.slice(0,1).toUpperCase()}</div><h2>{me.user.full_name}</h2><p className="muted">@{me.user.username}</p><span className="rolePill">{me.user.role.replaceAll("_"," ")}</span><button className="secondaryDanger" onClick={logout}><Icon name="logout"/> Logout</button></div>}</main><div className="bottom">{nav.map(n=><button className={page===n[0]?"active":""} onClick={()=>setPage(n[0])} key={n[0]}><Icon name={n[2]}/><span>{n[1]}</span></button>)}</div>{success&&<div className="modalbg"><div className="modal"><b>✓</b><h2>Submitted Successfully</h2><p>{success}</p><button onClick={()=>setSuccess("")}>OK</button></div></div>}</div>}
function AuthPortal({initialized,error,onLogin,onRegister}:{initialized:boolean;error:string;onLogin:(e:FormEvent<HTMLFormElement>)=>void;onRegister:(e:FormEvent<HTMLFormElement>)=>void}){
  const[tab,setTab]=useState<"login"|"register">(initialized?"login":"register");
  return <div className="auth">
    <div className="authGlow one"/><div className="authGlow two"/>
    <div className="brand"><div className="brandIcon"><Icon name="school"/></div><h1>School Attendance</h1><p>Simple · Smart · Reliable</p></div>
    <div className="card authcard">
      <div className="authTabs">
        <button type="button" className={tab==="login"?"active":""} onClick={()=>setTab("login")}>Login</button>
        <button type="button" className={tab==="register"?"active":""} onClick={()=>setTab("register")}>Register</button>
      </div>
      {error&&<div className="error">{error}</div>}
      {tab==="login"?<form onSubmit={onLogin}>
        <div className="authTitle"><span className="eyebrow">Welcome back</span><h2>Login</h2><p>Sign in to your school account.</p></div>
        <label>Username<input name="username" autoComplete="username" required/></label>
        <label>Password<input name="password" type="password" autoComplete="current-password" required/></label>
        <button className="primaryAction">Login</button>
      </form>:<form onSubmit={onRegister}>
        <div className="authTitle"><span className="eyebrow">New school</span><h2>Register</h2><p>Request school verification. Access is enabled only after administrator approval.</p></div>
        <label>School Name<input name="schoolName" required/></label>
        <label>Short Name <span className="optionalText">Optional</span><input name="shortName"/></label>
        <label>Motto <span className="optionalText">Optional</span><input name="motto"/></label>
        <label>App Name <span className="optionalText">Optional</span><input name="appName" defaultValue="School Attendance App"/></label>
        <label>Administrator Name<input name="adminName" required/></label>
        <label>Username<input name="username" autoComplete="username" required/></label>
        <label>Password<input name="password" type="password" minLength={10} autoComplete="new-password" required/></label>
        <label>Confirm Password<input name="confirmPassword" type="password" minLength={6} autoComplete="new-password" required/></label>
        <button className="primaryAction">Register School</button>
      </form>}
    </div>
  </div>
}
function Card({t,v,icon}:{t:string,v:any,icon:string}){return <div className="card stat"><div className="statTop"><div className="statIcon"><Icon name={icon}/></div><span>{t}</span></div><strong>{v}</strong><small>Today</small></div>}
function TeacherAttendancePortal({classes,students,chooseClass,done}:{classes:C[];students:S[];chooseClass:(id:number)=>void;done:(message:string)=>void}){
  const[mode,setMode]=useState<"student"|"teacher">("student");
  const[selectedClass,setSelectedClass]=useState(0);
  function selectClass(id:number){setSelectedClass(id);chooseClass(id)}
  return <div className="teacherAttendancePage">
    <div className="card sectionCard">
      <div className="sectionTitle"><div><span className="eyebrow">Teacher only</span><h2>Attendance</h2></div><div className="sectionIcon"><Icon name="check"/></div></div>
      <p className="settingsHint">Only teachers can submit attendance. Choose whether you are marking student attendance or teacher period attendance.</p>
      <div className="segmented attendanceTabs">
        <button type="button" className={mode==="student"?"active":""} onClick={()=>setMode("student")}>Student Attendance</button>
        <button type="button" className={mode==="teacher"?"active":""} onClick={()=>setMode("teacher")}>Teacher Attendance</button>
      </div>
    </div>
    <div className="card sectionCard">
      <label>Choose class<select value={selectedClass||""} onChange={e=>selectClass(Number(e.target.value))}><option value="">Select a class</option>{classes.map(c=><option value={c.id} key={c.id}>{c.display_name}</option>)}</select></label>
      {mode==="student"
        ? <Attendance students={students} classes={classes} done={()=>done("Student attendance has been saved.")}/>
        : <TeacherPeriodAttendance classId={selectedClass} done={()=>done("Teacher attendance has been saved.")}/>}
    </div>
  </div>
}

function TeacherPeriodAttendance({classId,done}:{classId:number;done:()=>void}){
  const[error,setError]=useState("");
  const[date,setDate]=useState(new Date().toISOString().slice(0,10));
  const[selections,setSelections]=useState<Record<number,string>>({});
  const[busy,setBusy]=useState(false);
  const statuses=[{value:"ARRIVED",label:"Arrived",symbol:"✓"},{value:"DELAYED",label:"Delayed",symbol:"◷"},{value:"RELIEF",label:"Relief",symbol:"↔"},{value:"NO TEACHER PRESENTED",label:"Not arrived",symbol:"✕"}];
  useEffect(()=>{setSelections({});setError("")},[classId,date]);
  const completed=Object.keys(selections).length;
  async function send(e:FormEvent<HTMLFormElement>){
    e.preventDefault();setError("");
    if(!classId){setError("Select a class first.");return}
    const periods=Array.from({length:9},(_,i)=>({period:i+1,status:selections[i+1]||""}));
    if(periods.some(p=>!p.status)){setError("Tap a status for all 9 periods before submitting.");return}
    setBusy(true);
    try{
      await api("/api/teacher-period-attendance",{method:"POST",body:JSON.stringify({class_id:classId,date,periods})});
      done();
    }catch(x:any){setError(x.message)}
    finally{setBusy(false)}
  }
  if(!classId)return <div className="emptyState"><Icon name="classes"/><b>Select a class</b><span>Choose your assigned class above to mark teacher attendance.</span></div>;
  return <form className="attendanceForm teacherPeriodForm" onSubmit={send}>
    <label>Date<input type="date" name="date" value={date} onChange={e=>setDate(e.target.value)} required/></label>
    <div className="periodProgress"><b>{completed} of 9 periods marked</b><span>{completed===9?"Ready to submit":"Tap one option for each period"}</span></div>
    {error&&<div className="error" role="alert">{error}</div>}
    <div className="periodTableScroll"><table className="periodRadioTable"><thead><tr><th scope="col">Period</th>{statuses.map(status=><th scope="col" key={status.value}>{status.label}</th>)}</tr></thead><tbody>{Array.from({length:9},(_,i)=><tr key={i+1}><th scope="row">Period {i+1}</th>{statuses.map(status=><td key={status.value}><label className="periodRadioCell"><input type="radio" name={"period_"+(i+1)} value={status.value} checked={selections[i+1]===status.value} onChange={()=>setSelections(current=>({...current,[i+1]:status.value}))} aria-label={"Period "+(i+1)+": "+status.label}/></label></td>)}</tr>)}</tbody></table></div>
    <button className="primaryAction" disabled={busy||completed!==9}><Icon name="check"/>{busy?"Submitting…":"Submit Teacher Attendance"}</button>
  </form>
}

function Attendance({students,classes,done}:{students:S[];classes:C[];done:()=>void}){const[classId,setClassId]=useState(0);useEffect(()=>{if(students[0]?.class_id)setClassId(students[0].class_id)},[students]);async function send(e:FormEvent<HTMLFormElement>){e.preventDefault();if(!classId)return;const f=e.currentTarget,records=students.map(s=>({student_id:s.id,status:String((f.elements.namedItem("s"+s.id) as RadioNodeList).value||"PRESENT")}));await api("/api/attendance",{method:"POST",body:JSON.stringify({class_id:classId,date:new FormData(f).get("date"),records,reason:new FormData(f).get("reason")})});done()}return students.length?<form className="attendanceForm" onSubmit={send}><input type="hidden" value={classId} readOnly/><label>Date<input type="date" name="date" defaultValue={new Date().toISOString().slice(0,10)}/></label><label>Correction reason (required when changing submitted attendance)<input name="reason" maxLength={500} placeholder="Explain changes to a previous submission"/></label><div className="studentList">{students.map(s=><div className="student" key={s.id}><div className="studentInfo"><span className="studentAvatar">{s.full_name.slice(0,1).toUpperCase()}</span><div><b>{s.full_name}</b><small>{s.admission_number}</small></div></div><div className="attendanceChoice"><label className="presentChoice"><input type="radio" name={"s"+s.id} value="PRESENT" defaultChecked/><span>Present</span></label><label className="absentChoice"><input type="radio" name={"s"+s.id} value="ABSENT"/><span>Absent</span></label></div></div>)}</div><button className="primaryAction"><Icon name="check"/>Submit Attendance</button></form>:<div className="emptyState"><Icon name="students"/><b>Select a class</b><span>Choose a class above to load the student list.</span></div>}
function History(){const[rows,setRows]=useState<any[]>([]);useEffect(()=>{api("/api/attendance/history").then(setRows)},[]);return <div className="card sectionCard"><div className="sectionTitle"><div><span className="eyebrow">Records</span><h2>Attendance History</h2></div><div className="sectionIcon"><Icon name="history"/></div></div>{rows.length?rows.map(r=><div className="row historyRow" key={r.id}><div><b>{r.class_name}</b><small>{r.date} · {r.submitted_by}</small></div><div className="historyCounts"><span className="miniGood">{r.present_count||0} P</span><span className="miniBad">{r.absent_count||0} A</span></div></div>):<div className="emptyState"><Icon name="history"/><b>No history yet</b><span>Submitted attendance will appear here.</span></div>}</div>}
function StudentsPage({classes,done}:{classes:C[];done:(message:string)=>void}){
  const[mode,setMode]=useState<"individual"|"bulk">("individual");
  const[grades,setGrades]=useState<any[]>([]);
  const[teachers,setTeachers]=useState<any[]>([]);
  const[error,setError]=useState("");
  const[bulkText,setBulkText]=useState("");
  async function loadTeachers(){try{setTeachers(await api("/api/teachers"))}catch(e:any){setError(e.message)}}
  useEffect(()=>{api("/api/grades").then(setGrades).catch(e=>setError(e.message));loadTeachers()},[]);

  async function addOne(e:FormEvent<HTMLFormElement>){
    e.preventDefault();setError("");
    const form=e.currentTarget,f=new FormData(form),grade=Number(f.get("grade_id")||0),cls=Number(f.get("class_id")||0);
    try{
      await api("/api/students",{method:"POST",body:JSON.stringify({
        admission_number:f.get("admission"),
        full_name:f.get("full_name"),
        grade_id:grade||null,
        class_id:cls||null
      })});
      form.reset();done("Student added successfully.");
    }catch(x:any){setError(x.message)}
  }

  async function addBulk(e:FormEvent<HTMLFormElement>){
    e.preventDefault();setError("");
    const f=new FormData(e.currentTarget),grade=Number(f.get("grade_id")||0),cls=Number(f.get("class_id")||0);
    const rows=bulkText.split(/\r?\n/).map(x=>x.trim()).filter(Boolean).map((line,index)=>{
      const parts=line.split(",");const admission=(parts.shift()||"").trim();const full_name=parts.join(",").trim();
      if(!admission||!full_name)throw new Error("Line "+(index+1)+" must be: admission number, student name");
      return {admission_number:admission,full_name,grade_id:grade||null,class_id:cls||null};
    });
    try{
      const result=await api("/api/students/bulk",{method:"POST",body:JSON.stringify({students:rows})});
      setBulkText("");done((result.added||rows.length)+" students added successfully.");
    }catch(x:any){setError(x.message)}
  }

  const classOptions=(gradeId:number)=>gradeId?classes.filter(c=>c.grade_id===gradeId):classes;

  return <div className="studentManage">
    <div className="card sectionCard">
      <div className="sectionTitle"><div><span className="eyebrow">Student records</span><h2>Add Students</h2></div><div className="sectionIcon"><Icon name="students"/></div></div>
      <p className="settingsHint">Only student creation is kept here. Grade and class assignment are optional.</p>
      <div className="segmented">
        <button type="button" className={mode==="individual"?"active":""} onClick={()=>{setMode("individual");setError("")}}>Individual</button>
        <button type="button" className={mode==="bulk"?"active":""} onClick={()=>{setMode("bulk");setError("")}}>Bulk Add</button>
      </div>
      {error&&<div className="error">{error}</div>}
    </div>

    {mode==="individual"?<IndividualStudentForm grades={grades} classes={classes} onSubmit={addOne}/>:<form className="card studentAddCard" onSubmit={addBulk}>
      <div className="formHeading"><div><span className="eyebrow">Multiple students</span><h3>Bulk Student Add</h3></div><span className="countPill">Up to 500</span></div>
      <label>Grade <span className="optionalText">Optional</span>
        <select name="grade_id"><option value="">No grade assigned</option>{grades.map(g=><option value={g.id} key={g.id}>{g.name}</option>)}</select>
      </label>
      <label>Class <span className="optionalText">Optional</span>
        <select name="class_id"><option value="">No class assigned</option>{classes.map(c=><option value={c.id} key={c.id}>{c.display_name}</option>)}</select>
      </label>
      <label>Students
        <textarea className="bulkBox" value={bulkText} onChange={e=>setBulkText(e.target.value)} placeholder={"1001, Ahmed Azeem\n1002, Fathima Nisa\n1003, Mohamed Rifan"} required/>
      </label>
      <div className="formatHint"><b>Format:</b> one student per line — <code>Admission Number, Student Name</code></div>
      <button className="primaryAction"><Icon name="students"/>Add Students</button>
    </form>}
  </div>
}

function IndividualStudentForm({grades,classes,onSubmit}:{grades:any[];classes:C[];onSubmit:(e:FormEvent<HTMLFormElement>)=>void}){
  const[selectedGrade,setSelectedGrade]=useState(0);
  const visibleClasses=selectedGrade?classes.filter(c=>c.grade_id===selectedGrade):classes;
  return <form className="card studentAddCard" onSubmit={onSubmit}>
    <div className="formHeading"><div><span className="eyebrow">One student</span><h3>Individual Student Add</h3></div><div className="sectionIcon"><Icon name="profile"/></div></div>
    <label>Admission Number<input name="admission" placeholder="e.g. 10542" required/></label>
    <label>Full Name<input name="full_name" placeholder="Student full name" required/></label>
    <label>Grade <span className="optionalText">Optional</span>
      <select name="grade_id" onChange={e=>setSelectedGrade(Number(e.target.value)||0)}>
        <option value="">No grade assigned</option>{grades.map(g=><option value={g.id} key={g.id}>{g.name}</option>)}
      </select>
    </label>
    <label>Class <span className="optionalText">Optional</span>
      <select name="class_id"><option value="">No class assigned</option>{visibleClasses.map(c=><option value={c.id} key={c.id}>{c.display_name}</option>)}</select>
    </label>
    <button className="primaryAction"><Icon name="students"/>Add Student</button>
  </form>
}

function SettingsPage({classes,school,refresh,onSchoolUpdated,done}:{classes:C[];school:any;refresh:()=>void;onSchoolUpdated:(school:any)=>void;done:(message:string)=>void}){
  const[grades,setGrades]=useState<any[]>([]);
  const[teachers,setTeachers]=useState<any[]>([]);
  const[error,setError]=useState("");
  const[logoPreview,setLogoPreview]=useState<string>(school?.logo_url||"");
  const[logoBusy,setLogoBusy]=useState(false);
  const[logoScale,setLogoScale]=useState<number>(Number(school?.logo_scale||100));
  const[gradeInput,setGradeInput]=useState("");
  const[classInput,setClassInput]=useState("");

  async function loadGrades(){try{setGrades(await api("/api/grades"))}catch(e:any){setError(e.message)}}
  async function loadTeachers(){try{setTeachers(await api("/api/teachers"))}catch(e:any){setError(e.message)}}
  useEffect(()=>{loadGrades();loadTeachers()},[]);
  useEffect(()=>{
    setLogoPreview(school?.logo_url||"");
    const saved=Number(localStorage.getItem("sat_logo_scale_"+school.id)||school?.logo_scale||100);
    setLogoScale(Math.min(140,Math.max(40,saved)));
  },[school?.id,school?.logo_url]);

  function normalizedGrade(value:string){
    const v=value.trim();
    if(!v)return "";
    return /^grade\s+/i.test(v)?v:"Grade "+v;
  }
  const previewGrade=normalizedGrade(gradeInput)||"Grade 10";
  const previewOutput=previewGrade+(classInput.trim()?"-"+classInput.trim():"");

  async function changeLogo(e:any){
    const file=e.target.files?.[0];if(!file)return;
    setError("");setLogoBusy(true);
    try{
      const logo_url=await prepareLogo(file);
      localStorage.setItem("sat_logo_"+school.id,logo_url);
      const localSchool={...school,logo_url,logo_scale:logoScale};
      setLogoPreview(logo_url);onSchoolUpdated(localSchool);
      try{
        const result=await api("/api/school/branding",{method:"PATCH",body:JSON.stringify({logo_url})});
        if(result?.school){onSchoolUpdated({...result.school,logo_scale:logoScale})}
        done("School logo updated successfully.");
      }catch{
        done("School logo saved on this device.");
      }
    }catch(x:any){setError(x.message)}
    finally{setLogoBusy(false);e.target.value=""}
  }
  function resizeLogo(value:number){
    const size=Math.min(140,Math.max(40,value));
    setLogoScale(size);
    localStorage.setItem("sat_logo_scale_"+school.id,String(size));
    onSchoolUpdated({...school,logo_url:logoPreview||school.logo_url,logo_scale:size});
  }
  async function removeLogo(){
    setError("");setLogoBusy(true);
    try{
      localStorage.setItem("sat_logo_"+school.id,"");
      setLogoPreview("");onSchoolUpdated({...school,logo_url:null,logo_scale:logoScale});
      try{await api("/api/school/branding",{method:"PATCH",body:JSON.stringify({logo_url:null})})}catch{}
      done("School logo removed.");
    }catch(x:any){setError(x.message)}
    finally{setLogoBusy(false)}
  }

  async function addGradeWithOptionalClass(e:FormEvent<HTMLFormElement>){
    e.preventDefault();setError("");
    const gradeName=normalizedGrade(gradeInput);
    const className=classInput.trim();
    if(!gradeName){setError("Grade is required.");return}
    try{
      let currentGrades=grades;
      let grade=currentGrades.find((g:any)=>String(g.name).toLowerCase()===gradeName.toLowerCase());
      if(!grade){
        const created=await api("/api/grades",{method:"POST",body:JSON.stringify({name:gradeName})});
        await loadGrades();
        grade={id:created.id,name:gradeName};
      }
      if(className){
        await api("/api/classes",{method:"POST",body:JSON.stringify({
          grade_id:Number(grade.id),
          name:className,
          display_name:gradeName+"-"+className
        })});
        refresh();
      }
      setGradeInput("");setClassInput("");
      done(className?"Grade and class added successfully.":"Grade added successfully.");
    }catch(x:any){setError(x.message)}
  }

  async function addTeacher(e:FormEvent<HTMLFormElement>){
    e.preventDefault();setError("");const form=e.currentTarget,f=new FormData(form),classId=Number(f.get("class_id")||0);
    try{await api("/api/teachers",{method:"POST",body:JSON.stringify({full_name:f.get("full_name"),username:f.get("username"),password:f.get("password"),class_ids:classId?[classId]:[]})});await loadTeachers();form.reset();done("Teacher added successfully.")}
    catch(x:any){setError(x.message)}
  }

  async function resetTeacherPassword(teacherId:number,e:FormEvent<HTMLFormElement>){
    e.preventDefault();setError("");
    const form=e.currentTarget,f=new FormData(form),password=String(f.get("password")||"");
    try{
      await api("/api/teachers/"+teacherId+"/password",{method:"PATCH",body:JSON.stringify({password})});
      form.reset();done("Teacher temporary password reset successfully.");
    }catch(x:any){setError(x.message)}
  }

  return <div className="settingsPage">
    <div className="card sectionCard">
      <div className="sectionTitle"><div><span className="eyebrow">Administration</span><h2>Settings</h2></div><div className="sectionIcon"><Icon name="settings"/></div></div>
      <p className="settingsHint">Tap a section to expand it. Add grades and optional classes together, manage the school logo, and manage teacher accounts.</p>
      {error&&<div className="error">{error}</div>}
    </div>

    <div className="settingsAccordionList">
      <details className="settingsAccordion">
        <summary><span><Icon name="school"/>School Logo</span><b>⌄</b></summary>
        <div className="accordionBody brandingCard">
          <div className="logoPreview">{logoPreview?<img src={logoPreview} alt="School logo preview" style={{width:logoScale+"px",height:logoScale+"px"}}/>:<div className="logoPlaceholder"><Icon name="school"/><span>No logo</span></div>}</div>
          <label className="logoUpload">Choose Logo<input type="file" accept="image/*" onChange={changeLogo} disabled={logoBusy}/></label>
          {logoPreview&&<label className="logoSizeControl">Logo Size <span>{logoScale}%</span><input type="range" min="40" max="140" step="5" value={logoScale} onChange={e=>resizeLogo(Number(e.target.value))}/></label>}
          <small className="logoHelp">Choose the image, then drag the size slider until the logo looks right.</small>
          {logoPreview&&<button type="button" className="secondaryDanger" onClick={removeLogo} disabled={logoBusy}>Remove Logo</button>}
        </div>
      </details>

      <details className="settingsAccordion">
        <summary><span><Icon name="classes"/>Add Grade</span><b>⌄</b></summary>
        <form className="accordionBody gradeClassForm" onSubmit={addGradeWithOptionalClass}>
          <label className="inlineSettingRow"><span>Grade</span><input value={gradeInput} onChange={e=>setGradeInput(e.target.value)} placeholder="eg: 10" required/></label>
          <label className="inlineSettingRow"><span>Class</span><input value={classInput} onChange={e=>setClassInput(e.target.value)} placeholder="eg: A (Optional)"/></label>
          <div className="gradeClassPreview"><small>Output</small><strong>{previewOutput}</strong></div>
          <button type="submit">Add Grade{classInput.trim()?" & Class":""}</button>
        </form>
      </details>

      <details className="settingsAccordion">
        <summary><span><Icon name="profile"/>Add Teacher</span><b>⌄</b></summary>
        <form className="accordionBody" onSubmit={addTeacher}>
          <input name="full_name" placeholder="Teacher full name" required/>
          <input name="username" placeholder="Username" required/>
          <input name="password" placeholder="Temporary password" minLength={4} required/>
          <label>Assigned Class <span className="optionalText">Optional</span><select name="class_id"><option value="">No class assigned</option>{classes.map(c=><option value={c.id} key={c.id}>{c.display_name}</option>)}</select></label>
          <button>Add Teacher</button>
        </form>
      </details>

      <details className="settingsAccordion">
        <summary><span><Icon name="students"/>Teachers List</span><span className="countPill">{teachers.length}</span></summary>
        <div className="accordionBody teacherListCard">
          <p className="settingsHint">Passwords are not stored in readable form. Set a new temporary password whenever a teacher needs one.</p>
          {teachers.length?teachers.map(t=><div className="teacherAccountRow" key={t.id}>
            <div className="teacherAccountInfo">
              <div className="teacherAccountTop"><b>{t.full_name}</b><span className={t.active?"status done":"status pending"}>{t.active?"Active":"Inactive"}</span></div>
              <span className="teacherMeta">@{t.username}</span>
              <span className="teacherMeta">{t.class_names?("Class: "+t.class_names):"No class assigned"}</span>
            </div>
            <form className="teacherPasswordReset" onSubmit={e=>resetTeacherPassword(t.id,e)}>
              <input name="password" type="text" minLength={4} placeholder="New temporary password" required/>
              <button type="submit">Reset Password</button>
            </form>
          </div>):<div className="emptyState"><Icon name="profile"/><b>No teachers added</b><span>Teachers you create will appear here.</span></div>}
        </div>
      </details>
    </div>
  </div>
}

function Icon({name}:{name:string}){const paths:Record<string,any>={home:<><path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10.5V20h13v-9.5"/><path d="M9.5 20v-6h5v6"/></>,check:<><path d="M9 11l2 2 4-4"/><path d="M5 4h14v16H5z"/><path d="M8 7h8"/></>,history:<><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l3 2"/></>,manage:<><path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h16"/><circle cx="8" cy="6" r="2"/><circle cx="16" cy="12" r="2"/><circle cx="10" cy="18" r="2"/></>,profile:<><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>,logout:<><path d="M10 5H5v14h5"/><path d="M13 8l4 4-4 4"/><path d="M17 12H9"/></>,students:<><circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 20c.5-4 3-6 6-6s5.5 2 6 6"/><path d="M14 15c3-.5 6 1 7 5"/></>,present:<><circle cx="12" cy="12" r="9"/><path d="m8 12 2.5 2.5L16 9"/></>,absent:<><circle cx="12" cy="12" r="9"/><path d="m9 9 6 6m0-6-6 6"/></>,classes:<><path d="M4 5h16v14H4z"/><path d="M8 9h8M8 13h5"/></>,calendar:<><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4m8-4v4M3 10h18"/></>,settings:<><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6 1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z"/></>,school:<><path d="m3 10 9-5 9 5-9 5-9-5Z"/><path d="M7 13v4c3 2 7 2 10 0v-4"/><path d="M21 10v6"/></>};return <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]||paths.home}</svg>}

function PrivacyPage({isAdmin}:{isAdmin:boolean}){const[policy,setPolicy]=useState(""),[requests,setRequests]=useState<any[]>([]),[message,setMessage]=useState("");async function review(id:number,status:string){try{await api("/api/privacy/requests/"+id,{method:"PATCH",body:JSON.stringify({status})});setRequests(await api("/api/privacy/requests"));setMessage("Request status updated.")}catch(e:any){setMessage(e.message)}}useEffect(()=>{api("/api/privacy").then(r=>setPolicy(r.policy)).catch(e=>setMessage(e.message));if(isAdmin)api("/api/privacy/requests").then(setRequests).catch(e=>setMessage(e.message))},[isAdmin]);async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();try{const f=new FormData(e.currentTarget);await api("/api/privacy/requests",{method:"POST",body:JSON.stringify({type:f.get("type"),details:f.get("details")})});setMessage("Request received. Contact your school administrator for follow-up.");(e.currentTarget as HTMLFormElement).reset()}catch(x:any){setMessage(x.message)}}return <div className="card sectionCard"><h2>Privacy and data requests</h2><p>{policy||"Loading privacy information…"}</p><p className="settingsHint">This is a draft notice and does not replace the official privacy policy.</p><form onSubmit={submit}><label>Request type<select name="type"><option value="ACCESS">Access my data</option><option value="CORRECTION">Request correction</option><option value="ERASURE">Request erasure</option></select></label><label>Details<textarea name="details" maxLength={2000} required/></label><button className="primaryAction">Submit request</button></form>{message&&<p role="status">{message}</p>}{isAdmin&&<section><h3>School privacy requests</h3>{requests.map(r=><div className="row" key={r.id}>{r.request_type} · {r.status} · {r.created_at} {r.status!=="COMPLETED"&&r.status!=="DENIED"&&<button type="button" onClick={()=>review(r.id,"IN_REVIEW")}>Review</button>}</div>)}</section>}</div>}

function SecurityPage(){const[rows,setRows]=useState<any[]>([]),[message,setMessage]=useState("");async function load(){try{setRows(await api("/api/sessions"))}catch(e:any){setMessage(e.message)}}useEffect(()=>{load()},[]);async function revoke(id:number){try{await api("/api/sessions/"+id,{method:"DELETE"});setMessage("Session revoked.");await load()}catch(e:any){setMessage(e.message)}}return <div className="card sectionCard"><h2>Active sessions</h2><p>Review and revoke signed-in sessions. Sessions also expire after inactivity.</p>{message&&<p role="status">{message}</p>}{rows.map(r=><div className="row" key={r.id}><div><b>Session #{r.id}</b><small>Last activity: {r.last_seen_at}</small></div><button type="button" onClick={()=>revoke(r.id)}>Revoke</button></div>)}</div>}
