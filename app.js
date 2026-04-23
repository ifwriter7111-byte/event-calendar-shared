const STORAGE_KEY = "schedule-events-v3";

const seedEvents = [
  { id: makeId(), name: "デベロゴン", start: "2026-04-01", end: "2026-04-19", interview: "2026-04-11", fill: "#dff4dc", ink: "#255725" },
  { id: makeId(), name: "ブイプロ", start: "2026-04-18", end: "2026-04-27", interview: "2026-04-24", fill: "#e0edf8", ink: "#1f4b77" },
  { id: makeId(), name: "なおき", start: "2026-04-18", end: "2026-04-27", interview: "2026-04-25", fill: "#f6e9d7", ink: "#7b4f1f" },
  { id: makeId(), name: "ぴよまる", start: "2026-04-27", end: "2026-05-06", interview: "2026-05-02", fill: "#f8e8f1", ink: "#7a3a65" },
  { id: makeId(), name: "チョーさん", start: "2026-04-26", end: "2026-05-10", interview: "2026-05-04", fill: "#e6f6ef", ink: "#1e6a4a" },
  { id: makeId(), name: "アドネス", start: "2026-04-30", end: "2026-05-17", interview: "2026-05-09", fill: "#efe9fb", ink: "#4b3a7f" },
  { id: makeId(), name: "みおさん", start: "2026-06-01", end: "2026-06-14", interview: "2026-06-07", fill: "#e9f3fb", ink: "#2f5f85" },
  { id: makeId(), name: "りんださん", start: "2026-06-14", end: "2026-06-28", interview: "2026-06-21", fill: "#fdf0e4", ink: "#8a4f1f" }
];

const state = { events: loadEvents(), editingId: null };

const form = document.querySelector("#eventForm");
const formTitle = document.querySelector("#formTitle");
const eventIdInput = document.querySelector("#eventId");
const submitButton = document.querySelector("#submitButton");
const deleteButton = document.querySelector("#deleteButton");
const resetButton = document.querySelector("#resetButton");
const exportButton = document.querySelector("#exportButton");
const importButton = document.querySelector("#importButton");
const importFileInput = document.querySelector("#importFileInput");

form.addEventListener("submit", onSubmit);
resetButton.addEventListener("click", clearForm);
deleteButton.addEventListener("click", onDelete);
exportButton.addEventListener("click", onExport);
importButton.addEventListener("click", () => importFileInput.click());
importFileInput.addEventListener("change", onImport);

renderAll();

function onSubmit(e) {
  e.preventDefault();

  const payload = collectFormValues();
  if (!payload) return;

  if (state.editingId) {
    state.events = state.events.map((event) => (event.id === state.editingId ? { ...event, ...payload } : event));
  } else {
    state.events.push({ id: makeId(), ...payload });
  }

  saveEvents();
  renderAll();
  clearForm();
}

function onDelete() {
  if (!state.editingId) return;
  state.events = state.events.filter((event) => event.id !== state.editingId);
  saveEvents();
  renderAll();
  clearForm();
}

function collectFormValues() {
  const name = document.querySelector("#name").value.trim();
  const start = document.querySelector("#start").value;
  const end = document.querySelector("#end").value;
  const interview = document.querySelector("#interview").value;
  const fill = document.querySelector("#fill").value;
  const ink = document.querySelector("#ink").value;

  if (!name || !start || !end || !interview) return null;
  if (start > end) {
    alert("終了日は開始日以降にしてください。");
    return null;
  }
  if (interview < start || interview > end) {
    alert("面談開始日は開始日〜終了日の範囲にしてください。");
    return null;
  }
  return { name, start, end, interview, fill, ink };
}

function clearForm() {
  form.reset();
  document.querySelector("#fill").value = "#dff4dc";
  document.querySelector("#ink").value = "#255725";
  state.editingId = null;
  eventIdInput.value = "";
  formTitle.textContent = "イベント追加";
  submitButton.textContent = "追加する";
  deleteButton.classList.add("hidden");
}

function startEdit(id) {
  const event = state.events.find((item) => item.id === id);
  if (!event) return;

  state.editingId = id;
  eventIdInput.value = id;
  formTitle.textContent = "イベント編集";
  submitButton.textContent = "更新する";
  deleteButton.classList.remove("hidden");

  document.querySelector("#name").value = event.name;
  document.querySelector("#start").value = event.start;
  document.querySelector("#end").value = event.end;
  document.querySelector("#interview").value = event.interview;
  document.querySelector("#fill").value = event.fill;
  document.querySelector("#ink").value = event.ink;
}

function renderAll() {
  renderEventList();
  renderCalendar();
}

