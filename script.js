const languageButtons = document.querySelectorAll('.choose button');
languageButtons.forEach((button) => {
  button.addEventListener('click', () => {
    languageButtons.forEach((item) => item.classList.remove('active'));
    button.classList.add('active');
  });
});

const appointmentDialog = document.querySelector('#appointmentDialog');
const ownerLoginDialog = document.querySelector('#ownerLoginDialog');
const ownerLoginForm = document.querySelector('#ownerLoginForm');
const ownerLoginStatus = document.querySelector('#ownerLoginStatus');
const ownerLoginSubmit = document.querySelector('#ownerLoginSubmit');
const ownerPasswordInput = document.querySelector('#ownerPassword');
const toggleOwnerPassword = document.querySelector('#toggleOwnerPassword');
const categoryButtons = document.querySelectorAll('.categories button');
const serviceCards = document.querySelectorAll('#services1 .service-option');
const peoplePanel = document.querySelector('.people');
const serviceRadios = document.querySelectorAll('#services1 input[name="service"]');
const chooseButton = document.querySelector('#choose');
const serviceStep = document.querySelector('#serviceStep');
const dateStep = document.querySelector('#dateStep');
const detailsStep = document.querySelector('#detailsStep');
const successStep = document.querySelector('#successStep');
const successAppointmentText = document.querySelector('#successAppointmentText');
const stepNumber1 = document.querySelector('#stepNumber1');
const stepNumber2 = document.querySelector('#stepNumber2');
const stepNumber3 = document.querySelector('#stepNumber3');
const bookingTitle = document.querySelector('#bookingTitle');
const monthName = document.querySelector('#monthName');
const calendarDays = document.querySelector('#calendarDays');
const availableTimes = document.querySelector('#availableTimes');
const timeHeading = document.querySelector('#timeHeading');
const continueToDetails = document.querySelector('#continueToDetails');
const confirmAppointment = document.querySelector('#confirmAppointment');
const bookingPrivacyConsent = document.querySelector('#bookingPrivacyConsent');
const detailsForm = document.querySelector('#bookingDetailsForm');
const summaryService = document.querySelector('#summaryService');
const summaryDate = document.querySelector('#summaryDate');
const requestStatus = document.querySelector('#requestStatus');
const appointmentTimes = ['9:00 AM', '10:30 AM', '12:00 PM', '2:30 PM', '4:00 PM', '5:15 PM'];
const today = new Date();
const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
let displayedMonth = new Date(today.getFullYear(), today.getMonth(), 1);
let selectedDate = null;
let selectedTime = null;

function dateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function resetBookingSteps() {
  serviceStep.hidden = false;
  dateStep.hidden = true;
  detailsStep.hidden = true;
  successStep.hidden = true;
  appointmentDialog.classList.remove('dialog-details');
  appointmentDialog.classList.remove('booking-success');
  detailsForm.reset();
  confirmAppointment.disabled = true;
  requestStatus.textContent = 'By submitting, you agree to be contacted about your appointment.';
  stepNumber1.textContent = '1';
  stepNumber1.classList.add('active');
  stepNumber1.classList.remove('completed');
  stepNumber2.textContent = '2';
  stepNumber2.classList.remove('active', 'completed');
  stepNumber3.textContent = '3';
  stepNumber3.classList.remove('active', 'completed');
  bookingTitle.textContent = 'Choose your care';
  serviceRadios.forEach((radio) => { radio.checked = false; });
  chooseButton.disabled = true;
  peoplePanel.classList.remove('is-visible');
  appointmentDialog.classList.remove('dialog-tall');
  selectedDate = null;
  selectedTime = null;
  continueToDetails.disabled = true;
  renderCalendar();
}

function renderTimes() {
  availableTimes.replaceChildren();
  appointmentTimes.forEach((time) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'time-slot';
    button.textContent = time;
    button.disabled = !selectedDate;
    button.setAttribute('aria-pressed', String(selectedTime === time));
    if (selectedTime === time) button.classList.add('selected');
    button.addEventListener('click', () => {
      selectedTime = time;
      continueToDetails.disabled = false;
      renderTimes();
    });
    availableTimes.append(button);
  });
}

