const STORAGE_KEY = "schedule-events-v3";
const LIST_SORT_KEY = "schedule-list-sort-v2";

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

const state = {
  events: loadEvents(),
  editingId: null,
  selectedCalendarId: "all",
  listSort: loadListSort()
};
let dragSourceId = null;

const form = document.querySelector("#eventForm");
const formTitle = document.querySelector("#formTitle");
const eventIdInput = document.querySelector("#eventId");
const submitButton = document.querySelector("#submitButton");
const deleteButton = document.querySelector("#deleteButton");
const resetButton = document.querySelector("#resetButton");

form.addEventListener("submit", onSubmit);
resetButton.addEventListener("click", clearForm);
deleteButton.addEventListener("click", onDelete);

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
  const rows = getListRows()
    .map((event) => {
      return `
      <tr data-id="${event.id}" draggable="true">
        <td class="check-cell"><input type="checkbox" class="row-check" data-id="${event.id}" /></td>
        <td><span class="name-badge" style="background:${event.fill};color:${event.ink}">${event.name}</span></td>
        <td class="period-cell">
          <span class="period-date">${formatDateWithWeekday(event.start)}</span>
          <span class="period-sep">〜</span>
          <span class="period-date">${formatDateWithWeekday(event.end)}</span>
        </td>
        <td>${formatDateWithWeekday(event.interview)}</td>
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
        <tr>
          <th class="check-cell">削除</th>
          <th>名前</th>
          <th>
            <button type="button" class="sort-trigger" data-sort-key="start">
              期間 <span class="sort-mark">${sortMark("start")}</span>
            </button>
          </th>
          <th>
            <button type="button" class="sort-trigger" data-sort-key="interview">
              面談開始 <span class="sort-mark">${sortMark("interview")}</span>
            </button>
          </th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <p>※ 行をクリックすると編集できます。削除したい行はチェックを入れて削除ボタンを押してください。</p>
  `;

  const checkAll = root.querySelector("#checkAllRows");
  const rowChecks = root.querySelectorAll(".row-check");
  const deleteSelectedButton = root.querySelector("#deleteSelectedButton");
  const sortTriggers = root.querySelectorAll(".sort-trigger");

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

  sortTriggers.forEach((button) => {
    button.addEventListener("click", () => {
      toggleListSort(button.dataset.sortKey);
    });
  });

  root.querySelectorAll("tbody tr").forEach((row) => {
    row.addEventListener("dragstart", onRowDragStart);
    row.addEventListener("dragover", onRowDragOver);
    row.addEventListener("drop", onRowDrop);
    row.addEventListener("dragend", onRowDragEnd);
    row.addEventListener("click", () => startEdit(row.dataset.id));
  });
}

function onRowDragStart(e) {
  const row = e.currentTarget;
  dragSourceId = row.dataset.id;
  row.classList.add("dragging");
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", dragSourceId);
  }
}

function onRowDragOver(e) {
  e.preventDefault();
  if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
}

function onRowDrop(e) {
  e.preventDefault();
  const targetId = e.currentTarget.dataset.id;
  if (!dragSourceId || !targetId || dragSourceId === targetId) return;
  reorderEvent(dragSourceId, targetId);
}

function onRowDragEnd(e) {
  e.currentTarget.classList.remove("dragging");
  dragSourceId = null;
}

function reorderEvent(sourceId, targetId) {
  const currentOrder = getListRows().map((event) => event.id);
  const sourceIndex = currentOrder.findIndex((id) => id === sourceId);
  const targetIndex = currentOrder.findIndex((id) => id === targetId);
  if (sourceIndex < 0 || targetIndex < 0) return;
  const [movedId] = currentOrder.splice(sourceIndex, 1);
  currentOrder.splice(targetIndex, 0, movedId);
  const eventById = new Map(state.events.map((event) => [event.id, event]));
  state.events = currentOrder.map((id) => eventById.get(id)).filter(Boolean);
  state.listSort = { key: "none", dir: "asc" };
  saveListSort();
  saveEvents();
  renderAll();
}

function getListRows() {
  if (state.listSort.key === "none") return [...state.events];
  const key = state.listSort.key;
  const dir = state.listSort.dir === "desc" ? -1 : 1;
  return [...state.events].sort((a, b) => {
    const primary = a[key].localeCompare(b[key]) * dir;
    if (primary !== 0) return primary;
    return a.name.localeCompare(b.name);
  });
}

