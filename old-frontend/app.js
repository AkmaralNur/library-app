// Фронтенд: общается с бэкендом через fetch и рисует все разделы приложения

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

let me = null;            // текущий пользователь или null
let config = { finePerDay: 50, extendDays: 7, maxExtensions: 2 };
let tab = 'catalog';
let editingId = null;     // null — добавляем новую книгу, число — редактируем
let issuingId = null;     // какую книгу выдаём
let openBookId = null;    // какая книга открыта в карточке
let registering = false;  // окно входа в режиме регистрации
let readersCache = [];

const isLibrarian = () => me?.role === 'librarian';
const isReader = () => me?.role === 'reader';

// ---------- Помощники ----------

// Небольшая обёртка над fetch
async function api(url, options = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (res.status === 204) return null;
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Ошибка сервера');
  return data;
}

// Защита от HTML-инъекций при выводе текста
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString('ru-RU') : '');
const money = (n) => `${Number(n).toLocaleString('ru-RU')} сом`;
const isOverdue = (iso) => iso && new Date(iso) < new Date();

function stars(rating) {
  if (!rating) return '<span class="muted">—</span>';
  const full = Math.round(rating);
  return `<span class="stars" title="${rating} из 5">${'★'.repeat(full)}${'☆'.repeat(5 - full)}</span>`;
}

// Обложка: картинка по ссылке или цветная заглушка с буквой
function cover(b, cls = '') {
  if (b.cover_url) return `<img class="cover ${cls}" src="${esc(b.cover_url)}" alt="" loading="lazy">`;
  const hue = [...b.title].reduce((h, c) => h + c.charCodeAt(0), 0) % 360;
  return `<span class="cover placeholder ${cls}" style="--hue:${hue}">${esc(b.title[0])}</span>`;
}

let toastTimer;
function toast(text, isError = false) {
  const el = $('#toast');
  el.textContent = text;
  el.classList.toggle('error', isError);
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 3500);
}

// ---------- Пользователь ----------

function renderUser() {
  $('#userBox').innerHTML = me
    ? `<span>${esc(me.name)} <small>(${isLibrarian() ? 'библиотекарь' : 'читатель'})</small></span>
       <button data-act="password" title="Сменить пароль">🔑</button>
       <button data-act="logout">Выйти</button>`
    : '<button data-act="login" class="primary">Войти</button>';
  $$('[data-role]').forEach((el) => { el.hidden = me?.role !== el.dataset.role; });
  const tabBtn = $(`#tabs [data-tab="${tab}"]`);
  if (tabBtn.hidden) showTab('catalog');
}

function setAuthMode(register) {
  registering = register;
  $('#authTitle').textContent = register ? 'Регистрация' : 'Вход';
  $('#authSubmit').textContent = register ? 'Зарегистрироваться' : 'Войти';
  $('#authSwitch').textContent = register ? 'Уже есть аккаунт? Войти' : 'Нет аккаунта? Зарегистрироваться';
  $('#nameField').hidden = !register;
  $('#authForm').elements.name.required = register;
  $('#authError').textContent = '';
}

function openAuth() {
  $('#authForm').reset();
  setAuthMode(false);
  $('#authDialog').showModal();
}

$('#authSwitch').addEventListener('click', (e) => {
  e.preventDefault();
  setAuthMode(!registering);
});

$('#authForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const body = JSON.stringify(Object.fromEntries(new FormData(e.target)));
  try {
    me = await api(registering ? '/api/register' : '/api/login', { method: 'POST', body });
    $('#authDialog').close();
    renderUser();
    toast(`Здравствуйте, ${me.name}!`);
    refreshAll();
  } catch (err) {
    $('#authError').textContent = err.message;
  }
});

$('#passwordForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await api('/api/password', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(e.target))) });
    $('#passwordDialog').close();
    toast('Пароль изменён');
  } catch (err) {
    $('#passwordError').textContent = err.message;
  }
});

