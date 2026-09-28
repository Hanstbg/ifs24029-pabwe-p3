/**
 * Praktikum 3 PABWE — Studi Kasus
 * Fitur: Tab switcher, Expense Tracker, Bookmark Manager, Quiz App
 * Semua data disimpan di localStorage dengan key yang berbeda.
 */

/* ========== UTILITAS ========== */

/** Ambil elemen; lempar error jika tidak ada (membantu debug DOM) */
function $(selector) {
  const el = document.querySelector(selector);
  if (!el) throw new Error(`Elemen tidak ditemukan: ${selector}`);
  return el;
}
function $all(selector) {
  return document.querySelectorAll(selector);
}

/** Buat elemen dengan class & teks (textContent = aman dari HTML injection) */
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** Baca / simpan array di localStorage */
function load(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
function save(key, data) {
  localStorage.setItem(key, JSON.stringify(data));
}

/** Format angka ke Rupiah */
const rupiah = (n) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);

/** Buat id unik (tidak butuh crypto.randomUUID) */
const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

/** Isi <select> dari array */
function fillSelect(select, items, firstLabel) {
  select.innerHTML = "";
  if (firstLabel) select.append(new Option(firstLabel, ""));
  items.forEach((v) => select.append(new Option(v, v)));
}

/* ========== MODAL (dipakai semua fitur) ========== */

function openModal(modal) {
  modal.classList.remove("hidden");
  modal.classList.add("flex");
  document.body.classList.add("overflow-hidden");
}
function closeModal(modal) {
  modal.classList.add("hidden");
  modal.classList.remove("flex");
  document.body.classList.remove("overflow-hidden");
}
// Semua elemen [data-close] (tombol Batal & backdrop) menutup modal induknya
$all("[data-close]").forEach((node) => {
  node.addEventListener("click", () => closeModal(node.closest(".modal")));
});
// Escape menutup semua modal
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") $all(".modal").forEach(closeModal);
});

/* ========== TAB SWITCHER ========== */

const TAB_STORAGE_KEY = "pabwe-p3-active-tab";
const tabButtons = $all(".tab-btn");
const panels = {
  expense: $("#panel-expense"),
  bookmark: $("#panel-bookmark"),
  quiz: $("#panel-quiz"),
};

// Nama tab di URL (bahasa Indonesia) <-> id panel di HTML
const TAB_URL = { expense: "dompet", bookmark: "tautan", quiz: "kuis" };
const TAB_FROM_URL = {
  dompet: "expense", tautan: "bookmark", kuis: "quiz",
  expense: "expense", bookmark: "bookmark", quiz: "quiz", // nama lama tetap diterima
};

/** Baca tab dari URL: ?tab=tautan atau #tautan */
function getTabFromUrl() {
  const raw = new URLSearchParams(location.search).get("tab") || location.hash.replace("#", "");
  return TAB_FROM_URL[raw.toLowerCase()] || null;
}

/**
 * Ganti tab aktif: sembunyikan panel lain, highlight tombol, ingat di localStorage.
 * urlMode: "push" (klik tab -> URL baru), "replace" (saat halaman dibuka), "none" (tombol Back/Forward)
 */
function switchTab(name, urlMode = "push") {
  if (!panels[name]) name = "expense";

  Object.entries(panels).forEach(([key, panel]) => {
    panel.classList.toggle("hidden", key !== name);
  });

  tabButtons.forEach((btn) => {
    const active = btn.dataset.tab === name;
    btn.setAttribute("aria-selected", String(active));
    btn.classList.toggle("is-active", active);
  });

  localStorage.setItem(TAB_STORAGE_KEY, name);

  // Tulis tab aktif ke URL, contoh: /?tab=tautan
  const newUrl = "?tab=" + TAB_URL[name];
  try {
    if (urlMode === "push" && location.search !== newUrl) history.pushState(null, "", newUrl);
    if (urlMode === "replace") history.replaceState(null, "", newUrl);
  } catch {
    /* diabaikan jika browser menolak (mis. file://) */
  }
}

tabButtons.forEach((btn) => {
  btn.addEventListener("click", () => switchTab(btn.dataset.tab, "push"));
});

// Tombol Back/Forward browser ikut memindahkan tab
window.addEventListener("popstate", () => switchTab(getTabFromUrl() || "expense", "none"));

// Prioritas: URL > tab terakhir di localStorage > default
switchTab(getTabFromUrl() || localStorage.getItem(TAB_STORAGE_KEY) || "expense", "replace");

