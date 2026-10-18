const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID, randomBytes, timingSafeEqual, createHash } = require('node:crypto');

const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const HOST = process.env.HOST || (IS_PRODUCTION ? '0.0.0.0' : '127.0.0.1');
const PORT = Number(process.env.PORT) || 3000;
const ROOT = __dirname;
const DATA_FILE = path.join(ROOT, 'data', 'appointments.ndjson');
const MAX_BODY_BYTES = 10_000;
const OWNER_PASSWORD = process.env.OWNER_PASSWORD || (IS_PRODUCTION ? '' : 'kosmic');
const ACCEPT_REAL_APPOINTMENTS = process.env.ACCEPT_REAL_APPOINTMENTS === 'true';
const PRIVACY_NOTICE_VERSION = process.env.PRIVACY_NOTICE_VERSION || 'local-draft';
const ownerSessions = new Set();
const loginAttempts = new Map();
let database = null;
const PUBLIC_FILES = new Set(['mainpage.html', 'style.css', 'script.js', 'admin.html', 'admin.css', 'admin.js', 'privacy.html']);

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp'
};

function sendJson(response, status, body) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  });
  response.end(JSON.stringify(body));
}

function cleanText(value, maxLength) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function sessionHash(token) {
  return createHash('sha256').update(token).digest('hex');
}

async function hasOwnerSession(request) {
  const cookies = request.headers.cookie || '';
  const match = cookies.match(/(?:^|;\s*)owner_session=([a-f0-9]{64})(?:;|$)/);
  if (!match) return false;
  if (!database) return ownerSessions.has(match[1]);
  const result = await database.query(
    'SELECT 1 FROM owner_sessions WHERE token_hash = $1 AND expires_at > NOW()',
    [sessionHash(match[1])]
  );
  return result.rowCount > 0;
}

async function loginOwner(request, response) {
  const remoteAddress = request.headers['x-forwarded-for']?.split(',')[0]?.trim() || request.socket.remoteAddress || 'unknown';
  const attempt = loginAttempts.get(remoteAddress) || { count: 0, firstAttemptAt: Date.now() };
  if (Date.now() - attempt.firstAttemptAt > 15 * 60_000) {
    attempt.count = 0;
    attempt.firstAttemptAt = Date.now();
  }
  if (attempt.count >= 5) {
    sendJson(response, 429, { error: 'Too many attempts. Please wait 15 minutes and try again.' });
    return;
  }

  let rawBody = '';
  for await (const chunk of request) {
    rawBody += chunk;
    if (Buffer.byteLength(rawBody) > 2_000) {
      sendJson(response, 413, { error: 'Request is too large.' });
      return;
    }
  }

  let input;
  try {
    input = JSON.parse(rawBody);
  } catch {
    sendJson(response, 400, { error: 'Invalid password request.' });
    return;
  }
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    sendJson(response, 400, { error: 'Invalid password request.' });
    return;
  }

  const submittedPassword = Buffer.from((typeof input.password === 'string' ? input.password : '').trim());
  const expectedPassword = Buffer.from(OWNER_PASSWORD);
  const matches = submittedPassword.length === expectedPassword.length && timingSafeEqual(submittedPassword, expectedPassword);
  if (!matches) {
    attempt.count++;
    loginAttempts.set(remoteAddress, attempt);
    sendJson(response, 401, { error: 'Incorrect password. Please try again.' });
    return;
  }

  loginAttempts.delete(remoteAddress);
  const token = randomBytes(32).toString('hex');
  if (database) {
    await database.query('DELETE FROM owner_sessions WHERE expires_at <= NOW()');
    await database.query(
      'INSERT INTO owner_sessions (token_hash, expires_at) VALUES ($1, NOW() + INTERVAL \'8 hours\')',
      [sessionHash(token)]
    );
  } else {
    ownerSessions.add(token);
  }
  response.writeHead(200, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Set-Cookie': `owner_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${IS_PRODUCTION ? '; Secure' : ''}`
  });
  response.end(JSON.stringify({ ok: true }));
}

