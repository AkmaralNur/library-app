// Бэкенд: REST API на Express + раздача собранного React-фронтенда из папки dist
const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const COOKIE = 'session';

// Обложки загружаются отдельным маршрутом с большим лимитом — его пропускаем здесь
const jsonBody = express.json();
app.use((req, res, next) => (req.path === '/api/covers' ? next() : jsonBody(req, res, next)));
app.use('/covers', express.static(path.join(__dirname, 'public', 'covers')));
app.use(express.static(path.join(__dirname, 'dist')));
// Сюда запрос дойдёт, только если фронтенд ещё не собран (иначе ответит dist/index.html)
app.get('/', (req, res) => {
  res.status(503).type('text').send(
    'Фронтенд не собран. Для разработки: npm run dev и откройте http://localhost:5173. Для запуска: npm start.');
});

// ---------- Авторизация ----------

// Достаём токен сессии из cookie и кладём пользователя в req.user
function readToken(req) {
  for (const part of (req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === COOKIE) return part.slice(i + 1).trim();
  }
  return null;
}

app.use((req, res, next) => {
  const token = readToken(req);
  req.user = token ? db.getSessionUser(token) : null;
  if (req.path.startsWith('/api/')) db.refreshHolds(); // снять просроченные брони, отложить книги следующим
  next();
});

function setSessionCookie(res, token) {
  res.setHeader('Set-Cookie',
    `${COOKIE}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${60 * 60 * 24 * 30}`);
}

// Пропускает только вошедших пользователей (и, если указано, с нужной ролью)
function requireUser(role = null) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Нужно войти в систему' });
    if (role && req.user.role !== role) return res.status(403).json({ error: 'Недостаточно прав' });
    next();
  };
}
const librarianOnly = requireUser('librarian');
const readerOnly = requireUser('reader');

// Проверка данных нового пользователя. Возвращает текст ошибки или null.
function validateNewUser({ username, name, password }) {
  if (!/^[a-zA-Z0-9_.-]{3,30}$/.test(username)) return 'Логин: 3–30 латинских букв, цифр или _ . -';
  if (!name) return 'Укажите имя';
  if (password.length < 6) return 'Пароль — минимум 6 символов';
  if (db.findUserByUsername(username)) return 'Такой логин уже занят';
  return null;
}

const userFields = (body) => ({
  username: String(body.username || '').trim(),
  name: String(body.name || '').trim(),
  password: String(body.password || ''),
});

// POST /api/register — регистрация читателя
app.post('/api/register', (req, res) => {
  const fields = userFields(req.body);
  const error = validateNewUser(fields);
  if (error) return res.status(400).json({ error });
  const user = db.createUser({ ...fields, role: 'reader' });
  setSessionCookie(res, db.createSession(user.id));
  res.status(201).json(user);
});

// POST /api/login — вход
app.post('/api/login', (req, res) => {
  const user = db.authenticate(String(req.body.username || '').trim(), String(req.body.password || ''));
  if (!user) return res.status(401).json({ error: 'Неверный логин или пароль' });
  setSessionCookie(res, db.createSession(user.id));
  res.json(user);
});

// POST /api/logout — выход
app.post('/api/logout', (req, res) => {
  const token = readToken(req);
  if (token) db.deleteSession(token);
  res.setHeader('Set-Cookie', `${COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`);
  res.status(204).end();
});

// GET /api/me — кто сейчас вошёл (null, если никто)
app.get('/api/me', (req, res) => res.json(req.user));

// POST /api/password  { oldPassword, newPassword } — сменить свой пароль
app.post('/api/password', requireUser(), (req, res) => {
  const newPassword = String(req.body.newPassword || '');
  if (newPassword.length < 6) return res.status(400).json({ error: 'Новый пароль — минимум 6 символов' });
  if (!db.changePassword(req.user.id, String(req.body.oldPassword || ''), newPassword))
    return res.status(400).json({ error: 'Текущий пароль указан неверно' });
  res.status(204).end();
});

// ---------- Книги ----------