function toggleListSort(key) {
  if (state.listSort.key !== key) {
    state.listSort = { key, dir: "asc" };
  } else if (state.listSort.dir === "asc") {
    state.listSort = { key, dir: "desc" };
  } else {
    state.listSort = { key: "none", dir: "asc" };
  }
  saveListSort();
  renderEventList();
}

function sortMark(key) {
  if (state.listSort.key !== key) return "▽";
  return state.listSort.dir === "asc" ? "▲" : "▼";
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
  if (!root) return;
  renderCalendarControls();
  const visibleEvents = getVisibleCalendarEvents();
  const months = collectMonths(visibleEvents);
  root.innerHTML = months.map(({ year, month }) => renderMonth(year, month, visibleEvents)).join("");
}

function renderCalendarControls() {
  const controlRoot = document.querySelector("#calendarControls");
  if (!controlRoot) return;
  const hasSelected = state.selectedCalendarId === "all" || state.events.some((event) => event.id === state.selectedCalendarId);
  if (!hasSelected) state.selectedCalendarId = "all";

  const options = [
    `<option value="all" ${state.selectedCalendarId === "all" ? "selected" : ""}>全員</option>`,
    ...state.events.map(
      (event) => `<option value="${event.id}" ${state.selectedCalendarId === event.id ? "selected" : ""}>${event.name}</option>`
    )
  ]
    .join("");

  controlRoot.innerHTML = `
    <div class="calendar-filter-row">
      <label for="calendarMemberSelect">表示対象</label>
      <select id="calendarMemberSelect">
        ${options}
      </select>
    </div>
  `;

  const memberSelect = controlRoot.querySelector("#calendarMemberSelect");

  memberSelect.addEventListener("change", () => {
    state.selectedCalendarId = memberSelect.value;
    renderCalendar();
  });
}

function getVisibleCalendarEvents() {
  if (state.selectedCalendarId === "all") return state.events;
  return state.events.filter((event) => event.id === state.selectedCalendarId);
}

