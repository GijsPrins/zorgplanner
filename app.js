import { initializeApp } from "firebase/app";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
} from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  getFirestore,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { firebaseConfig } from "./firebase-config.js";

const themeKey = "carePlannerReadableMode";
const familyId = getFamilyId();
const accessKey = `carePlannerAccess:${familyId}`;

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);
const familyRef = doc(db, "families", familyId);
const peopleRef = collection(db, "families", familyId, "people");
const appointmentsRef = collection(db, "families", familyId, "appointments");

const attendanceStatuses = {
  unknown: "Invullen",
  joining: "Aanwezig",
  declined: "Afwezig",
};

const form = document.querySelector("#appointmentForm");
const personForm = document.querySelector("#personForm");
const formTitle = document.querySelector("#formTitle");
const appointmentIdInput = document.querySelector("#appointmentId");
const titleInput = document.querySelector("#titleInput");
const dateInput = document.querySelector("#dateInput");
const timeInput = document.querySelector("#timeInput");
const reasonInput = document.querySelector("#reasonInput");
const hospitalInput = document.querySelector("#hospitalInput");
const locationInput = document.querySelector("#locationInput");
const doctorInput = document.querySelector("#doctorInput");
const attendanceEditor = document.querySelector("#attendanceEditor");
const notesInput = document.querySelector("#notesInput");
const appointmentList = document.querySelector("#appointmentList");
const appointmentTemplate = document.querySelector("#appointmentTemplate");
const peopleList = document.querySelector("#peopleList");
const personNameInput = document.querySelector("#personNameInput");
const accessShell = document.querySelector("#accessShell");
const accessForm = document.querySelector("#accessForm");
const passwordInput = document.querySelector("#passwordInput");
const accessMessage = document.querySelector("#accessMessage");
const accessSubmit = document.querySelector("#accessSubmit");
const appShell = document.querySelector("#appShell");
const nextAppointment = document.querySelector("#nextAppointment");
const resetButton = document.querySelector("#resetButton");
const contrastToggle = document.querySelector("#contrastToggle");
const speakButton = document.querySelector("#speakButton");
const filterButtons = document.querySelectorAll("[data-filter]");
const periodFilter = document.querySelector("#periodFilter");
const periodStartInput = document.querySelector("#periodStartInput");
const periodEndInput = document.querySelector("#periodEndInput");
const clearPeriodButton = document.querySelector("#clearPeriodButton");

let plannerState = createEmptyPlannerState();
let activeFilter = "upcoming";
let activePeriod = {
  start: "",
  end: "",
};
const expandedAppointmentIds = new Set();
let unsubscribePeople = null;
let unsubscribeAppointments = null;

applySavedTheme();
render();
initializeAccess();

accessForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const password = passwordInput.value;
  if (!password) return;

  await unlockPlanner(password);
});

personForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const name = personNameInput.value.trim();
  if (!name) return;

  const person = {
    id: createId(),
    name,
  };

  plannerState.people.push(person);

  personNameInput.value = "";
  render();
  await savePerson(person);
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const appointment = {
    id: appointmentIdInput.value || createId(),
    title: titleInput.value.trim(),
    date: dateInput.value,
    time: timeInput.value,
    reason: reasonInput.value.trim(),
    hospital: hospitalInput.value.trim(),
    location: locationInput.value.trim(),
    doctor: doctorInput.value.trim(),
    attendance: collectAttendance(),
    notes: notesInput.value.trim(),
  };

  const existingIndex = plannerState.appointments.findIndex(
    (item) => item.id === appointment.id,
  );
  if (existingIndex >= 0) {
    plannerState.appointments[existingIndex] = appointment;
  } else {
    plannerState.appointments.push(appointment);
  }

  resetForm();
  render();
  await saveAppointment(appointment);
});

resetButton.addEventListener("click", resetForm);

