/**
 * Alamdar Edu. Inst. Hamray — Apps Script storage helpers.
 *
 * IMPORTANT:
 * - All API routes that read-modify-write collections must execute inside
 *   withDataLock_(). Do not lock only write_(), because the read happened earlier.
 * - Keep the AIEM_Data folder private to the Apps Script owner.
 * - Back up the folder before migrating existing records.
 */

function withDataLock_(callback) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) {
    throw new Error('The school database is busy. Please try again.');
  }
  try {
    return callback();
  } finally {
    lock.releaseLock();
  }
}

function folder_() {
  const folders = DriveApp.getFoldersByName(CONFIG.FOLDER_NAME);
  if (!folders.hasNext()) {
    return DriveApp.createFolder(CONFIG.FOLDER_NAME);
  }
  const folder = folders.next();
  if (folders.hasNext()) {
    throw new Error('Multiple data folders named "' + CONFIG.FOLDER_NAME +
      '" were found. Stop and consolidate them before continuing.');
  }
  return folder;
}

function file_(name) {
  if (!/^[a-z][a-z0-9_-]*$/i.test(String(name))) {
    throw new Error('Invalid data collection name.');
  }
  const files = folder_().getFilesByName(name + '.json');
  if (!files.hasNext()) return null;
  const file = files.next();
  if (files.hasNext()) {
    throw new Error('Multiple files named "' + name +
      '.json" were found. Stop and consolidate them before continuing.');
  }
  return file;
}

function read_(name) {
  const file = file_(name);
  if (!file) return null;

  let parsed;
  try {
    parsed = JSON.parse(file.getBlob().getDataAsString('UTF-8'));
  } catch (error) {
    // Never convert corruption into an empty collection: a later write could
    // otherwise destroy the only remaining copy of the records.
    throw new Error('Data file "' + name + '.json" is unreadable. ' +
      'Restore it from backup before making changes.');
  }

  if (!Array.isArray(parsed)) {
    throw new Error('Data file "' + name + '.json" must contain a JSON array.');
  }
  return parsed;
}

function write_(name, records) {
  if (!Array.isArray(records)) {
    throw new Error('Only an array can be saved to "' + name + '".');
  }
  const text = JSON.stringify(records, null, 2);
  if (typeof text !== 'string') throw new Error('Could not serialize data.');

  const file = file_(name);
  if (file) {
    file.setContent(text);
  } else {
    folder_().createFile(name + '.json', text, MimeType.JSON);
  }
}

function deleteById_(collection, id) {
  if (!id || typeof id !== 'string') throw new Error('A valid record ID is required.');
  return withDataLock_(function () {
    const records = read_(collection) || [];
    const next = records.filter(function (record) {
      return record && record.id !== id;
    });
    const deleted = records.length - next.length;
    if (deleted) write_(collection, next);
    return { deleted: deleted };
  });
}

function uuid_() {
  return Utilities.getUuid();
}

function now_() {
  return new Date().toISOString();
}