/* ========== MODAL HAPUS BERSAMA ========== */

const modalDelete = $("#modal-delete");
const deleteText = $("#delete-text");
let pendingDelete = null; // { type: "expense" | "bookmark", id }

function askDelete(type, id, label) {
  pendingDelete = { type, id };
  deleteText.textContent = `"${label}"`;
  openModal(modalDelete);
}

$("#delete-confirm").addEventListener("click", () => {
  if (!pendingDelete) return;
  if (pendingDelete.type === "expense") {
    expenses = expenses.filter((x) => x.id !== pendingDelete.id);
    save(EXPENSE_KEY, expenses);
    renderExpenses();
  } else {
    bookmarks = bookmarks.filter((x) => x.id !== pendingDelete.id);
    save(BOOKMARK_KEY, bookmarks);
    renderBookmarks();
  }
  pendingDelete = null;
  closeModal(modalDelete);
});

/* ========== EXPENSE TRACKER ========== */

const EXPENSE_KEY = "pabwe-p3-expenses";
const CATEGORIES = ["Makanan", "Transport", "Belanja", "Tagihan", "Gaji", "Lainnya"];
let expenses = load(EXPENSE_KEY);
let editingExpenseId = null;

const expForm = $("#exp-form");
const expTitle = $("#exp-title");
const expCategory = $("#exp-category");
const expAmount = $("#exp-amount");
const expType = $("#exp-type");
const expDate = $("#exp-date");
const expError = $("#exp-error");
const expSearch = $("#exp-search");
const expFilterType = $("#exp-filter-type");
const expFilterCat = $("#exp-filter-cat");
const expSort = $("#exp-sort");
const expList = $("#exp-list");
const expEmpty = $("#exp-empty");

const modalExpEdit = $("#modal-exp-edit");
const expEditForm = $("#exp-edit-form");
const eeTitle = $("#ee-title");
const eeCategory = $("#ee-category");
const eeAmount = $("#ee-amount");
const eeType = $("#ee-type");
const eeDate = $("#ee-date");
const eeError = $("#ee-error");

fillSelect(expCategory, CATEGORIES);
fillSelect(eeCategory, CATEGORIES);
fillSelect(expFilterCat, CATEGORIES, "Semua kategori");

/** Validasi transaksi: kembalikan pesan error, atau "" jika valid */
function validateExpense(title, amount, date) {
  if (!title.trim()) return "Judul wajib diisi.";
  if (amount === "" || !Number.isFinite(Number(amount)) || Number(amount) <= 0) {
    return "Jumlah harus berupa angka lebih dari 0.";
  }
  if (!date) return "Tanggal wajib diisi.";
  return "";
}

/** Hitung dan tampilkan ringkasan (dari SEMUA transaksi, bukan hasil filter) */
function renderSummary() {
  const totalIn = expenses.filter((x) => x.type === "Pemasukan").reduce((s, x) => s + x.amount, 0);
  const totalOut = expenses.filter((x) => x.type === "Pengeluaran").reduce((s, x) => s + x.amount, 0);
  $("#sum-in").textContent = rupiah(totalIn);
  $("#sum-out").textContent = rupiah(totalOut);
  $("#sum-balance").textContent = rupiah(totalIn - totalOut);
}