contrastToggle.addEventListener("click", () => {
  const enabled = !document.body.classList.contains("readable");
  document.body.classList.toggle("readable", enabled);
  localStorage.setItem(themeKey, String(enabled));
  updateThemeButton(enabled);
});

speakButton.addEventListener("click", () => {
  if (window.speechSynthesis?.speaking) {
    window.speechSynthesis.cancel();
    updateSpeakButton(false);
    return;
  }

  speakText(createSpokenSummary());
});

filterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    setActiveFilter(button.dataset.filter);
    if (activeFilter === "period") {
      periodStartInput.focus();
    }
  });
});

[periodStartInput, periodEndInput].forEach((input) => {
  input.addEventListener("change", () => {
    activePeriod = {
      start: periodStartInput.value,
      end: periodEndInput.value,
    };
    setActiveFilter("period");
  });
});

clearPeriodButton.addEventListener("click", () => {
  periodStartInput.value = "";
  periodEndInput.value = "";
  activePeriod = {
    start: "",
    end: "",
  };
  setActiveFilter("upcoming");
});

function render() {
  renderPeople();
  renderAttendanceEditor();
  renderAppointments();
  updateSpeakButton(window.speechSynthesis?.speaking || false);
}

function renderPeople() {
  peopleList.replaceChildren();

  if (plannerState.people.length === 0) {
    const emptyState = document.createElement("p");
    emptyState.className = "empty-state small";
    emptyState.textContent =
      "Voeg eerst de familieleden toe die kunnen reageren.";
    peopleList.append(emptyState);
    return;
  }

  plannerState.people.forEach((person) => {
    const item = document.createElement("div");
    item.className = "person-row";

    const name = document.createElement("span");
    name.textContent = person.name;

    const deleteButton = document.createElement("button");
    deleteButton.className = "icon-button delete-button";
    deleteButton.type = "button";
    deleteButton.title = "Verwijderen";
    deleteButton.setAttribute("aria-label", `${person.name} verwijderen`);
    deleteButton.textContent = "Verwijderen";
    deleteButton.addEventListener("click", () => deletePerson(person.id));

    item.append(name, deleteButton);
    peopleList.append(item);
  });
}

function renderAttendanceEditor(appointment = getActiveAppointment()) {
  attendanceEditor.replaceChildren();

  if (plannerState.people.length === 0) {
    const emptyState = document.createElement("p");
    emptyState.className = "empty-state small";
    emptyState.textContent = "Nog geen mensen toegevoegd.";
    attendanceEditor.append(emptyState);
    return;
  }

  plannerState.people.forEach((person) => {
    const row = document.createElement("div");
    row.className = "attendance-row";

    const name = document.createElement("span");
    name.textContent = person.name;

    const options = document.createElement("div");
    options.className = "attendance-choice-group";
    options.dataset.personId = person.id;
    const currentStatus = appointment?.attendance?.[person.id] || "unknown";

    Object.entries(attendanceStatuses).forEach(([value, label]) => {
      const button = document.createElement("button");
      button.className = `attendance-choice ${value}`;
      button.type = "button";
      button.dataset.status = value;
      button.textContent = label;
      button.setAttribute("aria-pressed", String(value === currentStatus));
      button.addEventListener("click", () => {
        options.querySelectorAll(".attendance-choice").forEach((item) => {
          item.setAttribute("aria-pressed", String(item === button));
        });
      });
      options.append(button);
    });

    row.append(name, options);
    attendanceEditor.append(row);
  });
}

