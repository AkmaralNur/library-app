// Работа с базой данных SQLite.
// Используется встроенный модуль node:sqlite — ничего устанавливать не нужно.
// Файл базы library.db создаётся автоматически при первом запуске.

const { DatabaseSync } = require('node:sqlite');
const crypto = require('crypto');
const path = require('path');

const db = new DatabaseSync(path.join(__dirname, 'library.db'));

const FINE_PER_DAY = 20;   // штраф за каждый день просрочки, сом
const EXTEND_DAYS = 7;     // на сколько дней продлевается выдача
const MAX_EXTENSIONS = 2;  // сколько раз можно продлить одну выдачу
const HOLD_DAYS = 3;       // сколько дней забронированная книга ждёт читателя в библиотеке
const MAX_BOOKS = 5;       // сколько книг читатель может держать сразу (на руках + брони)
const DAY = 24 * 60 * 60 * 1000;

// Создаём таблицы, если их ещё нет
db.exec(`
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS authors (
    id   INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
  );

  CREATE TABLE IF NOT EXISTS books (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    title     TEXT    NOT NULL,
    author_id INTEGER NOT NULL REFERENCES authors(id),
    year      INTEGER,
    genre     TEXT,
    available INTEGER NOT NULL DEFAULT 1   -- устарело: статус теперь считается по таблице loans
  );

  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT NOT NULL UNIQUE,
    name          TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    role          TEXT NOT NULL DEFAULT 'reader'   -- 'librarian' или 'reader'
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token      TEXT PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL
  );

  -- Выдачи книг: кому, когда, до какого числа и когда вернули
  CREATE TABLE IF NOT EXISTS loans (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    book_id     INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    user_id     INTEGER NOT NULL REFERENCES users(id),
    issued_at   TEXT NOT NULL,
    due_at      TEXT NOT NULL,
    returned_at TEXT                                 -- NULL = книга ещё на руках
  );

  -- Очередь на книги, которые сейчас выданы
  CREATE TABLE IF NOT EXISTS reservations (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    book_id    INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL,
    UNIQUE (book_id, user_id)
  );

  -- Отзывы: один отзыв от читателя на книгу
  CREATE TABLE IF NOT EXISTS reviews (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    book_id    INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rating     INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    text       TEXT,
    created_at TEXT NOT NULL,
    UNIQUE (book_id, user_id)
  );
`);

// Добавляем новые столбцы в базы, созданные старой версией приложения
function addColumn(table, column, definition) {
  const exists = db.prepare(`PRAGMA table_info(${table})`).all().some((c) => c.name === column);
  if (!exists) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}
addColumn('books', 'cover_url', 'TEXT');
addColumn('books', 'description', 'TEXT');
addColumn('loans', 'extensions', 'INTEGER NOT NULL DEFAULT 0');
addColumn('loans', 'fine_paid', 'INTEGER NOT NULL DEFAULT 0');
addColumn('reservations', 'ready_at', 'TEXT'); // когда книга отложена для читателя; NULL — ждёт в очереди

const now = () => new Date().toISOString();

// ---------- Пароли ----------

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function checkPassword(password, stored) {
  const [salt, hash] = stored.split(':');
  const actual = crypto.scryptSync(password, salt, 64);
  return crypto.timingSafeEqual(actual, Buffer.from(hash, 'hex'));
}

// ---------- Авторы ----------

// Найти автора по имени или создать нового. Возвращает id автора.
function getOrCreateAuthor(name) {
  const found = db.prepare('SELECT id FROM authors WHERE name = ?').get(name);
  if (found) return found.id;
  return Number(db.prepare('INSERT INTO authors (name) VALUES (?)').run(name).lastInsertRowid);
}

function removeOrphanAuthors() {
  db.prepare('DELETE FROM authors WHERE id NOT IN (SELECT author_id FROM books)').run();
}

// ---------- Книги ----------

