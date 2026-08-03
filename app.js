// ============================================================
// KITACAMPING INVENTARIS — app.js v4
// ============================================================

// --- SUPABASE SETUP ---
const SUPABASE_URL = 'https://bwilqtcnalqsiklerfkl.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ3aWxxdGNuYWxxc2lrbGVyZmtsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUyMTY3OTYsImV4cCI6MjEwMDc5Mjc5Nn0.jeCHJRyuEd_vUWI0iIZT8-uW_f61qeE13W4FKnIvlsQ';

let db = null;
let allItems = [];
let currentFilter = 'all';

// Init Supabase setelah halaman selesai dimuat
window.addEventListener('DOMContentLoaded', () => {
    try {
        if (window.supabase) {
            db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
            console.log('Supabase terhubung.');
        } else {
            console.error('Supabase SDK tidak ditemukan.');
        }
    } catch (e) {
        console.error('Gagal inisialisasi Supabase:', e);
    }

    checkAuth();
    initFilterButtons();
});

// ============================================================
// AUTENTIKASI
// ============================================================

function checkAuth() {
    const isAuth = localStorage.getItem('kc_isAdmin');
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

// Dipanggil dari tombol "Masuk" di HTML (onclick)
function handleLogin() {
    const pw = document.getElementById('login-password').value.trim();
    const correct = 'YUKCAMPING';
    const errEl = document.getElementById('login-error');

    if (!pw) return;

    if (pw === correct) {
        localStorage.setItem('kc_isAdmin', 'true');
        errEl.style.display = 'none';
        document.getElementById('login-password').value = '';
        showDashboard();
    } else {
        errEl.style.display = 'block';
    }
}

// Dipanggil dari tombol "Keluar" di navbar
function handleLogout() {
    localStorage.removeItem('kc_isAdmin');
    showLogin();
}

// ============================================================
// DATA — SUPABASE CRUD
// ============================================================

async function fetchData() {
    const grid = document.getElementById('catalog-grid');
    const loader = document.getElementById('loading-indicator');

    loader.style.display = 'block';
    grid.innerHTML = '';

    if (!db) {
        grid.innerHTML = errorBox('Koneksi Supabase gagal. Pastikan Anda terhubung ke internet dan coba refresh halaman.');
        loader.style.display = 'none';
        return;
    }

    try {
        const { data, error } = await db
            .from('items')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        allItems = data || [];
        updateStats();
        renderCatalog();
    } catch (err) {
        console.error('fetchData error:', err);
        grid.innerHTML = errorBox('Gagal memuat data: ' + err.message);
    } finally {
        loader.style.display = 'none';
    }
}

// Dipanggil dari tombol "Simpan" di modal (onclick)
async function submitItemForm() {
    const id       = document.getElementById('item-id').value;
    const nama     = document.getElementById('item-name').value.trim();
    const kategori = document.getElementById('item-category').value;
    const harga    = parseInt(document.getElementById('item-price').value) || 0;
    const gambar   = document.getElementById('item-image').value.trim();
    const total    = parseInt(document.getElementById('item-stock-total').value) || 1;
    const keluar   = parseInt(document.getElementById('item-stock-out').value) || 0;
    const deskripsi= document.getElementById('item-desc').value.trim();

    // Validasi sederhana
    if (!nama || !gambar || !deskripsi) {
        showToast('Harap isi semua kolom!', 'error');
        return;
    }
    if (keluar > total) {
        showToast('Stok keluar tidak boleh melebihi stok total!', 'error');
        return;
    }

    const payload = { nama, kategori, harga, gambar_url: gambar, stok_total: total, stok_keluar: keluar, deskripsi };

    if (!db) {
        showToast('Koneksi database tidak tersedia.', 'error');
        return;
    }

    try {
        if (id) {
            // UPDATE
            const { error } = await db.from('items').update(payload).eq('id', parseInt(id));
            if (error) throw error;
            showToast('Barang berhasil diperbarui!', 'success');
        } else {
            // INSERT
            const { error } = await db.from('items').insert([payload]);
            if (error) throw error;
            showToast('Barang berhasil ditambahkan!', 'success');
        }
        closeItemModal();
        fetchData();
    } catch (err) {
        console.error('submitItemForm error:', err);
        showToast('Gagal menyimpan: ' + err.message, 'error');
    }
}

async function deleteItem(id) {
    if (!confirm('Yakin ingin menghapus barang ini?')) return;

    if (!db) { showToast('Koneksi database tidak tersedia.', 'error'); return; }

    try {
        const { error } = await db.from('items').delete().eq('id', id);
        if (error) throw error;
        showToast('Barang berhasil dihapus!', 'success');
        fetchData();
    } catch (err) {
        console.error('deleteItem error:', err);
        showToast('Gagal menghapus: ' + err.message, 'error');
    }
}

// ============================================================
// MODAL BARANG
// ============================================================

function openItemModal() {
    document.getElementById('modal-title').innerText = 'Tambah Barang Baru';
    document.getElementById('item-id').value = '';
    document.getElementById('item-form').reset();
    // Reset default values
    document.getElementById('item-stock-total').value = '1';
    document.getElementById('item-stock-out').value = '0';
    document.getElementById('item-modal').classList.add('active');
}

function openEditModal(id) {
    const item = allItems.find(i => i.id === id);
    if (!item) { showToast('Data barang tidak ditemukan.', 'error'); return; }

    document.getElementById('modal-title').innerText = 'Edit Barang';
    document.getElementById('item-id').value            = item.id;
    document.getElementById('item-name').value          = item.nama || '';
    document.getElementById('item-category').value      = item.kategori || 'lainnya';
    document.getElementById('item-price').value         = item.harga || 0;
    document.getElementById('item-image').value         = item.gambar_url || '';
    document.getElementById('item-stock-total').value   = item.stok_total || 1;
    document.getElementById('item-stock-out').value     = item.stok_keluar || 0;
    document.getElementById('item-desc').value          = item.deskripsi || '';

    document.getElementById('item-modal').classList.add('active');
}

function closeItemModal() {
    document.getElementById('item-modal').classList.remove('active');
    document.getElementById('item-form').reset();
}

// ============================================================
// RENDER & FILTER
// ============================================================

const formatRupiah = (n) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n || 0);