async function saveAppointment(request, response) {
  if (IS_PRODUCTION && !ACCEPT_REAL_APPOINTMENTS) {
    sendJson(response, 503, { error: 'Online booking is not enabled yet. Please contact the clinic directly.' });
    return;
  }

  let rawBody = '';
  for await (const chunk of request) {
    rawBody += chunk;
    if (Buffer.byteLength(rawBody) > MAX_BODY_BYTES) {
      sendJson(response, 413, { error: 'Request is too large.' });
      return;
    }
  }

  let input;
  try {
    input = JSON.parse(rawBody);
  } catch {
    sendJson(response, 400, { error: 'Invalid request data.' });
    return;
  }
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    sendJson(response, 400, { error: 'Invalid request data.' });
    return;
  }

  const appointment = {
    id: randomUUID(),
    receivedAt: new Date().toISOString(),
    firstName: cleanText(input.firstName, 80),
    lastName: cleanText(input.lastName, 80),
    phone: cleanText(input.phone, 40),
    email: cleanText(input.email, 254),
    service: cleanText(input.service, 120),
    date: cleanText(input.date, 10),
    time: cleanText(input.time, 20),
    people: Number(input.people),
    notes: cleanText(input.notes, 1000),
    privacyConsentAt: input.privacyConsent === true ? new Date().toISOString() : null,
    privacyNoticeVersion: PRIVACY_NOTICE_VERSION,
    status: 'New'
  };

  const valid = appointment.firstName && appointment.lastName && appointment.phone &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(appointment.email) && appointment.service &&
    /^\d{4}-\d{2}-\d{2}$/.test(appointment.date) && appointment.time &&
    Number.isInteger(appointment.people) && appointment.people >= 1 && appointment.people <= 10 &&
    appointment.privacyConsentAt;

  if (!valid) {
    sendJson(response, 400, { error: 'Please check the required appointment details.' });
    return;
  }

  if (database) {
    try {
      const { rows } = await database.query(
        `INSERT INTO appointments
          (id, received_at, first_name, last_name, phone, email, service, appointment_date, appointment_time, people, notes, privacy_consent_at, privacy_notice_version, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'New')
         RETURNING id`,
        [appointment.id, appointment.receivedAt, appointment.firstName, appointment.lastName,
          appointment.phone, appointment.email, appointment.service, appointment.date,
          appointment.time, appointment.people, appointment.notes, appointment.privacyConsentAt, appointment.privacyNoticeVersion]
      );
      sendJson(response, 201, { ok: true, id: rows[0].id });
    } catch (error) {
      console.error('Could not save appointment:', error.message);
      sendJson(response, 500, { error: 'The request could not be saved. Please try again later.' });
    }
    return;
  }

  try {
    await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
    await fs.appendFile(DATA_FILE, `${JSON.stringify(appointment)}\n`, { encoding: 'utf8', mode: 0o600 });
    sendJson(response, 201, { ok: true, id: appointment.id });
  } catch (error) {
    console.error('Could not save appointment:', error.message);
    sendJson(response, 500, { error: 'The request could not be saved. Please try again later.' });
  }
}

async function updateAppointmentStatus(request, response, id) {
  let rawBody = '';
  for await (const chunk of request) {
    rawBody += chunk;
    if (Buffer.byteLength(rawBody) > 2_000) {
      sendJson(response, 413, { error: 'Request is too large.' });
      return;
    }
  }

  let input;
  try {
    input = JSON.parse(rawBody);
  } catch {
    sendJson(response, 400, { error: 'Invalid status request.' });
    return;
  }
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    sendJson(response, 400, { error: 'Invalid status request.' });
    return;
  }

  if (!['New', 'Arrived', 'No-show'].includes(input.status)) {
    sendJson(response, 400, { error: 'Invalid appointment status.' });
    return;
  }

  if (database) {
    try {
      const { rows } = await database.query(
        `UPDATE appointments SET status = $1 WHERE id = $2
         RETURNING id, received_at, first_name, last_name, phone, email, service,
                   appointment_date, appointment_time, people, notes, privacy_consent_at,
                   privacy_notice_version, status`,
        [input.status, id]
      );
      if (!rows.length) {
        sendJson(response, 404, { error: 'Appointment not found.' });
        return;
      }
      sendJson(response, 200, { ok: true, appointment: appointmentFromRow(rows[0]) });
    } catch (error) {
      console.error('Could not update appointment status:', error.message);
      sendJson(response, 500, { error: 'Could not update appointment status.' });
    }
    return;
  }

  try {
    const content = await fs.readFile(DATA_FILE, 'utf8');
    const appointments = content.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
    const appointment = appointments.find((item) => item.id === id);
    if (!appointment) {
      sendJson(response, 404, { error: 'Appointment not found.' });
      return;
    }

    appointment.status = input.status;
    const updatedContent = appointments.map((item) => JSON.stringify(item)).join('\n') + '\n';
    const temporaryFile = `${DATA_FILE}.${randomUUID()}.tmp`;
    await fs.writeFile(temporaryFile, updatedContent, { encoding: 'utf8', mode: 0o600 });
    await fs.rename(temporaryFile, DATA_FILE);
    sendJson(response, 200, { ok: true, appointment });
  } catch (error) {
    console.error('Could not update appointment status:', error.message);
    sendJson(response, 500, { error: 'Could not update appointment status.' });
  }
}

