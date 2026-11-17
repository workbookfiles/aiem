const API_URL   = 'https://script.google.com/macros/s/AKfycbzwBRVOPgkFz7uWuE1alH9PfU9G1XCi5bPMMFXFzz8CWBbAF5safm8EAcGC73sX00k/exec';
const CLIENT_ID = '624013566184-6k4pjjk80rdhuo341270slup4e6sm0sa.apps.googleusercontent.com';

const $ = s => document.querySelector(s);
const app = $('#app');
const esc = s => String(s ?? '').replace(/[&<>"']/g,
  c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

let ID_TOKEN = sessionStorage.getItem('idtoken') || null;
const state = { user: null, data: null, tab: 'classes' };

function showLoading() {
  app.innerHTML = `
    <div class="flex flex-col items-center justify-center mt-32">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-700 mb-4"></div>
      <p class="text-slate-500">Loading data from Google Drive...</p>
    </div>`;
}

async function api(action, payload = {}) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action, token: ID_TOKEN, ...payload })
  });
  const j = await res.json();
  if (!j.ok) throw new Error(j.error);
  return j.data;
}

window.onload = function init() {
  if (!window.google || !google.accounts) { setTimeout(init, 300); return; }
  google.accounts.id.initialize({ client_id: CLIENT_ID, callback: onSignIn });
  if (ID_TOKEN) boot(); else renderLogin();
};

async function onSignIn(r) {
  ID_TOKEN = r.credential;
  sessionStorage.setItem('idtoken', ID_TOKEN);
  boot();
}

async function boot() {
  showLoading();
  try {
    const who = await api('whoami');
    state.user = who.user;
    if (state.user.role === 'admin') await renderAdmin();
    else if (state.user.role === 'teacher') await renderTeacher();
    else renderNotice('Signed in as ' + state.user.role + '.');
  } catch (e) {
    sessionStorage.removeItem('idtoken'); ID_TOKEN = null;
    renderLogin(e.message);
  }
}

function renderLogin(error) {
  app.innerHTML = `
    <div class="max-w-md mx-auto bg-white rounded-2xl shadow p-8 mt-16 text-center">
      <h1 class="text-xl font-semibold mb-1">Alamdar Institute of Education Hamray</h1>
      <p class="text-sm text-slate-500 mb-6">Sign in with your school Google account.</p>
      ${error ? `<p class="text-sm text-red-600 mb-4">${esc(error)}</p>` : ''}
      <div id="gbtn" class="flex justify-center"></div>
    </div>`;
  google.accounts.id.renderButton($('#gbtn'), { theme: 'filled_blue', size: 'large', width: 320 });
}

function renderNotice(msg) {
  app.innerHTML = `
    <div class="max-w-md mx-auto bg-white rounded-2xl shadow p-8 mt-16 text-center">
      <p class="mb-4">${esc(msg)}</p>
      <button id="logout" class="btn">Sign out</button>
    </div>`;
  $('#logout').onclick = () => { sessionStorage.removeItem('idtoken'); location.reload(); };
}

/* ==========================================
   ADMIN DASHBOARD
   ========================================== */
async function renderAdmin() {
  showLoading();
  state.data = await api('listAll');
  
  app.innerHTML = `
    <div class="max-w-6xl mx-auto px-4">
      <div class="flex flex-wrap items-center justify-between gap-2 mb-4">
        <div>
          <h1 class="text-xl font-semibold">Admin Dashboard</h1>
          <p class="text-sm text-slate-500">${esc(state.user.email)} · ${esc(state.user.role)}</p>
        </div>
        <button id="logout" class="px-3 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-sm">Sign out</button>
      </div>
      <div id="tabs" class="flex flex-wrap gap-2 mb-4"></div>
      <div id="tab-body"></div>
    </div>`;
  $('#logout').onclick = () => { sessionStorage.removeItem('idtoken'); location.reload(); };

  // Added 'logs' to the tabs list
  const tabs = ['classes','subjects','teachers','students','logs','users'];
  $('#tabs').innerHTML = tabs.map(t => `
    <button data-tab="${t}" class="px-3 py-1.5 rounded-lg text-sm
      ${state.tab === t ? 'bg-teal-700 text-white' : 'bg-white shadow'}">${t[0].toUpperCase()+t.slice(1)}</button>
  `).join('');
  $('#tabs').querySelectorAll('[data-tab]').forEach(b => {
    b.onclick = () => { state.tab = b.dataset.tab; renderAdmin(); };
  });
  renderTab();
}