/** Filter + sort, lalu render daftar lewat DOM */
function renderExpenses() {
  renderSummary();

  const query = expSearch.value.trim().toLowerCase();
  let items = expenses.filter((x) => {
    return (
      x.title.toLowerCase().includes(query) &&
      (!expFilterType.value || x.type === expFilterType.value) &&
      (!expFilterCat.value || x.category === expFilterCat.value)
    );
  });

  items.sort((a, b) => {
    switch (expSort.value) {
      case "oldest":
        return a.date.localeCompare(b.date) || a.createdAt - b.createdAt;
      case "biggest":
        return b.amount - a.amount;
      case "smallest":
        return a.amount - b.amount;
      default: // newest
        return b.date.localeCompare(a.date) || b.createdAt - a.createdAt;
    }
  });

  const noData = expenses.length === 0;
  expEmpty.classList.toggle("hidden", !noData);
  expList.innerHTML = "";
  if (noData) return;

  if (items.length === 0) {
    expList.append(el("li", "item text-sm", "Tidak ada transaksi yang cocok."));
    return;
  }

  items.forEach((x) => {
    const li = el("li", "item flex flex-col sm:flex-row sm:items-center gap-3");

    const info = el("div", "flex-1 min-w-0");
    info.append(el("p", "font-medium text-slate-900 truncate", x.title));

    const meta = el("div", "flex flex-wrap items-center gap-2 mt-1");
    const typeStyle = x.type === "Pemasukan" ? "chip-in" : "chip-out";
    meta.append(
      el("span", `chip ${typeStyle}`, x.type),
      el("span", "chip chip-cat", x.category),
      el("span", "text-xs text-slate-500", x.date)
    );
    info.append(meta);

    const amount = el(
      "p",
      `font-bold text-sm ${x.type === "Pemasukan" ? "text-emerald-700" : "text-rose-700"}`,
      (x.type === "Pemasukan" ? "+ " : "- ") + rupiah(x.amount)
    );

    const editBtn = el("button", "btn-ghost");
    editBtn.type = "button";
    editBtn.innerHTML = '<i class="ti ti-pencil"></i> Ubah';
    editBtn.addEventListener("click", () => openExpenseEdit(x.id));

    const delBtn = el("button", "btn-danger");
    delBtn.type = "button";
    delBtn.innerHTML = '<i class="ti ti-trash"></i> Hapus';
    delBtn.addEventListener("click", () => askDelete("expense", x.id, x.title));

    const actions = el("div", "flex items-center gap-1.5 shrink-0");
    actions.append(editBtn, delBtn);

    li.append(info, amount, actions);
    expList.append(li);
  });
}

/** Tambah transaksi */
expForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const error = validateExpense(expTitle.value, expAmount.value, expDate.value);
  expError.textContent = error;
  if (error) return;

  expenses.push({
    id: newId(),
    title: expTitle.value.trim(),
    category: expCategory.value,
    amount: Number(expAmount.value),
    type: expType.value,
    date: expDate.value,
    createdAt: Date.now(),
  });
  save(EXPENSE_KEY, expenses);
  expForm.reset();
  expDate.value = new Date().toISOString().slice(0, 10);
  renderExpenses();
});

/** Buka modal ubah: isi field dengan data transaksi */
function openExpenseEdit(id) {
  const x = expenses.find((t) => t.id === id);
  if (!x) return;
  editingExpenseId = id;
  eeTitle.value = x.title;
  eeCategory.value = x.category;
  eeAmount.value = x.amount;
  eeType.value = x.type;
  eeDate.value = x.date;
  eeError.textContent = "";
  openModal(modalExpEdit);
  eeTitle.focus();
}

/** Simpan perubahan */
expEditForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const error = validateExpense(eeTitle.value, eeAmount.value, eeDate.value);
  eeError.textContent = error;
  if (error) return;

  const x = expenses.find((t) => t.id === editingExpenseId);
  if (x) {
    x.title = eeTitle.value.trim();
    x.category = eeCategory.value;
    x.amount = Number(eeAmount.value);
    x.type = eeType.value;
    x.date = eeDate.value;
    save(EXPENSE_KEY, expenses);
    renderExpenses();
  }
  closeModal(modalExpEdit);
});

expSearch.addEventListener("input", renderExpenses);
[expFilterType, expFilterCat, expSort].forEach((s) => s.addEventListener("change", renderExpenses));

expDate.value = new Date().toISOString().slice(0, 10); // default: hari ini
renderExpenses();

/* ========== BOOKMARK MANAGER ========== */

const BOOKMARK_KEY = "pabwe-p3-bookmarks";
let bookmarks = load(BOOKMARK_KEY);
let editingBookmarkId = null;

const bmForm = $("#bm-form");
const bmTitle = $("#bm-title");
const bmUrl = $("#bm-url");
const bmCategory = $("#bm-category");
const bmNote = $("#bm-note");
const bmError = $("#bm-error");
const bmSearch = $("#bm-search");
const bmSort = $("#bm-sort");
const bmList = $("#bm-list");
const bmEmpty = $("#bm-empty");

const modalBmEdit = $("#modal-bm-edit");
const bmEditForm = $("#bm-edit-form");
const beTitle = $("#be-title");
const beUrl = $("#be-url");
const beCategory = $("#be-category");
const beNote = $("#be-note");
const beError = $("#be-error");

/** Validasi bookmark: URL harus diawali http:// atau https:// */
function validateBookmark(title, url, category) {
  if (!title.trim()) return "Nama wajib diisi.";
  if (!/^https?:\/\/\S+$/i.test(url.trim())) return "URL harus diawali http:// atau https://";
  if (!category.trim()) return "Kategori wajib diisi.";
  return "";
}