// Проверка входных данных книги
function validate(body, partial = false) {
  const errors = [];
  if (!partial || body.title !== undefined) {
    if (!body.title || !String(body.title).trim()) errors.push('Укажите название');
  }
  if (!partial || body.author !== undefined) {
    if (!body.author || !String(body.author).trim()) errors.push('Укажите автора');
  }
  if (body.year !== undefined && body.year !== null && body.year !== '') {
    const y = Number(body.year);
    if (!Number.isInteger(y) || y < 0 || y > new Date().getFullYear()) errors.push('Некорректный год');
  }
  // Обложка обязательна: загруженный файл (/covers/…) или ссылка http(s)://
  if (!partial || body.cover_url !== undefined) {
    const cover = String(body.cover_url ?? '').trim();
    if (!cover) errors.push('Добавьте обложку');
    else if (!/^(https?:\/\/|\/covers\/)/i.test(cover)) errors.push('Ссылка на обложку должна начинаться с http:// или https://');
  }
  return errors;
}

// POST /api/covers  { data: 'data:image/jpeg;base64,…' } — загрузить фото обложки
const COVER_TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
app.post('/api/covers', express.json({ limit: '8mb' }), (req, res, next) => {
  if (req.user?.role !== 'librarian') return res.status(403).json({ error: 'Недостаточно прав' });
  const match = /^data:(image\/[a-z]+);base64,(.+)$/.exec(String(req.body.data || ''));
  const ext = match && COVER_TYPES[match[1]];
  if (!ext) return res.status(400).json({ error: 'Нужна картинка JPG, PNG или WEBP' });
  const buffer = Buffer.from(match[2], 'base64');
  if (buffer.length > 5 * 1024 * 1024) return res.status(400).json({ error: 'Файл больше 5 МБ' });
  const name = `upload-${crypto.randomBytes(8).toString('hex')}.${ext}`;
  fs.writeFile(path.join(__dirname, 'public', 'covers', name), buffer, (err) => {
    if (err) return next(err);
    res.status(201).json({ url: `/covers/${name}` });
  });
});

function clean(body) {
  const out = {};
  if (body.title !== undefined) out.title = String(body.title).trim();
  if (body.author !== undefined) out.author = String(body.author).trim();
  if (body.year !== undefined) out.year = body.year === '' || body.year === null ? null : Number(body.year);
  for (const key of ['genre', 'cover_url', 'description']) {
    if (body[key] !== undefined) out[key] = String(body[key] ?? '').trim() || null;
  }
  return out;
}

// Кому выдана или для кого отложена книга, видят только библиотекарь и сам читатель
function present(book, user, myReservations = null) {
  const out = { ...book, available: Boolean(book.available) };
  const isLibrarian = user?.role === 'librarian';
  if (!(isLibrarian || user?.id === book.borrower_id)) {
    delete out.borrower;
    delete out.borrower_id;
  }
  out.held = Boolean(book.held_by_id);
  out.hold_until = book.held_since
    ? new Date(new Date(book.held_since).getTime() + db.HOLD_DAYS * 86400000).toISOString() : null;
  out.held_for_me = Boolean(user && user.id === book.held_by_id);
  if (!(isLibrarian || out.held_for_me)) {
    delete out.held_by;
    delete out.held_by_id;
  }
  delete out.held_since;
  out.mine = Boolean(user && user.id === book.borrower_id);
  if (myReservations) out.reserved_by_me = myReservations.has(book.id);
  return out;
}

// Книги, которые читатель забронировал (для кнопок «Забронировать» / «Отменить бронь»)
const myReservationIds = (user) =>
  user?.role === 'reader' ? new Set(db.listMyReservations(user.id).map((r) => r.book_id)) : null;

// GET /api/books?q=&genre=&available=1&sort=title|author|year|rating|popular
app.get('/api/books', (req, res) => {
  const books = db.listBooks({
    q: req.query.q || '',
    genre: req.query.genre || '',
    availableOnly: req.query.available === '1',
    sort: req.query.sort,
  });
  const mine = myReservationIds(req.user);
  res.json(books.map((b) => present(b, req.user, mine)));
});