async function deleteAppointment(response, id) {
  if (database) {
    try {
      const result = await database.query('DELETE FROM appointments WHERE id = $1 RETURNING id', [id]);
      if (!result.rowCount) {
        sendJson(response, 404, { error: 'Appointment not found.' });
        return;
      }
      sendJson(response, 200, { ok: true, id });
    } catch (error) {
      console.error('Could not delete appointment:', error.message);
      sendJson(response, 500, { error: 'Could not delete appointment.' });
    }
    return;
  }

  try {
    const content = await fs.readFile(DATA_FILE, 'utf8');
    const appointments = content.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
    const remaining = appointments.filter((item) => item.id !== id);
    if (remaining.length === appointments.length) {
      sendJson(response, 404, { error: 'Appointment not found.' });
      return;
    }
    const temporaryFile = `${DATA_FILE}.${randomUUID()}.tmp`;
    await fs.writeFile(temporaryFile, remaining.length ? `${remaining.map((item) => JSON.stringify(item)).join('\n')}\n` : '', { encoding: 'utf8', mode: 0o600 });
    await fs.rename(temporaryFile, DATA_FILE);
    sendJson(response, 200, { ok: true, id });
  } catch (error) {
    console.error('Could not delete appointment:', error.message);
    sendJson(response, 500, { error: 'Could not delete appointment.' });
  }
}

function appointmentFromRow(row) {
  return {
    id: row.id,
    receivedAt: row.received_at instanceof Date ? row.received_at.toISOString() : row.received_at,
    firstName: row.first_name,
    lastName: row.last_name,
    phone: row.phone,
    email: row.email,
    service: row.service,
    date: row.appointment_date,
    time: row.appointment_time,
    people: row.people,
    notes: row.notes,
    privacyConsentAt: row.privacy_consent_at instanceof Date ? row.privacy_consent_at.toISOString() : row.privacy_consent_at,
    privacyNoticeVersion: row.privacy_notice_version,
    status: row.status
  };
}

async function initializeDatabase() {
  if (!process.env.DATABASE_URL) {
    if (IS_PRODUCTION) throw new Error('DATABASE_URL is required in production.');
    return;
  }

  const { Pool } = require('pg');
  database = new Pool({ connectionString: process.env.DATABASE_URL, max: 5 });
  database.on('error', (error) => console.error('Database pool error:', error.message));
  await database.query(`
    CREATE TABLE IF NOT EXISTS appointments (
      id UUID PRIMARY KEY,
      received_at TIMESTAMPTZ NOT NULL,
      first_name VARCHAR(80) NOT NULL,
      last_name VARCHAR(80) NOT NULL,
      phone VARCHAR(40) NOT NULL,
      email VARCHAR(254) NOT NULL,
      service VARCHAR(120) NOT NULL,
      appointment_date DATE NOT NULL,
      appointment_time VARCHAR(20) NOT NULL,
      people INTEGER NOT NULL CHECK (people BETWEEN 1 AND 10),
      notes VARCHAR(1000) NOT NULL DEFAULT '',
      privacy_consent_at TIMESTAMPTZ,
      privacy_notice_version VARCHAR(40) NOT NULL DEFAULT 'local-draft',
      status VARCHAR(20) NOT NULL DEFAULT 'New' CHECK (status IN ('New', 'Arrived', 'No-show'))
    );
    ALTER TABLE appointments ADD COLUMN IF NOT EXISTS privacy_consent_at TIMESTAMPTZ;
    ALTER TABLE appointments ADD COLUMN IF NOT EXISTS privacy_notice_version VARCHAR(40) NOT NULL DEFAULT 'local-draft';
    CREATE TABLE IF NOT EXISTS owner_sessions (
      token_hash CHAR(64) PRIMARY KEY,
      expires_at TIMESTAMPTZ NOT NULL
    );
    CREATE INDEX IF NOT EXISTS owner_sessions_expiry_idx ON owner_sessions (expires_at);
    CREATE INDEX IF NOT EXISTS appointments_date_idx ON appointments (appointment_date);
  `);
}

async function endOwnerSession(request, response) {
  const cookies = request.headers.cookie || '';
  const match = cookies.match(/(?:^|;\s*)owner_session=([a-f0-9]{64})(?:;|$)/);
  if (match) {
    if (database) {
      await database.query('DELETE FROM owner_sessions WHERE token_hash = $1', [sessionHash(match[1])]);
    } else {
      ownerSessions.delete(match[1]);
    }
  }
  response.writeHead(200, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Set-Cookie': `owner_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${IS_PRODUCTION ? '; Secure' : ''}`
  });
  response.end(JSON.stringify({ ok: true }));
}