// ---------- Каталог ----------

function statusCell(b) {
  if (b.available && b.held) {
    const who = !b.held_for_me && b.held_by ? `для ${esc(b.held_by)}, ` : '';
    const info = `<small>${who}до ${fmtDate(b.hold_until)}</small>`;
    if (isLibrarian()) {
      return `<button class="status hold" data-act="issue" data-id="${b.id}" title="Выдать читателю">Отложена</button>${info}`;
    }
    return b.held_for_me
      ? `<span class="status hold">Отложена для вас</span>${info}`
      : '<span class="status hold">Забронирована</span>';
  }
  if (b.available) {
    return isLibrarian()
      ? `<button class="status in" data-act="issue" data-id="${b.id}" title="Выдать читателю">В наличии</button>`
      : '<span class="status in">В наличии</span>';
  }
  const late = isOverdue(b.due_at);
  const who = b.mine ? 'у вас, ' : b.borrower ? `${esc(b.borrower)}, ` : '';
  const queue = b.queue ? ` · очередь: ${b.queue}` : '';
  const info = `<small class="${late ? 'late' : ''}">${who}до ${fmtDate(b.due_at)}${queue}</small>`;
  return isLibrarian()
    ? `<button class="status out" data-act="return" data-id="${b.id}" title="Оформить возврат">Выдана</button>${info}`
    : `<span class="status out">Выдана</span>${info}`;
}

async function loadBooks() {
  const params = new URLSearchParams({
    q: $('#search').value,
    genre: $('#genreFilter').value,
    sort: $('#sort').value,
    available: $('#availableOnly').checked ? '1' : '',
  });
  const books = await api('/api/books?' + params);
  $('#empty').hidden = books.length > 0;
  $('#books').innerHTML = books.map((b) => `
    <tr>
      <td><a href="#" class="book-link" data-act="open" data-id="${b.id}">${cover(b, 'small')}<span>${esc(b.title)}</span></a></td>
      <td>${esc(b.author)}</td>
      <td>${esc(b.year)}</td>
      <td>${esc(b.genre)}</td>
      <td class="nowrap">${stars(b.rating)}${b.reviews_count ? ` <small class="muted">(${b.reviews_count})</small>` : ''}</td>
      <td class="status-cell">${statusCell(b)}</td>
      <td class="row-actions">
        ${isLibrarian() ? `
          <button class="icon" data-act="edit" data-id="${b.id}" title="Изменить">✏️</button>
          <button class="icon" data-act="delete" data-id="${b.id}" title="Удалить">🗑️</button>` : reserveButton(b)}
      </td>
    </tr>`).join('');
}

// Кнопка брони для читателя и гостя (гостю она предложит войти)
function reserveButton(b) {
  if (b.mine) return '<small class="muted">у вас</small>';
  if (b.reserved_by_me) return `<button data-act="unreserve" data-id="${b.id}">Отменить бронь</button>`;
  return `<button class="primary" data-act="reserve" data-id="${b.id}">📌 Забронировать</button>`;
}

async function loadGenres() {
  const genres = await api('/api/genres');
  const current = $('#genreFilter').value;
  $('#genreFilter').innerHTML = '<option value="">Все жанры</option>' +
    genres.map((g) => `<option ${g === current ? 'selected' : ''}>${esc(g)}</option>`).join('');
  $('#genreList').innerHTML = genres.map((g) => `<option value="${esc(g)}">`).join('');
}

async function loadStats() {
  const s = await api('/api/stats');
  let text = `Книг: ${s.total} · В наличии: ${s.available} · Авторов: ${s.authors}`;
  if (isLibrarian()) text += ` · Читателей: ${s.readers}` + (s.overdue ? ` · Просрочено: ${s.overdue}` : '');
  $('#stats').textContent = text;
}

// ---------- Карточка книги ----------