function tableHtml(headers, rows) {
  return `
    <div class="bg-white rounded-xl shadow overflow-x-auto">
      <table class="w-full text-sm">
        <thead class="bg-slate-100 text-left">
          <tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>
        </thead>
        <tbody>
          ${rows.length ? rows.join('') :
            `<tr><td colspan="${headers.length}" class="text-center text-slate-400 py-6">No records yet</td></tr>`}
        </tbody>
      </table>
    </div>`;
}

function card(title, formHtml) {
  return `
    <div class="bg-white rounded-xl shadow p-4 mb-4">
      <h3 class="font-medium mb-3">${title}</h3>
      ${formHtml}
    </div>`;
}

function tabClasses() {
  const d = state.data;
  const rows = d.classes.map(c => `
    <tr class="border-t">
      <td>${esc(c.name)}</td>
      <td>${esc(c.section || '—')}</td>
      <td>${d.students.filter(s => s.classId === c.id).length}</td>
      <td class="text-right"><button data-del-class="${c.id}" class="text-red-600 text-xs">Delete</button></td>
    </tr>`);
  return card('Add class', `
      <form id="f-class" class="flex flex-wrap gap-2">
        <input name="name" required placeholder="Class name (e.g. Grade 3)" class="input" />
        <input name="section" placeholder="Section (optional)" class="input" />
        <button class="btn">Add class</button>
      </form>
    `) + tableHtml(['Class','Section','Students',''], rows);
}

function tabSubjects() {
  const d = state.data;
  const rows = d.subjects.map(s => `
    <tr class="border-t">
      <td>${esc(s.name)}</td>
      <td class="text-right"><button data-del-subject="${s.id}" class="text-red-600 text-xs">Delete</button></td>
    </tr>`);
  return card('Add subject', `
      <form id="f-subject" class="flex flex-wrap gap-2">
        <input name="name" required placeholder="Subject name" class="input" />
        <button class="btn">Add subject</button>
      </form>
    `) + tableHtml(['Subject',''], rows);
}

function tabTeachers() {
  const d = state.data;
  const cmap = Object.fromEntries(d.classes.map(c => [c.id, c.name]));
  const smap = Object.fromEntries(d.subjects.map(s => [s.id, s.name]));
  const rows = d.teachers.map(t => {
    const tags = (t.assignments || [])
      .map(a => `<span class="inline-block bg-teal-50 text-teal-800 text-xs rounded px-2 py-0.5 mr-1 mb-1">
        ${esc(smap[a.subjectId] || '?')} · ${esc(cmap[a.classId] || '?')}</span>`).join('') || '—';
    return `
      <tr class="border-t align-top">
        <td>${esc(t.name)}</td>
        <td>${esc(t.email || '—')}<div class="text-xs text-slate-500">${esc(t.phone || '')}</div></td>
        <td>${tags}</td>
        <td class="text-right"><button data-del-teacher="${t.id}" class="text-red-600 text-xs">Delete</button></td>
      </tr>`;
  });
  const teacherOpts = d.teachers.map(t => `<option value="${t.id}">${esc(t.name)}</option>`).join('');
  const classOpts   = d.classes.map(c => `<option value="${c.id}">${esc(c.name)}${c.section?' · '+esc(c.section):''}</option>`).join('');
  const subjectOpts = d.subjects.map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join('');
  return card('Add teacher', `
      <form id="f-teacher" class="grid md:grid-cols-4 gap-2">
        <input name="name" required placeholder="Full name" class="input" />
        <input name="email" type="email" placeholder="Email (Google)" class="input" />
        <input name="phone" placeholder="Phone" class="input" />
        <input name="qualifications" placeholder="Qualifications" class="input" />
        <button class="btn md:col-span-4 justify-self-start">Add teacher</button>
      </form>
    `) + card('Assign teacher to class + subject', `
      <form id="f-assign" class="flex flex-wrap gap-2">
        <select name="teacherId" required class="input">${teacherOpts || '<option value="">No teachers</option>'}</select>
        <select name="classId"   required class="input">${classOpts   || '<option value="">No classes</option>'}</select>
        <select name="subjectId" required class="input">${subjectOpts || '<option value="">No subjects</option>'}</select>
        <button class="btn">Assign</button>
      </form>
    `) + tableHtml(['Teacher','Contact','Assignments',''], rows);
}

