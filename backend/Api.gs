function doGet() {
  return out_({ ok: false, error: 'Use POST for API requests.' });
}

function doPost(e) {
  try {
    const p = parseParams_(e);
    const identity = verifyIdToken_(p.token);
    const ctx = buildContext_(identity.email);
    const data = route_(p.action || '', p, ctx);
    return out_({ ok: true, data: data });
  } catch (err) {
    return out_({ ok: false, error: String((err && err.message) || err) });
  }
}

function parseParams_(e) {
  if (e && e.postData && e.postData.contents) {
    try {
      const parsed = JSON.parse(e.postData.contents);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error();
      return parsed;
    } catch (_) {
      throw new Error('Invalid JSON request.');
    }
  }
  throw new Error('POST request body is required.');
}

function verifyIdToken_(token) {
  if (typeof token !== 'string' || !token) throw new Error('Missing token.');
  const response = UrlFetchApp.fetch(
    'https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(token),
    { muteHttpExceptions: true }
  );
  if (response.getResponseCode() !== 200) throw new Error('Google sign-in token is invalid or expired.');

  let claims;
  try { claims = JSON.parse(response.getContentText()); }
  catch (_) { throw new Error('Google sign-in could not be verified.'); }

  const issuer = claims.iss;
  const expiry = Number(claims.exp);
  if (claims.aud !== CONFIG.CLIENT_ID) throw new Error('Token audience mismatch.');
  if (issuer !== 'accounts.google.com' && issuer !== 'https://accounts.google.com') {
    throw new Error('Token issuer is invalid.');
  }
  if (!Number.isFinite(expiry) || expiry <= Math.floor(Date.now() / 1000)) {
    throw new Error('Google sign-in token has expired.');
  }
  if (String(claims.email_verified) !== 'true') throw new Error('Google email is not verified.');
  if (!normalizeEmail_(claims.email) || typeof claims.sub !== 'string' || !claims.sub) {
    throw new Error('Google account information is incomplete.');
  }
  return { email: normalizeEmail_(claims.email), name: claims.name || '', sub: claims.sub };
}

function buildContext_(email) {
  const normalized = normalizeEmail_(email);
  if (!normalized) throw new Error('Google account email is missing.');

  let users = read_('users') || [];
  let user = users.find(function (u) { return normalizeEmail_(u && u.email) === normalized; });

  if (!user && normalized === normalizeEmail_(CONFIG.INITIAL_ADMIN_EMAIL)) {
    user = withDataLock_(function () {
      const current = read_('users') || [];
      let existing = current.find(function (u) { return normalizeEmail_(u && u.email) === normalized; });
      if (!existing) {
        existing = {
          id: uuid_(), email: normalized, name: normalized.split('@')[0],
          role: 'admin', active: true, createdAt: now_()
        };
        current.push(existing);
        write_('users', current);
      }
      return existing;
    });
  }

  if (!user) throw new Error('Not registered. Ask an administrator to add ' + normalized + '.');
  if (user.active !== true) throw new Error('Account disabled.');
  if (['admin', 'teacher'].indexOf(user.role) === -1) throw new Error('This account role is not enabled in this portal phase.');
  return { user: user, role: user.role };
}

function route_(action, p, ctx) {
  const routes = {
    whoami: function () {
      return { user: { id: ctx.user.id, email: ctx.user.email, name: ctx.user.name, role: ctx.user.role, active: ctx.user.active } };
    },
    getAllLogs: function () { requireAdmin_(ctx); return getAllLogs_(); },
    getTeacherData: function () { requireTeacher_(ctx); return getTeacherData_(ctx); },
    submitLog: function () { requireTeacher_(ctx); return withDataLock_(function () { return submitLog_(ctx, p); }); },
    listAll: function () { requireAdmin_(ctx); return listAll_(); },
    createClass: function () { requireAdmin_(ctx); return withDataLock_(function () { return createClass_(p); }); },
    deleteClass: function () { requireAdmin_(ctx); return withDataLock_(function () { return deleteClass_(p.id); }); },
    createSubject: function () { requireAdmin_(ctx); return withDataLock_(function () { return createSubject_(p); }); },
    deleteSubject: function () { requireAdmin_(ctx); return withDataLock_(function () { return deleteSubject_(p.id); }); },
    createTeacher: function () { requireAdmin_(ctx); return withDataLock_(function () { return createTeacher_(p); }); },
    deleteTeacher: function () { requireAdmin_(ctx); return withDataLock_(function () { return deleteTeacher_(p.id); }); },
    assignTeacher: function () { requireAdmin_(ctx); return withDataLock_(function () { return assignTeacher_(p); }); },
    createStudent: function () { requireAdmin_(ctx); return withDataLock_(function () { return createStudent_(p); }); },
    deleteStudent: function () { requireAdmin_(ctx); return withDataLock_(function () { return deleteById_('students', p.id); }); },
    toggleUser: function () { requireAdmin_(ctx); return withDataLock_(function () { return toggleUser_(p, ctx); }); }
  };
  if (!Object.prototype.hasOwnProperty.call(routes, action)) throw new Error('Unknown action: ' + action);
  return routes[action]();
}

function requireAdmin_(ctx) {
  if (!ctx || ctx.role !== 'admin') throw new Error('Admin access required.');
}

function requireTeacher_(ctx) {
  if (!ctx || (ctx.role !== 'teacher' && ctx.role !== 'admin')) throw new Error('Teacher access required.');
}

function out_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
