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
  calling: "Inbellen",
  declined: "Afwezig",
};

const attendanceIcons = {
  joining: "✓",
  declined: "×",
  calling: "☎",
  unknown: "?",
};
const attendanceChoiceValues = ["joining", "declined", "calling"];

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
const upcomingCount = document.querySelector("#upcomingCount");
const pendingCount = document.querySelector("#pendingCount");
const peopleCount = document.querySelector("#peopleCount");
const readerTitle = document.querySelector("#readerTitle");
const readerDate = document.querySelector("#readerDate");
const readerDetails = document.querySelector("#readerDetails");
const readerAppointmentList = document.querySelector("#readerAppointmentList");
const newAppointmentButton = document.querySelector("#newAppointmentButton");
const closeEditorButton = document.querySelector("#closeEditorButton");
const deleteAppointmentButton = document.querySelector(
  "#deleteAppointmentButton",
);
const speakButton = document.querySelector("#speakButton");
const filterButtons = document.querySelectorAll("[data-filter]");
const periodFilter = document.querySelector("#periodFilter");
const periodStartInput = document.querySelector("#periodStartInput");
const periodEndInput = document.querySelector("#periodEndInput");
const clearPeriodButton = document.querySelector("#clearPeriodButton");

let plannerState = createEmptyPlannerState();
let activeFilter = "upcoming";
const expandedAttendanceIds = new Set();
let activePeriod = {
  start: "",
  end: "",
};
let appliedEditFromUrl = false;
let unsubscribePeople = null;
let unsubscribeAppointments = null;

preserveFamilyInLinks();
render();
initializeAccess();

accessForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const password = passwordInput.value;
  if (!password) return;

  await unlockPlanner(password);
});

personForm?.addEventListener("submit", async (event) => {
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

form?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const appointment = {
    id: appointmentIdInput?.value || createId(),
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
  closeEditor();
  render();
  await saveAppointment(appointment);
});

newAppointmentButton?.addEventListener("click", () => {
  resetForm();
  openEditor();
  titleInput.focus();
});

closeEditorButton?.addEventListener("click", () => {
  closeEditor();
  resetForm();
});

deleteAppointmentButton?.addEventListener("click", async () => {
  const id = appointmentIdInput?.value;
  if (id) await deleteAppointment(id);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && document.body.classList.contains("editing")) {
    closeEditor();
    resetForm();
  }
});

filterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    setActiveFilter(button.dataset.filter);
    if (activeFilter === "period" && periodStartInput) {
      periodStartInput.focus();
    }
  });
});

[periodStartInput, periodEndInput].filter(Boolean).forEach((input) => {
  input.addEventListener("change", () => {
    activePeriod = {
      start: periodStartInput.value,
      end: periodEndInput.value,
    };
    setActiveFilter("period");
  });
});

clearPeriodButton?.addEventListener("click", () => {
  periodStartInput.value = "";
  periodEndInput.value = "";
  activePeriod = {
    start: "",
    end: "",
  };
  setActiveFilter("upcoming");
});

function render() {
  applyEditFromUrl();
  renderPeople();
  renderAttendanceEditor();
  renderAppointments();
  renderCounts();
  renderReaderPage();
}

function applyEditFromUrl() {
  if (appliedEditFromUrl || !form) return;

  const editId = new URLSearchParams(window.location.search).get("edit");
  if (!editId) return;

  const appointment = plannerState.appointments.find((item) => item.id === editId);
  if (!appointment) return;

  appliedEditFromUrl = true;
  editAppointment(editId);
}

function renderPeople() {
  if (!peopleList) return;

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
    const item = document.createElement("article");
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
  if (!attendanceEditor) return;

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

    attendanceChoiceValues.forEach((value) => {
      const label = attendanceStatuses[value];
      const button = document.createElement("button");
      button.className = `attendance-choice ${value}`;
      button.type = "button";
      button.dataset.status = value;
      button.title = label;
      button.setAttribute("aria-label", `${person.name}: ${label}`);
      button.textContent = attendanceIcons[value];
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
  if (!appointmentList || !appointmentTemplate) return;

  const sortedAppointments = [...plannerState.appointments].sort(
    compareAppointments,
  );
  const visibleAppointments = getVisibleAppointments(sortedAppointments);

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

    card.querySelector(".when-line").textContent =
      formatCardDateTime(appointment);
    card.querySelector("h3").textContent = appointment.title;
    card.querySelector(".place-line").textContent =
      [appointment.hospital, appointment.location].filter(Boolean).join(" · ") ||
      "Locatie nog niet ingevuld";

    const doctorLine = card.querySelector(".doctor-line");
    doctorLine.textContent = appointment.doctor;
    doctorLine.hidden = !appointment.doctor;

    renderAttendanceChips(card.querySelector(".chips"), appointment);

    card.setAttribute(
      "aria-label",
      `${appointment.title}, ${formatDateTime(appointment)}, bewerken`,
    );
    card.addEventListener("click", () => editAppointment(appointment.id));
    card.addEventListener("keydown", (event) => {
      if (event.target !== event.currentTarget) return;
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        editAppointment(appointment.id);
      }
    });

    appointmentList.append(card);
  });
}

