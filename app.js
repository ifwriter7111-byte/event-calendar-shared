const STORAGE_KEY = "schedule-events-v3";
const LIST_SORT_KEY = "schedule-list-sort-v3";
const NAME_HISTORY_KEY = "schedule-name-history-v1";

// 共有バックエンド（Googleスプレッドシート）のURL。
// 空 "" にすると、この端末だけに保存する従来モードになる。
const API_URL = "https://script.google.com/macros/s/AKfycbxNLee4rbCM7qU5Ex3AmTixeksqlJ0kBxS0R2wk-HhxflRC-spTia7knEcFYuvzIhj96g/exec";

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
  events: API_URL ? [] : loadEvents(),
  editingId: null,
  selectedCalendarId: "all",
  listSort: loadListSort()
};
let lastServerJson = "";
let inlineEditingActive = false;

const form = document.querySelector("#eventForm");

form.addEventListener("submit", onSubmit);
document.querySelector("#openAddButton").addEventListener("click", openAddModal);
document.querySelector("#addCancel").addEventListener("click", closeAddModal);
document.querySelector("#addReset").addEventListener("click", clearForm);
document.querySelector("#addTargetRow").addEventListener("click", () => addTargetRow(""));
document.querySelector("#addModal").addEventListener("click", (e) => {
  if (e.target.id === "addModal") closeAddModal();
});

init();

async function onSubmit(e) {
  e.preventDefault();

  const payload = collectFormValues();
  if (!payload) return;

  rememberName(payload.name);
  const id = makeId();
  closeAddModal();
  clearForm();
  await persist(
    { action: "add", event: { ...payload, id } },
    () => {
      state.events.push({ id, ...payload });
    }
  );
}

function collectFormValues() {
  const name = document.querySelector("#name").value.trim();
  const start = document.querySelector("#start").value;
  const end = document.querySelector("#end").value;
  const interview = document.querySelector("#interview").value;
  const fill = document.querySelector("#fill").value;
  const ink = "#000000";
  const targetList = collectTargetList();

  if (!name || !start || !end || !interview) return null;
  if (start > end) {
    alert("終了日は開始日以降にしてください。");
    return null;
  }
  if (interview < start || interview > end) {
    alert("面談開始日は開始日〜終了日の範囲にしてください。");
    return null;
  }
  return { name, start, end, interview, fill, ink, targetList };
}

function clearForm() {
  form.reset();
  document.querySelector("#fill").value = "#dff4dc";
  resetTargetRows();
}

// 「イベント追加」ボタンで開く追加モーダル。
function openAddModal() {
  clearForm();
  document.querySelector("#addModal").classList.remove("hidden");
  document.querySelector("#name").focus();
}

function closeAddModal() {
  document.querySelector("#addModal").classList.add("hidden");
}

// ===== 対象リスト（複数入力） =====

function addTargetRow(value) {
  const container = document.querySelector("#targetListContainer");
  const row = document.createElement("div");
  row.className = "target-row";
  const input = document.createElement("input");
  input.type = "text";
  input.className = "target-input";
  input.placeholder = "対象を入力";
  input.value = value || "";
  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "target-remove";
  remove.textContent = "×";
  remove.addEventListener("click", () => {
    row.remove();
    if (!container.querySelector(".target-row")) addTargetRow("");
  });
  row.appendChild(input);
  row.appendChild(remove);
  container.appendChild(row);
}

function resetTargetRows(values) {
  const container = document.querySelector("#targetListContainer");
  if (!container) return;
  container.innerHTML = "";
  const list = Array.isArray(values) && values.length ? values : [""];
  list.forEach((v) => addTargetRow(v));
}