function tabStudents() {
  const d = state.data;
  const cmap = Object.fromEntries(d.classes.map(c => [c.id, c.name + (c.section ? ' · ' + c.section : '')]));
  const rows = d.students.map(s => `
    <tr class="border-t">
      <td>${esc(s.name)}<div class="text-xs text-slate-500">${esc(s.admissionNo || '')}</div></td>
      <td>${esc(cmap[s.classId] || '—')}</td>
      <td>${esc(s.parentName || '—')}<div class="text-xs text-slate-500">${esc(s.parentPhone || '')}</div></td>
      <td>${esc(s.parentEmail || '—')}</td>
      <td class="text-right"><button data-del-student="${s.id}" class="text-red-600 text-xs">Delete</button></td>
    </tr>`);
  const classOpts = d.classes.map(c => `<option value="${c.id}">${esc(c.name)}${c.section?' · '+esc(c.section):''}</option>`).join('');
  return card('Add student', `
      <form id="f-student" class="grid md:grid-cols-4 gap-2">
        <input name="name" required placeholder="Student name" class="input" />
        <input name="admissionNo" placeholder="Admission no." class="input" />
        <select name="classId" required class="input">${classOpts || '<option value="">Create a class first</option>'}</select>
        <input name="dob" type="date" class="input" />
        <input name="parentName" placeholder="Parent name" class="input" />
        <input name="parentPhone" placeholder="Parent phone" class="input" />
        <input name="parentEmail" type="email" placeholder="Parent email (Google)" class="input" />
        <input name="address" placeholder="Address" class="input" />
        <button class="btn md:col-span-4 justify-self-start">Add student</button>
      </form>
    `) + tableHtml(['Student','Class','Parent','Parent email',''], rows);
}

// NEW TAB: DAILY LOGS & SUMMARIES
async function tabLogs() {
  const logs = await api('getAllLogs');
  const d = state.data;
  const cmap = Object.fromEntries(d.classes.map(c => [c.id, c.name + (c.section ? ' (' + c.section + ')' : '')]));
  const smap = Object.fromEntries(d.subjects.map(s => [s.id, s.name]));

  if (logs.length === 0) {
    return `<div class="bg-white p-6 rounded-xl shadow text-center text-slate-500">No teacher logs submitted yet.</div>`;
  }

  const rows = logs.map(l => `
    <tr class="border-t hover:bg-slate-50">
      <td class="whitespace-nowrap">${esc(l.date)}</td>
      <td><strong>${esc(cmap[l.classId] || '?')}</strong><br><span class="text-xs text-teal-700">${esc(smap[l.subjectId] || '?')}</span></td>
      <td class="max-w-xs whitespace-pre-wrap text-xs">${esc(l.classwork || '—')}</td>
      <td class="max-w-xs whitespace-pre-wrap text-xs">${esc(l.homework || '—')}</td>
      <td class="whitespace-nowrap text-xs">${esc(l.dueDate || '—')}</td>
      <td class="text-xs text-slate-500">${esc(l.teacherName)}</td>
    </tr>`).join('');

  // Create a text version for WhatsApp
  let waText = `*AIEM Daily Homework Summary*\n\n`;
  const today = logs[0].date; // Group by the latest date
  const todayLogs = logs.filter(l => l.date === today);
  
  waText += `📅 Date: ${today}\n\n`;
  todayLogs.forEach(l => {
    waText += `📚 *Class:* ${cmap[l.classId] || '?'}\n`;
    waText += `📖 *Subject:* ${smap[l.subjectId] || '?'}\n`;
    if (l.classwork) waText += `✍️ *Classwork:* ${l.classwork}\n`;
    if (l.homework) waText += `🏠 *Homework:* ${l.homework}\n`;
    if (l.dueDate) waText += `⏰ *Due Date:* ${l.dueDate}\n`;
    waText += `\n`;
  });

  return `
    <div class="mb-4 bg-teal-50 border border-teal-200 p-4 rounded-xl flex justify-between items-center flex-wrap gap-4">
      <div>
        <h3 class="font-medium text-teal-900">WhatsApp Summary</h3>
        <p class="text-sm text-teal-700">Copy today's homework to send to parents.</p>
      </div>
      <button id="copy-wa" class="btn bg-green-600 hover:bg-green-700 shadow-md">📋 Copy for WhatsApp</button>
    </div>
    ${tableHtml(['Date', 'Class & Subject', 'Classwork', 'Homework', 'Due Date', 'Teacher'], rows)}
    <script>
      document.getElementById('copy-wa').onclick = () => {
        navigator.clipboard.writeText(${JSON.stringify(waText)}).then(() => {
          const btn = document.getElementById('copy-wa');
          btn.innerText = '✅ Copied!';
          setTimeout(() => btn.innerText = '📋 Copy for WhatsApp', 2000);
        });
      };
    </script>
  `;
}

