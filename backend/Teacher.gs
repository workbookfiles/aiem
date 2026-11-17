function getTeacherData_(ctx) {
  const email = normalizeEmail_(ctx.user && ctx.user.email);
  const teacher = (read_('teachers') || []).find(function (t) { return normalizeEmail_(t.email) === email; });
  if (!teacher) throw new Error('Teacher profile not found for this account.');

  const assignments = Array.isArray(teacher.assignments) ? teacher.assignments : [];
  const classIds = {};
  const subjectIds = {};
  assignments.forEach(function (a) {
    if (a && a.classId && a.subjectId) {
      classIds[a.classId] = true;
      subjectIds[a.subjectId] = true;
    }
  });
  const classes = (read_('classes') || []).filter(function (c) { return !!classIds[c.id]; });
  const subjects = (read_('subjects') || []).filter(function (s) { return !!subjectIds[s.id]; });
  const logs = (read_('logs') || []).filter(function (l) { return l.teacherId === teacher.id; })
    .sort(function (a, b) { return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(); });

  return {
    teacher: { id: teacher.id, name: teacher.name, assignments: assignments },
    classes: classes,
    subjects: subjects,
    logs: logs
  };
}

function submitLog_(ctx, p) {
  const email = normalizeEmail_(ctx.user && ctx.user.email);
  const teacher = (read_('teachers') || []).find(function (t) { return normalizeEmail_(t.email) === email; });
  if (!teacher) throw new Error('Teacher profile not found.');

  const classId = requireText_(p.classId, 'Class', 100);
  const subjectId = requireText_(p.subjectId, 'Subject', 100);
  const date = validOptionalDate_(p.date, 'Lesson date');
  if (!date) throw new Error('Lesson date is required.');
  const dueDate = validOptionalDate_(p.dueDate, 'Due date');
  const assignments = Array.isArray(teacher.assignments) ? teacher.assignments : [];
  if (!assignments.some(function (a) { return a && a.classId === classId && a.subjectId === subjectId; })) {
    throw new Error('You are not assigned to this class and subject.');
  }
  if (!(read_('classes') || []).some(function (c) { return c.id === classId; })) throw new Error('Selected class does not exist.');
  if (!(read_('subjects') || []).some(function (s) { return s.id === subjectId; })) throw new Error('Selected subject does not exist.');
  if (dueDate && dueDate < date) throw new Error('Due date cannot be before the lesson date.');

  const classwork = typeof p.classwork === 'string' ? p.classwork.trim() : '';
  const homework = typeof p.homework === 'string' ? p.homework.trim() : '';
  if (classwork.length > 5000 || homework.length > 5000) throw new Error('Lesson or homework text is too long.');
  const logs = read_('logs') || [];
  const rec = {
    id: uuid_(), teacherId: teacher.id, teacherName: teacher.name,
    date: date, classId: classId, subjectId: subjectId,
    classwork: classwork, homework: homework, dueDate: dueDate, createdAt: now_()
  };
  logs.push(rec);
  write_('logs', logs);
  return rec;
}