// 「、」「,」やスペース（全角・半角）で区切られた入力を、別々のリスト名に分ける。
function splitTargetInput(value) {
  return String(value || "")
    .split(/[、,\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function collectTargetList() {
  return [...document.querySelectorAll("#targetListContainer .target-input")]
    .flatMap((i) => splitTargetInput(i.value));
}

function renderAll() {
  renderNameOptions();
  renderEventList();
  renderCalendar();
}

// 対象リストを小さなチップで表示する。
function renderTargetChips(list) {
  if (!Array.isArray(list) || list.length === 0) return "";
  return list
    .map((t) => `<span class="target-chip">${String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</span>`)
    .join("");
}

// ===== 共有バックエンド（Googleスプレッドシート）連携 =====

async function apiList() {
  const res = await fetch(API_URL);
  return res.json();
}

async function apiSend(body) {
  // 書き込みは no-cors で送る（Googleにログインしていない別の人の端末でも確実に届く）。
  await fetch(API_URL, { method: "POST", body: JSON.stringify(body), mode: "no-cors" });
}

function setEventsFromServer(list) {
  state.events = Array.isArray(list) ? list.map(normalizeEvent).filter(Boolean) : [];
  saveEvents();
}

// 変更を保存する。共有モードならサーバーへ送って全員に反映、そうでなければこの端末に保存。
async function persist(apiBody, localApply) {
  // まず手元に即反映（楽観的更新）＝操作した人にはすぐ見える。
  localApply();
  renderAll();
  if (!API_URL) {
    saveEvents();
    return;
  }
  try {
    await apiSend(apiBody);
  } catch (e) {
    alert("共有サーバーとの通信に失敗しました。通信環境を確認して、もう一度お試しください。");
    return;
  }
  saveEvents();
  // 少し後にサーバーの確定内容を取り込み、他の人の変更とも整合を取る。
  setTimeout(refreshFromServer, 1500);
}

async function init() {
  if (API_URL) {
    try {
      const list = await apiList();
      setEventsFromServer(list);
      lastServerJson = JSON.stringify(list);
    } catch (e) {
      state.events = loadEvents();
    }
    renderAll();
    setInterval(refreshFromServer, 15000);
    window.addEventListener("focus", refreshFromServer);
  } else {
    renderAll();
  }
}

// 他の人の変更を定期的に取り込む（編集中・チェック中は邪魔しない）。
async function refreshFromServer() {
  if (!API_URL || state.editingId || inlineEditingActive) return;
  try {
    const list = await apiList();
    const json = JSON.stringify(list);
    if (json === lastServerJson) return;
    lastServerJson = json;
    setEventsFromServer(list);
    renderAll();
  } catch (e) {}
}

function renderEventList() {
  const root = document.querySelector("#eventList");
  const rows = getListRows()
    .map((event) => {
      return `
      <tr data-id="${event.id}">
        <td class="check-cell"><button type="button" class="danger row-delete" data-id="${event.id}">削除</button></td>
        <td><span class="name-badge editable-name" data-id="${event.id}" title="クリックで名前を変更" style="background:${event.fill};color:${event.ink}">${event.name}</span></td>
        <td class="period-cell">
          <span class="editable-date period-date" data-id="${event.id}" data-field="start" data-value="${event.start}" title="クリックで変更">${formatDateWithWeekday(event.start)}</span>
          <span class="period-sep">〜</span>
          <span class="editable-date period-date" data-id="${event.id}" data-field="end" data-value="${event.end}" title="クリックで変更">${formatDateWithWeekday(event.end)}</span>
        </td>
        <td><span class="editable-date" data-id="${event.id}" data-field="interview" data-value="${event.interview}" title="クリックで変更">${formatDateWithWeekday(event.interview)}</span></td>
        <td class="target-cell"><span class="editable-target" data-id="${event.id}" title="クリックで対象リストを編集">${(event.targetList && event.targetList.length) ? renderTargetChips(event.targetList) : '<span class="target-placeholder">＋ 追加</span>'}</span></td>
      </tr>`;
    })
    .join("");

  root.innerHTML = `
    <table class="event-table">
      <thead>
        <tr>
          <th class="check-cell">削除</th>
          <th>ローンチ名</th>
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
          <th>対象リスト</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;

  const sortTriggers = root.querySelectorAll(".sort-trigger");

  root.querySelectorAll(".row-delete").forEach((button) => {
    button.addEventListener("click", (e) => {
      e.stopPropagation();
      deleteSingle(button.dataset.id);
    });
  });

  sortTriggers.forEach((button) => {
    button.addEventListener("click", () => {
      toggleListSort(button.dataset.sortKey);
    });
  });

  root.querySelectorAll(".editable-date").forEach((span) => {
    span.addEventListener("click", () => startInlineDateEdit(span));
  });
  root.querySelectorAll(".editable-name").forEach((span) => {
    span.addEventListener("click", () => startInlineNameEdit(span));
  });
  root.querySelectorAll(".editable-target").forEach((span) => {
    span.addEventListener("click", () => startInlineTargetEdit(span));
  });
}

// 一覧の対象リストをその場で編集（クリック→「、」やスペース区切りで入力→保存）。
function startInlineTargetEdit(span) {
  const id = span.dataset.id;
  const event = state.events.find((e) => e.id === id);
  const current = event && Array.isArray(event.targetList) ? event.targetList.join("、") : "";
  const input = document.createElement("input");
  input.type = "text";
  input.className = "inline-edit-input inline-target-input";
  input.value = current;
  inlineEditingActive = true;
  span.replaceWith(input);
  input.focus();
  input.select();
  let done = false;
  const commit = async () => {
    if (done) return;
    done = true;
    inlineEditingActive = false;
    const newList = splitTargetInput(input.value);
    const before = event && Array.isArray(event.targetList) ? event.targetList : [];
    if (JSON.stringify(before) === JSON.stringify(newList)) {
      renderEventList();
      return;
    }
    await updateEventField(id, "targetList", newList);
  };
  input.addEventListener("blur", commit);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      input.blur();
    }
  });
  input.addEventListener("mousedown", (e) => e.stopPropagation());
}

// 一覧の日付をその場で編集（クリック→日付選択→保存）。
function startInlineDateEdit(span) {
  const id = span.dataset.id;
  const field = span.dataset.field;
  const current = span.dataset.value;
  const input = document.createElement("input");
  input.type = "date";
  input.value = current;
  input.className = "inline-edit-input";
  inlineEditingActive = true;
  span.replaceWith(input);
  input.focus();
  if (input.showPicker) {
    try { input.showPicker(); } catch (e) {}
  }
  let done = false;
  const commit = async () => {
    if (done) return;
    done = true;
    inlineEditingActive = false;
    const newVal = input.value;
    if (!newVal || newVal === current) {
      renderEventList();
      return;
    }
    const ok = await updateEventField(id, field, newVal);
    if (!ok) renderEventList();
  };
  input.addEventListener("change", commit);
  input.addEventListener("blur", commit);
  input.addEventListener("mousedown", (e) => e.stopPropagation());
}

// 一覧の名前をその場で編集（クリック→文字入力→保存）。
function startInlineNameEdit(span) {
  const id = span.dataset.id;
  const current = span.textContent;
  const input = document.createElement("input");
  input.type = "text";
  input.value = current;
  input.className = "inline-edit-input";
  input.setAttribute("list", "nameOptions");
  input.setAttribute("autocomplete", "off");
  inlineEditingActive = true;
  span.replaceWith(input);
  input.focus();
  input.select();
  let done = false;
  const commit = async () => {
    if (done) return;
    done = true;
    inlineEditingActive = false;
    const newVal = input.value.trim();
    if (!newVal || newVal === current) {
      renderEventList();
      return;
    }
    rememberName(newVal);
    await updateEventField(id, "name", newVal);
  };
  input.addEventListener("blur", commit);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      input.blur();
    }
  });
  input.addEventListener("mousedown", (e) => e.stopPropagation());
}

// 1項目だけ更新して保存する。妥当性チェック付き。
async function updateEventField(id, field, value) {
  const target = state.events.find((e) => e.id === id);
  if (!target) return false;
  const updated = { ...target, [field]: value };
  if (updated.start > updated.end) {
    alert("終了日は開始日以降にしてください。");
    return false;
  }
  if (updated.interview < updated.start || updated.interview > updated.end) {
    alert("面談開始日は開始日〜終了日の範囲にしてください。");
    return false;
  }
  await persist(
    { action: "update", event: { id, name: updated.name, start: updated.start, end: updated.end, interview: updated.interview, fill: updated.fill, targetList: updated.targetList || [] } },
    () => {
      state.events = state.events.map((e) => (e.id === id ? updated : e));
    }
  );
  return true;
}

function getTodayIso() {
  const now = new Date();
  return toISO(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

// 終了日が今日以降のイベント（＝まだ終わっていないもの）だけを返す。
// 終了日当日は残し、翌日から一覧・カレンダーに出さない。データ自体は消さない。
function getActiveEvents() {
  const today = getTodayIso();
  return state.events.filter((event) => event.end >= today);
}

function getListRows() {
  const source = getActiveEvents();
  // 一覧は常に面談開始日順（昇順）で自動整列。手動で「期間」列を選んだ場合だけ開始日順にする。
  const key = state.listSort.key === "start" ? "start" : "interview";
  const secondaryKey = key === "start" ? "interview" : "start";
  const dir = state.listSort.dir === "desc" ? -1 : 1;
  return source.sort((a, b) => {
    const primary = a[key].localeCompare(b[key]) * dir;
    if (primary !== 0) return primary;
    // 主キーが同じときは、もう一方の日付→名前の順で安定させる。
    const secondary = a[secondaryKey].localeCompare(b[secondaryKey]);
    if (secondary !== 0) return secondary;
    return a.name.localeCompare(b.name);
  });
}

function toggleListSort(key) {
  // 昇順⇄降順のみを切り替える（未ソート状態は持たず、常にどちらかで整列する）。
  if (state.listSort.key === key) {
    state.listSort = { key, dir: state.listSort.dir === "asc" ? "desc" : "asc" };
  } else {
    state.listSort = { key, dir: "asc" };
  }
  saveListSort();
  renderEventList();
}

function sortMark(key) {
  if (state.listSort.key !== key) return "▽";
  return state.listSort.dir === "asc" ? "▲" : "▼";
}

async function deleteSingle(id) {
  const event = state.events.find((e) => e.id === id);
  const label = event ? `「${event.name}」を` : "この予定を";
  const ok = confirm(`${label}削除しますか？`);
  if (!ok) return;
  await persist(
    { action: "delete", ids: [id] },
    () => {
      state.events = state.events.filter((e) => e.id !== id);
    }
  );
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
  const activeEvents = getActiveEvents();
  const hasSelected = state.selectedCalendarId === "all" || activeEvents.some((event) => event.id === state.selectedCalendarId);
  if (!hasSelected) state.selectedCalendarId = "all";

  const options = [
    `<option value="all" ${state.selectedCalendarId === "all" ? "selected" : ""}>全員</option>`,
    ...activeEvents.map(
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
  const active = getActiveEvents();
  if (state.selectedCalendarId === "all") return active;
  return active.filter((event) => event.id === state.selectedCalendarId);
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
          const endNameTop = laneIndex * 32 + 4;

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
      // 帯エリアは最低でも約2倍の高さ（52px）。イベントが重なるぶんは1レーン32pxずつ伸ばす。
      const barsHeight = Math.max(52, placed.length * 32 + 8);
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
  // 今月から、最低でも今年の12月までは必ず表示する。
  const now = new Date();
  const startYear = now.getFullYear();
  const startMonth = now.getMonth() + 1;

  let endYear = startYear;
  let endMonth = 12;

  // 予定が今年12月より先まで続く場合は、その月まで伸ばす（予定を途中で切らない）。
  if (events.length > 0) {
    const maxEnd = [...events].sort((a, b) => b.end.localeCompare(a.end))[0].end;
    const endDate = new Date(maxEnd);
    const eventEndYear = endDate.getFullYear();
    const eventEndMonth = endDate.getMonth() + 1;
    if (eventEndYear > endYear || (eventEndYear === endYear && eventEndMonth > endMonth)) {
      endYear = eventEndYear;
      endMonth = eventEndMonth;
    }
  }

  const result = [];
  let year = startYear;
  let month = startMonth;
  while (year < endYear || (year === endYear && month <= endMonth)) {
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
    if (!Array.isArray(parsed)) return seedEvents;
    const normalized = parsed.map(normalizeEvent).filter(Boolean);
    return normalized.length > 0 ? normalized : seedEvents;
  } catch {
    return seedEvents;
  }
}

function loadListSort() {
  // 既定は面談開始日の昇順。保存された設定が壊れていても面談開始日順に戻す。
  try {
    const raw = localStorage.getItem(LIST_SORT_KEY);
    if (!raw) return { key: "interview", dir: "asc" };
    const parsed = JSON.parse(raw);
    const validKey = parsed?.key === "start" || parsed?.key === "interview" ? parsed.key : "interview";
    const validDir = parsed?.dir === "desc" ? "desc" : "asc";
    return { key: validKey, dir: validDir };
  } catch {
    return { key: "interview", dir: "asc" };
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



function loadNameHistory() {
  try {
    const raw = localStorage.getItem(NAME_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((n) => typeof n === "string" && n.trim()).map((n) => n.trim());
  } catch {
    return [];
  }
}

function saveNameHistory(names) {
  try {
    localStorage.setItem(NAME_HISTORY_KEY, JSON.stringify(names));
  } catch {
    // ignore
  }
}

// 一度でも入力した名前を履歴に残す（イベントを消しても候補には残る）。
function rememberName(name) {
  const trimmed = (name || "").trim();
  if (!trimmed) return;
  const history = loadNameHistory();
  if (!history.includes(trimmed)) {
    history.push(trimmed);
    saveNameHistory(history);
  }
}

// 履歴＋現在のイベント名を合わせた、重複なしの候補一覧。
function getNameSuggestions() {
  const set = new Set(loadNameHistory());
  state.events.forEach((event) => {
    if (event.name) set.add(event.name);
  });
  return [...set].sort((a, b) => a.localeCompare(b, "ja"));
}

function renderNameOptions() {
  const datalist = document.querySelector("#nameOptions");
  if (!datalist) return;
  datalist.innerHTML = getNameSuggestions()
    .map((name) => `<option value="${name.replace(/&/g, "&amp;").replace(/"/g, "&quot;")}"></option>`)
    .join("");
}

function makeId() {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `event-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizeEvent(input) {
  if (!input || typeof input !== "object") return null;
  const id = typeof input.id === "string" && input.id ? input.id : makeId();
  const name = typeof input.name === "string" ? input.name.trim() : "";
  const start = typeof input.start === "string" ? input.start : "";
  const end = typeof input.end === "string" ? input.end : "";
  const interview = typeof input.interview === "string" ? input.interview : "";
  const fill = typeof input.fill === "string" && input.fill ? input.fill : "#dff4dc";
  const ink = typeof input.ink === "string" && input.ink ? input.ink : "#255725";
  const targetList = Array.isArray(input.targetList)
    ? input.targetList.filter((t) => typeof t === "string" && t.trim()).map((t) => t.trim())
    : [];

  if (!name || !isIsoDate(start) || !isIsoDate(end) || !isIsoDate(interview)) return null;
  if (start > end) return null;
  if (interview < start || interview > end) return null;

  return { id, name, start, end, interview, fill, ink, targetList };
}

function isIsoDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function diffDays(fromDate, toDate) {
  const fromUtc = Date.UTC(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate());
  const toUtc = Date.UTC(toDate.getFullYear(), toDate.getMonth(), toDate.getDate());
  return Math.floor((toUtc - fromUtc) / 86400000);
}
