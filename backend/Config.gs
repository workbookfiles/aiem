const CONFIG = {
  FOLDER_NAME: 'AIEM_Data',
  CLIENT_ID: '624013566184-6k4pjjk80rdhuo341270slup4e6sm0sa.apps.googleusercontent.com',
  INITIAL_ADMIN_EMAIL: 'workbook.docs.files@gmail.com'
};

function setup() {
  return withDataLock_(function () {
    ['users', 'classes', 'subjects', 'teachers', 'students', 'logs', 'attendance', 'fees', 'notices']
      .forEach(function (name) {
        if (read_(name) === null) write_(name, []);
      });

    const adminEmail = normalizeEmail_(CONFIG.INITIAL_ADMIN_EMAIL);
    const users = read_('users') || [];
    if (!users.some(function (u) { return normalizeEmail_(u && u.email) === adminEmail; })) {
      users.push({
        id: uuid_(), email: adminEmail, name: 'Initial Admin',
        role: 'admin', active: true, createdAt: now_()
      });
      write_('users', users);
    }

    const subjects = read_('subjects') || [];
    if (subjects.length === 0) {
      ['English', 'Maths', 'Science', 'Urdu', 'Arabic', 'Al Quran', 'Ethics', 'Kashmiri', 'Social Science', 'EVS']
        .forEach(function (name) {
          subjects.push({ id: uuid_(), name: name, createdAt: now_() });
        });
      write_('subjects', subjects);
    }
    return 'Setup complete. Folder: ' + folder_().getUrl();
  });
}

function normalizeEmail_(email) {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}
