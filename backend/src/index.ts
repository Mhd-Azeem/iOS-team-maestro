export interface Env {
  DB: D1Database;
}

type Auth = {
  userId: number;
  schoolId: number;
  role: string;
  fullName: string;
  username: string;
};

const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "Authorization, Content-Type",
  "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS"
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...corsHeaders
    }
  });
}

function fail(message: string, status = 400): Response {
  return json({ error: message }, status);
}

function hex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return hex(new Uint8Array(digest));
}

async function passwordHash(password: string, saltHex: string): Promise<string> {
  const parts = saltHex.match(/../g) || [];
  const salt = new Uint8Array(parts.map((x) => parseInt(x, 16)));
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: 100000 },
    key,
    256
  );
  return hex(new Uint8Array(bits));
}

async function requestBody(req: Request): Promise<any> {
  return await req.json() as any;
}

async function createSession(env: Env, userId: number, schoolId: number): Promise<string> {
  const token = hex(crypto.getRandomValues(new Uint8Array(32)));
  await env.DB.prepare(
    "INSERT INTO sessions(user_id,school_id,token_hash,expires_at) VALUES(?,?,?,datetime('now','+30 days'))"
  ).bind(userId, schoolId, await sha256(token)).run();
  return token;
}

async function authenticate(req: Request, env: Env): Promise<Auth | null> {
  const header = req.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  const tokenHash = await sha256(header.slice(7));
  return await env.DB.prepare(
    `SELECT u.id userId,u.school_id schoolId,u.role,u.full_name fullName,u.username
     FROM sessions s
     JOIN users u ON u.id=s.user_id
     JOIN schools sc ON sc.id=u.school_id
     WHERE s.token_hash=?
       AND s.expires_at>datetime('now')
       AND u.active=1
       AND sc.active=1`
  ).bind(tokenHash).first<Auth>() || null;
}

function isAdmin(auth: Auth): boolean {
  return ["SUPER_ADMIN", "SCHOOL_ADMIN", "SECTION_HEAD"].includes(auth.role);
}

async function classAllowed(env: Env, auth: Auth, classId: number): Promise<boolean> {
  if (auth.role !== "TEACHER") {
    return !!await env.DB.prepare(
      "SELECT id FROM classes WHERE id=? AND school_id=? AND active=1"
    ).bind(classId, auth.schoolId).first();
  }
  return !!await env.DB.prepare(
    `SELECT 1
     FROM teacher_class_assignments t
     JOIN classes c ON c.id=t.class_id
     WHERE t.school_id=? AND t.teacher_id=? AND t.class_id=? AND c.active=1`
  ).bind(auth.schoolId, auth.userId, classId).first();
}