function renderAppointments() {
  const sortedAppointments = [...plannerState.appointments].sort(
    compareAppointments,
  );
  const visibleAppointments = getVisibleAppointments(sortedAppointments);

  renderNextAppointment(sortedAppointments);
  appointmentList.replaceChildren();

  if (visibleAppointments.length === 0) {
    const emptyState = document.createElement("p");
    emptyState.className = "empty-state";
    emptyState.textContent = emptyStateMessage();
    appointmentList.append(emptyState);
    return;
  }

  visibleAppointments.forEach((appointment) => {
    const card = appointmentTemplate.content.firstElementChild.cloneNode(true);
    const details = card.querySelector(".card-details");
    const toggleButton = card.querySelector(".details-toggle");
    const detailsId = `appointment-details-${appointment.id}`;
    const isExpanded = expandedAppointmentIds.has(appointment.id);

    card.querySelector(".date-line").textContent = formatDateTime(appointment);
    card.querySelector("h3").textContent = appointment.title;
    const summaryLine = card.querySelector(".summary-line");
    const companionsText = createCompanionsSummary(appointment);
    summaryLine.textContent = companionsText;
    summaryLine.classList.toggle(
      "empty",
      companionsText === "Nog niemand ingevuld",
    );
    details.id = detailsId;
    details.hidden = !isExpanded;
    toggleButton.setAttribute("aria-controls", detailsId);
    toggleButton.setAttribute("aria-expanded", String(isExpanded));
    toggleButton.textContent = isExpanded
      ? "Details verbergen"
      : "Details tonen";
    toggleButton.addEventListener("click", () =>
      toggleAppointmentDetails(appointment.id),
    );

    card
      .querySelector("dl")
      .append(
        createDetail("Waarom", appointment.reason || "Niet ingevuld"),
        createDetail("Ziekenhuis", appointment.hospital),
        createDetail("Locatie", appointment.location || "Niet ingevuld"),
        createDetail("Behandelaar", appointment.doctor || "Niet ingevuld"),
      );

    renderAttendanceSummary(
      card.querySelector(".attendance-summary"),
      appointment,
    );
    renderQuickAttendanceControls(details, appointment);

    const notes = card.querySelector(".notes");
    notes.textContent = appointment.notes;
    notes.hidden = !appointment.notes;

    const readButton = document.createElement("button");
    readButton.className =
      "secondary-button speak-button appointment-speak-button";
    readButton.type = "button";
    readButton.textContent = "Lees deze afspraak voor";
    readButton.addEventListener("click", () => speakAppointment(appointment));
    card.querySelector(".card-summary").append(readButton);
    details.append(card.querySelector(".card-actions"));

    card
      .querySelector(".edit-button")
      .addEventListener("click", () => editAppointment(appointment.id));
    card
      .querySelector(".delete-button")
      .addEventListener("click", () => deleteAppointment(appointment.id));

    appointmentList.append(card);
  });
}

function getVisibleAppointments(sortedAppointments) {
  if (activeFilter === "upcoming") {
    return sortedAppointments.filter(isUpcoming);
  }

  if (activeFilter === "history") {
    return sortedAppointments
      .filter((appointment) => !isUpcoming(appointment))
      .reverse();
  }

  if (activeFilter === "period") {
    return sortedAppointments.filter(isInSelectedPeriod);
  }

  return sortedAppointments;
}

function emptyStateMessage() {
  if (activeFilter === "upcoming") {
    return "Er staan nog geen komende afspraken in de planner.";
  }

  if (activeFilter === "history") {
    return "Er zijn nog geen afspraken geweest.";
  }

  if (activeFilter === "period") {
    return activePeriod.start || activePeriod.end
      ? "Er staan geen afspraken in deze periode."
      : "Kies een begin- en/of einddatum voor de periode.";
  }

  return "Er zijn nog geen afspraken opgeslagen.";
}

function setActiveFilter(filter) {
  activeFilter = filter;
  filterButtons.forEach((button) =>
    button.classList.toggle("active", button.dataset.filter === activeFilter),
  );
  periodFilter.hidden = activeFilter !== "period";
  renderAppointments();
}

function toggleAppointmentDetails(id) {
  if (expandedAppointmentIds.has(id)) {
    expandedAppointmentIds.delete(id);
  } else {
    expandedAppointmentIds.add(id);
  }

  renderAppointments();
}