// GET /api/books/:id — книга со всеми подробностями: отзывы, очередь, история
app.get('/api/books/:id', (req, res) => {
  const book = db.getBook(Number(req.params.id));
  if (!book) return res.status(404).json({ error: 'Книга не найдена' });
  const out = present(book, req.user, myReservationIds(req.user));
  out.reviews = db.listReviews(book.id);
  const queue = db.listQueue(book.id);
  if (req.user?.role === 'librarian') {
    out.queue_list = queue;
    out.history = db.listLoans({ bookId: book.id }).slice(0, 10);
  } else if (req.user) {
    out.my_position = queue.findIndex((r) => r.user_id === req.user.id) + 1; // 0 — не в очереди
  }
  res.json(out);
});

// POST /api/books — добавить книгу
app.post('/api/books', librarianOnly, (req, res) => {
  const errors = validate(req.body);
  if (errors.length) return res.status(400).json({ error: errors.join(', ') });
  res.status(201).json(present(db.addBook(clean(req.body)), req.user));
});

// PUT /api/books/:id — изменить книгу (можно передать только часть полей)
app.put('/api/books/:id', librarianOnly, (req, res) => {
  const errors = validate(req.body, true);
  if (errors.length) return res.status(400).json({ error: errors.join(', ') });
  const book = db.updateBook(Number(req.params.id), clean(req.body));
  if (!book) return res.status(404).json({ error: 'Книга не найдена' });
  res.json(present(book, req.user));
});

// DELETE /api/books/:id — удалить книгу
app.delete('/api/books/:id', librarianOnly, (req, res) => {
  const book = db.getBook(Number(req.params.id));
  if (!book) return res.status(404).json({ error: 'Книга не найдена' });
  if (!book.available) return res.status(400).json({ error: 'Книга выдана — сначала оформите возврат' });
  db.deleteBook(book.id);
  res.status(204).end();
});

// ---------- Выдачи ----------

// POST /api/books/:id/issue  { userId, days } — выдать книгу читателю
app.post('/api/books/:id/issue', librarianOnly, (req, res) => {
  const days = req.body.days === undefined ? 14 : Number(req.body.days);
  if (!Number.isInteger(days) || days < 1 || days > 365)
    return res.status(400).json({ error: 'Срок — от 1 до 365 дней' });
  const userId = Number(req.body.userId);
  if (!Number.isInteger(userId)) return res.status(400).json({ error: 'Выберите читателя' });
  const result = db.issueBook(Number(req.params.id), userId, days);
  if (result.error) return res.status(400).json({ error: result.error });
  res.json(present(result.book, req.user));
});

// POST /api/books/:id/return — оформить возврат
app.post('/api/books/:id/return', librarianOnly, (req, res) => {
  const result = db.returnBook(Number(req.params.id));
  if (!result) return res.status(400).json({ error: 'Эта книга сейчас не выдана' });
  res.json({ book: present(result.book, req.user), next: result.next });
});

// GET /api/loans?active=1 — выдачи: библиотекарь видит все, читатель — свои
app.get('/api/loans', requireUser(), (req, res) => {
  const userId = req.user.role === 'librarian' ? null : req.user.id;
  res.json(db.listLoans({ userId, activeOnly: req.query.active === '1' }));
});

// POST /api/loans/:id/extend — продлить выдачу (читатель — свою, библиотекарь — любую)
app.post('/api/loans/:id/extend', requireUser(), (req, res) => {
  const result = db.extendLoan(Number(req.params.id), req.user);
  if (result.error) return res.status(400).json({ error: result.error });
  res.json(result.loan);
});

// POST /api/loans/:id/pay — отметить штраф оплаченным
app.post('/api/loans/:id/pay', librarianOnly, (req, res) => {
  if (!db.payFine(Number(req.params.id))) return res.status(404).json({ error: 'Выдача не найдена' });
  res.status(204).end();
});

// ---------- Бронирование ----------

// POST /api/books/:id/reserve — встать в очередь на книгу
app.post('/api/books/:id/reserve', readerOnly, (req, res) => {
  const result = db.reserveBook(Number(req.params.id), req.user);
  if (result.error) return res.status(400).json({ error: result.error });
  res.status(201).json(result);
});

