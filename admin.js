import { auth } from "./firebase-config.js";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-functions.js";

const functions = getFunctions(auth.app, "us-central1");
const signInPanel = document.querySelector("#sign-in-panel");
const appPanel = document.querySelector("#admin-app");
const authStatus = document.querySelector("#auth-status");
const appStatus = document.querySelector("#app-status");
const signOutButton = document.querySelector("#sign-out");
const usersTable = document.querySelector("#users-table");
const dateForm = document.querySelector("#date-form");
const dateInput = document.querySelector("#joined-date");
const localToday = new Date();
dateInput.max = `${localToday.getFullYear()}-${String(localToday.getMonth() + 1).padStart(2, "0")}-${String(localToday.getDate()).padStart(2, "0")}`;
let selectedUser = null;

function setStatus(element, message, isError = false) {
  element.textContent = message;
  element.classList.toggle("error", isError);
}

function call(name, data = {}) {
  return httpsCallable(functions, name)(data).then((result) => result.data);
}

function safeDate(value) {
  if (!value) return "Unavailable";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unavailable" : date.toLocaleDateString("en-US", { timeZone: "UTC" });
}

function renderActivity(records) {
  const list = document.querySelector("#activity-list");
  list.replaceChildren();
  if (!records.length) {
    const empty = document.createElement("li");
    empty.textContent = "No administrator actions have been recorded yet.";
    list.append(empty);
    return;
  }
  for (const record of records) {
    const item = document.createElement("li");
    const heading = document.createElement("strong");
    heading.textContent = record.action || "Administrator action";
    const detail = document.createElement("small");
    const before = record.details?.before;
    const after = record.details?.after;
    const change = before !== undefined || after !== undefined ? ` · ${before ?? "not set"} → ${after ?? "not set"}` : "";
    detail.textContent = `${safeDate(record.createdAt)} · Admin ${record.adminUid || "unknown"}${record.targetUserId ? ` · Account ${record.targetUserId}` : ""}${change} · ${record.reason || "No reason recorded"}`;
    item.append(heading, detail);
    list.append(item);
  }
}

function showUserEditor(user) {
  selectedUser = user;
  document.querySelector("#selected-user").textContent =
    `${user.fullName || user.username || "User"} · ${user.email || "No email"} · ${user.uid}`;
  dateInput.value = user.createdAt ? new Date(user.createdAt).toISOString().slice(0, 10) : "";
  dateForm.hidden = false;
  dateForm.scrollIntoView({ behavior: "smooth", block: "center" });
}

function renderUsers(users) {
  usersTable.replaceChildren();
  for (const user of users) {
    const row = document.createElement("tr");
    const account = document.createElement("td");
    const name = document.createElement("span");
    name.className = "account-name";
    name.textContent = user.fullName || user.username || "Unnamed user";
    const id = document.createElement("span");
    id.className = "account-id";
    id.textContent = user.uid;
    account.append(name, id);
    const email = document.createElement("td");
    email.textContent = user.email || "—";
    const joined = document.createElement("td");
    joined.textContent = safeDate(user.createdAt);
    const verification = document.createElement("td");
    verification.textContent = user.kycStatus.replaceAll("_", " ");
    const actions = document.createElement("td");
    const edit = document.createElement("button");
    edit.type = "button";
    edit.className = "button button-quiet row-button";
    edit.textContent = "Edit joined date";
    edit.addEventListener("click", () => showUserEditor(user));
    actions.append(edit);
    row.append(account, email, joined, verification, actions);
    usersTable.append(row);
  }
}

async function loadUsers(search = "") {
  setStatus(document.querySelector("#users-status"), "Loading users…");
  try {
    const result = await call("searchAdminUsers", { search });
    renderUsers(result.users);
    setStatus(
      document.querySelector("#users-status"),
      `${result.users.length} account(s) shown${search ? ` matching “${search}”` : " from the newest registrations"}.`
    );
  } catch (error) {
    setStatus(document.querySelector("#users-status"), `Users could not be loaded: ${error.message}`, true);
  }
}