function createCompanionsSummary(appointment) {
  const joiningPeople = plannerState.people
    .filter((person) => appointment.attendance[person.id] === "joining")
    .map((person) => person.name);

  if (joiningPeople.length === 0) return "Nog niemand ingevuld";
  if (joiningPeople.length <= 3) return joiningPeople.join(", ");

  const visibleNames = joiningPeople.slice(0, 3).join(", ");
  const remainingCount = joiningPeople.length - 3;
  return `${visibleNames} + ${remainingCount}`;
}

function renderAttendanceSummary(container, appointment) {
  container.replaceChildren();

  const heading = document.createElement("p");
  heading.className = "attendance-heading";
  heading.textContent = "Wie gaat mee";
  container.append(heading);

  if (plannerState.people.length === 0) {
    const empty = document.createElement("p");
    empty.className = "muted-line";
    empty.textContent = "Nog geen mensen toegevoegd.";
    container.append(empty);
    return;
  }

  const list = document.createElement("div");
  list.className = "attendance-pills";
  const groupedPeople = {
    joining: plannerState.people.filter(
      (person) => appointment.attendance[person.id] === "joining",
    ),
    declined: plannerState.people.filter(
      (person) => appointment.attendance[person.id] === "declined",
    ),
    unknown: plannerState.people.filter(
      (person) =>
        !appointment.attendance[person.id] ||
        appointment.attendance[person.id] === "unknown",
    ),
  };

  if (
    groupedPeople.joining.length === 0 &&
    groupedPeople.declined.length === 0
  ) {
    const pill = document.createElement("span");
    pill.className = "attendance-pill unknown";
    pill.textContent = "Nog niemand ingevuld";
    list.append(pill);
    container.append(list);
    return;
  }

  appendAttendanceGroup(list, "Gaat mee", groupedPeople.joining, "joining");
  appendAttendanceGroup(
    list,
    "Gaat niet mee",
    groupedPeople.declined,
    "declined",
  );
  appendAttendanceGroup(
    list,
    "Nog niet ingevuld",
    groupedPeople.unknown,
    "unknown",
  );

  container.append(list);
}

function appendAttendanceGroup(container, label, people, status) {
  if (people.length === 0) return;

  const group = document.createElement("div");
  group.className = "attendance-pill-group";

  const heading = document.createElement("p");
  heading.className = "attendance-group-heading";
  heading.textContent = label;
  group.append(heading);

  people.forEach((person) => {
    const pill = document.createElement("span");
    pill.className = `attendance-pill ${status}`;
    pill.textContent = person.name;
    group.append(pill);
  });

  container.append(group);
}

function renderQuickAttendanceControls(container, appointment) {
  if (plannerState.people.length === 0) return;

  const controls = document.createElement("div");
  controls.className = "quick-attendance";

  const heading = document.createElement("p");
  heading.className = "quick-attendance-heading";
  heading.textContent = "Aanwezigheid aanpassen";
  controls.append(heading);

  plannerState.people.forEach((person) => {
    const row = document.createElement("div");
    row.className = "quick-attendance-row";

    const name = document.createElement("span");
    name.textContent = person.name;

    const actions = document.createElement("div");
    actions.className = "quick-attendance-actions";

    const joiningButton = createAttendanceButton(
      appointment,
      person,
      "joining",
      "Aanwezig",
    );
    const declinedButton = createAttendanceButton(
      appointment,
      person,
      "declined",
      "Afwezig",
    );

    actions.append(joiningButton, declinedButton);
    row.append(name, actions);
    controls.append(row);
  });

  container.append(controls);
}

function createAttendanceButton(appointment, person, status, label) {
  const button = document.createElement("button");
  const currentStatus = appointment.attendance[person.id] || "unknown";
  button.className = `attendance-toggle ${status}`;
  button.type = "button";
  button.textContent = label;
  button.setAttribute("aria-pressed", String(currentStatus === status));
  button.addEventListener("click", () =>
    updateAttendanceStatus(appointment.id, person.id, status),
  );
  return button;
}