// Общая часть запроса: книга + автор + текущая выдача + рейтинг и счётчики
const BOOK_SELECT = `
  SELECT b.id, b.title, a.name AS author, b.year, b.genre, b.cover_url, b.description,
         l.id IS NULL AS available,
         l.id AS loan_id, l.due_at, l.user_id AS borrower_id, u.name AS borrower,
         (SELECT ROUND(AVG(rating), 1) FROM reviews r WHERE r.book_id = b.id) AS rating,
         (SELECT COUNT(*) FROM reviews r WHERE r.book_id = b.id) AS reviews_count,
         (SELECT COUNT(*) FROM reservations s WHERE s.book_id = b.id) AS queue,
         (SELECT COUNT(*) FROM loans x WHERE x.book_id = b.id) AS times_borrowed,
         h.user_id AS held_by_id, hu.name AS held_by, h.ready_at AS held_since
  FROM books b
  JOIN authors a ON a.id = b.author_id
  LEFT JOIN loans l ON l.book_id = b.id AND l.returned_at IS NULL
  LEFT JOIN users u ON u.id = l.user_id
  LEFT JOIN reservations h ON h.book_id = b.id AND h.ready_at IS NOT NULL
  LEFT JOIN users hu ON hu.id = h.user_id
`;

// Допустимые варианты сортировки каталога
const SORTS = {
  title: 'b.title',
  author: 'a.name, b.title',
  year: 'b.year DESC NULLS LAST, b.title',
  rating: 'rating DESC NULLS LAST, b.title',
  popular: 'times_borrowed DESC, b.title',
};

// Список книг с поиском (название, автор), фильтрами и сортировкой
function listBooks({ q = '', genre = '', availableOnly = false, sort = 'title' } = {}) {
  return db.prepare(`
    ${BOOK_SELECT}
    WHERE (b.title LIKE ? OR a.name LIKE ?)
      AND (? = '' OR b.genre = ?)
      AND (? = 0 OR (l.id IS NULL AND h.id IS NULL))
    ORDER BY ${SORTS[sort] || SORTS.title}
  `).all(`%${q}%`, `%${q}%`, genre, genre, availableOnly ? 1 : 0);
}

function getBook(id) {
  return db.prepare(`${BOOK_SELECT} WHERE b.id = ?`).get(id);
}

