// ============================================================
// KITACAMPING INVENTARIS — app.js v5
// ============================================================

// --- CONFIG ---
var SUPABASE_URL = 'https://bwilqtcnalqsiklerfkl.supabase.co';
var SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ3aWxxdGNuYWxxc2lrbGVyZmtsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUyMTY3OTYsImV4cCI6MjEwMDc5Mjc5Nn0.jeCHJRyuEd_vUWI0iIZT8-uW_f61qeE13W4FKnIvlsQ';

// --- STATE (global agar semua fungsi bisa akses) ---
var db = null;
var allItems = [];
var currentFilter = 'all';

// ============================================================
// INIT — dipanggil saat halaman selesai dimuat
// ============================================================
window.addEventListener('DOMContentLoaded', function() {
    // Init Supabase
    try {
        if (window.supabase) {
            db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        } else {
            console.warn('Supabase SDK belum tersedia.');
        }
    } catch (e) {
        console.error('Gagal init Supabase:', e);
    }

    checkAuth();
});

// ============================================================
// AUTENTIKASI
// ============================================================

function checkAuth() {
    var isAuth = localStorage.getItem('kc_isAdmin') || localStorage.getItem('isAdmin');
    if (isAuth === 'true') {
        showDashboard();
    } else {
        showLogin();
    }
}

function showLogin() {
    document.getElementById('login-overlay').classList.add('active');
}

function showDashboard() {
    document.getElementById('login-overlay').classList.remove('active');
    fetchData();
}

// Dipanggil dari tombol "Masuk" (onclick di HTML)
function handleLogin() {
    var input = document.getElementById('login-password');
    var errEl = document.getElementById('login-error');
    var pw = input ? input.value.trim() : '';
    var correct = 'YUKCAMPING';

    if (!pw) {
        if (errEl) { errEl.style.display = 'block'; errEl.textContent = 'Password tidak boleh kosong!'; }
        return false;
    }

    if (pw === correct) {
        localStorage.setItem('kc_isAdmin', 'true');
        localStorage.setItem('isAdmin', 'true'); // backward compat
        if (errEl) errEl.style.display = 'none';
        if (input) input.value = '';
        showDashboard();
    } else {
        if (errEl) { errEl.style.display = 'block'; errEl.textContent = 'Password salah!'; }
    }
    return false;
}

// Dipanggil dari tombol "Keluar" (onclick di HTML)
function handleLogout() {
    localStorage.removeItem('kc_isAdmin');
    localStorage.removeItem('isAdmin');
    showLogin();
}

// ============================================================
// FILTER — dipanggil langsung dari onclick di HTML
// ============================================================

function setFilter(btn, filter) {
    currentFilter = filter;
    // Reset semua tombol filter
    var allBtns = document.querySelectorAll('.filter-btn');
    allBtns.forEach(function(b) { b.classList.remove('active'); });
    // Aktifkan tombol yang diklik
    if (btn) btn.classList.add('active');
    renderCatalog();
}

// ============================================================
// FETCH DATA DARI SUPABASE
// ============================================================

function fetchData() {
    var grid = document.getElementById('catalog-grid');
    var loader = document.getElementById('loading-indicator');

    if (loader) loader.style.display = 'block';
    if (grid) grid.innerHTML = '';

    if (!db) {
        if (grid) grid.innerHTML = errorBox('Koneksi Supabase gagal. Cek koneksi internet Anda dan refresh halaman.');
        if (loader) loader.style.display = 'none';
        return;
    }

    db.from('items')
        .select('*')
        .order('id', { ascending: false })
        .then(function(result) {
            if (loader) loader.style.display = 'none';
            if (result.error) {
                console.error('fetchData error:', result.error);
                if (grid) grid.innerHTML = errorBox('Gagal memuat data: ' + result.error.message);
                return;
            }
            allItems = result.data || [];
            updateStats();
            renderCatalog();
        })
        .catch(function(err) {
            if (loader) loader.style.display = 'none';
            console.error('fetchData catch:', err);
            if (grid) grid.innerHTML = errorBox('Error: ' + err.message);
        });
}

// ============================================================
// CRUD — TAMBAH & EDIT BARANG
// ============================================================