async function updateAttendanceStatus(appointmentId, personId, status) {
  plannerState.appointments = plannerState.appointments.map((appointment) => {
    if (appointment.id !== appointmentId) return appointment;

    const attendance = { ...appointment.attendance };
    attendance[personId] = attendance[personId] === status ? "unknown" : status;
    return { ...appointment, attendance };
  });

  renderAppointments();
  const appointment = plannerState.appointments.find(
    (item) => item.id === appointmentId,
  );
  if (appointment) await saveAppointment(appointment);
}

function createDetail(label, value) {
  const fragment = document.createDocumentFragment();
  const term = document.createElement("dt");
  const description = document.createElement("dd");
  term.textContent = label;
  description.textContent = value;
  fragment.append(term, description);
  return fragment;
}

function collectAttendance() {
  const attendance = {};
  attendanceEditor
    .querySelectorAll(".attendance-choice-group[data-person-id]")
    .forEach((group) => {
      const activeButton = group.querySelector(
        '.attendance-choice[aria-pressed="true"]',
      );
      attendance[group.dataset.personId] =
        activeButton?.dataset.status || "unknown";
    });
  return attendance;
}

function editAppointment(id) {
  const appointment = plannerState.appointments.find((item) => item.id === id);
  if (!appointment) return;

  appointmentIdInput.value = appointment.id;
  titleInput.value = appointment.title;
  dateInput.value = appointment.date;
  timeInput.value = appointment.time;
  reasonInput.value = appointment.reason;
  hospitalInput.value = appointment.hospital;
  locationInput.value = appointment.location;
  doctorInput.value = appointment.doctor;
  notesInput.value = appointment.notes;
  formTitle.textContent = "Afspraak bewerken";
  renderAttendanceEditor(appointment);
  titleInput.focus();
}

async function deleteAppointment(id) {
  const appointment = plannerState.appointments.find((item) => item.id === id);
  if (!appointment) return;

  const confirmed = confirm(`Afspraak verwijderen: ${appointment.title}?`);
  if (!confirmed) return;

  plannerState.appointments = plannerState.appointments.filter(
    (item) => item.id !== id,
  );
  resetForm();
  render();
  await deleteDoc(doc(appointmentsRef, id));
}

async function deletePerson(id) {
  const person = plannerState.people.find((item) => item.id === id);
  if (!person) return;

  const confirmed = confirm(`${person.name} verwijderen uit de planning?`);
  if (!confirmed) return;

  plannerState.people = plannerState.people.filter((item) => item.id !== id);
  plannerState.appointments = plannerState.appointments.map((appointment) => {
    const attendance = { ...appointment.attendance };
    delete attendance[id];
    return { ...appointment, attendance };
  });

  resetForm();
  render();
  await deleteDoc(doc(peopleRef, id));
  await Promise.all(plannerState.appointments.map(saveAppointment));
}

function resetForm() {
  form.reset();
  appointmentIdInput.value = "";
  formTitle.textContent = "Afspraak toevoegen";
  renderAttendanceEditor();
}

function getActiveAppointment() {
  return plannerState.appointments.find(
    (item) => item.id === appointmentIdInput.value,
  );
}

function renderNextAppointment(sortedAppointments) {
  const upcomingAppointment = sortedAppointments.find(isUpcoming);
  nextAppointment.textContent = upcomingAppointment
    ? `${upcomingAppointment.title} - ${formatDateTime(upcomingAppointment)}`
    : "Nog geen komende afspraken";
}

function createSpokenSummary() {
  const sortedAppointments = [...plannerState.appointments].sort(
    compareAppointments,
  );
  const upcomingAppointment = sortedAppointments.find(isUpcoming);

  if (!upcomingAppointment) {
    return "Er staan geen komende afspraken in de planner.";
  }

  return createAppointmentSpeechText(
    upcomingAppointment,
    "De volgende afspraak is",
  );
}

function speakAppointment(appointment) {
  speakText(createAppointmentSpeechText(appointment, "Deze afspraak is"));
}

