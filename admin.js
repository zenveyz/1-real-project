const requestList = document.querySelector('#requestList');
const requestDetails = document.querySelector('#requestDetails');
const listMessage = document.querySelector('#listMessage');
const searchRequests = document.querySelector('#searchRequests');
let appointments = [];
let selectedId = null;

function formatDate(value, withYear = true) {
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value || 'Date not available';
  return new Intl.DateTimeFormat('en-US', {
    month: 'long', day: 'numeric', ...(withYear ? { year: 'numeric' } : {})
  }).format(date);
}

function initials(appointment) {
  return `${appointment.firstName?.[0] || ''}${appointment.lastName?.[0] || ''}`.toLowerCase() || '•';
}

function statusLabel(status) {
  if (status === 'Arrived') return 'Arrived';
  if (status === 'No-show') return 'No-show';
  return 'New';
}

async function setAppointmentStatus(appointment, status) {
  const buttons = requestDetails.querySelectorAll('.attendance-button');
  buttons.forEach((button) => { button.disabled = true; });
  try {
    const response = await fetch(`/api/appointments/${encodeURIComponent(appointment.id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    const result = await response.json();
    if (response.status === 404 || response.status === 405) {
      throw new Error('The server is still running the old version. Restart it, then refresh this page.');
    }
    if (!response.ok) throw new Error(result.error || 'Could not update appointment status.');
    const index = appointments.findIndex((item) => item.id === appointment.id);
    if (index !== -1) appointments[index] = result.appointment;
    showDetails(result.appointment);
  } catch (error) {
    listMessage.textContent = error.message;
    buttons.forEach((button) => { button.disabled = false; });
  }
}

async function deleteAppointment(appointment, button) {
  const patientName = `${appointment.firstName} ${appointment.lastName}`.trim();
  if (!window.confirm(`Permanently delete the request from ${patientName}? This cannot be undone.`)) return;
  button.disabled = true;
  try {
    const response = await fetch(`/api/appointments/${encodeURIComponent(appointment.id)}`, { method: 'DELETE' });
    const result = await response.json();
    if (response.status === 404 || response.status === 405) {
      throw new Error('The server is still running the old version. Restart it, then refresh this page.');
    }
    if (!response.ok) throw new Error(result.error || 'Could not delete appointment request.');
    appointments = appointments.filter((item) => item.id !== appointment.id);
    selectedId = appointments[0]?.id || null;
    renderList();
    const selected = appointments.find((item) => item.id === selectedId);
    if (selected) showDetails(selected);
    else requestDetails.innerHTML = '<div class="empty-details">Select a request to see its details.</div>';
    listMessage.textContent = 'Appointment request deleted.';
  } catch (error) {
    listMessage.textContent = error.message;
    button.disabled = false;
  }
}

function showDetails(appointment) {
  selectedId = appointment.id;
  requestDetails.replaceChildren();

  const heading = document.createElement('div');
  heading.className = 'detail-heading';
  const headingText = document.createElement('div');
  const label = document.createElement('p');
  label.className = 'detail-label';
  label.textContent = 'REQUEST DETAILS';
  const name = document.createElement('h2');
  name.textContent = `${appointment.firstName} ${appointment.lastName}`;
  if (appointment.status === 'Arrived' || appointment.status === 'No-show') {
    name.classList.add('marked-name');
  }
  const status = document.createElement('span');
  status.className = `status-badge${appointment.status === 'Arrived' ? ' status-arrived' : appointment.status === 'No-show' ? ' status-no-show' : ''}`;
  status.textContent = statusLabel(appointment.status);
  headingText.append(label, name);
  const actions = document.createElement('div');
  actions.className = 'detail-actions';
  actions.append(status);
  const attendanceActions = document.createElement('div');
  attendanceActions.className = 'attendance-actions';
  [
    { value: 'Arrived', label: 'Arrived' },
    { value: 'No-show', label: 'No-show' }
  ].forEach(({ value, label: buttonLabel }) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `attendance-button${appointment.status === value ? ' active' : ''}`;
    button.textContent = buttonLabel;
    button.setAttribute('aria-pressed', String(appointment.status === value));
    button.addEventListener('click', () => {
      setAppointmentStatus(appointment, appointment.status === value ? 'New' : value);
    });
    attendanceActions.append(button);
  });
  actions.append(attendanceActions);
  const deleteButton = document.createElement('button');
  deleteButton.type = 'button';
  deleteButton.className = 'delete-request-button';
  deleteButton.textContent = 'Delete request';
  deleteButton.addEventListener('click', () => deleteAppointment(appointment, deleteButton));
  actions.append(deleteButton);
  heading.append(headingText, actions);

  const card = document.createElement('section');
  card.className = 'appointment-card';
  const cardLabel = document.createElement('p');
  cardLabel.className = 'detail-label';
  cardLabel.textContent = 'APPOINTMENT';
  const service = document.createElement('h3');
  service.textContent = appointment.service || 'Service not specified';
  const date = document.createElement('p');
  date.textContent = `${formatDate(appointment.date)}, ${appointment.time || 'Time not specified'}`;
  card.append(cardLabel, service, date);

  const phoneBlock = document.createElement('div');
  phoneBlock.className = 'contact-block';
  const phoneLabel = document.createElement('p');
  phoneLabel.className = 'detail-label';
  phoneLabel.textContent = 'PHONE';
  const phone = document.createElement('a');
  phone.href = `tel:${(appointment.phone || '').replace(/[^\d+]/g, '')}`;
  phone.textContent = appointment.phone || 'Not provided';
  phoneBlock.append(phoneLabel, phone);

  const emailBlock = document.createElement('div');
  emailBlock.className = 'contact-block';
  const emailLabel = document.createElement('p');
  emailLabel.className = 'detail-label';
  emailLabel.textContent = 'EMAIL';
  const email = document.createElement('a');
  email.href = `mailto:${appointment.email || ''}`;
  email.textContent = appointment.email || 'Not provided';
  emailBlock.append(emailLabel, email);

  const noteBlock = document.createElement('div');
  noteBlock.className = 'contact-block';
  const noteLabel = document.createElement('p');
  noteLabel.className = 'detail-label';
  noteLabel.textContent = 'PATIENT NOTE';
  const note = document.createElement('p');
  note.className = 'note-text';
  note.textContent = appointment.notes || 'No note provided';
  noteBlock.append(noteLabel, note);

  const peopleBlock = document.createElement('div');
  peopleBlock.className = 'contact-block';
  const peopleLabel = document.createElement('p');
  peopleLabel.className = 'detail-label';
  peopleLabel.textContent = 'PEOPLE';
  const people = document.createElement('p');
  people.textContent = String(appointment.people || 1);
  peopleBlock.append(peopleLabel, people);

  requestDetails.append(heading, card, phoneBlock, emailBlock, noteBlock, peopleBlock);
  renderList();
}

function renderList() {
  const query = searchRequests.value.trim().toLowerCase();
  const filtered = appointments.filter((item) =>
    `${item.firstName} ${item.lastName} ${item.service} ${item.email} ${item.phone}`.toLowerCase().includes(query)
  );
  requestList.replaceChildren();
  listMessage.textContent = appointments.length === 0
    ? 'No appointment requests yet. New bookings will appear here.'
    : filtered.length === 0 ? 'No requests match your search.' : '';

  filtered.forEach((appointment) => {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = `request-row${appointment.id === selectedId ? ' selected' : ''}`;
    const avatar = document.createElement('span');
    avatar.className = 'avatar';
    avatar.textContent = initials(appointment);
    const text = document.createElement('span');
    const name = document.createElement('span');
    name.className = 'row-name';
    name.textContent = `${appointment.firstName} ${appointment.lastName}`;
    const service = document.createElement('span');
    service.className = 'row-service';
    service.textContent = `${appointment.service} · ${statusLabel(appointment.status)}`;
    if (appointment.status === 'Arrived' || appointment.status === 'No-show') {
      name.classList.add('row-name-marked');
    }
    text.append(name, service);
    const when = document.createElement('span');
    when.className = 'row-date';
    const date = document.createElement('strong');
    date.textContent = formatDate(appointment.date);
    const time = document.createElement('span');
    time.textContent = appointment.time || '';
    when.append(date, time);
    row.append(avatar, text, when);
    row.addEventListener('click', () => showDetails(appointment));
    requestList.append(row);
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const upcomingCount = appointments.filter((item) => new Date(`${item.date}T12:00:00`) >= today).length;
  document.querySelector('#totalRequests').textContent = appointments.length;
  document.querySelector('#upcomingRequests').textContent = upcomingCount;
  document.querySelector('#pastRequests').textContent = appointments.length - upcomingCount;
}

async function loadAppointments() {
  listMessage.textContent = 'Loading requests…';
  try {
    const response = await fetch('/api/appointments', { cache: 'no-store' });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Could not load requests.');
    appointments = result.appointments || [];
    if (selectedId && !appointments.some((item) => item.id === selectedId)) selectedId = null;
    if (!selectedId && appointments.length) selectedId = appointments[0].id;
    renderList();
    const selected = appointments.find((item) => item.id === selectedId);
    if (selected) showDetails(selected);
    else requestDetails.innerHTML = '<div class="empty-details">Select a request to see its details.</div>';
  } catch (error) {
    listMessage.textContent = `${error.message} Make sure the server is running, then refresh this page.`;
  }
}

searchRequests.addEventListener('input', renderList);
document.querySelector('#refreshRequests').addEventListener('click', loadAppointments);
document.querySelector('#logoutButton').addEventListener('click', async () => {
  try {
    await fetch('/api/logout', { method: 'POST' });
  } finally {
    window.location.assign('/');
  }
});
loadAppointments();
