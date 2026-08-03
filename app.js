// ============================================================
// KITACAMPING INVENTARIS — app.js v6
// ============================================================

var SUPABASE_URL = 'https://bwilqtcnalqsiklerfkl.supabase.co';
var SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ3aWxxdGNuYWxxc2lrbGVyZmtsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUyMTY3OTYsImV4cCI6MjEwMDc5Mjc5Nn0.jeCHJRyuEd_vUWI0iIZT8-uW_f61qeE13W4FKnIvlsQ';

var db          = null;
var allItems    = [];
var currentFilter = 'all';

// ============================================================
// INIT
// ============================================================
window.addEventListener('DOMContentLoaded', function () {
    try {
        if (window.supabase) {
            db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        } else {
            console.warn('Supabase SDK tidak tersedia.');
        }
    } catch (e) {
        console.error('Gagal init Supabase:', e);
    }
    checkAuth();
    // Buka panel peminjaman otomatis saat pertama load
    toggleLoansPanel();
});

// ============================================================
// AUTH
// ============================================================
function checkAuth() {
    var ok = localStorage.getItem('kc_isAdmin') || localStorage.getItem('isAdmin');
    if (ok === 'true') { showDashboard(); } else { showLogin(); }
}

function showLogin()    { document.getElementById('login-overlay').classList.add('active'); }
function showDashboard(){
    document.getElementById('login-overlay').classList.remove('active');
    fetchData();
    fetchTransactions();
}

function handleLogin() {
    var input  = document.getElementById('login-password');
    var errEl  = document.getElementById('login-error');
    var pw     = input ? input.value.trim() : '';

    if (!pw) { if (errEl) { errEl.style.display = 'block'; errEl.textContent = 'Password tidak boleh kosong!'; } return false; }

    if (pw === 'YUKCAMPING') {
        localStorage.setItem('kc_isAdmin', 'true');
        localStorage.setItem('isAdmin', 'true');
        if (errEl) errEl.style.display = 'none';
        if (input) input.value = '';
        showDashboard();
    } else {
        if (errEl) { errEl.style.display = 'block'; errEl.textContent = 'Password salah!'; }
    }
    return false;
}

function handleLogout() {
    localStorage.removeItem('kc_isAdmin');
    localStorage.removeItem('isAdmin');
    showLogin();
}

// ============================================================
// FILTER
// ============================================================
function setFilter(btn, filter) {
    currentFilter = filter;
    var all = document.querySelectorAll('.filter-btn');
    for (var i = 0; i < all.length; i++) all[i].classList.remove('active');
    if (btn) btn.classList.add('active');
    renderCatalog();
}

// ============================================================
// FETCH DATA
// ============================================================
function fetchData() {
    var grid   = document.getElementById('catalog-grid');
    var loader = document.getElementById('loading-indicator');
    if (loader) loader.style.display = 'block';
    if (grid)   grid.innerHTML = '';

    if (!db) {
        if (grid)   grid.innerHTML = errorBox('Koneksi Supabase gagal. Pastikan terhubung ke internet.');
        if (loader) loader.style.display = 'none';
        return;
    }

    db.from('items').select('*').order('id', { ascending: false })
        .then(function (res) {
            if (loader) loader.style.display = 'none';
            if (res.error) { if (grid) grid.innerHTML = errorBox('Gagal memuat: ' + res.error.message); return; }
            allItems = res.data || [];
            updateStats();
            renderCatalog();
        })
        .catch(function (err) {
            if (loader) loader.style.display = 'none';
            if (grid)   grid.innerHTML = errorBox('Error: ' + err.message);
        });
}

// ============================================================
// IMAGE UPLOAD (client-side, compressed → base64)
// ============================================================
var currentImageData = ''; // base64 data URL