async function openBook(id) {
  openBookId = id;
  await renderBook();
  if (!$('#bookDialog').open) $('#bookDialog').showModal();
}

async function renderBook() {
  const b = await api('/api/books/' + openBookId);
  const myReview = me && b.reviews.find((r) => r.user_id === me.id);

  // Статус и кнопки действий
  const holdInfo = b.held_for_me ? 'для вас ' : b.held_by ? `для ${esc(b.held_by)} ` : '';
  let status = b.available && b.held
    ? `<span class="status hold">${holdInfo || isLibrarian() ? 'Отложена' : 'Забронирована'}</span>
       ${holdInfo ? `<span class="muted">${holdInfo}до ${fmtDate(b.hold_until)}</span>` : ''}`
    : b.available
    ? '<span class="status in">В наличии</span>'
    : `<span class="status out">Выдана</span> <span class="${isOverdue(b.due_at) ? 'late' : 'muted'}">
         ${b.mine ? 'у вас ' : b.borrower ? esc(b.borrower) + ' ' : ''}до ${fmtDate(b.due_at)}</span>`;
  let actions = '';
  if (isLibrarian()) {
    actions += b.available
      ? `<button class="primary" data-act="issue" data-id="${b.id}">Выдать</button>`
      : `<button class="primary" data-act="return" data-id="${b.id}">Принять возврат</button>`;
    actions += ` <button data-act="edit" data-id="${b.id}">✏️ Изменить</button>`;
  } else if (isReader()) {
    const cancel = `<button data-act="unreserve" data-id="${b.id}">Отменить бронь</button>`;
    if (b.mine) {
      actions = `<small class="muted">Книга у вас до ${fmtDate(b.due_at)}.</small>`;
    } else if (b.held_for_me) {
      actions = `<span class="ok"><b>Книга отложена для вас до ${fmtDate(b.hold_until)}</b> — заберите её в библиотеке.</span> ${cancel}`;
    } else if (b.my_position) {
      actions = `<span>Вы в очереди: <b>${b.my_position}</b>. Когда книга освободится, её отложат для вас.</span> ${cancel}`;
    } else if (b.available && !b.held) {
      actions = `<button class="primary" data-act="reserve" data-id="${b.id}">📌 Забронировать</button>
        <small class="muted">Книгу отложат для вас на ${config.holdDays} дня — заберите её в библиотеке.</small>`;
    } else {
      actions = `<button class="primary" data-act="reserve" data-id="${b.id}">📌 Встать в очередь</button>
        <small class="muted">${b.queue ? `В очереди: ${b.queue}. ` : ''}Когда книга освободится, её отложат для вас.</small>`;
    }
  } else if (!me) {
    actions = `<button class="primary" data-act="reserve" data-id="${b.id}">📌 Забронировать</button>
      <small class="muted">Нужно войти — это займёт минуту.</small>`;
  }

  // Очередь и история — только для библиотекаря
  let extra = '';
  if (isLibrarian()) {
    extra += `<h3>Очередь</h3>` + (b.queue_list.length
      ? `<ol class="queue">${b.queue_list.map((r) => `<li>${esc(r.name)}
          ${r.ready_at ? '<b class="ok">книга отложена</b>' : `<small class="muted">с ${fmtDate(r.created_at)}</small>`}
          <button class="link" data-act="removeRes" data-id="${r.id}">снять бронь</button></li>`).join('')}</ol>`
      : '<p class="muted">Никто не ждёт</p>');
    extra += `<h3>История выдач</h3>` + (b.history.length ? loansTable(b.history, { reader: true }) : '<p class="muted">Книгу ещё не выдавали</p>');
  }

  // Отзывы
  const reviews = b.reviews.map((r) => `
    <div class="review">
      <div>${stars(r.rating)} <b>${esc(r.name)}</b> <small class="muted">${fmtDate(r.created_at)}</small>
        ${me && (isLibrarian() || r.user_id === me.id)
          ? `<button class="link" data-act="delReview" data-id="${r.id}">удалить</button>` : ''}
      </div>
      ${r.text ? `<p>${esc(r.text)}</p>` : ''}
    </div>`).join('') || '<p class="muted">Отзывов пока нет</p>';

  const reviewForm = isReader() ? `
    <form id="reviewForm" class="review-form">
      <div class="rate">${[5, 4, 3, 2, 1].map((n) => `
        <input type="radio" name="rating" id="r${n}" value="${n}" ${myReview?.rating === n ? 'checked' : ''}><label for="r${n}">★</label>`).join('')}
      </div>
      <textarea name="text" rows="2" placeholder="Ваш отзыв (необязательно)">${esc(myReview?.text)}</textarea>
      <button class="primary">${myReview ? 'Обновить отзыв' : 'Оставить отзыв'}</button>
    </form>` : '';

  $('#bookCard').innerHTML = `
    <div class="book-head">
      ${cover(b, 'big')}
      <div>
        <h2>${esc(b.title)}</h2>
        <p class="author">${esc(b.author)}</p>
        <p class="muted">${[b.year, b.genre].filter(Boolean).map(esc).join(' · ')}</p>
        <p>${stars(b.rating)} ${b.rating ? `<b>${b.rating}</b> <small class="muted">(${b.reviews_count} отз.)</small>` : ''}
           <small class="muted"> · выдавалась ${b.times_borrowed} раз</small></p>
        <p>${status}</p>
        <div class="card-actions">${actions}</div>
      </div>
    </div>
    ${b.description ? `<p class="description">${esc(b.description)}</p>` : ''}
    ${extra}
    <h3>Отзывы</h3>
    ${reviewForm}
    ${reviews}`;

  $('#reviewForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target));
    try {
      await api(`/api/books/${openBookId}/reviews`, { method: 'POST', body: JSON.stringify(data) });
      toast('Спасибо за отзыв!');
      refreshAll();
    } catch (err) {
      toast(err.message, true);
    }
  });
}