function speakText(text) {
  if (
    !("speechSynthesis" in window) ||
    !("SpeechSynthesisUtterance" in window)
  ) {
    alert("Voorlezen wordt niet ondersteund door deze browser.");
    return;
  }

  if (window.speechSynthesis.speaking) {
    window.speechSynthesis.cancel();
  }

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "nl-NL";
  utterance.rate = 0.9;
  utterance.pitch = 1;
  utterance.onend = () => updateSpeakButton(false);
  utterance.onerror = () => updateSpeakButton(false);

  updateSpeakButton(true);
  window.speechSynthesis.speak(utterance);
}

function createAppointmentSpeechText(appointment, opening) {
  const joiningPeople = plannerState.people
    .filter((person) => appointment.attendance[person.id] === "joining")
    .map((person) => person.name);

  const attendanceText =
    joiningPeople.length > 0
      ? `${joiningPeople.join(", ")} gaat mee.`
      : "Er is nog niemand ingevuld die meegaat.";

  const locationParts = [appointment.hospital, appointment.location]
    .map((part) => part.trim())
    .filter(Boolean);
  const locationText =
    locationParts.length > 0
      ? `De locatie is ${locationParts.join(", ")}.`
      : "De locatie is nog niet ingevuld.";
  const doctorText = appointment.doctor
    ? `De behandelaar is ${appointment.doctor}.`
    : "De behandelaar is nog niet ingevuld.";
  const reasonText = appointment.reason
    ? `De reden is ${appointment.reason}.`
    : "";
  const notesText = appointment.notes
    ? `Praktische notities: ${appointment.notes}.`
    : "";

  return [
    `${opening} ${appointment.title}.`,
    `Dat is op ${formatDateTime(appointment)}.`,
    reasonText,
    locationText,
    doctorText,
    attendanceText,
    notesText,
  ]
    .filter(Boolean)
    .join(" ");
}

function updateSpeakButton(isSpeaking) {
  speakButton.textContent = isSpeaking ? "Stop voorlezen" : "Lees voor";
  speakButton.setAttribute("aria-pressed", String(isSpeaking));
}

function createEmptyPlannerState() {
  return {
    people: [],
    appointments: [],
  };
}

async function initializeAccess() {
  try {
    setAccessMessage("Verbinden...");
    const user = await getCurrentUser();

    if (
      localStorage.getItem(accessKey) === "granted" &&
      user?.email === getFamilyEmail(familyId)
    ) {
      showPlanner();
      await connectToFirebase();
      return;
    }

    showAccessForm();
  } catch (error) {
    console.error("Aanmelden is niet gelukt", error);
    setAccessMessage(createFirebaseAuthMessage(error), true);
  }
}

async function unlockPlanner(password) {
  try {
    setAccessSubmitting(true);
    setAccessMessage("Wachtwoord controleren...");

    await signInWithEmailAndPassword(auth, getFamilyEmail(familyId), password);
    localStorage.setItem(accessKey, "granted");
    passwordInput.value = "";

    showPlanner();
    await connectToFirebase();
  } catch (error) {
    console.error("Toegang verlenen is niet gelukt", error);
    setAccessMessage(createFunctionMessage(error), true);
  } finally {
    setAccessSubmitting(false);
  }
}

function showPlanner() {
  accessShell.hidden = true;
  appShell.hidden = false;
}

function showAccessForm(message = "") {
  localStorage.removeItem(accessKey);
  accessShell.hidden = false;
  appShell.hidden = true;
  setAccessMessage(message);
  passwordInput.focus();
}

function setAccessSubmitting(isSubmitting) {
  accessSubmit.disabled = isSubmitting;
  passwordInput.disabled = isSubmitting;
}

function setAccessMessage(message, isError = false) {
  accessMessage.textContent = message;
  accessMessage.classList.toggle("error", isError);
}

