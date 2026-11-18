function listAll_() {
  return {
    classes: read_('classes') || [],
    subjects: read_('subjects') || [],
    teachers: read_('teachers') || [],
    students: read_('students') || [],
    users: (read_('users') || []).map(function (u) {
      return { id: u.id, email: u.email, name: u.name, role: u.role, active: u.active };
    })
  };
}

function requireText_(value, label, max) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(label + ' is required.');
  const result = value.trim();
  if (result.length > max) throw new Error(label + ' is too long.');
  return result;
}

function createClass_(p) {
  const name = requireText_(p.name, 'Class name', 80);
  const section = typeof p.section === 'string' ? p.section.trim() : '';
  if (section.length > 40) throw new Error('Section is too long.');
  const arr = read_('classes') || [];
  if (arr.some(function (x) { return String(x.name || '').toLowerCase() === name.toLowerCase() && String(x.section || '').toLowerCase() === section.toLowerCase(); })) {
    throw new Error('That class and section already exist.');
  }
  const rec = { id: uuid_(), name: name, section: section, createdAt: now_() };
  arr.push(rec); write_('classes', arr); return rec;
}

function createSubject_(p) {
  const name = requireText_(p.name, 'Subject name', 80);
  const arr = read_('subjects') || [];
  if (arr.some(function (s) { return String(s.name || '').toLowerCase() === name.toLowerCase(); })) {
    throw new Error('Subject already exists.');
  }
  const rec = { id: uuid_(), name: name, createdAt: now_() };
  arr.push(rec); write_('subjects', arr); return rec;
}

function createTeacher_(p) {
  const name = requireText_(p.name, 'Teacher name', 120);
  const email = normalizeEmail_(p.email);
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('A valid teacher email is required.');
  const arr = read_('teachers') || [];
  if (arr.some(function (t) { return normalizeEmail_(t.email) === email; })) throw new Error('A teacher with this email already exists.');
  const rec = {
    id: uuid_(), name: name, email: email,
    phone: typeof p.phone === 'string' ? p.phone.trim().slice(0, 40) : '',
    qualifications: typeof p.qualifications === 'string' ? p.qualifications.trim().slice(0, 500) : '',
    assignments: [], createdAt: now_()
  };
  ensureTeacherUser_(email, name);
  arr.push(rec); write_('teachers', arr); return rec;
}

function ensureTeacherUser_(email, name) {
  const users = read_('users') || [];
  const existing = users.find(function (u) { return normalizeEmail_(u.email) === email; });
  if (existing) {
    if (existing.role !== 'teacher') throw new Error('This email is already registered with a different role.');
    if (existing.active !== true) throw new Error('This teacher account is disabled. Enable it from user management first.');
    return;
  }
  users.push({ id: uuid_(), email: email, name: name, role: 'teacher', active: true, createdAt: now_() });
  write_('users', users);
}

function assignTeacher_(p) {
  const teachers = read_('teachers') || [];
  const teacher = teachers.find(function (t) { return t.id === p.teacherId; });
  if (!teacher) throw new Error('Teacher not found.');
  const classId = requireText_(p.classId, 'Class', 100);
  const subjectId = requireText_(p.subjectId, 'Subject', 100);
  if (!(read_('classes') || []).some(function (c) { return c.id === classId; })) throw new Error('Selected class does not exist.');
  if (!(read_('subjects') || []).some(function (s) { return s.id === subjectId; })) throw new Error('Selected subject does not exist.');
  teacher.assignments = Array.isArray(teacher.assignments) ? teacher.assignments : [];
  if (!teacher.assignments.some(function (a) { return a.classId === classId && a.subjectId === subjectId; })) {
    teacher.assignments.push({ classId: classId, subjectId: subjectId });
  }
  write_('teachers', teachers); return teacher;
}