function renderAttendanceChips(container, appointment) {
  container.replaceChildren();

  if (plannerState.people.length === 0) {
    const chip = document.createElement("span");
    chip.className = "chip";
    chip.textContent = "Nog geen mensen toegevoegd";
    container.append(chip);
    return;
  }

  const expanded = expandedAttendanceIds.has(appointment.id);
  const visiblePeople = expanded
    ? plannerState.people
    : plannerState.people.filter(
        (person) =>
          appointment.attendance[person.id] &&
          appointment.attendance[person.id] !== "unknown",
      );

  visiblePeople.forEach((person) =>
    container.append(createAttendanceChip(appointment, person)),
  );

  const hiddenCount = plannerState.people.length - visiblePeople.length;
  if (!expanded && hiddenCount === 0) return;

  const toggle = document.createElement("button");
  toggle.className = "chip toggle";
  toggle.type = "button";
  if (expanded) {
    toggle.textContent = "Minder ▴";
    toggle.title = "Alleen reacties tonen";
  } else if (visiblePeople.length === 0) {
    toggle.textContent = "Nog niemand ingevuld ▾";
    toggle.title = "Aanwezigheid invullen";
  } else {
    toggle.textContent = `+${hiddenCount} invullen ▾`;
    toggle.title = "Iedereen tonen";
  }
  toggle.addEventListener("click", (event) => {
    event.stopPropagation();
    if (expanded) {
      expandedAttendanceIds.delete(appointment.id);
    } else {
      expandedAttendanceIds.add(appointment.id);
    }
    renderAppointments();
  });
  container.append(toggle);
}

function createAttendanceChip(appointment, person) {
  const status = appointment.attendance[person.id] || "unknown";
  const chip = document.createElement("button");
  chip.className = `chip ${status}`;
  chip.type = "button";
  chip.textContent = `${attendanceIcons[status]} ${person.name}`;
  chip.title = `${person.name}: ${attendanceStatuses[status]} — tik om te wijzigen`;
  chip.setAttribute(
    "aria-label",
    `${person.name}: ${attendanceStatuses[status]}, tik om te wijzigen`,
  );
  chip.addEventListener("click", (event) => {
    event.stopPropagation();
    cycleAttendanceStatus(appointment.id, person.id);
  });
  return chip;
}

async function cycleAttendanceStatus(appointmentId, personId) {
  const cycle = ["unknown", "joining", "calling", "declined"];

  plannerState.appointments = plannerState.appointments.map((appointment) => {
    if (appointment.id !== appointmentId) return appointment;

    const attendance = { ...appointment.attendance };
    const current = attendance[personId] || "unknown";
    attendance[personId] = cycle[(cycle.indexOf(current) + 1) % cycle.length];
    return { ...appointment, attendance };
  });

  renderAppointments();
  renderCounts();
  const appointment = plannerState.appointments.find(
    (item) => item.id === appointmentId,
  );
  if (appointment) await saveAppointment(appointment);
}

function renderCounts() {
  const upcomingAppointments = plannerState.appointments.filter(isUpcoming);

  if (upcomingCount) upcomingCount.textContent = String(upcomingAppointments.length);
  if (peopleCount) peopleCount.textContent = String(plannerState.people.length);
  if (pendingCount) pendingCount.textContent = String(countPendingResponses(upcomingAppointments));
}

function renderReaderPage() {
  if (readerAppointmentList) {
    renderReaderAppointmentList();
    return;
  }

  if (!readerTitle && !readerDetails) return;

  const next = [...plannerState.appointments].sort(compareAppointments).find(isUpcoming);
  if (!next) {
    if (readerTitle) readerTitle.textContent = "Geen afspraak";
    if (readerDate) readerDate.textContent = "Er staan geen komende afspraken in de planner.";
    readerDetails?.replaceChildren();
    return;
  }

  if (readerTitle) readerTitle.textContent = next.title;
  if (readerDate) readerDate.textContent = formatDateTime(next);
  if (readerDetails) {
    readerDetails.replaceChildren(
      createOverviewDetail("Waar", [next.hospital, next.location].filter(Boolean).join(", ") || "Niet ingevuld"),
      createOverviewDetail("Behandelaar", next.doctor || "Niet ingevuld"),
      createOverviewDetail("Aanwezigheid", createCompanionsSummary(next)),
      createOverviewDetail("Meenemen", next.notes || "Geen notities"),
    );
  }
}