// Dipanggil dari tombol "Tambah Barang" (onclick di HTML)
function openItemModal() {
    var modal = document.getElementById('item-modal');
    var title = document.getElementById('modal-title');
    var form  = document.getElementById('item-form');

    if (!modal) { console.error('item-modal tidak ditemukan!'); return; }

    if (title) title.innerText = 'Tambah Barang Baru';
    document.getElementById('item-id').value = '';
    if (form) form.reset();
    document.getElementById('item-stock-total').value = '1';
    document.getElementById('item-stock-out').value   = '0';

    modal.classList.add('active');
}

// Dipanggil dari tombol "Edit" pada card (onclick di HTML)
function openEditModal(id) {
    var item = null;
    for (var i = 0; i < allItems.length; i++) {
        if (allItems[i].id === id) { item = allItems[i]; break; }
    }
    if (!item) { showToast('Data tidak ditemukan!', 'error'); return; }

    var modal = document.getElementById('item-modal');
    if (!modal) return;

    document.getElementById('modal-title').innerText        = 'Edit Barang';
    document.getElementById('item-id').value                = item.id;
    document.getElementById('item-name').value              = item.nama || '';
    document.getElementById('item-category').value          = item.kategori || 'lainnya';
    document.getElementById('item-price').value             = item.harga || 0;
    document.getElementById('item-image').value             = item.gambar_url || '';
    document.getElementById('item-stock-total').value       = item.stok_total || 1;
    document.getElementById('item-stock-out').value         = item.stok_keluar || 0;
    document.getElementById('item-desc').value              = item.deskripsi || '';

    modal.classList.add('active');
}

function closeItemModal() {
    var modal = document.getElementById('item-modal');
    if (modal) modal.classList.remove('active');
}

// Dipanggil dari tombol "Simpan" (onclick di HTML)
function submitItemForm() {
    var id       = document.getElementById('item-id').value;
    var nama     = document.getElementById('item-name').value.trim();
    var kategori = document.getElementById('item-category').value;
    var harga    = parseInt(document.getElementById('item-price').value) || 0;
    var gambar   = document.getElementById('item-image').value.trim();
    var total    = parseInt(document.getElementById('item-stock-total').value) || 1;
    var keluar   = parseInt(document.getElementById('item-stock-out').value) || 0;
    var deskripsi= document.getElementById('item-desc').value.trim();

    if (!nama)      { showToast('Nama barang wajib diisi!', 'error'); return; }
    if (!gambar)    { showToast('URL Gambar wajib diisi!', 'error'); return; }
    if (!deskripsi) { showToast('Deskripsi wajib diisi!', 'error'); return; }
    if (keluar > total) { showToast('Stok keluar tidak boleh melebihi stok total!', 'error'); return; }

    if (!db) { showToast('Koneksi database tidak tersedia.', 'error'); return; }

    var payload = {
        nama: nama,
        kategori: kategori,
        harga: harga,
        gambar_url: gambar,
        stok_total: total,
        stok_keluar: keluar,
        deskripsi: deskripsi
    };

    var promise;
    if (id) {
        promise = db.from('items').update(payload).eq('id', parseInt(id));
    } else {
        promise = db.from('items').insert([payload]);
    }

    promise.then(function(result) {
        if (result.error) {
            console.error('submitItemForm error:', result.error);
            showToast('Gagal menyimpan: ' + result.error.message, 'error');
            return;
        }
        showToast(id ? 'Barang berhasil diperbarui!' : 'Barang berhasil ditambahkan!', 'success');
        closeItemModal();
        fetchData();
    }).catch(function(err) {
        console.error('submitItemForm catch:', err);
        showToast('Error: ' + err.message, 'error');
    });
}

// Dipanggil dari tombol "Hapus" pada card (onclick di HTML)
function deleteItem(id) {
    if (!confirm('Yakin ingin menghapus barang ini?')) return;
    if (!db) { showToast('Koneksi database tidak tersedia.', 'error'); return; }

    db.from('items').delete().eq('id', id)
        .then(function(result) {
            if (result.error) {
                showToast('Gagal menghapus: ' + result.error.message, 'error');
                return;
            }
            showToast('Barang berhasil dihapus!', 'success');
            fetchData();
        })
        .catch(function(err) {
            showToast('Error: ' + err.message, 'error');
        });
}

// ============================================================
// RENDER KATALOG
// ============================================================

function formatRupiah(n) {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n || 0);
}