function addBook({ title, author, year, genre, cover_url, description }) {
  const authorId = getOrCreateAuthor(author);
  const info = db.prepare(`
    INSERT INTO books (title, author_id, year, genre, cover_url, description)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(title, authorId, year ?? null, genre ?? null, cover_url ?? null, description ?? null);
  return getBook(Number(info.lastInsertRowid));
}

function updateBook(id, fields) {
  const current = getBook(id);
  if (!current) return null;
  const pick = (key) => (fields[key] !== undefined ? fields[key] : current[key]);
  db.prepare(`
    UPDATE books SET title = ?, author_id = ?, year = ?, genre = ?, cover_url = ?, description = ?
    WHERE id = ?
  `).run(
    pick('title'),
    getOrCreateAuthor(pick('author')),
    pick('year'), pick('genre'), pick('cover_url'), pick('description'),
    id
  );
  removeOrphanAuthors(); // у книги мог смениться автор
  return getBook(id);
}

function deleteBook(id) {
  const deleted = db.prepare('DELETE FROM books WHERE id = ?').run(id).changes > 0;
  if (deleted) removeOrphanAuthors();
  return deleted;
}

function listGenres() {
  return db.prepare(
    "SELECT DISTINCT genre FROM books WHERE genre IS NOT NULL AND genre <> '' ORDER BY genre"
  ).all().map(r => r.genre);
}

function stats() {
  return db.prepare(`
    SELECT (SELECT COUNT(*) FROM books) AS total,
           (SELECT COUNT(*) FROM books) -
             (SELECT COUNT(*) FROM loans WHERE returned_at IS NULL) AS available,
           (SELECT COUNT(*) FROM authors) AS authors,
           (SELECT COUNT(*) FROM users WHERE role = 'reader') AS readers,
           (SELECT COUNT(*) FROM loans
              WHERE returned_at IS NULL AND due_at < ?) AS overdue
  `).get(now());
}

// ---------- Пользователи и сессии ----------

function createUser({ username, name, password, role = 'reader' }) {
  const info = db.prepare(
    'INSERT INTO users (username, name, password_hash, role) VALUES (?, ?, ?, ?)'
  ).run(username, name, hashPassword(password), role);
  return getUser(Number(info.lastInsertRowid));
}

function getUser(id) {
  return db.prepare('SELECT id, username, name, role FROM users WHERE id = ?').get(id);
}

function findUserByUsername(username) {
  return db.prepare('SELECT id FROM users WHERE username = ?').get(username);
}

// Проверить логин и пароль. Возвращает пользователя или null.
function authenticate(username, password) {
  const row = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!row || !checkPassword(password, row.password_hash)) return null;
  return getUser(row.id);
}

function changePassword(userId, oldPassword, newPassword) {
  const row = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(userId);
  if (!row || !checkPassword(oldPassword, row.password_hash)) return false;
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(newPassword), userId);
  return true;
}

// Читатели со сводкой: сколько книг на руках, просрочек и неоплаченных штрафов
function listReaders() {
  const readers = db.prepare(`
    SELECT u.id, u.username, u.name,
           (SELECT COUNT(*) FROM loans l WHERE l.user_id = u.id) AS total_loans,
           (SELECT COUNT(*) FROM loans l WHERE l.user_id = u.id AND l.returned_at IS NULL) AS active_loans,
           (SELECT COUNT(*) FROM loans l WHERE l.user_id = u.id AND l.returned_at IS NULL AND l.due_at < ?) AS overdue
    FROM users u WHERE u.role = 'reader' ORDER BY u.name
  `).all(now());
  for (const r of readers) {
    r.unpaid_fines = listLoans({ userId: r.id }).reduce((sum, l) => sum + (l.fine_paid ? 0 : l.fine), 0);
  }
  return readers;
}

function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  db.prepare('INSERT INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)')
    .run(token, userId, now());
  return token;
}

function getSessionUser(token) {
  const row = db.prepare('SELECT user_id FROM sessions WHERE token = ?').get(token);
  return row ? getUser(row.user_id) : null;
}

function deleteSession(token) {
  db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
}

// ---------- Выдачи ----------

// Штраф: FINE_PER_DAY за каждый полный день просрочки (до возврата или до сегодня)
function fineFor(loan) {
  const end = loan.returned_at ? new Date(loan.returned_at) : new Date();
  const daysLate = Math.floor((end - new Date(loan.due_at)) / DAY);
  return daysLate > 0 ? daysLate * FINE_PER_DAY : 0;
}

function getLoan(id) {
  return db.prepare('SELECT * FROM loans WHERE id = ?').get(id);
}

// Выдать книгу читателю на days дней. Возвращает { error } или { book }.
function issueBook(bookId, userId, days) {
  const book = getBook(bookId);
  if (!book) return { error: 'Книга не найдена' };
  if (!book.available) return { error: 'Книга уже выдана' };
  const user = getUser(userId);
  if (!user || user.role !== 'reader') return { error: 'Читатель не найден' };
  if (book.held_by_id && book.held_by_id !== userId)
    return { error: `Книга отложена для читателя ${book.held_by} — выдать можно только ему` };

  const issued = new Date();
  const due = new Date(issued.getTime() + days * DAY);
  db.prepare('INSERT INTO loans (book_id, user_id, issued_at, due_at) VALUES (?, ?, ?, ?)')
    .run(bookId, userId, issued.toISOString(), due.toISOString());
  // Если читатель стоял в очереди на эту книгу — бронь выполнена
  db.prepare('DELETE FROM reservations WHERE book_id = ? AND user_id = ?').run(bookId, userId);
  return { book: getBook(bookId) };
}

// Вернуть книгу. Возвращает книгу и того, кто следующий в очереди (если есть).
function returnBook(bookId) {
  const changes = db.prepare(
    'UPDATE loans SET returned_at = ? WHERE book_id = ? AND returned_at IS NULL'
  ).run(now(), bookId).changes;
  if (!changes) return null;
  refreshHolds(); // книга сразу откладывается для первого в очереди
  return { book: getBook(bookId), next: listQueue(bookId)[0] || null };
}

// Продлить выдачу на EXTEND_DAYS дней
function extendLoan(loanId, user) {
  const loan = getLoan(loanId);
  if (!loan || loan.returned_at) return { error: 'Выдача не найдена' };
  if (user.role !== 'librarian' && loan.user_id !== user.id) return { error: 'Это не ваша выдача' };
  if (loan.extensions >= MAX_EXTENSIONS) return { error: `Продлить можно не больше ${MAX_EXTENSIONS} раз` };
  if (new Date(loan.due_at) < new Date()) return { error: 'Выдача просрочена — продление невозможно' };
  const queue = db.prepare('SELECT COUNT(*) AS n FROM reservations WHERE book_id = ?').get(loan.book_id).n;
  if (queue > 0) return { error: 'На книгу есть очередь — продление невозможно' };

  const due = new Date(new Date(loan.due_at).getTime() + EXTEND_DAYS * DAY);
  db.prepare('UPDATE loans SET due_at = ?, extensions = extensions + 1 WHERE id = ?')
    .run(due.toISOString(), loanId);
  return { loan: getLoan(loanId) };
}

function payFine(loanId) {
  return db.prepare('UPDATE loans SET fine_paid = 1 WHERE id = ?').run(loanId).changes > 0;
}

// История выдач: все или одного читателя / одной книги
function listLoans({ userId = null, bookId = null, activeOnly = false } = {}) {
  const loans = db.prepare(`
    SELECT l.id, l.book_id, b.title, a.name AS author,
           l.user_id, u.name AS borrower, u.username,
           l.issued_at, l.due_at, l.returned_at, l.extensions, l.fine_paid,
           (l.returned_at IS NULL AND l.due_at < ?) AS overdue,
           (SELECT COUNT(*) FROM reservations s WHERE s.book_id = l.book_id) AS queue
    FROM loans l
    JOIN books b   ON b.id = l.book_id
    JOIN authors a ON a.id = b.author_id
    JOIN users u   ON u.id = l.user_id
    WHERE (? IS NULL OR l.user_id = ?)
      AND (? IS NULL OR l.book_id = ?)
      AND (? = 0 OR l.returned_at IS NULL)
    ORDER BY l.returned_at IS NOT NULL, l.due_at, l.returned_at DESC
  `).all(now(), userId, userId, bookId, bookId, activeOnly ? 1 : 0);
  return loans.map((l) => ({
    ...l,
    overdue: Boolean(l.overdue),
    fine_paid: Boolean(l.fine_paid),
    fine: fineFor(l),
    can_extend: !l.returned_at && !l.overdue && l.extensions < MAX_EXTENSIONS && l.queue === 0,
  }));
}

// ---------- Бронирование ----------

// Бронь работает так: первый в очереди на книгу, которая есть в наличии, получает её
// «отложенной» на HOLD_DAYS дней (ready_at). Не забрал вовремя — бронь снимается,
// и книга откладывается для следующего. Вызывается перед каждым запросом к API.
function refreshHolds() {
  const expired = new Date(Date.now() - HOLD_DAYS * DAY).toISOString();
  db.prepare('DELETE FROM reservations WHERE ready_at IS NOT NULL AND ready_at < ?').run(expired);
  db.prepare(`
    UPDATE reservations SET ready_at = ?
    WHERE ready_at IS NULL
      AND id IN (SELECT MIN(id) FROM reservations GROUP BY book_id)
      AND NOT EXISTS (SELECT 1 FROM loans l WHERE l.book_id = reservations.book_id AND l.returned_at IS NULL)
  `).run(now());
}

const holdUntil = (readyAt) => new Date(new Date(readyAt).getTime() + HOLD_DAYS * DAY).toISOString();

function listQueue(bookId) {
  return db.prepare(`
    SELECT s.id, s.user_id, u.name, u.username, s.created_at, s.ready_at
    FROM reservations s JOIN users u ON u.id = s.user_id
    WHERE s.book_id = ? ORDER BY s.id
  `).all(bookId);
}

// Забронировать книгу. Свободная — откладывается сразу, выданная — встаём в очередь.
function reserveBook(bookId, user) {
  const book = getBook(bookId);
  if (!book) return { error: 'Книга не найдена' };
  if (book.borrower_id === user.id) return { error: 'Эта книга и так у вас' };
  if (listQueue(bookId).some((r) => r.user_id === user.id)) return { error: 'Вы уже забронировали эту книгу' };

  const loans = listLoans({ userId: user.id, activeOnly: true });
  if (loans.some((l) => l.overdue)) return { error: 'У вас есть просроченные книги — сначала верните их' };
  const reserved = db.prepare('SELECT COUNT(*) AS n FROM reservations WHERE user_id = ?').get(user.id).n;
  if (loans.length + reserved >= MAX_BOOKS)
    return { error: `Можно держать не больше ${MAX_BOOKS} книг одновременно (на руках и в брони)` };

  db.prepare('INSERT INTO reservations (book_id, user_id, created_at) VALUES (?, ?, ?)')
    .run(bookId, user.id, now());
  refreshHolds();
  const queue = listQueue(bookId);
  const mine = queue.find((r) => r.user_id === user.id);
  return {
    position: queue.indexOf(mine) + 1,
    ready: Boolean(mine.ready_at),
    hold_until: mine.ready_at ? holdUntil(mine.ready_at) : null,
  };
}

// Удалить бронь по id (библиотекарь убирает читателя из очереди)
function deleteReservation(id) {
  const changes = db.prepare('DELETE FROM reservations WHERE id = ?').run(id).changes;
  refreshHolds();
  return changes > 0;
}

// Книги, отложенные для читателей и ждущие выдачи (для библиотекаря)
function listHolds() {
  return db.prepare(`
    SELECT s.id, s.book_id, b.title, a.name AS author, b.cover_url,
           s.user_id, u.name AS reader, u.username, s.ready_at
    FROM reservations s
    JOIN books b ON b.id = s.book_id
    JOIN authors a ON a.id = b.author_id
    JOIN users u ON u.id = s.user_id
    WHERE s.ready_at IS NOT NULL ORDER BY s.ready_at
  `).all().map((h) => ({ ...h, hold_until: holdUntil(h.ready_at) }));
}

function cancelReservation(bookId, userId) {
  const changes = db.prepare('DELETE FROM reservations WHERE book_id = ? AND user_id = ?')
    .run(bookId, userId).changes;
  refreshHolds(); // книга переходит следующему в очереди
  return changes > 0;
}

// Брони читателя с его местом в очереди
function listMyReservations(userId) {
  return db.prepare(`
    SELECT s.book_id, b.title, a.name AS author, b.cover_url, s.created_at, s.ready_at,
           (SELECT COUNT(*) FROM reservations x WHERE x.book_id = s.book_id AND x.id <= s.id) AS position
    FROM reservations s
    JOIN books b ON b.id = s.book_id
    JOIN authors a ON a.id = b.author_id
    WHERE s.user_id = ? ORDER BY s.id
  `).all(userId).map((r) => ({ ...r, hold_until: r.ready_at ? holdUntil(r.ready_at) : null }));
}

// ---------- Отзывы ----------

function listReviews(bookId) {
  return db.prepare(`
    SELECT r.id, r.user_id, u.name, r.rating, r.text, r.created_at
    FROM reviews r JOIN users u ON u.id = r.user_id
    WHERE r.book_id = ? ORDER BY r.created_at DESC
  `).all(bookId);
}

// Добавить отзыв или обновить свой прежний
function saveReview(bookId, userId, rating, text) {
  db.prepare(`
    INSERT INTO reviews (book_id, user_id, rating, text, created_at) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT (book_id, user_id) DO UPDATE SET rating = excluded.rating, text = excluded.text,
                                               created_at = excluded.created_at
  `).run(bookId, userId, rating, text || null, now());
}

function deleteReview(id, user) {
  const review = db.prepare('SELECT user_id FROM reviews WHERE id = ?').get(id);
  if (!review) return { error: 'Отзыв не найден' };
  if (user.role !== 'librarian' && review.user_id !== user.id) return { error: 'Это не ваш отзыв' };
  db.prepare('DELETE FROM reviews WHERE id = ?').run(id);
  return {};
}

// ---------- Отчёты ----------

function reports() {
  const allLoans = listLoans();
  return {
    totals: {
      loans: allLoans.length,
      active: allLoans.filter((l) => !l.returned_at).length,
      overdue: allLoans.filter((l) => l.overdue).length,
      fines_unpaid: allLoans.reduce((s, l) => s + (l.fine_paid ? 0 : l.fine), 0),
      fines_paid: allLoans.reduce((s, l) => s + (l.fine_paid ? l.fine : 0), 0),
    },
    topBooks: db.prepare(`
      SELECT b.title, a.name AS author, COUNT(l.id) AS n
      FROM loans l JOIN books b ON b.id = l.book_id JOIN authors a ON a.id = b.author_id
      GROUP BY b.id ORDER BY n DESC, b.title LIMIT 5
    `).all(),
    topReaders: db.prepare(`
      SELECT u.name, u.username, COUNT(l.id) AS n
      FROM loans l JOIN users u ON u.id = l.user_id
      GROUP BY u.id ORDER BY n DESC, u.name LIMIT 5
    `).all(),
    genres: db.prepare(`
      SELECT COALESCE(NULLIF(genre, ''), 'Без жанра') AS genre, COUNT(*) AS n
      FROM books GROUP BY 1 ORDER BY n DESC
    `).all(),
    byMonth: db.prepare(`
      SELECT substr(issued_at, 1, 7) AS month, COUNT(*) AS n
      FROM loans GROUP BY month ORDER BY month DESC LIMIT 12
    `).all().reverse(),
  };
}

// ---------- Начальные данные ----------

// Заполняем пустую базу: книги, пользователи и полгода демо-активности
if (db.prepare('SELECT COUNT(*) AS n FROM books').get().n === 0) {
  db.exec('BEGIN'); // одна транзакция — иначе каждая вставка отдельно пишется на диск
  const seed = require('./seed');
  for (const b of seed.books) {
    addBook({ ...b, cover_url: `/covers/${b.cover}.jpg` });
  }

  if (db.prepare('SELECT COUNT(*) AS n FROM users').get().n === 0) {
    createUser(seed.librarian);
    for (const r of seed.readers) createUser({ ...r, password: 'reader123', role: 'reader' });
  }

  // Предсказуемый генератор случайных чисел — демо-данные одинаковые при каждом создании базы
  let state = 42;
  const rand = () => (state = (state * 1103515245 + 12345) % 2147483648) / 2147483648;
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];
  const ago = (days) => new Date(Date.now() - days * DAY).toISOString();

  const bookIds = db.prepare('SELECT id FROM books').all().map((b) => b.id);
  const readerIds = db.prepare("SELECT id FROM users WHERE role = 'reader'").all().map((u) => u.id);
  const loan = db.prepare(`
    INSERT INTO loans (book_id, user_id, issued_at, due_at, returned_at, fine_paid)
    VALUES (?, ?, ?, ?, ?, ?)`);
  const freeFrom = new Map(); // книга -> с какого дня «назад» она снова свободна

  // История за полгода: книги выдаются на 14 дней, иногда возвращаются с опозданием
  for (let day = 180; day > 30; day -= 2) {
    for (let k = 0; k < 2; k++) {
      const bookId = pick(bookIds);
      if (freeFrom.has(bookId) && freeFrom.get(bookId) < day) continue; // книга ещё на руках
      const keep = 5 + Math.floor(rand() * 16);                         // 5–20 дней, больше 14 — просрочка
      loan.run(bookId, pick(readerIds), ago(day), ago(day - 14), ago(day - keep),
        keep > 14 && rand() < 0.3 ? 0 : 1); // часть штрафов ещё не оплачена
      freeFrom.set(bookId, day - keep);
    }
  }

  // Книги на руках сейчас: две просроченные, остальные в срок
  const onHand = bookIds.filter((id) => !freeFrom.has(id) || freeFrom.get(id) > 25).slice(0, 10);
  onHand.forEach((bookId, i) => {
    const issued = i < 2 ? 20 + i * 4 : 1 + i;
    loan.run(bookId, readerIds[(i + 2) % readerIds.length], ago(issued), ago(issued - 14), null, 0);
  });

  // Очередь на три выданные книги
  const reserve = db.prepare('INSERT INTO reservations (book_id, user_id, created_at) VALUES (?, ?, ?)');
  onHand.slice(0, 3).forEach((bookId, i) => {
    reserve.run(bookId, readerIds[(i + 5) % readerIds.length], ago(1 + i));
  });

  // Две свободные книги уже отложены для читателей — их ждут в библиотеке
  const free = bookIds.filter((id) => !onHand.includes(id)).slice(-2);
  const hold = db.prepare(
    'INSERT INTO reservations (book_id, user_id, created_at, ready_at) VALUES (?, ?, ?, ?)');
  free.forEach((bookId, i) => hold.run(bookId, readerIds[i + 1], ago(1 + i), ago(1 + i)));

  // Отзывы с разными датами за последние три месяца
  const review = db.prepare(
    'INSERT INTO reviews (book_id, user_id, rating, text, created_at) VALUES (?, ?, ?, ?, ?)');
  for (const b of seed.books) {
    const bookId = db.prepare('SELECT id FROM books WHERE title = ?').get(b.title).id;
    for (const [username, rating, text] of b.reviews) {
      review.run(bookId, findUserByUsername(username).id, rating, text, ago(1 + Math.floor(rand() * 90)));
    }
  }
  db.exec('COMMIT');
}

// Убираем авторов, у которых не осталось книг (например, после старых удалений)
removeOrphanAuthors();

module.exports = {
  FINE_PER_DAY, EXTEND_DAYS, MAX_EXTENSIONS, HOLD_DAYS, MAX_BOOKS,
  listBooks, getBook, addBook, updateBook, deleteBook, listGenres, stats,
  createUser, getUser, findUserByUsername, authenticate, changePassword, listReaders,
  createSession, getSessionUser, deleteSession,
  getLoan, issueBook, returnBook, extendLoan, payFine, listLoans,
  refreshHolds, listQueue, reserveBook, cancelReservation, deleteReservation, listMyReservations, listHolds,
  listReviews, saveReview, deleteReview,
  reports,
};