async function registerSchool(req: Request, env: Env): Promise<Response> {
  const b = await requestBody(req);
  const schoolName = String(b.schoolName || "").trim();
  const adminName = String(b.adminName || "").trim();
  const username = String(b.username || "").trim();
  const password = String(b.password || "");

  if (!schoolName || !adminName || !username || !password) {
    return fail("School name, administrator name, username and password are required.");
  }
  if (password.length < 6) return fail("Password must be at least 6 characters.");

  const existing = await env.DB.prepare(
    "SELECT id FROM users WHERE username=? COLLATE NOCASE LIMIT 1"
  ).bind(username).first();
  if (existing) return fail("This username is already in use.", 409);

  let schoolId: number | undefined;
  try {
    const school = await env.DB.prepare(
      "INSERT INTO schools(name,short_name,motto,app_name) VALUES(?,?,?,?)"
    ).bind(
      schoolName,
      String(b.shortName || "").trim() || null,
      String(b.motto || "").trim() || null,
      String(b.appName || "School Attendance App").trim() || "School Attendance App"
    ).run();

    schoolId = Number(school.meta.last_row_id);
    if (!schoolId) throw new Error("School creation failed");

    const salt = hex(crypto.getRandomValues(new Uint8Array(16)));
    const hash = await passwordHash(password, salt);
    const user = await env.DB.prepare(
      `INSERT INTO users(school_id,full_name,username,password_hash,password_salt,role)
       VALUES(?,?,?,?,?,'SCHOOL_ADMIN')`
    ).bind(schoolId, adminName, username, hash, salt).run();

    const userId = Number(user.meta.last_row_id);
    if (!userId) throw new Error("Administrator creation failed");

    await env.DB.prepare(
      "INSERT OR IGNORE INTO school_settings(school_id) VALUES(?)"
    ).bind(schoolId).run();

    return json({ token: await createSession(env, userId, schoolId) }, 201);
  } catch (error) {
    console.error("Registration failed", error);
    if (schoolId) {
      try {
        await env.DB.prepare("DELETE FROM school_settings WHERE school_id=?").bind(schoolId).run();
        await env.DB.prepare("DELETE FROM users WHERE school_id=?").bind(schoolId).run();
        await env.DB.prepare("DELETE FROM schools WHERE id=?").bind(schoolId).run();
      } catch (cleanupError) {
        console.error("Registration cleanup failed", cleanupError);
      }
    }
    return fail("Registration could not be completed.", 500);
  }
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const url = new URL(req.url);
    const path = url.pathname;

    try {
      if (path === "/api/health" && req.method === "GET") {
        return json({ ok: true, service: "maestro-school-attendance-api" });
      }

      if (path === "/api/public/status" && req.method === "GET") {
        const row = await env.DB.prepare("SELECT COUNT(*) count FROM schools WHERE active=1").first<{count:number}>();
        return json({ initialized: (row?.count || 0) > 0, registrationOpen: true });
      }

      if (path === "/api/register" && req.method === "POST") {
        return await registerSchool(req, env);
      }

      if (path === "/api/public/setup" && req.method === "POST") {
        return await registerSchool(req, env);
      }

      if (path === "/api/login" && req.method === "POST") {
        const b = await requestBody(req);
        const username = String(b.username || "").trim();
        const password = String(b.password || "");
        const user = await env.DB.prepare(
          `SELECT u.*,s.active school_active
           FROM users u
           JOIN schools s ON s.id=u.school_id
           WHERE u.username=? COLLATE NOCASE
           LIMIT 1`
        ).bind(username).first<any>();

        if (!user || !user.active || !user.school_active) {
          return fail("Invalid username or password.", 401);
        }

        const hash = await passwordHash(password, String(user.password_salt));
        if (hash !== user.password_hash) return fail("Invalid username or password.", 401);

        return json({ token: await createSession(env, user.id, user.school_id) });
      }

      const auth = await authenticate(req, env);
      if (!auth) return fail("Please sign in to continue.", 401);

      if (path === "/api/logout" && req.method === "POST") {
        const token = req.headers.get("authorization")!.slice(7);
        await env.DB.prepare("DELETE FROM sessions WHERE token_hash=?")
          .bind(await sha256(token)).run();
        return json({ ok: true });
      }

      if (path === "/api/me" && req.method === "GET") {
        const school = await env.DB.prepare(
          `SELECT id,name,short_name,motto,logo_url,app_name,
                  primary_color,secondary_color,accent_color,background_color
           FROM schools WHERE id=?`
        ).bind(auth.schoolId).first();
        return json({
          user: {
            id: auth.userId,
            full_name: auth.fullName,
            username: auth.username,
            role: auth.role
          },
          school
        });
      }

      if (path === "/api/dashboard" && req.method === "GET") {
        const date = new Date().toISOString().slice(0, 10);
        const total = await env.DB.prepare(
          "SELECT COUNT(*) count FROM students WHERE school_id=? AND status='ACTIVE'"
        ).bind(auth.schoolId).first<{count:number}>();
        const present = await env.DB.prepare(
          `SELECT COUNT(*) count
           FROM attendance_records r
           JOIN attendance_sessions s ON s.id=r.session_id
           WHERE r.school_id=? AND s.date=? AND r.status='PRESENT'`
        ).bind(auth.schoolId, date).first<{count:number}>();
        const absent = await env.DB.prepare(
          `SELECT COUNT(*) count
           FROM attendance_records r
           JOIN attendance_sessions s ON s.id=r.session_id
           WHERE r.school_id=? AND s.date=? AND r.status='ABSENT'`
        ).bind(auth.schoolId, date).first<{count:number}>();

        let classSql = `SELECT c.id,c.display_name,
          CASE WHEN s.id IS NULL THEN 0 ELSE 1 END submitted
          FROM classes c
          LEFT JOIN attendance_sessions s
            ON s.class_id=c.id AND s.date=? AND s.school_id=c.school_id
          WHERE c.school_id=? AND c.active=1`;
        const args: any[] = [date, auth.schoolId];
        if (auth.role === "TEACHER") {
          classSql += " AND c.id IN (SELECT class_id FROM teacher_class_assignments WHERE school_id=? AND teacher_id=?)";
          args.push(auth.schoolId, auth.userId);
        }
        classSql += " ORDER BY c.display_name";

        const classes = await env.DB.prepare(classSql).bind(...args).all<any>();
        return json({
          totalStudents: total?.count || 0,
          presentToday: present?.count || 0,
          absentToday: absent?.count || 0,
          submitted: classes.results.filter((x) => x.submitted).length,
          totalClasses: classes.results.length,
          pending: classes.results.filter((x) => !x.submitted)
        });
      }

      if (path === "/api/grades" && req.method === "GET") {
        const rows = await env.DB.prepare(
          "SELECT id,name,sort_order FROM grades WHERE school_id=? AND active=1 ORDER BY sort_order,name"
        ).bind(auth.schoolId).all();
        return json(rows.results);
      }

      if (path === "/api/grades" && req.method === "POST") {
        if (!isAdmin(auth)) return fail("You do not have permission to manage grades.", 403);
        const b = await requestBody(req);
        const name = String(b.name || "").trim();
        if (!name) return fail("Grade name is required.");
        try {
          const result = await env.DB.prepare(
            "INSERT INTO grades(school_id,name) VALUES(?,?)"
          ).bind(auth.schoolId, name).run();
          return json({ id: result.meta.last_row_id }, 201);
        } catch {
          return fail("This grade already exists.", 409);
        }
      }

      if (path === "/api/classes" && req.method === "GET") {
        let sql = `SELECT c.id,c.grade_id,c.name,c.display_name,c.academic_year,g.name grade_name
                   FROM classes c
                   LEFT JOIN grades g ON g.id=c.grade_id
                   WHERE c.school_id=? AND c.active=1`;
        const args: any[] = [auth.schoolId];
        if (auth.role === "TEACHER") {
          sql += " AND c.id IN (SELECT class_id FROM teacher_class_assignments WHERE school_id=? AND teacher_id=?)";
          args.push(auth.schoolId, auth.userId);
        }
        sql += " ORDER BY c.display_name";
        const rows = await env.DB.prepare(sql).bind(...args).all();
        return json(rows.results);
      }

      if (path === "/api/classes" && req.method === "POST") {
        if (!isAdmin(auth)) return fail("You do not have permission to manage classes.", 403);
        const b = await requestBody(req);
        const name = String(b.name || "").trim();
        const displayName = String(b.display_name || "").trim();
        const gradeId = Number(b.grade_id || 0);
        if (!gradeId) return fail("Please select a grade before creating a class.");
        if (!name || !displayName) return fail("Class name and display name are required.");
        const grade = await env.DB.prepare(
          "SELECT id FROM grades WHERE id=? AND school_id=? AND active=1"
        ).bind(gradeId, auth.schoolId).first();
        if (!grade) return fail("Invalid grade.");
        const result = await env.DB.prepare(
          "INSERT INTO classes(school_id,grade_id,name,display_name,academic_year) VALUES(?,?,?,?,?)"
        ).bind(
          auth.schoolId,
          gradeId,
          name,
          displayName,
          String(b.academic_year || "").trim() || null
        ).run();
        return json({ id: result.meta.last_row_id }, 201);
      }

      if (path === "/api/students" && req.method === "GET") {
        const classParam = url.searchParams.get("class_id");
        const classId = classParam ? Number(classParam) : 0;
        if (classId && !await classAllowed(env, auth, classId)) {
          return fail("You do not have permission to view this class.", 403);
        }

        let sql = `SELECT s.id,s.admission_number,s.full_name,s.grade_id,s.class_id,
                          g.name grade_name,c.display_name class_name
                   FROM students s
                   LEFT JOIN grades g ON g.id=s.grade_id
                   LEFT JOIN classes c ON c.id=s.class_id
                   WHERE s.school_id=? AND s.status='ACTIVE'`;
        const args: any[] = [auth.schoolId];
        if (classId) {
          sql += " AND s.class_id=?";
          args.push(classId);
        } else if (auth.role === "TEACHER") {
          sql += " AND s.class_id IN (SELECT class_id FROM teacher_class_assignments WHERE school_id=? AND teacher_id=?)";
          args.push(auth.schoolId, auth.userId);
        }
        sql += " ORDER BY COALESCE(c.display_name,''),s.admission_number";
        const rows = await env.DB.prepare(sql).bind(...args).all();
        return json(rows.results);
      }

      if (path === "/api/students" && req.method === "POST") {
        if (!isAdmin(auth)) return fail("You do not have permission to add students.", 403);
        const b = await requestBody(req);
        const admission = String(b.admission_number || "").trim();
        const fullName = String(b.full_name || "").trim();
        if (!admission || !fullName) return fail("Admission number and student name are required.");

        let gradeId: number | null = b.grade_id ? Number(b.grade_id) : null;
        const classId: number | null = b.class_id ? Number(b.class_id) : null;

        if (classId) {
          const cls = await env.DB.prepare(
            "SELECT grade_id FROM classes WHERE id=? AND school_id=? AND active=1"
          ).bind(classId, auth.schoolId).first<{grade_id:number|null}>();
          if (!cls) return fail("Invalid class.");
          if (!gradeId) gradeId = cls.grade_id || null;
        } else if (gradeId) {
          const grade = await env.DB.prepare(
            "SELECT id FROM grades WHERE id=? AND school_id=? AND active=1"
          ).bind(gradeId, auth.schoolId).first();
          if (!grade) return fail("Invalid grade.");
        }

        try {
          const result = await env.DB.prepare(
            "INSERT INTO students(school_id,admission_number,full_name,grade_id,class_id) VALUES(?,?,?,?,?)"
          ).bind(auth.schoolId, admission, fullName, gradeId, classId).run();
          return json({ id: result.meta.last_row_id }, 201);
        } catch {
          return fail("This admission number already exists.", 409);
        }
      }

      if (path === "/api/students/bulk" && req.method === "POST") {
        if (!isAdmin(auth)) return fail("You do not have permission to add students.", 403);
        const b = await requestBody(req);
        const rows = Array.isArray(b.students) ? b.students : [];
        if (!rows.length) return fail("Add at least one student.");
        if (rows.length > 500) return fail("A maximum of 500 students can be added at once.");

        const seen = new Set<string>();
        const prepared: D1PreparedStatement[] = [];

        for (const item of rows) {
          const admission = String(item.admission_number || "").trim();
          const fullName = String(item.full_name || "").trim();
          if (!admission || !fullName) return fail("Every row needs an admission number and student name.");

          const duplicateKey = admission.toLowerCase();
          if (seen.has(duplicateKey)) return fail("Duplicate admission number in bulk list: " + admission);
          seen.add(duplicateKey);

          let gradeId: number | null = item.grade_id ? Number(item.grade_id) : null;
          const classId: number | null = item.class_id ? Number(item.class_id) : null;

          if (classId) {
            const cls = await env.DB.prepare(
              "SELECT grade_id FROM classes WHERE id=? AND school_id=? AND active=1"
            ).bind(classId, auth.schoolId).first<{grade_id:number|null}>();
            if (!cls) return fail("Invalid class for " + admission + ".");
            if (!gradeId) gradeId = cls.grade_id || null;
          } else if (gradeId) {
            const grade = await env.DB.prepare(
              "SELECT id FROM grades WHERE id=? AND school_id=? AND active=1"
            ).bind(gradeId, auth.schoolId).first();
            if (!grade) return fail("Invalid grade for " + admission + ".");
          }

          prepared.push(
            env.DB.prepare(
              "INSERT INTO students(school_id,admission_number,full_name,grade_id,class_id) VALUES(?,?,?,?,?)"
            ).bind(auth.schoolId, admission, fullName, gradeId, classId)
          );
        }

        try {
          await env.DB.batch(prepared);
          return json({ added: prepared.length }, 201);
        } catch {
          return fail("Bulk add failed. Check that admission numbers are unique and try again.", 409);
        }
      }

      if (path === "/api/teachers" && req.method === "GET") {
        if (!isAdmin(auth)) return fail("You do not have permission to view teachers.", 403);
        const rows = await env.DB.prepare(
          "SELECT id,full_name,username,active FROM users WHERE school_id=? AND role='TEACHER' ORDER BY full_name"
        ).bind(auth.schoolId).all();
        return json(rows.results);
      }

      if (path === "/api/teachers" && req.method === "POST") {
        if (!isAdmin(auth)) return fail("You do not have permission to create teachers.", 403);
        const b = await requestBody(req);
        const fullName = String(b.full_name || "").trim();
        const username = String(b.username || "").trim();
        const password = String(b.password || "");
        if (!fullName || !username || !password) return fail("Teacher name, username and password are required.");
        if (password.length < 4) return fail("Temporary password must be at least 4 characters.");

        const exists = await env.DB.prepare(
          "SELECT id FROM users WHERE username=? COLLATE NOCASE LIMIT 1"
        ).bind(username).first();
        if (exists) return fail("This username is already in use.", 409);

        const salt = hex(crypto.getRandomValues(new Uint8Array(16)));
        const hash = await passwordHash(password, salt);
        const result = await env.DB.prepare(
          `INSERT INTO users(school_id,full_name,username,password_hash,password_salt,role,force_password_change)
           VALUES(?,?,?,?,?,'TEACHER',1)`
        ).bind(auth.schoolId, fullName, username, hash, salt).run();

        const teacherId = Number(result.meta.last_row_id);
        const classIds = Array.isArray(b.class_ids) ? b.class_ids : [];
        for (const rawId of classIds) {
          const classId = Number(rawId);
          if (!classId) continue;
          await env.DB.prepare(
            `INSERT OR IGNORE INTO teacher_class_assignments(school_id,teacher_id,class_id)
             SELECT ?,?,id FROM classes WHERE id=? AND school_id=? AND active=1`
          ).bind(auth.schoolId, teacherId, classId, auth.schoolId).run();
        }
        return json({ id: teacherId }, 201);
      }

      if (path === "/api/attendance" && req.method === "POST") {
        const b = await requestBody(req);
        const classId = Number(b.class_id || 0);
        if (!classId || !await classAllowed(env, auth, classId)) {
          return fail("You do not have permission to submit attendance for this class.", 403);
        }

        const active = await env.DB.prepare(
          "SELECT id FROM students WHERE school_id=? AND class_id=? AND status='ACTIVE'"
        ).bind(auth.schoolId, classId).all<{id:number}>();
        const validIds = new Set(active.results.map((x) => x.id));
        const records = Array.isArray(b.records) ? b.records : [];

        if (
          records.length !== validIds.size ||
          records.some((r: any) => !validIds.has(Number(r.student_id)) || !["PRESENT","ABSENT"].includes(String(r.status)))
        ) {
          return fail("Attendance must be recorded for every active student.");
        }

        const date = String(b.date || "").trim();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return fail("A valid attendance date is required.");

        await env.DB.prepare(
          `INSERT INTO attendance_sessions(school_id,class_id,date,submitted_by)
           VALUES(?,?,?,?)
           ON CONFLICT(school_id,class_id,date)
           DO UPDATE SET submitted_by=excluded.submitted_by,updated_at=CURRENT_TIMESTAMP`
        ).bind(auth.schoolId, classId, date, auth.userId).run();

        const session = await env.DB.prepare(
          "SELECT id FROM attendance_sessions WHERE school_id=? AND class_id=? AND date=?"
        ).bind(auth.schoolId, classId, date).first<{id:number}>();

        for (const record of records) {
          await env.DB.prepare(
            `INSERT INTO attendance_records(school_id,session_id,student_id,status)
             VALUES(?,?,?,?)
             ON CONFLICT(session_id,student_id)
             DO UPDATE SET status=excluded.status,updated_at=CURRENT_TIMESTAMP`
          ).bind(auth.schoolId, session!.id, Number(record.student_id), String(record.status)).run();
        }
        return json({ ok: true });
      }

      if (path === "/api/attendance/history" && req.method === "GET") {
        const rows = await env.DB.prepare(
          `SELECT s.id,s.date,c.display_name class_name,u.full_name submitted_by,
                  SUM(CASE WHEN r.status='PRESENT' THEN 1 ELSE 0 END) present_count,
                  SUM(CASE WHEN r.status='ABSENT' THEN 1 ELSE 0 END) absent_count
           FROM attendance_sessions s
           JOIN classes c ON c.id=s.class_id
           JOIN users u ON u.id=s.submitted_by
           LEFT JOIN attendance_records r ON r.session_id=s.id
           WHERE s.school_id=?
           GROUP BY s.id
           ORDER BY s.date DESC,s.id DESC
           LIMIT 200`
        ).bind(auth.schoolId).all();
        return json(rows.results);
      }

      if (path === "/api/teacher-period-attendance" && req.method === "POST") {
        const b = await requestBody(req);
        const classId = Number(b.class_id || 0);
        if (!classId || !await classAllowed(env, auth, classId)) {
          return fail("You do not have permission to submit this class.", 403);
        }
        const date = String(b.date || "").trim();
        for (const period of Array.isArray(b.periods) ? b.periods : []) {
          await env.DB.prepare(
            `INSERT INTO teacher_period_attendance(school_id,class_id,date,period,status,submitted_by)
             VALUES(?,?,?,?,?,?)
             ON CONFLICT(school_id,class_id,date,period)
             DO UPDATE SET status=excluded.status,submitted_by=excluded.submitted_by,updated_at=CURRENT_TIMESTAMP`
          ).bind(
            auth.schoolId,
            classId,
            date,
            Number(period.period),
            String(period.status),
            auth.userId
          ).run();
        }
        return json({ ok: true });
      }

      if (path === "/api/reports" && req.method === "GET") {
        const start = url.searchParams.get("start") || "0000-00-00";
        const end = url.searchParams.get("end") || "9999-12-31";
        const rows = await env.DB.prepare(
          `SELECT s.admission_number,s.full_name,
                  COALESCE(c.display_name,'Unassigned') display_name,
                  COUNT(ar.id) total,
                  SUM(CASE WHEN ar.status='PRESENT' THEN 1 ELSE 0 END) present,
                  SUM(CASE WHEN ar.status='ABSENT' THEN 1 ELSE 0 END) absent
           FROM students s
           LEFT JOIN classes c ON c.id=s.class_id
           LEFT JOIN attendance_records ar ON ar.student_id=s.id
           LEFT JOIN attendance_sessions ss ON ss.id=ar.session_id
           WHERE s.school_id=? AND (ss.date BETWEEN ? AND ? OR ss.id IS NULL)
           GROUP BY s.id
           ORDER BY COALESCE(c.display_name,''),s.admission_number`
        ).bind(auth.schoolId, start, end).all<any>();

        return json({
          headers: ["Admission","Name","Class","Total Days","Present","Absent","Attendance %"],
          rows: rows.results.map((r) => [
            r.admission_number,
            r.full_name,
            r.display_name,
            r.total || 0,
            r.present || 0,
            r.absent || 0,
            r.total ? ((r.present / r.total) * 100).toFixed(1) + "%" : "0.0%"
          ])
        });
      }

      if (path === "/api/settings" && req.method === "GET") {
        const settings = await env.DB.prepare(
          "SELECT * FROM school_settings WHERE school_id=?"
        ).bind(auth.schoolId).first();
        return json(settings || {});
      }

      if (path === "/api/settings" && req.method === "PATCH") {
        if (!isAdmin(auth)) return fail("You do not have permission to change settings.", 403);
        const b = await requestBody(req);
        await env.DB.prepare(
          `UPDATE school_settings
           SET academic_year=COALESCE(?,academic_year),
               period_count=COALESCE(?,period_count),
               allow_attendance_edit=COALESCE(?,allow_attendance_edit),
               submission_deadline=COALESCE(?,submission_deadline)
           WHERE school_id=?`
        ).bind(
          b.academic_year ?? null,
          b.period_count ?? null,
          b.allow_attendance_edit ?? null,
          b.submission_deadline ?? null,
          auth.schoolId
        ).run();
        return json({ ok: true });
      }

      return fail("Not found.", 404);
    } catch (error) {
      console.error("Unhandled backend error", error);
      return fail("The request could not be completed.", 500);
    }
  }
};