function handleImageUpload(input) {
    var errEl    = document.getElementById('image-error');
    var preview  = document.getElementById('image-preview');
    var preWrap  = document.getElementById('image-preview-wrap');
    var fileLabel= document.getElementById('image-filename');
    var dataInput= document.getElementById('item-image-data');
    var uploadArea = document.getElementById('upload-area');

    errEl.style.display    = 'none';
    preWrap.style.display  = 'none';
    currentImageData       = '';
    if (dataInput) dataInput.value = '';

    if (!input.files || input.files.length === 0) return;

    var file = input.files[0];
    var MAX_BYTES = 2 * 1024 * 1024; // 2 MB

    if (file.size > MAX_BYTES) {
        errEl.style.display = 'block';
        input.value = '';
        return;
    }

    // Compress & preview via Canvas
    var reader = new FileReader();
    reader.onload = function (e) {
        var img = new Image();
        img.onload = function () {
            var canvas  = document.createElement('canvas');
            var MAX_DIM = 800;
            var scale   = Math.min(MAX_DIM / img.width, MAX_DIM / img.height, 1);
            canvas.width  = Math.round(img.width  * scale);
            canvas.height = Math.round(img.height * scale);
            canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);

            var base64 = canvas.toDataURL('image/jpeg', 0.82);
            currentImageData = base64;
            if (dataInput) dataInput.value = base64;

            // Show preview
            preview.src        = base64;
            fileLabel.textContent = file.name + ' (' + (file.size / 1024).toFixed(0) + ' KB)';
            preWrap.style.display = 'block';

            // Update upload area text
            var uploadText = uploadArea ? uploadArea.querySelector('.upload-text') : null;
            if (uploadText) uploadText.textContent = 'Gambar terpilih — klik untuk ganti';
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

// ============================================================
// ITEM MODAL (TAMBAH / EDIT)
// ============================================================
function openItemModal() {
    var modal = document.getElementById('item-modal');
    if (!modal) return;
    document.getElementById('modal-title').innerText = 'Tambah Barang Baru';
    document.getElementById('item-id').value          = '';
    document.getElementById('item-form').reset();
    document.getElementById('item-stock-total').value = '1';
    document.getElementById('image-preview-wrap').style.display = 'none';
    document.getElementById('image-error').style.display        = 'none';
    document.getElementById('item-image-data').value = '';
    currentImageData = '';
    var uploadText = document.querySelector('#upload-area .upload-text');
    if (uploadText) uploadText.textContent = 'Klik untuk pilih gambar';
    modal.classList.add('active');
}

function openEditModal(id) {
    var item = null;
    for (var i = 0; i < allItems.length; i++) { if (allItems[i].id === id) { item = allItems[i]; break; } }
    if (!item) { showToast('Data tidak ditemukan!', 'error'); return; }

    document.getElementById('modal-title').innerText        = 'Edit Barang';
    document.getElementById('item-id').value                = item.id;
    document.getElementById('item-name').value              = item.nama || '';
    document.getElementById('item-category').value          = item.kategori || 'lainnya';
    document.getElementById('item-price').value             = item.harga || 0;
    document.getElementById('item-stock-total').value       = item.stok_total || 1;
    document.getElementById('item-desc').value              = item.deskripsi || '';

    // Show existing image
    var preWrap  = document.getElementById('image-preview-wrap');
    var preview  = document.getElementById('image-preview');
    var fileLabel= document.getElementById('image-filename');
    if (item.gambar_url) {
        preview.src            = item.gambar_url;
        fileLabel.textContent  = 'Gambar saat ini (ganti jika perlu)';
        preWrap.style.display  = 'block';
        currentImageData       = item.gambar_url; // keep existing if not changed
        document.getElementById('item-image-data').value = item.gambar_url;
    } else {
        preWrap.style.display = 'none';
        currentImageData = '';
    }
    document.getElementById('image-error').style.display = 'none';
    document.getElementById('item-modal').classList.add('active');
}

function closeItemModal() {
    var modal = document.getElementById('item-modal');
    if (modal) modal.classList.remove('active');
    currentImageData = '';
}

function submitItemForm() {
    var id        = document.getElementById('item-id').value;
    var nama      = document.getElementById('item-name').value.trim();
    var kategori  = document.getElementById('item-category').value;
    var harga     = parseInt(document.getElementById('item-price').value) || 0;
    var total     = parseInt(document.getElementById('item-stock-total').value) || 1;
    var deskripsi = document.getElementById('item-desc').value.trim();
    var gambar    = document.getElementById('item-image-data').value || currentImageData;

    if (!nama)      { showToast('Nama barang wajib diisi!', 'error'); return; }
    if (!deskripsi) { showToast('Deskripsi wajib diisi!', 'error'); return; }
    if (!gambar)    { showToast('Foto barang wajib diunggah!', 'error'); return; }
    if (!db)        { showToast('Koneksi database tidak tersedia.', 'error'); return; }

    // Preserve stok_keluar when editing
    var keluar = 0;
    if (id) {
        var existing = null;
        for (var i = 0; i < allItems.length; i++) { if (allItems[i].id === parseInt(id)) { existing = allItems[i]; break; } }
        if (existing) keluar = existing.stok_keluar || 0;
    }

    var payload = { nama: nama, kategori: kategori, harga: harga, gambar_url: gambar, stok_total: total, stok_keluar: keluar, deskripsi: deskripsi };

    var promise = id
        ? db.from('items').update(payload).eq('id', parseInt(id))
        : db.from('items').insert([payload]);

    promise.then(function (res) {
        if (res.error) { showToast('Gagal menyimpan: ' + res.error.message, 'error'); return; }
        showToast(id ? 'Barang berhasil diperbarui!' : 'Barang berhasil ditambahkan!', 'success');
        closeItemModal();
        fetchData();
    }).catch(function (err) { showToast('Error: ' + err.message, 'error'); });
}

// ============================================================
// LOAN MODAL (TRANSAKSI PEMINJAMAN)
// ============================================================
function openLoanModal(id) {
    var item = null;
    for (var i = 0; i < allItems.length; i++) { if (allItems[i].id === id) { item = allItems[i]; break; } }
    if (!item) { showToast('Data tidak ditemukan!', 'error'); return; }

    var sisa = Math.max((item.stok_total || 0) - (item.stok_keluar || 0), 0);
    if (sisa <= 0) { showToast('Stok barang ini sudah habis!', 'error'); return; }

    // Fill item info
    document.getElementById('loan-item-id').value      = item.id;
    document.getElementById('loan-item-name').innerText = item.nama || '-';
    document.getElementById('loan-item-stock').innerText = 'Sisa stok tersedia: ' + sisa + ' unit';
    var imgEl = document.getElementById('loan-item-img');
    if (item.gambar_url) { imgEl.src = item.gambar_url; imgEl.style.display = 'block'; }
    else { imgEl.style.display = 'none'; }

    // Set max jumlah
    var jumlahInput = document.getElementById('loan-jumlah');
    jumlahInput.max   = sisa;
    jumlahInput.value = 1;

    // Reset form
    document.getElementById('loan-nama').value     = '';
    document.getElementById('loan-lama').value     = '1';
    document.getElementById('loan-jaminan').value  = '';
    document.getElementById('loan-catatan').value  = '';

    document.getElementById('loan-modal').classList.add('active');
}

function closeLoanModal() {
    document.getElementById('loan-modal').classList.remove('active');
}

function submitLoanForm() {
    var itemId   = parseInt(document.getElementById('loan-item-id').value);
    var nama     = document.getElementById('loan-nama').value.trim();
    var jumlah   = parseInt(document.getElementById('loan-jumlah').value) || 1;
    var lama     = parseInt(document.getElementById('loan-lama').value) || 1;
    var satuan   = document.getElementById('loan-satuan').value;
    var jaminan  = document.getElementById('loan-jaminan').value.trim();
    var catatan  = document.getElementById('loan-catatan').value.trim();

    if (!nama)    { showToast('Nama peminjam wajib diisi!', 'error'); return; }
    if (!jaminan) { showToast('Jaminan peminjam wajib diisi!', 'error'); return; }
    if (jumlah < 1) { showToast('Jumlah harus minimal 1!', 'error'); return; }
    if (!db)      { showToast('Koneksi database tidak tersedia.', 'error'); return; }

    // Cek stok terkini
    var item = null;
    for (var i = 0; i < allItems.length; i++) { if (allItems[i].id === itemId) { item = allItems[i]; break; } }
    if (!item) { showToast('Data barang tidak ditemukan!', 'error'); return; }

    var sisa = Math.max((item.stok_total || 0) - (item.stok_keluar || 0), 0);
    if (jumlah > sisa) { showToast('Jumlah melebihi stok yang tersedia (' + sisa + ' unit)!', 'error'); return; }

    var namaBarang = item.nama || '-';
    var newKeluar  = (item.stok_keluar || 0) + jumlah;

    // Update stok_keluar item
    db.from('items').update({ stok_keluar: newKeluar }).eq('id', itemId)
        .then(function (res) {
            if (res.error) { showToast('Gagal update stok: ' + res.error.message, 'error'); return; }

            // Simpan transaksi (opsional — hanya jika tabel transactions ada)
            var txData = {
                item_id:         itemId,
                nama_peminjam:   nama,
                barang_dipinjam: namaBarang,
                jumlah:          jumlah,
                lama_peminjaman: lama,
                satuan:          satuan,
                jaminan:         jaminan,
                catatan:         catatan || null,
                status:          'aktif'
            };
            db.from('transactions').insert([txData])
                .then(function () { /* tabel mungkin belum ada, abaikan error */ })
                .catch(function () { /* sama */ });

            showToast('Peminjaman berhasil dicatat! Stok berkurang ' + jumlah + ' unit.', 'success');
            closeLoanModal();
            fetchData();
            fetchTransactions();
        })
        .catch(function (err) { showToast('Error: ' + err.message, 'error'); });
}

// ============================================================
// DELETE
// ============================================================
function deleteItem(id) {
    if (!confirm('Yakin ingin menghapus barang ini?')) return;
    if (!db) { showToast('Koneksi tidak tersedia.', 'error'); return; }
    db.from('items').delete().eq('id', id)
        .then(function (res) {
            if (res.error) { showToast('Gagal hapus: ' + res.error.message, 'error'); return; }
            showToast('Barang berhasil dihapus!', 'success');
            fetchData();
        })
        .catch(function (err) { showToast('Error: ' + err.message, 'error'); });
}

// ============================================================
// RENDER
// ============================================================
function formatRupiah(n) {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n || 0);
}

// Hitung total barang yang sedang dipinjam untuk item tertentu (dari loansData)
function getActiveLoanCount(itemId) {
    var count = 0;
    for (var i = 0; i < loansData.length; i++) {
        if (loansData[i].item_id === itemId) {
            count += parseInt(loansData[i].jumlah) || 0;
        }
    }
    return count;
}

function updateStats() {
    var total = 0;
    for (var i = 0; i < allItems.length; i++) {
        total += parseInt(allItems[i].stok_total) || 0;
    }

    // SUMBER KEBENARAN: hitung dari transaksi aktif, bukan stok_keluar
    var out = 0;
    for (var j = 0; j < loansData.length; j++) {
        out += parseInt(loansData[j].jumlah) || 0;
    }

    var el;
    el = document.getElementById('stat-total'); if (el) el.innerText = total;
    el = document.getElementById('stat-out');   if (el) el.innerText = out;
    el = document.getElementById('stat-ready'); if (el) el.innerText = Math.max(total - out, 0);
}

function renderCatalog() {
    var grid = document.getElementById('catalog-grid');
    if (!grid) return;
    grid.innerHTML = '';

    var filtered = currentFilter === 'all'
        ? allItems
        : allItems.filter(function (i) { return i.kategori === currentFilter; });

    if (filtered.length === 0) {
        grid.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:var(--text-muted);padding:3rem 0;">Tidak ada barang ditemukan.</p>';
        return;
    }

    var fallback = 'https://placehold.co/300x200/1e293b/f59e0b?text=No+Image';

    for (var j = 0; j < filtered.length; j++) {
        var item  = filtered[j];
        var activeBorrowed = getActiveLoanCount(item.id);
        var sisa      = Math.max((item.stok_total || 0) - activeBorrowed, 0);
        var sisaColor = sisa > 0 ? '#10b981' : '#ef4444';
        var sisaLabel = sisa > 0 ? 'Sisa: ' + sisa : 'Habis';

        var card = document.createElement('div');
        card.className = 'card';
        card.innerHTML =
            '<div class="card-img-wrapper">' +
                '<img src="' + (item.gambar_url || fallback) + '" alt="' + (item.nama || '') + '" class="card-img" onerror="this.src=\'' + fallback + '\'">' +
                '<div class="stock-badge" style="color:' + sisaColor + ';">' + sisaLabel + '</div>' +
            '</div>' +
            '<div class="card-content">' +
                '<span class="card-category">' + (item.kategori || '-') + '</span>' +
                '<h3 class="card-title">' + (item.nama || '-') + '</h3>' +
                '<p class="card-desc">' + (item.deskripsi || '') + '</p>' +
                '<div class="price">' + formatRupiah(item.harga) + '<span>/hari</span></div>' +
                '<div class="admin-actions">' +
                    '<button class="action-btn loan-btn" onclick="openLoanModal(' + item.id + ')">' +
                        '<i class="fa-solid fa-handshake"></i> Pinjam' +
                    '</button>' +
                    '<button class="action-btn edit-btn" onclick="openEditModal(' + item.id + ')">' +
                        '<i class="fa-solid fa-pen"></i> Edit' +
                    '</button>' +
                    '<button class="action-btn del-btn" onclick="deleteItem(' + item.id + ')">' +
                        '<i class="fa-solid fa-trash"></i> Hapus' +
                    '</button>' +
                '</div>' +
            '</div>';
        grid.appendChild(card);
    }
}

// ============================================================
// TOAST
// ============================================================
function showToast(msg, type) {
    type = type || 'success';
    var ex = document.getElementById('kc-toast');
    if (ex) ex.remove();
    if (!document.getElementById('toast-anim')) {
        var s = document.createElement('style');
        s.id  = 'toast-anim';
        s.textContent = '@keyframes kct{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}';
        document.head.appendChild(s);
    }
    var t = document.createElement('div');
    t.id  = 'kc-toast';
    t.style.cssText = 'position:fixed;bottom:2rem;right:2rem;z-index:9999;padding:.9rem 1.4rem;border-radius:12px;color:#fff;font-family:Outfit,sans-serif;font-size:.95rem;background:' + (type === 'success' ? '#10b981' : '#ef4444') + ';box-shadow:0 8px 32px rgba(0,0,0,.35);display:flex;align-items:center;gap:.6rem;animation:kct .3s ease;max-width:340px;';
    t.innerHTML = '<i class="fa-solid fa-' + (type === 'success' ? 'circle-check' : 'circle-exclamation') + '"></i> ' + msg;
    document.body.appendChild(t);
    setTimeout(function () { if (t.parentNode) t.remove(); }, 3500);
}

// ============================================================
// LOANS DASHBOARD (DAFTAR PEMINJAMAN AKTIF)
// ============================================================
var loansData = [];
var loansPanelOpen = true; // terbuka by default

function toggleLoansPanel() {
    loansPanelOpen = !loansPanelOpen;
    var panel   = document.getElementById('loans-panel');
    var chevron = document.getElementById('loans-chevron');
    if (panel)   panel.classList.toggle('open', loansPanelOpen);
    if (chevron) chevron.classList.toggle('open', loansPanelOpen);
}

function fetchTransactions() {
    if (!db) return;
    var loadEl = document.getElementById('loans-loading');
    if (loadEl) loadEl.style.display = 'block';

    db.from('transactions')
        .select('*')
        .eq('status', 'aktif')
        .order('id', { ascending: false })
        .then(function (res) {
            if (loadEl) loadEl.style.display = 'none';
            if (res.error) {
                // Tabel mungkin belum dibuat — tampilkan petunjuk
                console.warn('Transactions table:', res.error.message);
                renderTransactionsMissing();
                return;
            }
            loansData = res.data || [];
            renderTransactions();
            // Re-render stats & catalog agar sinkron dengan transaksi aktif
            updateStats();
            renderCatalog();
            // Buka panel otomatis jika ada data
            if (loansData.length > 0 && !loansPanelOpen) toggleLoansPanel();
        })
        .catch(function () {
            if (loadEl) loadEl.style.display = 'none';
            renderTransactionsMissing();
        });
}

function renderTransactionsMissing() {
    var empty = document.getElementById('loans-empty');
    var table = document.getElementById('loans-table');
    var badge = document.getElementById('loan-count-badge');
    if (empty) {
        empty.style.display = 'block';
        empty.innerHTML = '<i class="fa-solid fa-triangle-exclamation" style="font-size:1.5rem;margin-bottom:.5rem;display:block;color:var(--primary);"></i>' +
            'Tabel <b>transactions</b> belum dibuat di Supabase.<br>' +
            '<span style="font-size:.8rem;color:var(--text-muted);">Jalankan SQL di Supabase → SQL Editor untuk mengaktifkan fitur ini.</span>';
    }
    if (table) table.style.display = 'none';
    if (badge) { badge.textContent = '0'; badge.className = 'loan-badge zero'; }
    // Pastikan panel terbuka agar pesan terlihat
    var panel = document.getElementById('loans-panel');
    if (panel && !loansPanelOpen) toggleLoansPanel();
}

function renderTransactions() {
    var tbody  = document.getElementById('loans-tbody');
    var table  = document.getElementById('loans-table');
    var empty  = document.getElementById('loans-empty');
    var badge  = document.getElementById('loan-count-badge');

    if (!tbody) return;

    // Update badge
    if (badge) {
        badge.textContent = loansData.length;
        badge.className   = loansData.length > 0 ? 'loan-badge' : 'loan-badge zero';
    }

    if (loansData.length === 0) {
        if (empty) { empty.style.display = 'block'; empty.innerHTML = '<i class="fa-solid fa-inbox" style="font-size:2rem;margin-bottom:.5rem;display:block;"></i>Tidak ada peminjaman aktif saat ini.'; }
        if (table) table.style.display = 'none';
        return;
    }

    if (empty) empty.style.display = 'none';
    if (table) table.style.display = 'table';

    tbody.innerHTML = '';
    for (var i = 0; i < loansData.length; i++) {
        var tx   = loansData[i];
        var date = tx.created_at ? new Date(tx.created_at).toLocaleDateString('id-ID', { day:'2-digit', month:'short', year:'numeric' }) : '-';
        var tr   = document.createElement('tr');
        tr.innerHTML =
            '<td>' + (i + 1) + '</td>' +
            '<td class="loan-name-cell"><i class="fa-solid fa-user" style="color:var(--text-muted);margin-right:.4rem;font-size:.8rem;"></i>' + escHtml(tx.nama_peminjam || '-') + '</td>' +
            '<td class="loan-item-cell"><i class="fa-solid fa-tent" style="margin-right:.4rem;font-size:.8rem;"></i>' + escHtml(tx.barang_dipinjam || '-') + '</td>' +
            '<td style="text-align:center;font-weight:700;">' + (tx.jumlah || 1) + ' unit</td>' +
            '<td style="white-space:nowrap;">' + (tx.lama_peminjaman || '-') + ' ' + (tx.satuan || 'hari') + '</td>' +
            '<td><span class="loan-jaminan-cell">' + escHtml(tx.jaminan || '-') + '</span></td>' +
            '<td class="loan-date-cell"><i class="fa-regular fa-calendar" style="margin-right:.3rem;"></i>' + date + '</td>' +
            '<td><button class="return-btn" onclick="returnItem(' + tx.id + ',' + (tx.item_id || 0) + ',' + (tx.jumlah || 1) + ')">' +
                '<i class="fa-solid fa-rotate-left"></i> Kembalikan' +
            '</button></td>';
        tbody.appendChild(tr);
    }
}

function returnItem(txId, itemId, jumlah) {
    if (!confirm('Konfirmasi pengembalian barang?')) return;
    if (!db) { showToast('Koneksi tidak tersedia.', 'error'); return; }

    // 1. Tandai transaksi selesai
    db.from('transactions').update({ status: 'selesai' }).eq('id', txId)
        .then(function (res) {
            if (res.error) { showToast('Gagal update transaksi: ' + res.error.message, 'error'); return; }

            // 2. Kurangi stok_keluar item
            if (itemId) {
                var item = null;
                for (var i = 0; i < allItems.length; i++) { if (allItems[i].id === itemId) { item = allItems[i]; break; } }
                var currentKeluar = item ? (item.stok_keluar || 0) : jumlah;
                var newKeluar     = Math.max(currentKeluar - jumlah, 0);

                db.from('items').update({ stok_keluar: newKeluar }).eq('id', itemId)
                    .then(function () {
                        showToast('Barang berhasil dikembalikan! Stok bertambah ' + jumlah + ' unit.', 'success');
                        fetchData();
                        fetchTransactions();
                    })
                    .catch(function (err) { showToast('Error update stok: ' + err.message, 'error'); });
            } else {
                showToast('Peminjaman ditandai selesai.', 'success');
                fetchTransactions();
            }
        })
        .catch(function (err) { showToast('Error: ' + err.message, 'error'); });
}

function escHtml(str) {
    return String(str)
        .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
        .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

// ============================================================
// HELPERS
// ============================================================
function errorBox(msg) {
    return '<div style="grid-column:1/-1;text-align:center;color:#ef4444;padding:2rem;background:var(--bg-card);border-radius:16px;"><i class="fa-solid fa-triangle-exclamation" style="font-size:2rem;margin-bottom:.75rem;display:block;"></i>' + msg + '</div>';
}