// ---------- Таблица выдач (общая для нескольких разделов) ----------

function loansTable(loans, { reader = false, book = true } = {}) {
  const rows = loans.map((l) => {
    const status = l.returned_at
      ? `<span class="status">Возвращена ${fmtDate(l.returned_at)}</span>`
      : l.overdue ? '<span class="status out">Просрочена</span>' : '<span class="status in">На руках</span>';
    const fine = l.fine
      ? `<span class="${l.fine_paid ? 'muted' : 'late'}">${money(l.fine)}${l.fine_paid ? ' ✓ оплачен' : ''}</span>` : '';
    const btns = [];
    if (isLibrarian() && !l.returned_at) btns.push(`<button data-act="return" data-id="${l.book_id}">Принять</button>`);
    if (l.can_extend) btns.push(`<button data-act="extend" data-id="${l.id}" title="+${config.extendDays} дней">Продлить</button>`);
    if (isLibrarian() && l.fine && !l.fine_paid) btns.push(`<button data-act="pay" data-id="${l.id}">Штраф оплачен</button>`);
    return `
      <tr class="${l.overdue ? 'overdue' : ''}">
        ${book ? `<td><a href="#" data-act="open" data-id="${l.book_id}" class="title">${esc(l.title)}</a><br><small class="muted">${esc(l.author)}</small></td>` : ''}
        ${reader ? `<td><a href="#" data-act="reader" data-id="${l.user_id}">${esc(l.borrower)}</a></td>` : ''}
        <td>${fmtDate(l.issued_at)}</td>
        <td>${fmtDate(l.due_at)}${l.extensions ? ` <small class="muted">(продлено ×${l.extensions})</small>` : ''}</td>
        <td>${status}</td>
        <td>${fine}</td>
        <td class="row-actions">${btns.join(' ')}</td>
      </tr>`;
  }).join('');
  return `
    <table>
      <thead><tr>
        ${book ? '<th>Книга</th>' : ''}${reader ? '<th>Читатель</th>' : ''}
        <th>Выдана</th><th>Вернуть до</th><th>Статус</th><th>Штраф</th><th></th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

// ---------- Мои книги (читатель) ----------

async function loadMy() {
  const [loans, reservations] = await Promise.all([api('/api/loans'), api('/api/reservations')]);
  const active = loans.filter((l) => !l.returned_at);
  const history = loans.filter((l) => l.returned_at);
  const unpaid = loans.reduce((s, l) => s + (l.fine_paid ? 0 : l.fine), 0);

  $('#myFines').hidden = !unpaid;
  $('#myFines').innerHTML = `⚠️ У вас неоплаченные штрафы: <b>${money(unpaid)}</b>.
    Штраф — ${money(config.finePerDay)} за каждый день просрочки. Оплатить можно в библиотеке.`;
  $('#myActive').innerHTML = active.length ? loansTable(active)
    : '<p class="muted">Сейчас у вас нет книг. Забронируйте книгу в каталоге и заберите её в библиотеке.</p>';
  $('#myHistory').innerHTML = history.length ? loansTable(history) : '<p class="muted">Пока пусто</p>';
  $('#myReservations').innerHTML = reservations.length ? `
    <table>
      <thead><tr><th>Книга</th><th>Забронирована</th><th>Статус</th><th></th></tr></thead>
      <tbody>${reservations.map((r) => `
        <tr>
          <td><a href="#" class="book-link" data-act="open" data-id="${r.book_id}">${cover(r, 'small')}<span>${esc(r.title)}<br><small class="muted">${esc(r.author)}</small></span></a></td>
          <td>${fmtDate(r.created_at)}</td>
          <td>${r.ready_at
            ? `<b class="ok">Готова к выдаче — заберите до ${fmtDate(r.hold_until)}</b>`
            : `Место в очереди: <b>${r.position}</b>`}</td>
          <td class="row-actions"><button data-act="unreserve" data-id="${r.book_id}">Отменить</button></td>
        </tr>`).join('')}
      </tbody>
    </table>` : '<p class="muted">Нет броней. Нажмите «📌 Забронировать» у любой книги в каталоге.</p>';
}

// ---------- Выдачи (библиотекарь) ----------

async function loadLoans() {
  const filter = $('#loansFilter').value;
  const [holds, all] = await Promise.all([api('/api/holds'), api('/api/loans' + (filter === 'active' ? '?active=1' : ''))]);
  let loans = all;
  $('#holdsList').innerHTML = holds.length ? `
    <h2>Ждут выдачи <small class="muted">— забронированы читателями</small></h2>
    <table>
      <thead><tr><th>Книга</th><th>Читатель</th><th>Отложена до</th><th></th></tr></thead>
      <tbody>${holds.map((h) => `
        <tr>
          <td><a href="#" class="book-link" data-act="open" data-id="${h.book_id}">${cover(h, 'small')}<span>${esc(h.title)}<br><small class="muted">${esc(h.author)}</small></span></a></td>
          <td><a href="#" data-act="reader" data-id="${h.user_id}">${esc(h.reader)}</a></td>
          <td>${fmtDate(h.hold_until)}</td>
          <td class="row-actions">
            <button class="primary" data-act="issue" data-id="${h.book_id}">Выдать</button>
            <button data-act="removeRes" data-id="${h.id}">Снять бронь</button>
          </td>
        </tr>`).join('')}
      </tbody>
    </table>
    <h2>Выдачи</h2>` : '';
  if (filter === 'overdue') loans = loans.filter((l) => l.overdue);
  if (filter === 'fines') loans = loans.filter((l) => l.fine && !l.fine_paid);
  $('#loansList').innerHTML = loans.length ? loansTable(loans, { reader: true }) : '<p class="empty">Выдач нет</p>';
}

// ---------- Читатели (библиотекарь) ----------

async function loadReaders() {
  readersCache = await api('/api/readers');
  renderReaders();
}

function renderReaders() {
  const q = $('#readerSearch').value.toLowerCase();
  const list = readersCache.filter((r) => (r.name + ' ' + r.username).toLowerCase().includes(q));
  $('#readers').innerHTML = list.map((r) => `
    <tr class="${r.overdue ? 'overdue' : ''}">
      <td><a href="#" data-act="reader" data-id="${r.id}" class="title">${esc(r.name)}</a></td>
      <td class="muted">@${esc(r.username)}</td>
      <td>${r.active_loans}</td>
      <td>${r.overdue ? `<span class="late">${r.overdue}</span>` : '0'}</td>
      <td>${r.unpaid_fines ? `<span class="late">${money(r.unpaid_fines)}</span>` : '—'}</td>
      <td>${r.total_loans}</td>
    </tr>`).join('') || '<tr><td colspan="6" class="empty">Читателей не найдено</td></tr>';
}

async function openReader(id) {
  const [loans, readers] = await Promise.all([api(`/api/readers/${id}/loans`), api('/api/readers')]);
  const r = readers.find((x) => x.id === id);
  $('#infoBody').innerHTML = `
    <h2>${esc(r.name)} <small class="muted">@${esc(r.username)}</small></h2>
    <p>На руках: <b>${r.active_loans}</b> · Просрочено: <b>${r.overdue}</b> ·
       Неоплаченные штрафы: <b>${money(r.unpaid_fines)}</b> · Всего выдач: <b>${r.total_loans}</b></p>
    ${loans.length ? loansTable(loans) : '<p class="muted">Этот читатель ещё не брал книг</p>'}`;
  if (!$('#infoDialog').open) $('#infoDialog').showModal();
}

$('#readerForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    const user = await api('/api/readers', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(e.target))) });
    $('#readerDialog').close();
    toast(`Читатель ${user.name} создан`);
    loadReaders();
  } catch (err) {
    $('#readerError').textContent = err.message;
  }
});

// ---------- Отчёты (библиотекарь) ----------

function bars(items, label) {
  if (!items.length) return '<p class="muted">Нет данных</p>';
  const max = Math.max(...items.map((i) => i.n));
  return items.map((i) => `
    <div class="bar-row">
      <span class="bar-label">${label(i)}</span>
      <span class="bar"><span style="width:${(i.n / max) * 100}%"></span></span>
      <b>${i.n}</b>
    </div>`).join('');
}

async function loadReports() {
  const r = await api('/api/reports');
  const t = r.totals;
  $('#reportTotals').innerHTML = [
    ['Всего выдач', t.loans], ['На руках', t.active], ['Просрочено', t.overdue],
    ['Штрафы к оплате', money(t.fines_unpaid)], ['Штрафов оплачено', money(t.fines_paid)],
  ].map(([k, v]) => `<div class="tile"><span>${k}</span><b>${v}</b></div>`).join('');
  $('#repBooks').innerHTML = bars(r.topBooks, (i) => `${esc(i.title)} <small class="muted">${esc(i.author)}</small>`);
  $('#repReaders').innerHTML = bars(r.topReaders, (i) => esc(i.name));
  $('#repGenres').innerHTML = bars(r.genres, (i) => esc(i.genre));
  $('#repMonths').innerHTML = bars(r.byMonth, (i) =>
    new Date(i.month + '-01').toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' }));
}

// ---------- Вкладки и обновление ----------

const tabLoaders = { catalog: null, my: loadMy, loans: loadLoans, readers: loadReaders, reports: loadReports };

function showTab(name) {
  tab = name;
  for (const key of Object.keys(tabLoaders)) $('#view-' + key).hidden = key !== name;
  $$('#tabs button').forEach((b) => b.classList.toggle('active', b.dataset.tab === name));
  tabLoaders[name]?.();
}

// Перерисовать всё, что сейчас на экране
function refreshAll() {
  const jobs = [loadBooks(), loadGenres(), loadStats(), tabLoaders[tab]?.()];
  if ($('#bookDialog').open) jobs.push(renderBook());
  return Promise.all(jobs).catch((err) => toast(err.message, true));
}

$('#tabs').addEventListener('click', (e) => {
  if (e.target.dataset.tab) showTab(e.target.dataset.tab);
});

// ---------- Окно книги: добавление и редактирование ----------

async function openForm(id = null) {
  const form = $('#form');
  editingId = id;
  form.reset();
  $('#formError').textContent = '';
  $('#formTitle').textContent = id ? 'Редактировать книгу' : 'Новая книга';
  if (id) {
    const b = await api('/api/books/' + id);
    for (const key of ['title', 'author', 'year', 'genre', 'cover_url', 'description']) {
      form.elements[key].value = b[key] ?? '';
    }
  }
  showCoverPreview();
  $('#formDialog').showModal();
}

// Предпросмотр обложки в форме книги
function showCoverPreview() {
  const url = $('#form').elements.cover_url.value.trim();
  $('#coverPreview').hidden = !url;
  if (url) $('#coverPreview').src = url;
}
$('#form').elements.cover_url.addEventListener('input', showCoverPreview);

// Выбрали файл — сразу загружаем его на сервер и подставляем ссылку
$('#coverFile').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const { url } = await api('/api/covers', { method: 'POST', body: JSON.stringify({ data: reader.result }) });
      $('#form').elements.cover_url.value = url;
      showCoverPreview();
      $('#formError').textContent = '';
    } catch (err) {
      $('#formError').textContent = err.message;
    }
  };
  reader.readAsDataURL(file);
});

$('#form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const body = JSON.stringify(Object.fromEntries(new FormData(e.target)));
  try {
    if (editingId) await api('/api/books/' + editingId, { method: 'PUT', body });
    else await api('/api/books', { method: 'POST', body });
    $('#formDialog').close();
    toast(editingId ? 'Книга сохранена' : 'Книга добавлена');
    refreshAll();
  } catch (err) {
    $('#formError').textContent = err.message;
  }
});

// ---------- Окно выдачи ----------

async function openIssue(id) {
  issuingId = id;
  const [book, readers] = await Promise.all([api('/api/books/' + id), api('/api/readers')]);
  const firstInQueue = book.queue_list[0]?.user_id;
  const f = $('#issueForm');
  f.reset();
  $('#issueError').textContent = readers.length ? '' : 'Нет зарегистрированных читателей';
  $('#issueBook').textContent = `«${book.title}» — ${book.author}`;
  f.userId.innerHTML = readers.map((r) => {
    const notes = [];
    if (r.id === firstInQueue) notes.push('первый в очереди');
    if (r.overdue) notes.push(`просрочек: ${r.overdue}`);
    if (r.unpaid_fines) notes.push(`штраф ${money(r.unpaid_fines)}`);
    return `<option value="${r.id}" ${r.id === firstInQueue ? 'selected' : ''}>
      ${esc(r.name)} (@${esc(r.username)})${notes.length ? ' — ' + notes.join(', ') : ''}</option>`;
  }).join('');
  $('#issueDialog').showModal();
}

$('#issueForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.target;
  try {
    await api(`/api/books/${issuingId}/issue`, {
      method: 'POST',
      body: JSON.stringify({ userId: Number(f.userId.value), days: Number(f.days.value) }),
    });
    $('#issueDialog').close();
    toast('Книга выдана');
    refreshAll();
  } catch (err) {
    $('#issueError').textContent = err.message;
  }
});

// ---------- Все кнопки с data-act обрабатываются здесь ----------

const actions = {
  login: () => openAuth(),
  async logout() {
    await api('/api/logout', { method: 'POST' });
    me = null;
    $$('dialog[open]').forEach((d) => d.close());
    renderUser();
    refreshAll();
  },
  password() {
    $('#passwordForm').reset();
    $('#passwordError').textContent = '';
    $('#passwordDialog').showModal();
  },
  open: (id) => openBook(id),
  edit: (id) => openForm(id),
  issue: (id) => openIssue(id),
  reader: (id) => openReader(id),
  async delete(id) {
    if (!confirm('Удалить книгу?')) return;
    await api('/api/books/' + id, { method: 'DELETE' });
    $('#bookDialog').close();
    toast('Книга удалена');
    refreshAll();
  },
  async return(id) {
    if (!confirm('Оформить возврат книги?')) return;
    const res = await api(`/api/books/${id}/return`, { method: 'POST' });
    toast(res.next ? `Возврат оформлен. Книга отложена для: ${res.next.name}` : 'Возврат оформлен');
    refreshAll();
  },
  async extend(id) {
    const loan = await api(`/api/loans/${id}/extend`, { method: 'POST' });
    toast(`Срок продлён до ${fmtDate(loan.due_at)}`);
    refreshAll();
  },
  async pay(id) {
    if (!confirm('Отметить штраф как оплаченный?')) return;
    await api(`/api/loans/${id}/pay`, { method: 'POST' });
    toast('Штраф отмечен оплаченным');
    refreshAll();
    if ($('#infoDialog').open) $('#infoDialog').close();
  },
  async reserve(id) {
    if (!me) {
      toast('Войдите, чтобы забронировать книгу');
      openAuth();
      return;
    }
    const res = await api(`/api/books/${id}/reserve`, { method: 'POST' });
    toast(res.ready
      ? `Книга отложена для вас до ${fmtDate(res.hold_until)} — заберите её в библиотеке`
      : `Вы в очереди под номером ${res.position}. Когда книга освободится, её отложат для вас`);
    refreshAll();
  },
  async removeRes(id) {
    if (!confirm('Снять бронь читателя?')) return;
    await api('/api/reservations/' + id, { method: 'DELETE' });
    toast('Бронь снята');
    refreshAll();
  },
  async unreserve(id) {
    await api(`/api/books/${id}/reserve`, { method: 'DELETE' });
    toast('Бронь отменена');
    refreshAll();
  },
  async delReview(id) {
    if (!confirm('Удалить отзыв?')) return;
    await api('/api/reviews/' + id, { method: 'DELETE' });
    refreshAll();
  },
};

document.addEventListener('click', async (e) => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  e.preventDefault();
  try {
    await actions[el.dataset.act](Number(el.dataset.id));
  } catch (err) {
    toast(err.message, true);
  }
});

// Кнопки «Отмена» и «✕» во всех окнах
$$('[data-close]').forEach((b) => b.addEventListener('click', () => b.closest('dialog').close()));

$('#addBtn').addEventListener('click', () => openForm());
$('#addReaderBtn').addEventListener('click', () => {
  $('#readerForm').reset();
  $('#readerError').textContent = '';
  $('#readerDialog').showModal();
});
$('#genreFilter').addEventListener('change', loadBooks);
$('#sort').addEventListener('change', loadBooks);
$('#availableOnly').addEventListener('change', loadBooks);
$('#loansFilter').addEventListener('change', loadLoans);
$('#readerSearch').addEventListener('input', renderReaders);

let timer;
$('#search').addEventListener('input', () => {
  clearTimeout(timer);
  timer = setTimeout(loadBooks, 250); // небольшая задержка, чтобы не слать запрос на каждую букву
});

// Старт: узнаём настройки и кто вошёл, затем загружаем данные
Promise.all([api('/api/config'), api('/api/me')]).then(([cfg, user]) => {
  config = cfg;
  me = user;
  renderUser();
  refreshAll();
});