function updateStats() {
    let total = 0, out = 0;
    allItems.forEach(item => {
        total += parseInt(item.stok_total) || 0;
        out   += parseInt(item.stok_keluar) || 0;
    });
    const ready = Math.max(total - out, 0);
    document.getElementById('stat-total').innerText = total;
    document.getElementById('stat-out').innerText   = out;
    document.getElementById('stat-ready').innerText = ready;
}

function renderCatalog() {
    const grid = document.getElementById('catalog-grid');
    grid.innerHTML = '';

    const filtered = currentFilter === 'all'
        ? allItems
        : allItems.filter(i => i.kategori === currentFilter);

    if (filtered.length === 0) {
        grid.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:var(--text-muted);padding:3rem 0;">Tidak ada barang ditemukan.</p>';
        return;
    }

    filtered.forEach(item => {
        const sisa = Math.max((item.stok_total || 0) - (item.stok_keluar || 0), 0);
        const sisaColor  = sisa > 0 ? '#10b981' : '#ef4444';
        const sisaLabel  = sisa > 0 ? `Sisa: ${sisa}` : 'Habis';
        const imgFallback = 'https://placehold.co/300x200/1e293b/f59e0b?text=No+Image';

        const card = document.createElement('div');
        card.className = 'card';
        card.innerHTML = `
            <div class="card-img-wrapper">
                <img src="${item.gambar_url || imgFallback}"
                     alt="${item.nama}"
                     class="card-img"
                     onerror="this.src='${imgFallback}'">
                <div class="stock-badge" style="color:${sisaColor};">${sisaLabel}</div>
            </div>
            <div class="card-content">
                <span class="card-category">${item.kategori || '-'}</span>
                <h3 class="card-title">${item.nama || '-'}</h3>
                <p class="card-desc">${item.deskripsi || ''}</p>
                <div class="price">${formatRupiah(item.harga)}<span>/hari</span></div>
                <div class="admin-actions">
                    <button class="action-btn edit-btn" onclick="openEditModal(${item.id})">
                        <i class="fa-solid fa-pen"></i> Edit
                    </button>
                    <button class="action-btn del-btn" onclick="deleteItem(${item.id})">
                        <i class="fa-solid fa-trash"></i> Hapus
                    </button>
                </div>
            </div>
        `;
        grid.appendChild(card);
    });
}

function initFilterButtons() {
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.getAttribute('data-filter');
            renderCatalog();
        });
    });
}

// ============================================================
// TOAST NOTIFICATION
// ============================================================

function showToast(message, type = 'success') {
    const existing = document.getElementById('kc-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'kc-toast';
    toast.style.cssText = `
        position: fixed; bottom: 2rem; right: 2rem; z-index: 9999;
        padding: 1rem 1.5rem; border-radius: 12px; color: #fff;
        font-family: 'Outfit', sans-serif; font-size: 0.95rem;
        background: ${type === 'success' ? '#10b981' : '#ef4444'};
        box-shadow: 0 8px 32px rgba(0,0,0,0.3);
        display: flex; align-items: center; gap: 0.6rem;
        animation: slideInToast 0.3s ease;
    `;
    toast.innerHTML = `<i class="fa-solid fa-${type === 'success' ? 'circle-check' : 'circle-exclamation'}"></i> ${message}`;

    // Add animation style once
    if (!document.getElementById('toast-style')) {
        const style = document.createElement('style');
        style.id = 'toast-style';
        style.textContent = `
            @keyframes slideInToast {
                from { opacity: 0; transform: translateY(20px); }
                to   { opacity: 1; transform: translateY(0); }
            }
        `;
        document.head.appendChild(style);
    }

    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

// ============================================================
// HELPERS
// ============================================================

function errorBox(msg) {
    return `<div style="grid-column:1/-1;text-align:center;color:#ef4444;
        padding:2rem;background:var(--bg-card);border-radius:16px;">
        <i class="fa-solid fa-triangle-exclamation" style="font-size:2rem;margin-bottom:1rem;display:block;"></i>
        ${msg}</div>`;
}