function createFirebaseAuthMessage(error) {
  if (error?.code === "auth/api-key-not-valid.-please-pass-a-valid-api-key.") {
    return "De Firebase API key klopt niet. Kopieer de web app-config opnieuw uit Firebase Console.";
  }

  if (error?.code === "auth/operation-not-allowed") {
    return "Email/password login staat nog niet aan in Firebase Authentication.";
  }

  if (error?.code === "auth/unauthorized-domain") {
    return "Dit domein is nog niet toegestaan in Firebase Authentication. Probeer localhost of voeg dit domein toe.";
  }

  if (error?.code === "auth/network-request-failed") {
    return "Firebase is niet bereikbaar. Controleer je internetverbinding en probeer opnieuw.";
  }

  return "Verbinden met Firebase is niet gelukt. Open de browserconsole voor de technische foutcode.";
}

function createFunctionMessage(error) {
  if (
    error?.code === "auth/wrong-password" ||
    error?.code === "auth/invalid-credential"
  ) {
    return "Het wachtwoord klopt niet.";
  }

  if (error?.code === "auth/user-not-found") {
    return "Deze familielink is nog niet ingericht in Firebase Authentication.";
  }

  if (error?.code === "auth/operation-not-allowed") {
    return "Email/password login staat nog niet aan in Firebase Authentication.";
  }

  return "Toegang controleren is niet gelukt. Open de browserconsole voor de technische foutcode.";
}

function getCurrentUser() {
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      resolve(user);
    });
  });
}