function createStudent_(p) {
  const name = requireText_(p.name, 'Student name', 120);
  const classId = requireText_(p.classId, 'Class', 100);
  if (!(read_('classes') || []).some(function (c) { return c.id === classId; })) throw new Error('Selected class does not exist.');
  const arr = read_('students') || [];
  const admissionNo = typeof p.admissionNo === 'string' ? p.admissionNo.trim().slice(0, 60) : '';
  if (admissionNo && arr.some(function (s) { return String(s.admissionNo || '').toLowerCase() === admissionNo.toLowerCase(); })) {
    throw new Error('Admission number already exists.');
  }
  const rec = {
    id: uuid_(), name: name, admissionNo: admissionNo, classId: classId,
    parentName: typeof p.parentName === 'string' ? p.parentName.trim().slice(0, 120) : '',
    parentPhone: typeof p.parentPhone === 'string' ? p.parentPhone.trim().slice(0, 40) : '',
    parentEmail: typeof p.parentEmail === 'string' ? p.parentEmail.trim().slice(0, 160) : '',
    dob: validOptionalDate_(p.dob, 'Date of birth'),
    address: typeof p.address === 'string' ? p.address.trim().slice(0, 500) : '',
    active: true, createdAt: now_()
  };
  arr.push(rec); write_('students', arr);
  // Guardian contact details are stored only; parent accounts are deferred.
  return rec;
}

function validOptionalDate_(value, label) {
  if (value === undefined || value === null || value === '') return '';
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(label + ' must use YYYY-MM-DD.');
  const date = new Date(value + 'T00:00:00Z');
  if (isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new Error(label + ' is invalid.');
  return value;
}

function deleteClass_(id) {
  if (typeof id !== 'string' || !id) throw new Error('A valid class ID is required.');
  const students = read_('students') || [];
  const teachers = read_('teachers') || [];
  const logs = read_('logs') || [];
  if (students.some(function (s) { return s.classId === id; }) ||
      logs.some(function (l) { return l.classId === id; }) ||
      teachers.some(function (t) { return (t.assignments || []).some(function (a) { return a.classId === id; }); })) {
    throw new Error('This class is in use. Remove or reassign its linked records before deleting it.');
  }
  return deleteById_('classes', id);
}

function deleteSubject_(id) {
  if (typeof id !== 'string' || !id) throw new Error('A valid subject ID is required.');
  const teachers = read_('teachers') || [];
  const logs = read_('logs') || [];
  if (logs.some(function (l) { return l.subjectId === id; }) ||
      teachers.some(function (t) { return (t.assignments || []).some(function (a) { return a.subjectId === id; }); })) {
    throw new Error('This subject is in use. Remove or reassign its linked records before deleting it.');
  }
  return deleteById_('subjects', id);
}

function deleteTeacher_(id) {
  if (typeof id !== 'string' || !id) throw new Error('A valid teacher ID is required.');
  const teachers = read_('teachers') || [];
  const teacher = teachers.find(function (t) { return t.id === id; });
  if (!teacher) return { deleted: 0 };
  if ((read_('logs') || []).some(function (l) { return l.teacherId === id; })) {
    throw new Error('This teacher has lesson logs. Keep the profile for record history and disable the account instead.');
  }
  const result = deleteById_('teachers', id);
  const users = read_('users') || [];
  const user = users.find(function (u) { return normalizeEmail_(u.email) === normalizeEmail_(teacher.email) && u.role === 'teacher'; });
  if (user) { user.active = false; write_('users', users); }
  return result;
}

function toggleUser_(p, ctx) {
  if (typeof p.id !== 'string' || typeof p.active !== 'boolean') throw new Error('User ID and active status are required.');
  if (p.id === ctx.user.id && p.active === false) throw new Error('You cannot disable your own account.');
  const users = read_('users') || [];
  const user = users.find(function (u) { return u.id === p.id; });
  if (!user) throw new Error('User not found.');
  if (user.role === 'admin' && user.active === true && p.active === false) {
    const activeAdmins = users.filter(function (u) { return u.role === 'admin' && u.active === true; });
    if (activeAdmins.length <= 1) throw new Error('The last active administrator cannot be disabled.');
  }
  user.active = p.active;
  write_('users', users);
  return { id: user.id, active: user.active };
}

function getAllLogs_() {
  return (read_('logs') || []).slice().sort(function (a, b) {
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}