// DELETE /api/books/:id/reserve — отменить свою бронь
app.delete('/api/books/:id/reserve', readerOnly, (req, res) => {
  if (!db.cancelReservation(Number(req.params.id), req.user.id))
    return res.status(404).json({ error: 'Брони нет' });
  res.status(204).end();
});

// GET /api/reservations — мои брони
app.get('/api/reservations', readerOnly, (req, res) => res.json(db.listMyReservations(req.user.id)));

// GET /api/holds — книги, отложенные для читателей и ждущие выдачи
app.get('/api/holds', librarianOnly, (req, res) => res.json(db.listHolds()));

// DELETE /api/reservations/:id — библиотекарь снимает бронь (убирает читателя из очереди)
app.delete('/api/reservations/:id', librarianOnly, (req, res) => {
  if (!db.deleteReservation(Number(req.params.id))) return res.status(404).json({ error: 'Брони нет' });
  res.status(204).end();
});

// ---------- Отзывы ----------

// POST /api/books/:id/reviews  { rating, text } — оставить или обновить свой отзыв
app.post('/api/books/:id/reviews', readerOnly, (req, res) => {
  const bookId = Number(req.params.id);
  if (!db.getBook(bookId)) return res.status(404).json({ error: 'Книга не найдена' });
  const rating = Number(req.body.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5)
    return res.status(400).json({ error: 'Поставьте оценку от 1 до 5' });
  const text = String(req.body.text || '').trim().slice(0, 2000);
  db.saveReview(bookId, req.user.id, rating, text);
  res.status(201).json(db.listReviews(bookId));
});

// DELETE /api/reviews/:id — удалить отзыв (свой или любой для библиотекаря)
app.delete('/api/reviews/:id', requireUser(), (req, res) => {
  const result = db.deleteReview(Number(req.params.id), req.user);
  if (result.error) return res.status(400).json({ error: result.error });
  res.status(204).end();
});

// ---------- Читатели и отчёты (для библиотекаря) ----------

// GET /api/readers — читатели со сводкой по долгам
app.get('/api/readers', librarianOnly, (req, res) => res.json(db.listReaders()));

// POST /api/readers  { username, name, password } — завести читателя
app.post('/api/readers', librarianOnly, (req, res) => {
  const fields = userFields(req.body);
  const error = validateNewUser(fields);
  if (error) return res.status(400).json({ error });
  res.status(201).json(db.createUser({ ...fields, role: 'reader' }));
});

// GET /api/readers/:id/loans — история выдач одного читателя
app.get('/api/readers/:id/loans', librarianOnly, (req, res) => {
  res.json(db.listLoans({ userId: Number(req.params.id) }));
});

app.get('/api/reports', librarianOnly, (req, res) => res.json(db.reports()));

// GET /api/export/books.csv — каталог для Excel (разделитель «;», UTF-8 с BOM)
app.get('/api/export/books.csv', librarianOnly, (req, res) => {
  const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = [['Название', 'Автор', 'Год', 'Жанр', 'Статус', 'У кого', 'Вернуть до', 'Рейтинг', 'Выдач всего']];
  for (const b of db.listBooks()) {
    rows.push([b.title, b.author, b.year, b.genre,
      b.available ? 'В наличии' : 'Выдана', b.borrower, b.due_at ? b.due_at.slice(0, 10) : '',
      b.rating, b.times_borrowed]);
  }
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="books.csv"');
  res.send('﻿' + rows.map((r) => r.map(cell).join(';')).join('\r\n'));
});

// Вспомогательные данные для фронтенда
app.get('/api/genres', (req, res) => res.json(db.listGenres()));
app.get('/api/stats', (req, res) => res.json(db.stats()));
app.get('/api/config', (req, res) => res.json({
  finePerDay: db.FINE_PER_DAY, extendDays: db.EXTEND_DAYS, maxExtensions: db.MAX_EXTENSIONS,
  holdDays: db.HOLD_DAYS, maxBooks: db.MAX_BOOKS,
}));

app.listen(PORT, () => {
  console.log(`Библиотека запущена: http://localhost:${PORT}`);
});