/** Filter (nama / URL / kategori) + sort, lalu render lewat DOM */
function renderBookmarks() {
  const query = bmSearch.value.trim().toLowerCase();
  let items = bookmarks.filter(
    (b) =>
      b.title.toLowerCase().includes(query) ||
      b.url.toLowerCase().includes(query) ||
      b.category.toLowerCase().includes(query)
  );

  items.sort((a, b) => {
    switch (bmSort.value) {
      case "title-asc":
        return a.title.localeCompare(b.title, "id");
      case "title-desc":
        return b.title.localeCompare(a.title, "id");
      default: // newest
        return b.createdAt - a.createdAt;
    }
  });

  const noData = bookmarks.length === 0;
  bmEmpty.classList.toggle("hidden", !noData);
  bmList.innerHTML = "";
  if (noData) return;

  if (items.length === 0) {
    bmList.append(el("li", "item text-sm", "Tidak ada bookmark yang cocok."));
    return;
  }

  items.forEach((b) => {
    const li = el("li", "item flex flex-col sm:flex-row sm:items-center gap-3");
    const info = el("div", "flex-1 min-w-0");

    // Link buka di tab baru (aman: noopener noreferrer)
    const link = el("a", "font-bold text-[#6c4cff] hover:underline block truncate", b.title);
    link.href = b.url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";

    const urlText = el("p", "text-xs text-slate-500 truncate", b.url);
    const badge = el("span", "chip chip-cat mt-2", b.category);
    info.append(link, urlText, badge);
    if (b.note) info.append(el("p", "text-sm text-slate-600 mt-1", b.note));

    const editBtn = el("button", "btn-ghost");
    editBtn.type = "button";
    editBtn.innerHTML = '<i class="ti ti-pencil"></i> Ubah';
    editBtn.addEventListener("click", () => openBookmarkEdit(b.id));

    const delBtn = el("button", "btn-danger");
    delBtn.type = "button";
    delBtn.innerHTML = '<i class="ti ti-trash"></i> Hapus';
    delBtn.addEventListener("click", () => askDelete("bookmark", b.id, b.title));

    const actions = el("div", "flex items-center gap-1.5 shrink-0");
    actions.append(editBtn, delBtn);

    li.append(info, actions);
    bmList.append(li);
  });
}

/** Tambah bookmark */
bmForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const error = validateBookmark(bmTitle.value, bmUrl.value, bmCategory.value);
  bmError.textContent = error;
  if (error) return;

  bookmarks.push({
    id: newId(),
    title: bmTitle.value.trim(),
    url: bmUrl.value.trim(),
    category: bmCategory.value.trim(),
    note: bmNote.value.trim(),
    createdAt: Date.now(),
  });
  save(BOOKMARK_KEY, bookmarks);
  bmForm.reset();
  renderBookmarks();
});

function openBookmarkEdit(id) {
  const b = bookmarks.find((x) => x.id === id);
  if (!b) return;
  editingBookmarkId = id;
  beTitle.value = b.title;
  beUrl.value = b.url;
  beCategory.value = b.category;
  beNote.value = b.note;
  beError.textContent = "";
  openModal(modalBmEdit);
  beTitle.focus();
}

bmEditForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const error = validateBookmark(beTitle.value, beUrl.value, beCategory.value);
  beError.textContent = error;
  if (error) return;

  const b = bookmarks.find((x) => x.id === editingBookmarkId);
  if (b) {
    b.title = beTitle.value.trim();
    b.url = beUrl.value.trim();
    b.category = beCategory.value.trim();
    b.note = beNote.value.trim();
    save(BOOKMARK_KEY, bookmarks);
    renderBookmarks();
  }
  closeModal(modalBmEdit);
});

bmSearch.addEventListener("input", renderBookmarks);
bmSort.addEventListener("change", renderBookmarks);
renderBookmarks();

/* ========== QUIZ APP ========== */

const QUIZ_HIGH_KEY = "pabwe-p3-quiz-high";

// Soal disimpan sebagai array of object (answer = index opsi yang benar)
const QUESTIONS = [
  { q: "Tag HTML untuk tautan adalah…", options: ["<link>", "<a>", "<href>", "<url>"], answer: 1 },
  { q: "Properti CSS untuk mengubah warna teks adalah…", options: ["font-color", "text-color", "color", "fg-color"], answer: 2 },
  { q: "Method JavaScript untuk mengambil elemen dengan selector CSS adalah…", options: ["getElement()", "querySelector()", "selectId()", "findNode()"], answer: 1 },
  { q: "Fungsi untuk mengubah object menjadi string JSON adalah…", options: ["JSON.parse()", "JSON.toString()", "JSON.stringify()", "JSON.encode()"], answer: 2 },
  { q: "Web Storage yang datanya tetap ada setelah browser ditutup adalah…", options: ["sessionStorage", "localStorage", "cookieStorage", "memoryStorage"], answer: 1 },
];

