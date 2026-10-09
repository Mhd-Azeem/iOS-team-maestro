// Dedicated platform-owner API. No school user or school session can access these endpoints.
// Secrets are configured in Worker environment; never embedded in frontend or APK.
export interface OwnerEnv {
  DB: D1Database;
  PLATFORM_OWNER_PASSWORD_SALT?: string;
  PLATFORM_OWNER_PASSWORD_HASH?: string;
  PLATFORM_ALLOWED_ORIGIN?: string;
}
const response=(value:unknown,status=200)=>new Response(JSON.stringify(value),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store","access-control-allow-origin":"null"}});
const failure=(message:string,status=400)=>response({error:message},status);
const bytesToHex=(a:Uint8Array)=>Array.from(a).map(x=>x.toString(16).padStart(2,"0")).join("");
async function digest(s:string){return bytesToHex(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(s))))}
async function derive(password:string,saltHex:string){
  if(!/^[0-9a-f]{32}$/i.test(saltHex))throw Error("Owner password salt configuration is invalid");
  const salt=new Uint8Array((saltHex.match(/../g)||[]).map(x=>parseInt(x,16)));
  const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(password),"PBKDF2",false,["deriveBits"]);
  return bytesToHex(new Uint8Array(await crypto.subtle.deriveBits({name:"PBKDF2",hash:"SHA-256",salt,iterations:210000},key,256)));
}
function safeEqual(a:string,b:string){
  if(a.length!==b.length)return false;
  let difference=0;for(let i=0;i<a.length;i++)difference|=a.charCodeAt(i)^b.charCodeAt(i);
  return difference===0;
}
async function authorized(req:Request,env:OwnerEnv){
  const bearer=req.headers.get("authorization");
  if(!bearer?.startsWith("Bearer "))return false;
  const token=bearer.slice(7);
  if(!/^[0-9a-f]{64}$/i.test(token))return false;
  const row=await env.DB.prepare("SELECT token_hash FROM platform_owner_sessions WHERE token_hash=? AND expires_at>datetime('now')").bind(await digest(token)).first();
  return !!row;
}
export async function handleOwnerRequest(req:Request,env:OwnerEnv,url:URL):Promise<Response>{
  if(!env.PLATFORM_ALLOWED_ORIGIN || !env.PLATFORM_OWNER_PASSWORD_HASH || !env.PLATFORM_OWNER_PASSWORD_SALT){
    return failure("Platform owner portal is not configured.",503);
  }
  const origin=req.headers.get("origin");
  if(origin!==env.PLATFORM_ALLOWED_ORIGIN)return failure("Platform portal origin is not authorized.",403);
  const headers={"access-control-allow-origin":origin,"vary":"Origin","cache-control":"no-store"};
  const send=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{...headers,"content-type":"application/json; charset=utf-8"}});
  const deny=(message:string,status=400)=>send({error:message},status);
  if(req.method==="OPTIONS")return new Response(null,{status:204,headers:{...headers,"access-control-allow-headers":"Authorization, Content-Type","access-control-allow-methods":"GET,POST,DELETE,OPTIONS"}});
  const path=url.pathname;
  if(path==="/api/owner/login" && req.method==="POST"){
    // Per-client windowed rate limit in D1. Apply Cloudflare WAF rate limits as defense in depth.
    const fingerprint=await digest((req.headers.get("cf-connecting-ip")||"unknown")+"|platform-owner");
    await env.DB.prepare("INSERT OR IGNORE INTO platform_login_attempts(fingerprint) VALUES(?)").bind(fingerprint).run();
    await env.DB.prepare("UPDATE platform_login_attempts SET attempts=0,window_start=CURRENT_TIMESTAMP WHERE fingerprint=? AND window_start<datetime('now','-15 minutes')").bind(fingerprint).run();
    const attempt=await env.DB.prepare("SELECT attempts FROM platform_login_attempts WHERE fingerprint=?").bind(fingerprint).first<{attempts:number}>();
    if((attempt?.attempts||0)>=5)return deny("Too many attempts. Try again in 15 minutes.",429);
    const body=await req.json().catch(()=>({})) as {password?:string};
    const password=typeof body.password==="string"?body.password:"";
    const hash=await derive(password,env.PLATFORM_OWNER_PASSWORD_SALT);
    if(!safeEqual(hash,env.PLATFORM_OWNER_PASSWORD_HASH.toLowerCase())){
      await env.DB.prepare("UPDATE platform_login_attempts SET attempts=attempts+1 WHERE fingerprint=?").bind(fingerprint).run();
      return deny("Invalid platform owner credentials.",401);
    }
    await env.DB.prepare("UPDATE platform_login_attempts SET attempts=0 WHERE fingerprint=?").bind(fingerprint).run();
    const token=bytesToHex(crypto.getRandomValues(new Uint8Array(32)));
    await env.DB.prepare("INSERT INTO platform_owner_sessions(token_hash,expires_at) VALUES(?,datetime('now','+30 minutes'))").bind(await digest(token)).run();
    await env.DB.prepare("INSERT INTO platform_owner_audit(action,details) VALUES('LOGIN','Owner signed in')").run();
    return send({token,expiresInMinutes:30});
  }
  if(!await authorized(req,env))return deny("Platform owner session expired. Sign in again.",401);
  if(path==="/api/owner/logout" && req.method==="POST"){
    const token=req.headers.get("authorization")!.slice(7);
    await env.DB.prepare("DELETE FROM platform_owner_sessions WHERE token_hash=?").bind(await digest(token)).run();
    return send({ok:true});
  }
  if(path==="/api/owner/overview" && req.method==="GET"){
    const totals=await env.DB.prepare("SELECT COUNT(*) total,SUM(CASE WHEN verification_status='PENDING' THEN 1 ELSE 0 END) pending,SUM(CASE WHEN verification_status='APPROVED' THEN 1 ELSE 0 END) approved,SUM(CASE WHEN verification_status='SUSPENDED' THEN 1 ELSE 0 END) suspended,SUM(CASE WHEN verification_status='REJECTED' THEN 1 ELSE 0 END) rejected FROM schools").first();
    return send(totals||{});
  }
  if(path==="/api/owner/schools" && req.method==="GET"){
    const allowed=["ALL","PENDING","APPROVED","REJECTED","SUSPENDED"];
    const status=(url.searchParams.get("status")||"ALL").toUpperCase();
    if(!allowed.includes(status))return deny("Invalid status filter.");
    const search=(url.searchParams.get("search")||"").trim().slice(0,80);
    const limit=Math.min(100,Math.max(1,Number(url.searchParams.get("limit"))||50));
    const offset=Math.max(0,Math.min(100000,Number(url.searchParams.get("offset"))||0));
    const pattern="%"+search.replace(/[\\%_]/g,"\\$&")+"%";
    const rows=await env.DB.prepare(`SELECT s.id,s.name,s.short_name,s.verification_status,s.created_at,s.verification_reviewed_at,
      (SELECT COUNT(*) FROM users u WHERE u.school_id=s.id AND u.active=1) users_count,
      (SELECT COUNT(*) FROM students st WHERE st.school_id=s.id) students_count
      FROM schools s WHERE (?='ALL' OR s.verification_status=?) AND s.name LIKE ? ESCAPE '\\'
      ORDER BY CASE WHEN s.verification_status='PENDING' THEN 0 ELSE 1 END,s.created_at DESC,s.id DESC LIMIT ? OFFSET ?`).bind(status,status,pattern,limit,offset).all();
    return send({schools:rows.results,limit,offset});
  }
  const match=/^\/api\/owner\/schools\/(\d+)\/decision$/.exec(path);
  if(match && req.method==="POST"){
    const id=Number(match[1]);
    const body=await req.json().catch(()=>({})) as {status?:string;note?:string};
    const status=String(body.status||"").toUpperCase();
    const note=String(body.note||"").trim().slice(0,500);
    if(!["APPROVED","REJECTED","SUSPENDED"].includes(status))return deny("Invalid school decision.");
    if(status!=="APPROVED" && note.length<5)return deny("Provide a reason for rejecting or suspending a school.");
    const current=await env.DB.prepare("SELECT id,verification_status FROM schools WHERE id=?").bind(id).first<{id:number;verification_status:string}>();
    if(!current)return deny("School not found.",404);
    if(current.verification_status===status)return deny("School already has that status.",409);
    // Single transaction for status change, revoked sessions and audit history.
    const statements=[
      env.DB.prepare("UPDATE schools SET verification_status=?,verification_reviewed_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(status,id),
      env.DB.prepare("INSERT INTO platform_approval_events(school_id,status,note) VALUES(?,?,?)").bind(id,status,note),
      env.DB.prepare("INSERT INTO platform_owner_audit(action,school_id,details) VALUES(?,?,?)").bind("SCHOOL_"+status,id,note)
    ];
    if(status!=="APPROVED")statements.push(env.DB.prepare("DELETE FROM sessions WHERE school_id=?").bind(id));
    await env.DB.batch(statements);
    return send({ok:true,id,status});
  }
  if(path==="/api/owner/audit" && req.method==="GET"){
    const rows=await env.DB.prepare("SELECT id,action,school_id,details,created_at FROM platform_owner_audit ORDER BY id DESC LIMIT 50").all();
    return send(rows.results);
  }
  return deny("Not found.",404);
}