async function handleRequest(request, response) {
  const requestUrl = new URL(request.url, `http://${request.headers.host || 'localhost'}`);

  if (request.method === 'GET' && requestUrl.pathname === '/healthz') {
    sendJson(response, 200, { ok: true });
    return;
  }

  if (request.method === 'POST' && requestUrl.pathname === '/api/login') {
    await loginOwner(request, response);
    return;
  }

  if (request.method === 'POST' && requestUrl.pathname === '/api/logout') {
    await endOwnerSession(request, response);
    return;
  }

  if (request.method === 'GET' && requestUrl.pathname === '/api/appointments') {
    if (!await hasOwnerSession(request)) {
      sendJson(response, 401, { error: 'Owner sign-in required.' });
      return;
    }
    if (database) {
      try {
        const { rows } = await database.query(
          `SELECT id, received_at, first_name, last_name, phone, email, service,
                  appointment_date, appointment_time, people, notes, privacy_consent_at,
                  privacy_notice_version, status
           FROM appointments ORDER BY received_at DESC`
        );
        sendJson(response, 200, { appointments: rows.map(appointmentFromRow) });
      } catch (error) {
        console.error('Could not read appointments:', error.message);
        sendJson(response, 500, { error: 'Could not load appointment requests.' });
      }
      return;
    }
    try {
      const content = await fs.readFile(DATA_FILE, 'utf8');
      const appointments = content.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line)).reverse();
      sendJson(response, 200, { appointments });
    } catch (error) {
      if (error.code === 'ENOENT') {
        sendJson(response, 200, { appointments: [] });
      } else {
        console.error('Could not read appointments:', error.message);
        sendJson(response, 500, { error: 'Could not load appointment requests.' });
      }
    }
    return;
  }

  const statusMatch = requestUrl.pathname.match(/^\/api\/appointments\/([^/]+)$/);
  if (request.method === 'PATCH' && statusMatch) {
    if (!await hasOwnerSession(request)) {
      sendJson(response, 401, { error: 'Owner sign-in required.' });
      return;
    }
    await updateAppointmentStatus(request, response, decodeURIComponent(statusMatch[1]));
    return;
  }

  if (request.method === 'DELETE' && statusMatch) {
    if (!await hasOwnerSession(request)) {
      sendJson(response, 401, { error: 'Owner sign-in required.' });
      return;
    }
    await deleteAppointment(response, decodeURIComponent(statusMatch[1]));
    return;
  }

  if (request.method === 'POST' && requestUrl.pathname === '/api/appointments') {
    await saveAppointment(request, response);
    return;
  }

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    sendJson(response, 405, { error: 'Method not allowed.' });
    return;
  }

  if (requestUrl.pathname === '/admin.html' && !await hasOwnerSession(request)) {
    response.writeHead(302, { Location: '/', 'Cache-Control': 'no-store' });
    response.end();
    return;
  }

  const requestedPath = requestUrl.pathname === '/' ? '/mainpage.html' : decodeURIComponent(requestUrl.pathname);
  const filePath = path.resolve(ROOT, `.${requestedPath}`);
  const relativePath = path.relative(ROOT, filePath);
  const isPublicFile = PUBLIC_FILES.has(relativePath) || relativePath.startsWith(`Images${path.sep}`);
  if (!filePath.startsWith(`${ROOT}${path.sep}`) || !isPublicFile) {
    response.writeHead(404);
    response.end('Forbidden');
    return;
  }

  try {
    const file = await fs.readFile(filePath);
    response.writeHead(200, {
      'Content-Type': contentTypes[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff'
    });
    response.end(request.method === 'HEAD' ? undefined : file);
  } catch {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Not found');
  }
}

const server = http.createServer((request, response) => {
  handleRequest(request, response).catch((error) => {
    console.error('Unhandled request error:', error.message);
    if (!response.headersSent) {
      sendJson(response, 500, { error: 'The server could not complete the request.' });
    } else {
      response.destroy();
    }
  });
});

async function startServer() {
  if (IS_PRODUCTION && (!OWNER_PASSWORD || OWNER_PASSWORD.length < 16)) {
    throw new Error('Set OWNER_PASSWORD to a secret of at least 16 characters in production.');
  }
  if (IS_PRODUCTION && ACCEPT_REAL_APPOINTMENTS && PRIVACY_NOTICE_VERSION.includes('draft')) {
    throw new Error('Set PRIVACY_NOTICE_VERSION to the approved notice version before enabling real appointments.');
  }
  await initializeDatabase();
  server.listen(PORT, HOST, () => {
    console.log(`Dental booking form running on ${HOST}:${PORT}`);
  });
}

startServer().catch((error) => {
  console.error('Could not start the dental booking server:', error.message);
  process.exitCode = 1;
});