function renderCalendar() {
  monthName.textContent = displayedMonth.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric'
  });
  calendarDays.replaceChildren();

  const year = displayedMonth.getFullYear();
  const month = displayedMonth.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  for (let blank = 0; blank < firstWeekday; blank++) {
    const spacer = document.createElement('span');
    spacer.className = 'calendar-spacer';
    spacer.setAttribute('aria-hidden', 'true');
    calendarDays.append(spacer);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'calendar-day';
    button.textContent = day;
    button.disabled = date < todayStart || date.getDay() === 0;
    button.setAttribute('aria-label', date.toLocaleDateString('en-US', {
      month: 'long', day: 'numeric', year: 'numeric'
    }));
    if (selectedDate && dateKey(selectedDate) === dateKey(date)) {
      button.classList.add('selected');
      button.setAttribute('aria-pressed', 'true');
    }
    button.addEventListener('click', () => {
      selectedDate = date;
      selectedTime = null;
      continueToDetails.disabled = true;
      timeHeading.textContent = `Available times for ${date.toLocaleDateString('en-US', {
        month: 'short', day: 'numeric'
      })}`;
      renderCalendar();
      renderTimes();
    });
    calendarDays.append(button);
  }

  renderTimes();
}

function showServiceStep() {
  dateStep.hidden = true;
  detailsStep.hidden = true;
  serviceStep.hidden = false;
  stepNumber1.textContent = '1';
  stepNumber1.classList.add('active');
  stepNumber1.classList.remove('completed');
  stepNumber2.textContent = '2';
  stepNumber2.classList.remove('active', 'completed');
  stepNumber3.classList.remove('active', 'completed');
  bookingTitle.textContent = 'Choose your care';
}

document.querySelectorAll('.appointment').forEach((button) => {
  button.addEventListener('click', () => {
    resetBookingSteps();
    appointmentDialog.showModal();
  });
});

if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
document.querySelector('#closeDialog').addEventListener('click', () => appointmentDialog.close());
document.querySelector('#doneButton').addEventListener('click', () => appointmentDialog.close());
document.querySelector('#openDashboard').addEventListener('click', () => {
  ownerLoginForm.reset();
  ownerPasswordInput.type = 'password';
  toggleOwnerPassword.setAttribute('aria-pressed', 'false');
  toggleOwnerPassword.setAttribute('aria-label', 'Show password');
  ownerLoginStatus.textContent = '';
  ownerLoginDialog.showModal();
  ownerPasswordInput.focus();
});
document.querySelector('#closeOwnerLogin').addEventListener('click', () => ownerLoginDialog.close());
toggleOwnerPassword.addEventListener('click', () => {
  const showPassword = ownerPasswordInput.type === 'password';
  ownerPasswordInput.type = showPassword ? 'text' : 'password';
  toggleOwnerPassword.setAttribute('aria-pressed', String(showPassword));
  toggleOwnerPassword.setAttribute('aria-label', showPassword ? 'Hide password' : 'Show password');
  ownerPasswordInput.focus();
});
ownerLoginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  ownerLoginSubmit.disabled = true;
  ownerLoginStatus.textContent = 'Checking password…';
  try {
    const response = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: ownerPasswordInput.value })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Incorrect password.');
    window.location.assign('/admin.html');
  } catch (error) {
    ownerLoginStatus.textContent = error.message;
    ownerLoginSubmit.disabled = false;
    ownerPasswordInput.focus();
  }
});

categoryButtons.forEach((button) => {
  button.addEventListener('click', () => {
    categoryButtons.forEach((item) => {
      item.classList.remove('category-active');
      item.classList.add('category');
    });
    button.classList.remove('category');
    button.classList.add('category-active');

    serviceCards.forEach((card) => {
      card.hidden = card.dataset.category !== button.dataset.category;
      if (card.hidden) card.querySelector('input[name="service"]').checked = false;
    });
    peoplePanel.classList.remove('is-visible');
    appointmentDialog.classList.remove('dialog-tall');
    chooseButton.disabled = true;
  });
});

const initialCategory = document.querySelector('.categories .category-active');
if (initialCategory) initialCategory.click();

serviceRadios.forEach((radio) => {
  radio.addEventListener('change', () => {
    const showPeople = radio.value === 'in-person-consultation';
    peoplePanel.classList.toggle('is-visible', showPeople);
    appointmentDialog.classList.toggle('dialog-tall', showPeople);
    chooseButton.disabled = false;
  });
});