async function loadOverview() {
  try {
    const overview = await call("getAdminOverview");
    document.querySelector("#total-users").textContent = overview.totalUsers.toLocaleString();
    renderActivity(overview.recentActivity);
    if (overview.feeConfigured) {
      document.querySelector("#fee-percent").value = overview.feePercent;
      setStatus(document.querySelector("#fee-status"), `Current configured rate: ${overview.feePercent}% of the requested amount.`);
    } else {
      document.querySelector("#fee-percent").value = "0";
      setStatus(document.querySelector("#fee-status"), "No withdrawal fee rate is configured yet.");
    }
    return true;
  } catch (error) {
    setStatus(appStatus, `Administrator access or dashboard data is unavailable: ${error.message}`, true);
    return false;
  }
}

document.querySelector("#sign-in-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector("button[type='submit']");
  button.disabled = true;
  setStatus(authStatus, "Signing in…");
  try {
    const values = new FormData(form);
    await signInWithEmailAndPassword(auth, String(values.get("email")), String(values.get("password")));
  } catch (error) {
    setStatus(authStatus, `Sign-in failed: ${error.message}`, true);
  } finally {
    button.disabled = false;
  }
});

document.querySelector("#search-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  await loadUsers(document.querySelector("#user-search").value.trim());
});

dateForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!selectedUser) return;
  const button = dateForm.querySelector("button[type='submit']");
  button.disabled = true;
  try {
    const values = new FormData(dateForm);
    await call("updateAdminUserCreatedAt", {
      userId: selectedUser.uid,
      date: String(values.get("date")),
      reason: String(values.get("reason"))
    });
    setStatus(document.querySelector("#users-status"), "Registration date updated and recorded in the administrator audit log.");
    dateForm.reset();
    dateForm.hidden = true;
    selectedUser = null;
    await Promise.all([loadUsers(document.querySelector("#user-search").value.trim()), loadOverview()]);
  } catch (error) {
    setStatus(document.querySelector("#users-status"), `Registration date was not changed: ${error.message}`, true);
  } finally {
    button.disabled = false;
  }
});

document.querySelector("#fee-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector("button[type='submit']");
  button.disabled = true;
  try {
    const values = new FormData(form);
    const result = await call("updateWithdrawalFeePercent", {
      feePercent: Number(values.get("feePercent")),
      reason: String(values.get("reason"))
    });
    form.reset();
    document.querySelector("#fee-percent").value = result.feePercent;
    setStatus(document.querySelector("#fee-status"), `Withdrawal fee set to ${result.feePercent}% and recorded in the administrator audit log.`);
    await loadOverview();
  } catch (error) {
    setStatus(document.querySelector("#fee-status"), `Fee rate was not changed: ${error.message}`, true);
  } finally {
    button.disabled = false;
  }
});

signOutButton.addEventListener("click", async () => {
  try {
    await signOut(auth);
  } catch (error) {
    setStatus(appStatus, `Could not sign out: ${error.message}`, true);
  }
});

onAuthStateChanged(auth, async (user) => {
  appPanel.hidden = true;
  signInPanel.hidden = Boolean(user);
  signOutButton.hidden = !user;
  if (!user) {
    setStatus(authStatus, "");
    return;
  }
  setStatus(authStatus, "Checking administrator permissions…");
  try {
    const authorized = await loadOverview();
    if (!authorized) {
      signInPanel.hidden = false;
      setStatus(authStatus, "Administrator access denied or unavailable. Set users/{your UID}.role to admin in Firestore, then sign in again.", true);
      return;
    }
    appPanel.hidden = false;
    signInPanel.hidden = true;
    setStatus(authStatus, "");
    await loadUsers();
  } catch (error) {
    signInPanel.hidden = false;
    setStatus(authStatus, `Administrator access denied or unavailable: ${error.message}`, true);
  }
});
