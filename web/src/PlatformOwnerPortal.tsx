import {FormEvent,useCallback,useEffect,useState} from "react";
const API=import.meta.env.VITE_API_BASE_URL||"http://localhost:8787";
type School={id:number;name:string;short_name:string|null;verification_status:string;created_at:string;verification_reviewed_at:string|null;users_count:number;students_count:number};
type Totals={total:number;pending:number;approved:number;suspended:number;rejected:number};
type Audit={id:number;action:string;school_id:number|null;details:string|null;created_at:string};
export default function PlatformOwnerPortal(){
  // Intentionally memory-only: no owner token in localStorage, sessionStorage or APK settings.
  const[token,setToken]=useState("");
  const[password,setPassword]=useState("");
  const[busy,setBusy]=useState(false);
  const[error,setError]=useState("");
  const[overview,setOverview]=useState<Totals|null>(null);
  const[schools,setSchools]=useState<School[]>([]);
  const[audit,setAudit]=useState<Audit[]>([]);
  const[status,setStatus]=useState("ALL");
  const[search,setSearch]=useState("");
  const[query,setQuery]=useState("");
  const[offset,setOffset]=useState(0);
  const[selected,setSelected]=useState<School|null>(null);
  const[decision,setDecision]=useState("APPROVED");
  const[note,setNote]=useState("");
  const[tab,setTab]=useState<"schools"|"activity">("schools");
  const[notice,setNotice]=useState("");
  const request=useCallback(async(path:string,method="GET",body?:unknown,authToken=token)=>{
    const response=await fetch(API+path,{method,headers:{"Content-Type":"application/json",...(authToken?{"Authorization":"Bearer "+authToken}:{})},body:body?JSON.stringify(body):undefined,cache:"no-store"});
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw Error(data.error||"Request failed");
    return data;
  },[token]);
  const load=useCallback(async()=>{
    if(!token)return;
    setBusy(true);setError("");
    try{
      const params=new URLSearchParams({status,search:query,offset:String(offset),limit:"50"});
      const [stats,list,events]=await Promise.all([request("/api/owner/overview"),request("/api/owner/schools?"+params),request("/api/owner/audit")]);
      setOverview(stats);setSchools(list.schools||[]);setAudit(events||[]);
    }catch(e:any){setError(e.message);if(String(e.message).includes("session expired"))setToken("")}
    finally{setBusy(false)}
  },[token,status,query,offset,request]);
  useEffect(()=>{void load()},[load]);
  async function signIn(e:FormEvent<HTMLFormElement>){
    e.preventDefault();setBusy(true);setError("");
    try{const data=await request("/api/owner/login","POST",{password},"");setToken(data.token);setPassword("")}
    catch(e:any){setError(e.message)}
    finally{setBusy(false)}
  }
  async function signOut(){try{await request("/api/owner/logout","POST")}catch{}setToken("");setOverview(null);setSchools([]);setAudit([])}
  async function applyDecision(e:FormEvent<HTMLFormElement>){
    e.preventDefault();if(!selected)return;
    setBusy(true);setError("");setNotice("");
    try{await request("/api/owner/schools/"+selected.id+"/decision","POST",{status:decision,note});
      setNotice(selected.name+" changed to "+decision+".");setSelected(null);setNote("");await load();
    }catch(e:any){setError(e.message)}finally{setBusy(false)}
  }
  const fmt=(date:string)=>date?new Date(date.replace(" ","T")+"Z").toLocaleDateString():"—";
  return <main className="ownerPortal">
    <header className="ownerHeader"><div className="ownerLogo">M</div><div><strong>Maestro</strong><small>Platform Owner Console</small></div><span className="ownerHeaderSpace"/>{token&&<button className="ownerOutline" onClick={()=>void signOut()}>Sign out</button>}</header>
    {!token?<section className="ownerLogin"><div className="ownerLoginIcon">M</div><span className="ownerEyebrow">Restricted access</span><h1>Platform owner sign in</h1><p>Manage registered schools and verification requests. This is separate from school administrator accounts.</p><form onSubmit={signIn}><label>Owner password<input type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} minLength={10} required/></label>{error&&<p className="ownerError" role="alert">{error}</p>}<button className="ownerPrimary" disabled={busy||!password}>{busy?"Signing in…":"Secure sign in"}</button></form><small>Owner credentials must be configured on the Cloudflare Worker before this portal can be used.</small></section>
    :<div className="ownerBody">
      <div className="ownerIntro"><div><span className="ownerEyebrow">Overview</span><h1>School management</h1><p>Review and manage schools across Maestro without opening their student records.</p></div><button className="ownerOutline" disabled={busy} onClick={()=>void load()}>↻ Refresh</button></div>
      {notice&&<p className="ownerNotice" role="status">{notice}</p>}{error&&<p className="ownerError" role="alert">{error}</p>}
      <div className="ownerMetrics">{([{key:"total",label:"All schools"},{key:"pending",label:"Awaiting approval"},{key:"approved",label:"Approved"},{key:"suspended",label:"Suspended"}] as const).map(x=><div className="ownerMetric" key={x.key}><small>{x.label}</small><strong>{overview?.[x.key]??"—"}</strong></div>)}</div>
      <div className="ownerTabs"><button className={tab==="schools"?"selected":""} onClick={()=>setTab("schools")}>Schools</button><button className={tab==="activity"?"selected":""} onClick={()=>setTab("activity")}>Audit activity</button></div>
      {tab==="schools"?<section className="ownerPanel"><div className="ownerPanelHeading"><div><h2>Registered schools</h2><p>Approve, reject or suspend school access.</p></div></div><div className="ownerFilters"><form onSubmit={e=>{e.preventDefault();setOffset(0);setQuery(search)}}><input aria-label="Search school name" placeholder="Search school name…" value={search} onChange={e=>setSearch(e.target.value)}/><button type="submit">Search</button></form><select aria-label="Filter schools by status" value={status} onChange={e=>{setStatus(e.target.value);setOffset(0)}}>{["ALL","PENDING","APPROVED","REJECTED","SUSPENDED"].map(v=><option key={v} value={v}>{v==="ALL"?"All statuses":v}</option>)}</select></div>
        <div className="ownerSchoolList">{schools.map(s=><article className="ownerSchool" key={s.id}><div className="ownerSchoolIcon">{s.name.slice(0,1).toUpperCase()}</div><div className="ownerSchoolInfo"><strong>{s.name}</strong><small>School #{s.id} · Registered {fmt(s.created_at)}</small><span>{s.users_count} active staff · {s.students_count} students</span></div><div className="ownerSchoolActions"><span className={"ownerStatus "+s.verification_status.toLowerCase()}>{s.verification_status}</span><button className="ownerOutline" onClick={()=>{setSelected(s);setDecision(s.verification_status==="PENDING"?"APPROVED":s.verification_status==="APPROVED"?"SUSPENDED":"APPROVED");setNote("")}}>Manage</button></div></article>)}{!schools.length&&<div className="ownerEmpty">No schools match your filter.</div>}</div>
        <div className="ownerPager"><button className="ownerOutline" disabled={busy||offset===0} onClick={()=>setOffset(Math.max(0,offset-50))}>Previous</button><small>Showing {schools.length?offset+1:0}–{offset+schools.length}</small><button className="ownerOutline" disabled={busy||schools.length<50} onClick={()=>setOffset(offset+50)}>Next</button></div>
      </section>:<section className="ownerPanel"><h2>Recent platform activity</h2><p className="ownerMuted">Latest 50 owner actions.</p>{audit.map(a=><div className="ownerAudit" key={a.id}><strong>{a.action.replace(/_/g," ")}</strong><small>{a.school_id?"School #"+a.school_id+" · ":""}{fmt(a.created_at)}</small>{a.details&&<p>{a.details}</p>}</div>)}{!audit.length&&<div className="ownerEmpty">No activity recorded yet.</div>}</section>}
      {selected&&<div className="ownerModalBackdrop" role="presentation"><section className="ownerModal" role="dialog" aria-modal="true" aria-labelledby="ownerDecisionTitle"><div className="ownerPanelHeading"><div><span className="ownerEyebrow">School verification</span><h2 id="ownerDecisionTitle">{selected.name}</h2></div><button className="ownerOutline" onClick={()=>setSelected(null)}>Close</button></div><p>Current status: <b>{selected.verification_status}</b>. Changing to rejected or suspended revokes the school's active sessions.</p><form onSubmit={applyDecision}><label>Decision<select value={decision} onChange={e=>setDecision(e.target.value)}>{["APPROVED","REJECTED","SUSPENDED"].filter(v=>v!==selected.verification_status).map(v=><option key={v} value={v}>{v}</option>)}</select></label><label>Reason / review note<textarea rows={3} maxLength={500} placeholder="Explain the verification decision" value={note} onChange={e=>setNote(e.target.value)} required={decision!=="APPROVED"}/></label><button className="ownerPrimary" disabled={busy||decision===selected.verification_status} type="submit">Confirm {decision.toLowerCase()}</button></form></section></div>}
    </div>}
  </main>;
}