function renderReaderAppointmentList() {
  readerAppointmentList.replaceChildren();

  const upcomingAppointments = [...plannerState.appointments]
    .sort(compareAppointments)
    .filter(isUpcoming);

  if (upcomingAppointments.length === 0) {
    const emptyState = document.createElement("p");
    emptyState.className = "reader-empty";
    emptyState.textContent = "Er staan geen komende afspraken in de planner.";
    readerAppointmentList.append(emptyState);
    return;
  }

  upcomingAppointments.forEach((appointment) => {
    const card = document.createElement("article");
    card.className = "reader-appointment-card";

    const title = document.createElement("h2");
    title.textContent = appointment.title;

    const date = document.createElement("strong");
    date.textContent = formatDateTime(appointment);

    const speak = document.createElement("button");
    speak.type = "button";
    speak.textContent = "Lees voor";
    speak.addEventListener("click", () => speakAppointment(appointment));

    const details = document.createElement("dl");
    details.replaceChildren(
      createOverviewDetail("Waar", appointment.hospital || "Niet ingevuld"),
      createOverviewDetail("Route", appointment.location || "Niet ingevuld"),
      createOverviewDetail("Behandelaar", appointment.doctor || "Niet ingevuld"),
      createOverviewDetail("Aanwezigheid", createCompanionsSummary(appointment)),
      createOverviewDetail("Meenemen", appointment.notes || "Geen notities"),
    );

    card.append(title, date, speak, details);
    readerAppointmentList.append(card);
  });
}

function createOverviewDetail(label, value) {
  const wrapper = document.createElement("div");
  const term = document.createElement("dt");
  const description = document.createElement("dd");
  term.textContent = label;
  description.textContent = value;
  wrapper.append(term, description);
  return wrapper;
}

function countPendingResponses(appointments) {
  return appointments.reduce((count, appointment) => {
    return (
      count +
      plannerState.people.filter(
        (person) =>
          !appointment.attendance[person.id] ||
          appointment.attendance[person.id] === "unknown",
      ).length
    );
  }, 0);
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
  if (periodFilter) periodFilter.hidden = activeFilter !== "period";
  renderAppointments();
}

function openEditor() {
  if (!form) return;
  document.body.classList.add("editing");
}

function closeEditor() {
  document.body.classList.remove("editing");
}

function createCompanionsSummary(appointment) {
  const joiningPeople = plannerState.people
    .filter((person) => appointment.attendance[person.id] === "joining")
    .map((person) => person.name);
  const callingPeople = plannerState.people
    .filter((person) => appointment.attendance[person.id] === "calling")
    .map((person) => person.name);

  const parts = [];
  if (joiningPeople.length > 0) {
    parts.push(`Mee: ${formatPeopleList(joiningPeople)}`);
  }
  if (callingPeople.length > 0) {
    parts.push(`Inbellen: ${formatPeopleList(callingPeople)}`);
  }

  return parts.length > 0 ? parts.join(" · ") : "Nog niemand ingevuld";
}

function formatPeopleList(people) {
  if (people.length <= 3) return people.join(", ");

  const visibleNames = people.slice(0, 3).join(", ");
  return `${visibleNames} + ${people.length - 3}`;
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

  if (!form) {
    window.location.href = createPageUrl("index.html", { edit: id });
    return;
  }

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
  if (deleteAppointmentButton) deleteAppointmentButton.hidden = false;
  renderAttendanceEditor(appointment);
  openEditor();
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
  closeEditor();
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
  if (!form) return;

  form.reset();
  if (appointmentIdInput) appointmentIdInput.value = "";
  if (formTitle) formTitle.textContent = "Nieuwe afspraak";
  if (deleteAppointmentButton) deleteAppointmentButton.hidden = true;
  renderAttendanceEditor();
}

function getActiveAppointment() {
  if (!appointmentIdInput) return undefined;

  return plannerState.appointments.find(
    (item) => item.id === appointmentIdInput.value,
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
  const callingPeople = plannerState.people
    .filter((person) => appointment.attendance[person.id] === "calling")
    .map((person) => person.name);

  const attendanceText =
    joiningPeople.length > 0
      ? `${joiningPeople.join(", ")} gaat mee.`
      : "Er is nog niemand ingevuld die meegaat.";
  const callingText =
    callingPeople.length > 0
      ? `${callingPeople.join(", ")} moet ingebeld worden.`
      : "";

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
    callingText,
    notesText,
  ]
    .filter(Boolean)
    .join(" ");
}

function updateSpeakButton(isSpeaking) {
  if (!speakButton) return;

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

function formatCardDateTime(appointment) {
  const date = new Date(`${appointment.date}T${appointment.time || "00:00"}`);
  const options = {
    weekday: "short",
    day: "numeric",
    month: "long",
  };

  if (date.getFullYear() !== new Date().getFullYear()) {
    options.year = "numeric";
  }

  const formatted = new Intl.DateTimeFormat("nl-NL", options).format(date);
  return appointment.time ? `${formatted} · ${appointment.time}` : formatted;
}

function createId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function preserveFamilyInLinks() {
  const params = new URLSearchParams(window.location.search);
  const queryFamilyId = params.get("family");
  if (!queryFamilyId) return;

  document.querySelectorAll('a[href$=".html"], a[href="index.html"]').forEach((link) => {
    const href = link.getAttribute("href");
    if (!href) return;

    const url = new URL(href, window.location.href);
    url.searchParams.set("family", queryFamilyId);
    link.href = `${url.pathname.split("/").pop()}${url.search}${url.hash}`;
  });
}

function createPageUrl(page, extraParams = {}) {
  const params = new URLSearchParams(window.location.search);
  Object.entries(extraParams).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  const query = params.toString();
  return query ? `${page}?${query}` : page;
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