function renderEventList() {
  const root = document.querySelector("#eventList");
  const rows = [...state.events]
    .sort((a, b) => a.start.localeCompare(b.start))
    .map((event) => {
      return `
      <tr data-id="${event.id}">
        <td class="check-cell"><input type="checkbox" class="row-check" data-id="${event.id}" /></td>
        <td>${event.name}</td>
        <td>${formatDate(event.start)} 〜 ${formatDate(event.end)}</td>
        <td>${formatDate(event.interview)}</td>
      </tr>`;
    })
    .join("");

  root.innerHTML = `
    <div class="list-actions">
      <label class="check-label">
        <input type="checkbox" id="checkAllRows" />
        全選択
      </label>
      <button type="button" id="deleteSelectedButton" class="danger">選択したイベントを削除</button>
    </div>
    <table class="event-table">
      <thead>
        <tr><th class="check-cell">削除</th><th>名前</th><th>期間</th><th>面談開始</th></tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <p>※ 行をクリックすると編集できます。削除したい行はチェックを入れて削除ボタンを押してください。</p>
  `;

  const checkAll = root.querySelector("#checkAllRows");
  const rowChecks = root.querySelectorAll(".row-check");
  const deleteSelectedButton = root.querySelector("#deleteSelectedButton");

  checkAll.addEventListener("change", () => {
    rowChecks.forEach((checkbox) => {
      checkbox.checked = checkAll.checked;
    });
  });

  rowChecks.forEach((checkbox) => {
    checkbox.addEventListener("click", (e) => {
      e.stopPropagation();
    });
    checkbox.addEventListener("change", () => {
      const allChecked = [...rowChecks].every((item) => item.checked);
      checkAll.checked = allChecked;
    });
  });

  deleteSelectedButton.addEventListener("click", () => {
    deleteSelected([...root.querySelectorAll(".row-check:checked")].map((item) => item.dataset.id));
  });

  root.querySelectorAll("tbody tr").forEach((row) => {
    row.addEventListener("click", () => startEdit(row.dataset.id));
  });
}

function deleteSelected(selectedIds) {
  if (selectedIds.length === 0) {
    alert("削除するイベントを選択してください。");
    return;
  }
  const ok = confirm(`${selectedIds.length}件のイベントを削除します。よろしいですか？`);
  if (!ok) return;

  state.events = state.events.filter((event) => !selectedIds.includes(event.id));
  if (state.editingId && selectedIds.includes(state.editingId)) clearForm();
  saveEvents();
  renderAll();
}

function renderCalendar() {
  const root = document.querySelector("#calendarRoot");
  const months = collectMonths(state.events);

  root.innerHTML = months
    .map(({ year, month }) => renderMonth(year, month))
    .join("");
}

function renderMonth(year, month) {
  const first = new Date(year, month - 1, 1);
  const last = new Date(year, month, 0);
  const firstOffset = (first.getDay() + 6) % 7;
  const totalCells = Math.ceil((firstOffset + last.getDate()) / 7) * 7;

  const cells = [];
  for (let i = 0; i < totalCells; i += 1) {
    const dayNum = i - firstOffset + 1;
    if (dayNum < 1 || dayNum > last.getDate()) {
      cells.push('<div class="day-cell"></div>');
      continue;
    }

    const date = toISO(year, month, dayNum);
    const chips = state.events
      .filter((event) => event.start <= date && event.end >= date)
      .map((event) => {
        const interviewClass = event.interview === date ? "interview" : "";
        return `<span class="chip ${interviewClass}" style="background:${event.fill};color:${event.ink}" title="${event.name}">${event.name}</span>`;
      })
      .join("");

    cells.push(`
      <div class="day-cell">
        <div class="day-number">${dayNum}</div>
        ${chips}
      </div>
    `);
  }

  return `
    <section class="month-block">
      <h3 class="month-title">${year}年${month}月</h3>
      <div class="week-header">
        <div>月</div><div>火</div><div>水</div><div>木</div><div>金</div><div>土</div><div>日</div>
      </div>
      <div class="day-grid">${cells.join("")}</div>
    </section>
  `;
}

function collectMonths(events) {
  if (events.length === 0) {
    const now = new Date();
    const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return [
      { year: now.getFullYear(), month: now.getMonth() + 1 },
      { year: next.getFullYear(), month: next.getMonth() + 1 }
    ];
  }

  const minStart = [...events].sort((a, b) => a.start.localeCompare(b.start))[0].start;
  const maxEnd = [...events].sort((a, b) => b.end.localeCompare(a.end))[0].end;

  const start = new Date(minStart);
  const end = new Date(maxEnd);
  const endWithNextMonth = new Date(end.getFullYear(), end.getMonth() + 1, 1);
  const result = [];

  let year = start.getFullYear();
  let month = start.getMonth() + 1;
  while (
    year < endWithNextMonth.getFullYear() ||
    (year === endWithNextMonth.getFullYear() && month <= endWithNextMonth.getMonth() + 1)
  ) {
    result.push({ year, month });
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return result;
}

function toISO(year, month, day) {
  const mm = `${month}`.padStart(2, "0");
  const dd = `${day}`.padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

function formatDate(iso) {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function loadEvents() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return seedEvents;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : seedEvents;
  } catch {
    return seedEvents;
  }
}

function saveEvents() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.events));
  } catch {
    alert("ブラウザ保存に失敗しました。");
  }
}

function onExport() {
  const data = JSON.stringify(state.events, null, 2);
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "events.json";
  a.click();
  URL.revokeObjectURL(url);
}

async function onImport(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) throw new Error("invalid format");
    state.events = parsed.map(normalizeEvent).filter(Boolean);
    saveEvents();
    renderAll();
    clearForm();
    alert("JSONを読み込みました。");
  } catch {
    alert("JSONの読み込みに失敗しました。");
  } finally {
    importFileInput.value = "";
  }
}

function normalizeEvent(event) {
  if (!event || typeof event !== "object") return null;
  const required = ["name", "start", "end", "interview"];
  for (const key of required) {
    if (!event[key]) return null;
  }
  return {
    id: event.id || makeId(),
    name: String(event.name),
    start: String(event.start),
    end: String(event.end),
    interview: String(event.interview),
    fill: event.fill || "#dff4dc",
    ink: event.ink || "#255725"
  };
}

function makeId() {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `event-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
