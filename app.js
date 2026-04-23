const API_BASE = "/api/events";

const state = {
  events: [],
  editingId: null
};

const form = document.querySelector("#eventForm");
const formTitle = document.querySelector("#formTitle");
const eventIdInput = document.querySelector("#eventId");
const submitButton = document.querySelector("#submitButton");
const deleteButton = document.querySelector("#deleteButton");
const resetButton = document.querySelector("#resetButton");

form.addEventListener("submit", onSubmit);
resetButton.addEventListener("click", clearForm);
deleteButton.addEventListener("click", onDelete);

init();

async function init() {
  await reloadEvents();
  renderAll();
}

async function onSubmit(e) {
  e.preventDefault();

  const payload = collectFormValues();
  if (!payload) return;

  try {
    if (state.editingId) {
      const res = await fetch(`${API_BASE}/${state.editingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error("update failed");
    } else {
      const res = await fetch(API_BASE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error("create failed");
    }
  } catch {
    alert("保存に失敗しました。サーバー接続を確認してください。");
    return;
  }

  await reloadEvents();
  renderAll();
  clearForm();
}

async function onDelete() {
  if (!state.editingId) return;

  try {
    const res = await fetch(`${API_BASE}/${state.editingId}`, { method: "DELETE" });
    if (!res.ok) throw new Error("delete failed");
  } catch {
    alert("削除に失敗しました。サーバー接続を確認してください。");
    return;
  }

  await reloadEvents();
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

async function deleteSelected(selectedIds) {
    if (selectedIds.length === 0) {
      alert("削除するイベントを選択してください。");
      return;
    }
    const ok = confirm(`${selectedIds.length}件のイベントを削除します。よろしいですか？`);
    if (!ok) return;

    try {
      const res = await fetch(API_BASE, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedIds })
      });
      if (!res.ok) throw new Error("bulk delete failed");
    } catch {
      alert("一括削除に失敗しました。サーバー接続を確認してください。");
      return;
    }

    if (state.editingId && selectedIds.includes(state.editingId)) clearForm();
    await reloadEvents();
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
    return [{ year: now.getFullYear(), month: now.getMonth() + 1 }];
  }

  const minStart = [...events].sort((a, b) => a.start.localeCompare(b.start))[0].start;
  const maxEnd = [...events].sort((a, b) => b.end.localeCompare(a.end))[0].end;

  const start = new Date(minStart);
  const end = new Date(maxEnd);
  const result = [];

  let year = start.getFullYear();
  let month = start.getMonth() + 1;
  while (year < end.getFullYear() || (year === end.getFullYear() && month <= end.getMonth() + 1)) {
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

async function reloadEvents() {
  try {
    const res = await fetch(API_BASE);
    if (!res.ok) throw new Error("request failed");
    const data = await res.json();
    state.events = Array.isArray(data.events) ? data.events : [];
  } catch {
    alert("イベント取得に失敗しました。server.py を起動して再読み込みしてください。");
    state.events = [];
  }
}