function updateStats() {
    var total = 0, out = 0;
    allItems.forEach(function(item) {
        total += parseInt(item.stok_total) || 0;
        out   += parseInt(item.stok_keluar) || 0;
    });
    var ready = Math.max(total - out, 0);

    var elTotal = document.getElementById('stat-total');
    var elOut   = document.getElementById('stat-out');
    var elReady = document.getElementById('stat-ready');
    if (elTotal) elTotal.innerText = total;
    if (elOut)   elOut.innerText   = out;
    if (elReady) elReady.innerText = ready;
}

function renderCatalog() {
    var grid = document.getElementById('catalog-grid');
    if (!grid) return;
    grid.innerHTML = '';

    var filtered = currentFilter === 'all'
        ? allItems
        : allItems.filter(function(i) { return i.kategori === currentFilter; });

    if (filtered.length === 0) {
        grid.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:var(--text-muted);padding:3rem 0;">Tidak ada barang ditemukan.</p>';
        return;
    }

    var imgFallback = 'https://placehold.co/300x200/1e293b/f59e0b?text=No+Image';

    filtered.forEach(function(item) {
        var sisa       = Math.max((item.stok_total || 0) - (item.stok_keluar || 0), 0);
        var sisaColor  = sisa > 0 ? '#10b981' : '#ef4444';
        var sisaLabel  = sisa > 0 ? 'Sisa: ' + sisa : 'Habis';

        var card = document.createElement('div');
        card.className = 'card';
        card.innerHTML =
            '<div class="card-img-wrapper">' +
                '<img src="' + (item.gambar_url || imgFallback) + '" alt="' + (item.nama || '') + '" class="card-img" onerror="this.src=\'' + imgFallback + '\'">' +
                '<div class="stock-badge" style="color:' + sisaColor + ';">' + sisaLabel + '</div>' +
            '</div>' +
            '<div class="card-content">' +
                '<span class="card-category">' + (item.kategori || '-') + '</span>' +
                '<h3 class="card-title">' + (item.nama || '-') + '</h3>' +
                '<p class="card-desc">' + (item.deskripsi || '') + '</p>' +
                '<div class="price">' + formatRupiah(item.harga) + '<span>/hari</span></div>' +
                '<div class="admin-actions">' +
                    '<button class="action-btn edit-btn" onclick="openEditModal(' + item.id + ')">' +
                        '<i class="fa-solid fa-pen"></i> Edit' +
                    '</button>' +
                    '<button class="action-btn del-btn" onclick="deleteItem(' + item.id + ')">' +
                        '<i class="fa-solid fa-trash"></i> Hapus' +
                    '</button>' +
                '</div>' +
            '</div>';
        grid.appendChild(card);
    });
}

// ============================================================
// TOAST NOTIFICATION
// ============================================================

function showToast(message, type) {
    type = type || 'success';
    var existing = document.getElementById('kc-toast');
    if (existing) existing.remove();

    if (!document.getElementById('toast-style')) {
        var style = document.createElement('style');
        style.id = 'toast-style';
        style.textContent = '@keyframes slideInToast{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}';
        document.head.appendChild(style);
    }

    var toast = document.createElement('div');
    toast.id = 'kc-toast';
    toast.style.cssText = 'position:fixed;bottom:2rem;right:2rem;z-index:9999;padding:1rem 1.5rem;border-radius:12px;color:#fff;font-family:Outfit,sans-serif;font-size:0.95rem;background:' +
        (type === 'success' ? '#10b981' : '#ef4444') +
        ';box-shadow:0 8px 32px rgba(0,0,0,.3);display:flex;align-items:center;gap:0.6rem;animation:slideInToast .3s ease;';
    toast.innerHTML = '<i class="fa-solid fa-' + (type === 'success' ? 'circle-check' : 'circle-exclamation') + '"></i> ' + message;

    document.body.appendChild(toast);
    setTimeout(function() { if (toast.parentNode) toast.remove(); }, 3000);
}

// ============================================================
// HELPERS
// ============================================================

function errorBox(msg) {
    return '<div style="grid-column:1/-1;text-align:center;color:#ef4444;padding:2rem;background:var(--bg-card);border-radius:16px;">' +
        '<i class="fa-solid fa-triangle-exclamation" style="font-size:2rem;margin-bottom:1rem;display:block;"></i>' + msg + '</div>';
}