async function connectToFirebase() {
  try {
    await setDoc(
      familyRef,
      {
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );

    unsubscribePeople?.();
    unsubscribeAppointments?.();

    unsubscribePeople = onSnapshot(
      peopleRef,
      (snapshot) => {
        plannerState.people = snapshot.docs
          .map((personDoc) =>
            normalizePerson({ id: personDoc.id, ...personDoc.data() }),
          )
          .filter((person) => person.name)
          .sort((first, second) =>
            first.name.localeCompare(second.name, "nl-NL"),
          );
        render();
      },
      handleAccessError,
    );

    unsubscribeAppointments = onSnapshot(
      appointmentsRef,
      (snapshot) => {
        plannerState.appointments = snapshot.docs.map((appointmentDoc) =>
          normalizeAppointment({
            id: appointmentDoc.id,
            ...appointmentDoc.data(),
          }),
        );
        render();
      },
      handleAccessError,
    );
  } catch (error) {
    console.error("Firebase verbinden is niet gelukt", error);
    handleAccessError(error);
  }
}

function handleAccessError(error) {
  console.error("Gedeelde planning openen is niet gelukt", error);
  unsubscribePeople?.();
  unsubscribeAppointments?.();
  unsubscribePeople = null;
  unsubscribeAppointments = null;
  plannerState = createEmptyPlannerState();
  render();

  const isPermissionError =
    error?.code === "permission-denied" || error?.code === "PERMISSION_DENIED";
  const message = isPermissionError
    ? "Deze sessie heeft nog geen toegang. Voer het wachtwoord opnieuw in."
    : "Verbinden met de gedeelde planning is niet gelukt. Probeer later opnieuw.";
  showAccessForm(message);
}

async function savePerson(person) {
  await setDoc(doc(peopleRef, person.id), {
    name: person.name,
    updatedAt: serverTimestamp(),
  });
}

async function saveAppointment(appointment) {
  await setDoc(doc(appointmentsRef, appointment.id), {
    title: appointment.title,
    date: appointment.date,
    time: appointment.time,
    reason: appointment.reason,
    hospital: appointment.hospital,
    location: appointment.location,
    doctor: appointment.doctor,
    attendance: appointment.attendance,
    notes: appointment.notes,
    updatedAt: serverTimestamp(),
  });
}

function normalizePlannerState(state) {
  if (Array.isArray(state)) {
    return {
      people: [],
      appointments: state.map(normalizeAppointment),
    };
  }

  return {
    people: Array.isArray(state.people)
      ? state.people.map(normalizePerson)
      : [],
    appointments: Array.isArray(state.appointments)
      ? state.appointments.map(normalizeAppointment)
      : [],
  };
}

function normalizePerson(person) {
  return {
    id: String(person.id || createId()),
    name: String(person.name || "").trim(),
  };
}

function normalizeAppointment(appointment) {
  return {
    id: String(appointment.id || createId()),
    title: String(appointment.title || ""),
    date: String(appointment.date || ""),
    time: String(appointment.time || ""),
    reason: String(appointment.reason || ""),
    hospital: String(appointment.hospital || ""),
    location: String(appointment.location || ""),
    doctor: String(appointment.doctor || ""),
    attendance: normalizeAttendance(appointment),
    notes: String(appointment.notes || ""),
  };
}

function normalizeAttendance(appointment) {
  if (appointment.attendance && typeof appointment.attendance === "object") {
    return Object.fromEntries(
      Object.entries(appointment.attendance).map(([personId, status]) => [
        personId,
        attendanceStatuses[status] ? status : "unknown",
      ]),
    );
  }

  if (Array.isArray(appointment.companions)) {
    return Object.fromEntries(
      appointment.companions.map((name) => [String(name), "joining"]),
    );
  }

  return {};
}

function compareAppointments(first, second) {
  return getAppointmentTime(first) - getAppointmentTime(second);
}

function isUpcoming(appointment) {
  return getAppointmentTime(appointment) >= startOfToday();
}

function isInSelectedPeriod(appointment) {
  const bounds = getSelectedPeriodBounds();
  if (!bounds) return false;

  const appointmentTime = getAppointmentTime(appointment);

  return appointmentTime >= bounds.startTime && appointmentTime <= bounds.endTime;
}

function getSelectedPeriodBounds() {
  const { start, end } = activePeriod;
  if (!start && !end) return null;

  if (start && end) {
    const [firstDate, lastDate] = [start, end].sort();
    return {
      startTime: getDateStartTime(firstDate),
      endTime: getDateEndTime(lastDate),
    };
  }

  return {
    startTime: start ? getDateStartTime(start) : Number.NEGATIVE_INFINITY,
    endTime: end ? getDateEndTime(end) : Number.POSITIVE_INFINITY,
  };
}

function getAppointmentTime(appointment) {
  return new Date(
    `${appointment.date}T${appointment.time || "00:00"}`,
  ).getTime();
}

function getDateStartTime(date) {
  return new Date(`${date}T00:00`).getTime();
}

function getDateEndTime(date) {
  return new Date(`${date}T23:59:59.999`).getTime();
}

function startOfToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today.getTime();
}

function formatDateTime(appointment) {
  const date = new Date(`${appointment.date}T${appointment.time || "00:00"}`);
  const options = {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  };

  if (appointment.time) {
    options.hour = "2-digit";
    options.minute = "2-digit";
  }

  return new Intl.DateTimeFormat("nl-NL", options).format(date);
}

function applySavedTheme() {
  const enabled = localStorage.getItem(themeKey) === "true";
  document.body.classList.toggle("readable", enabled);
  updateThemeButton(enabled);
}

function updateThemeButton(enabled) {
  contrastToggle.setAttribute("aria-pressed", String(enabled));
  contrastToggle.textContent = enabled ? "Normale tekst" : "Extra groot";
}

function createId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getFamilyId() {
  const params = new URLSearchParams(window.location.search);
  const queryFamilyId = params.get("family");
  if (queryFamilyId) return normalizeFamilyId(queryFamilyId);

  const hashMatch = window.location.hash.match(/familie\/([a-zA-Z0-9_-]+)/);
  if (hashMatch) return normalizeFamilyId(hashMatch[1]);

  return "development-family";
}

function normalizeFamilyId(value) {
  const family = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return family || "development-family";
}

function getFamilyEmail(family) {
  return `${family}@zorgplanner.local`;
}