function renderMonth(year, month, events) {
  const first = new Date(year, month - 1, 1);
  const last = new Date(year, month, 0);
  const firstOffset = (first.getDay() + 6) % 7;
  const totalCells = Math.ceil((firstOffset + last.getDate()) / 7) * 7;
  const today = new Date();
  const todayIso = toISO(today.getFullYear(), today.getMonth() + 1, today.getDate());
  const weeks = [];
  for (let w = 0; w < totalCells / 7; w += 1) {
    const days = [];
    for (let d = 0; d < 7; d += 1) {
      const i = w * 7 + d;
      const dayNum = i - firstOffset + 1;
      const inMonth = dayNum >= 1 && dayNum <= last.getDate();
      const dateObj = inMonth
        ? new Date(year, month - 1, dayNum)
        : new Date(year, month - 1, dayNum < 1 ? dayNum : dayNum);
      days.push({
        inMonth,
        dayNum: dateObj.getDate(),
        date: toISO(dateObj.getFullYear(), dateObj.getMonth() + 1, dateObj.getDate())
      });
    }
    weeks.push(days);
  }

  const weekRows = weeks
    .map((weekDays) => {
      const weekStart = weekDays[0].date;
      const weekEnd = weekDays[6].date;
      const minInMonthIdx = weekDays.findIndex((day) => day.inMonth);
      const maxInMonthIdx = 6 - [...weekDays].reverse().findIndex((day) => day.inMonth);
      const orderedEvents = [...events].sort(
        (a, b) => a.start.localeCompare(b.start) || a.name.localeCompare(b.name)
      );
      const segments = events
        .filter((event) => !(event.end < weekStart || event.start > weekEnd))
        .map((event) => {
          const startIdx = Math.max(0, diffDays(new Date(weekStart), new Date(event.start)));
          const endIdx = Math.min(6, diffDays(new Date(weekStart), new Date(event.end)));
          const orderIndex = orderedEvents.findIndex((item) => item.id === event.id);
          const visibleStart = Math.max(startIdx, minInMonthIdx);
          const visibleEnd = endIdx;
          return { event, startIdx, endIdx, visibleStart, visibleEnd, orderIndex };
        })
        .filter((segment) => segment.visibleStart <= segment.visibleEnd)
        .sort((a, b) => a.orderIndex - b.orderIndex);

      const placed = segments.map((segment, laneIndex) => ({ ...segment, laneIndex }));
      return { weekDays, weekStart, weekEnd, minInMonthIdx, maxInMonthIdx, placed };
    });

  const renderedWeekRows = weekRows
    .map(({ weekDays, weekStart, weekEnd, minInMonthIdx, placed }) => {

      const bars = placed
        .map(({ event, startIdx, endIdx, visibleStart, visibleEnd, laneIndex }) => {
          const span = Math.max(1, visibleEnd - visibleStart + 1);
          const showInterview = event.interview >= weekStart && event.interview <= weekEnd;
          const startsThisWeek = event.start >= weekStart && event.start <= weekEnd;
          const continuesFromPrevMonth = startIdx < minInMonthIdx && visibleStart === minInMonthIdx;
          const interviewPos = showInterview
            ? Math.max(0, diffDays(new Date(weekStart), new Date(event.interview)))
            : 0;
          const isWeekStartLabel = visibleStart === 0 || startsThisWeek || continuesFromPrevMonth;
          const interviewOverlapsNameAtStart = showInterview && interviewPos === visibleStart;
          const showName = isWeekStartLabel && !interviewOverlapsNameAtStart;
          const interviewOffset = interviewPos - visibleStart + 0.5;
          const interviewLeftInBar = (interviewOffset / span) * 100;
          const showEndFallbackName = isWeekStartLabel && interviewOverlapsNameAtStart;
          const endCellIndex = Math.min(visibleEnd, endIdx);
          const endCellLeft = (endCellIndex / 7) * 100;
          const endNameTop = laneIndex * 16 + 2;

          return `
            <div class="week-bar" style="--start:${visibleStart};--span:${span};--lane:${laneIndex};background:${event.fill};color:${event.ink}">
              ${showName ? `<span class="week-bar-text">${event.name}</span>` : ""}
              ${showInterview ? `<span class="week-interview-tag" style="left:${interviewLeftInBar}%;background:${event.fill};color:${event.ink};border-color:${event.ink}">面談開始</span>` : ""}
            </div>
            ${showEndFallbackName ? `<span class="week-end-name-tag" style="left:${endCellLeft}%;top:${endNameTop}px;background:${event.fill};color:${event.ink}">${event.name}</span>` : ""}
          `;
        })
        .join("");

      const dayCells = weekDays
        .map((day) => {
          return `
          <div class="day-cell ${day.inMonth ? "" : "muted"} ${day.date === todayIso ? "today-day" : ""}">
            <div class="day-number">${day.inMonth ? day.dayNum : ""}</div>
          </div>
        `;
        })
        .join("");

      const todayIdx = weekDays.findIndex((day) => day.date === todayIso);
      const barsHeight = Math.max(22, placed.length * 16 + 4);
      return `
        <div class="week-block">
          <div class="day-grid">${dayCells}</div>
          <div class="week-bars ${todayIdx >= 0 ? "has-today" : ""}" style="height:${barsHeight}px;--today-idx:${todayIdx}">
            ${todayIdx >= 0 ? '<div class="today-column"></div>' : ""}
            ${bars}
          </div>
        </div>
      `;
    })
    .join("");

  return `
    <section class="month-block">
      <h3 class="month-title">${year}年${month}月</h3>
      <div class="week-header">
        <div>月</div><div>火</div><div>水</div><div>木</div><div>金</div><div>土</div><div>日</div>
      </div>
      <div class="month-weeks">${renderedWeekRows}</div>
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

function formatDateWithWeekday(iso) {
  const d = new Date(iso);
  const weekdays = ["日", "月", "火", "水", "木", "金", "土"];
  return `${d.getMonth() + 1}/${d.getDate()}(${weekdays[d.getDay()]})`;
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

function loadListSort() {
  try {
    const raw = localStorage.getItem(LIST_SORT_KEY);
    if (!raw) return { key: "none", dir: "asc" };
    const parsed = JSON.parse(raw);
    const validKey = parsed?.key === "start" || parsed?.key === "interview" ? parsed.key : "none";
    const validDir = parsed?.dir === "desc" ? "desc" : "asc";
    return { key: validKey, dir: validDir };
  } catch {
    return { key: "none", dir: "asc" };
  }
}



function saveEvents() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.events));
  } catch {
    alert("ブラウザ保存に失敗しました。");
  }
}

function saveListSort() {
  try {
    localStorage.setItem(LIST_SORT_KEY, JSON.stringify(state.listSort));
  } catch {
    // ignore
  }
}



function makeId() {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `event-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function diffDays(fromDate, toDate) {
  const fromUtc = Date.UTC(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate());
  const toUtc = Date.UTC(toDate.getFullYear(), toDate.getMonth(), toDate.getDate());
  return Math.floor((toUtc - fromUtc) / 86400000);
}