function tabUsers() {
  const rows = state.data.users.map(u => `
    <tr class="border-t">
      <td>${esc(u.email)}</td>
      <td>${esc(u.name || '—')}</td>
      <td>${esc(u.role)}</td>
      <td>${u.active ? 'Active' : 'Disabled'}</td>
      <td class="text-right">
        <button data-toggle-user="${u.id}" data-active="${u.active}"
          class="text-xs ${u.active ? 'text-red-600' : 'text-teal-700'}">
          ${u.active ? 'Disable' : 'Enable'}</button>
      </td>
    </tr>`);
  return tableHtml(['Email','Name','Role','Status',''], rows);
}

async function renderTab() {
  const body = $('#tab-body');
  
  if (state.tab === 'logs') {
    body.innerHTML = await tabLogs();
    return;
  }

  body.innerHTML =
      state.tab === 'classes'  ? tabClasses()
    : state.tab === 'subjects' ? tabSubjects()
    : state.tab === 'teachers' ? tabTeachers()
    : state.tab === 'students' ? tabStudents()
    : tabUsers();

  // ... (rest of the form submission logic remains the same as before)
  const fClass = $('#f-class');
  if (fClass) fClass.onsubmit = async e => {
    e.preventDefault(); const f = new FormData(fClass);
    const btn = fClass.querySelector('button'); btn.innerText = 'Saving...'; btn.disabled = true;
    try { await api('createClass', { name: f.get('name'), section: f.get('section') }); await renderAdmin(); }
    catch (err) { alert(err.message); btn.innerText = 'Add class'; btn.disabled = false; }
  };
  const fSubject = $('#f-subject');
  if (fSubject) fSubject.onsubmit = async e => {
    e.preventDefault(); const f = new FormData(fSubject);
    const btn = fSubject.querySelector('button'); btn.innerText = 'Saving...'; btn.disabled = true;
    try { await api('createSubject', { name: f.get('name') }); await renderAdmin(); }
    catch (err) { alert(err.message); btn.innerText = 'Add subject'; btn.disabled = false; }
  };
  const fTeacher = $('#f-teacher');
  if (fTeacher) fTeacher.onsubmit = async e => {
    e.preventDefault(); const f = new FormData(fTeacher);
    const btn = fTeacher.querySelector('button'); btn.innerText = 'Saving...'; btn.disabled = true;
    try { await api('createTeacher', {
      name: f.get('name'), email: f.get('email'),
      phone: f.get('phone'), qualifications: f.get('qualifications')
    }); await renderAdmin(); }
    catch (err) { alert(err.message); btn.innerText = 'Add teacher'; btn.disabled = false; }
  };
  const fAssign = $('#f-assign');
  if (fAssign) fAssign.onsubmit = async e => {
    e.preventDefault(); const f = new FormData(fAssign);
    const btn = fAssign.querySelector('button'); btn.innerText = 'Assigning...'; btn.disabled = true;
    try { await api('assignTeacher', {
      teacherId: f.get('teacherId'), classId: f.get('classId'), subjectId: f.get('subjectId')
    }); await renderAdmin(); }
    catch (err) { alert(err.message); btn.innerText = 'Assign'; btn.disabled = false; }
  };
  const fStudent = $('#f-student');
  if (fStudent) fStudent.onsubmit = async e => {
    e.preventDefault(); const f = new FormData(fStudent);
    const btn = fStudent.querySelector('button'); btn.innerText = 'Saving...'; btn.disabled = true;
    try { await api('createStudent', Object.fromEntries(f.entries())); await renderAdmin(); }
    catch (err) { alert(err.message); btn.innerText = 'Add student'; btn.disabled = false; }
  };
  body.querySelectorAll('[data-del-class]').forEach(b =>
    b.onclick = async () => { if (confirm('Delete class?')) { await api('deleteClass', { id: b.dataset.delClass }); renderAdmin(); } });
  body.querySelectorAll('[data-del-subject]').forEach(b =>
    b.onclick = async () => { if (confirm('Delete subject?')) { await api('deleteSubject', { id: b.dataset.delSubject }); renderAdmin(); } });
  body.querySelectorAll('[data-del-teacher]').forEach(b =>
    b.onclick = async () => { if (confirm('Delete teacher?')) { await api('deleteTeacher', { id: b.dataset.delTeacher }); renderAdmin(); } });
  body.querySelectorAll('[data-del-student]').forEach(b =>
    b.onclick = async () => { if (confirm('Delete student?')) { await api('deleteStudent', { id: b.dataset.delStudent }); renderAdmin(); } });
  body.querySelectorAll('[data-toggle-user]').forEach(b =>
    b.onclick = async () => { await api('toggleUser', {
      id: b.dataset.toggleUser, active: b.dataset.active !== 'true'
    }); renderAdmin(); });
}