chooseButton.addEventListener('click', () => {
  if (chooseButton.disabled) return;
  serviceStep.hidden = true;
  dateStep.hidden = false;
  stepNumber1.textContent = '✓';
  stepNumber1.classList.remove('active');
  stepNumber1.classList.add('completed');
  stepNumber2.classList.add('active');
  bookingTitle.textContent = 'Pick a time.';
  renderCalendar();
});

document.querySelector('#previousMonth').addEventListener('click', () => {
  displayedMonth = new Date(displayedMonth.getFullYear(), displayedMonth.getMonth() - 1, 1);
  renderCalendar();
});
document.querySelector('#nextMonth').addEventListener('click', () => {
  displayedMonth = new Date(displayedMonth.getFullYear(), displayedMonth.getMonth() + 1, 1);
  renderCalendar();
});

document.querySelector('#backToServices').addEventListener('click', showServiceStep);

document.querySelector('#continueToDetails').addEventListener('click', () => {
  if (!selectedDate || !selectedTime) return;
  const selectedService = document.querySelector('#services1 input[name="service"]:checked');
  if (!selectedService) return;
  summaryService.textContent = selectedService.closest('.service-option')
    .querySelector('.service-name').textContent;
  const dateText = selectedDate.toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric'
  });
  summaryDate.textContent = `${dateText} at ${selectedTime}`;
  dateStep.hidden = true;
  detailsStep.hidden = false;
  appointmentDialog.classList.add('dialog-details');
  stepNumber2.textContent = '✓';
  stepNumber2.classList.remove('active');
  stepNumber2.classList.add('completed');
  stepNumber3.classList.add('active');
  bookingTitle.textContent = 'Tell us about you.';
  confirmAppointment.disabled = !detailsForm.checkValidity();
});

document.querySelector('#backToDate').addEventListener('click', () => {
  detailsStep.hidden = true;
  dateStep.hidden = false;
  appointmentDialog.classList.remove('dialog-details');
  stepNumber2.textContent = '2';
  stepNumber2.classList.remove('completed');
  stepNumber2.classList.add('active');
  stepNumber3.classList.remove('active');
  bookingTitle.textContent = 'Pick a time.';
});

detailsForm.addEventListener('input', () => {
  confirmAppointment.disabled = !detailsForm.checkValidity();
});
detailsForm.addEventListener('submit', (event) => {
  event.preventDefault();
  if (!detailsForm.reportValidity()) return;

  const selectedService = document.querySelector('#services1 input[name="service"]:checked');
  if (!selectedService || !selectedDate || !selectedTime) {
    requestStatus.textContent = 'Please select a service, date, and time first.';
    return;
  }

  const payload = {
    firstName: document.querySelector('#bookingFirstName').value.trim(),
    lastName: document.querySelector('#bookingLastName').value.trim(),
    phone: document.querySelector('#bookingPhone').value.trim(),
    email: document.querySelector('#bookingEmail').value.trim(),
    service: selectedService.closest('.service-option').querySelector('.service-name').textContent.trim(),
    date: dateKey(selectedDate),
    time: selectedTime,
    people: selectedService.value === 'in-person-consultation' ? people : 1,
    notes: document.querySelector('#bookingNotes').value.trim(),
    privacyConsent: bookingPrivacyConsent.checked
  };

  confirmAppointment.disabled = true;
  requestStatus.textContent = 'Sending your request…';
  fetch('/api/appointments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
    .then(async (response) => {
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not send your request.');
      const dateText = selectedDate.toLocaleDateString('en-US', {
        month: 'long', day: 'numeric'
      });
      successAppointmentText.textContent = `${payload.service} on ${dateText} at ${selectedTime}.`;
      detailsStep.hidden = true;
      successStep.hidden = false;
      appointmentDialog.classList.remove('dialog-details');
      appointmentDialog.classList.add('booking-success');
    })
    .catch((error) => {
      requestStatus.textContent = `${error.message} Please try again.`;
      confirmAppointment.disabled = false;
    });
});

let people = 1;
const peopleCountText = document.querySelector('#peopleCount');
const totalText = document.querySelector('#total');
function updateTotal() {
  peopleCountText.textContent = people;
  totalText.textContent = `$${(10 + (people - 1) * 5).toFixed(2)}`;
}
document.querySelector('#plus').addEventListener('click', () => {
  if (people < 10) { people++; updateTotal(); }
});
document.querySelector('#minus').addEventListener('click', () => {
  if (people > 1) { people--; updateTotal(); }
});

renderCalendar();