// State aplikasi
let quizIndex = 0;
let quizScore = 0;
let quizAnswered = false;

const quizStart = $("#quiz-start");
const quizBox = $("#quiz-box");
const quizResult = $("#quiz-result");
const quizProgress = $("#quiz-progress");
const quizQuestion = $("#quiz-question");
const quizOptions = $("#quiz-options");
const quizFeedback = $("#quiz-feedback");
const quizNext = $("#quiz-next");
const quizHigh = $("#quiz-high");

function showQuizHigh() {
  const v = localStorage.getItem(QUIZ_HIGH_KEY);
  quizHigh.textContent = v === null ? "—" : `${v} / ${QUESTIONS.length}`;
}

/** Mulai / ulangi: reset state lalu tampilkan soal pertama */
function startQuiz() {
  quizIndex = 0;
  quizScore = 0;
  quizStart.classList.add("hidden");
  quizResult.classList.add("hidden");
  quizBox.classList.remove("hidden");
  renderQuestion();
}

/** Render soal aktif berdasarkan state */
function renderQuestion() {
  const item = QUESTIONS[quizIndex];
  quizAnswered = false;
  quizProgress.textContent = `Soal ${quizIndex + 1} dari ${QUESTIONS.length}`;
  $("#quiz-bar").style.width = `${(quizIndex / QUESTIONS.length) * 100}%`; // progres kuis
  quizQuestion.textContent = item.q;
  quizFeedback.textContent = "";
  quizNext.classList.add("hidden");
  quizNext.textContent = quizIndex === QUESTIONS.length - 1 ? "Lihat hasil" : "Soal berikutnya";
  quizOptions.innerHTML = "";

  item.options.forEach((text, i) => {
    const btn = el("button", "opt", text);
    btn.type = "button";
    btn.addEventListener("click", () => answerQuestion(i));
    quizOptions.append(btn);
  });
}

/** Nilai jawaban: bandingkan dengan kunci, update skor, beri feedback */
function answerQuestion(choice) {
  if (quizAnswered) return;
  quizAnswered = true;

  const correct = QUESTIONS[quizIndex].answer;
  if (choice === correct) {
    quizScore += 1;
    quizFeedback.textContent = "Benar!";
    quizFeedback.className = "text-sm font-bold min-h-[1.25rem] mb-3 text-emerald-700";
  } else {
    quizFeedback.textContent = `Salah. Jawaban yang benar: ${QUESTIONS[quizIndex].options[correct]}`;
    quizFeedback.className = "text-sm font-bold min-h-[1.25rem] mb-3 text-rose-700";
  }

  // Tandai opsi benar (hijau) dan pilihan salah (merah), lalu kunci semua tombol
  Array.from(quizOptions.children).forEach((btn, i) => {
    btn.disabled = true;
    if (i === correct) btn.classList.add("is-right");
    else if (i === choice) btn.classList.add("is-wrong");
  });
  quizNext.classList.remove("hidden");
}

/** Lanjut ke soal berikutnya, atau tampilkan hasil akhir */
quizNext.addEventListener("click", () => {
  if (quizIndex < QUESTIONS.length - 1) {
    quizIndex += 1;
    renderQuestion();
  } else {
    showQuizResult();
  }
});

/** Hasil akhir + update high score */
function showQuizResult() {
  quizBox.classList.add("hidden");
  quizResult.classList.remove("hidden");
  $("#quiz-score").textContent = `${quizScore} / ${QUESTIONS.length}`;

  const stored = localStorage.getItem(QUIZ_HIGH_KEY);
  let msg = "Coba lagi untuk skor lebih tinggi!";
  if (stored === null || quizScore > Number(stored)) {
    localStorage.setItem(QUIZ_HIGH_KEY, String(quizScore));
    msg = "Skor terbaik baru!";
  }
  $("#quiz-result-msg").textContent = msg;
  showQuizHigh();
}

$("#quiz-start-btn").addEventListener("click", startQuiz);
$("#quiz-again").addEventListener("click", startQuiz);
showQuizHigh();