/* ==========================================
   TEACHER DASHBOARD
   ========================================== */
async function renderTeacher() {
  showLoading();
  state.data = await api('getTeacherData');
  const { teacher, classes, subjects, logs } = state.data;
  
  const cmap = Object.fromEntries(classes.map(c => [c.id, c.name + (c.section ? ' · ' + c.section : '')]));
  const smap = Object.fromEntries(subjects.map(s => [s.id, s.name]));

  const assignOpts = (teacher.assignments || []).map(a => 
    `<option value="${a.classId}|${a.subjectId}">${esc(cmap[a.classId] || '?')} — ${esc(smap[a.subjectId] || '?')}</option>`
  ).join('');

  const logRows = logs.map(l => `
    <tr class="border-t">
      <td class="whitespace-nowrap">${esc(l.date)}</td>
      <td>${esc(cmap[l.classId] || '?')}<br><span class="text-xs text-slate-500">${esc(smap[l.subjectId] || '?')}</span></td>
      <td class="max-w-xs whitespace-pre-wrap">${esc(l.classwork || '—')}</td>
      <td class="max-w-xs whitespace-pre-wrap">${esc(l.homework || '—')}</td>
      <td class="whitespace-nowrap">${esc(l.dueDate || '—')}</td>
    </tr>`).join('');

  app.innerHTML = `
    <div class="max-w-6xl mx-auto px-4 pb-12">
      <div class="flex flex-wrap items-center justify-between gap-2 mb-6">
        <div>
          <h1 class="text-xl font-semibold">Teacher Dashboard</h1>
          <p class="text-sm text-slate-500">Welcome, ${esc(teacher.name)}</p>
        </div>
        <button id="logout" class="px-3 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-sm">Sign out</button>
      </div>

      <div class="bg-white rounded-xl shadow p-4 mb-6">
        <h3 class="font-medium mb-3 text-teal-800">Submit Daily Class Log</h3>
        ${assignOpts ? `
        <form id="f-log" class="grid md:grid-cols-2 gap-4">
          <div class="md:col-span-2">
            <label class="block text-sm mb-1">Class & Subject</label>
            <select name="assignment" required class="input w-full">${assignOpts}</select>
          </div>
          <div>
            <label class="block text-sm mb-1">Date</label>
            <input name="date" type="date" required class="input w-full" value="${new Date().toISOString().split('T')[0]}" />
          </div>
          <div>
            <label class="block text-sm mb-1">Homework Due Date (optional)</label>
            <input name="dueDate" type="date" class="input w-full" />
          </div>
          <div>
            <label class="block text-sm mb-1">Classwork Done</label>
            <textarea name="classwork" required rows="3" class="input w-full" placeholder="What was taught in class..."></textarea>
          </div>
          <div>
            <label class="block text-sm mb-1">Homework Given</label>
            <textarea name="homework" rows="3" class="input w-full" placeholder="What homework was assigned..."></textarea>
          </div>
          <div class="md:col-span-2">
            <button class="btn w-full md:w-auto">Submit Log</button>
          </div>
        </form>
        ` : '<p class="text-red-500 text-sm">You have no classes assigned yet. Please contact the Admin.</p>'}
      </div>

      <div class="bg-white rounded-xl shadow overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="bg-slate-100 text-left">
            <tr>
              <th>Date</th>
              <th>Class & Subject</th>
              <th>Classwork</th>
              <th>Homework</th>
              <th>Due Date</th>
            </tr>
          </thead>
          <tbody>
            ${logRows || '<tr><td colspan="5" class="text-center py-6 text-slate-400">No logs submitted yet</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>`;

  $('#logout').onclick = () => { sessionStorage.removeItem('idtoken'); location.reload(); };

  const fLog = $('#f-log');
  if (fLog) {
    fLog.onsubmit = async e => {
      e.preventDefault();
      const f = new FormData(fLog);
      const [classId, subjectId] = f.get('assignment').split('|');
      const btn = fLog.querySelector('button');
      btn.innerText = 'Saving to Drive...'; btn.disabled = true;

      try {
        await api('submitLog', {
          classId, subjectId,
          date: f.get('date'),
          classwork: f.get('classwork'),
          homework: f.get('homework'),
          dueDate: f.get('dueDate')
        });
        await renderTeacher();
      } catch (err) {
        alert(err.message);
        btn.innerText = 'Submit Log'; btn.disabled = false;
      }
    };
  }
}
