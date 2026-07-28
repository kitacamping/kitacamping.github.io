// --- SUPABASE SETUP ---
const supabaseUrl = 'https://bwilqtcnalqsiklerfkl.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ3aWxxdGNuYWxxc2lrbGVyZmtsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUyMTY3OTYsImV4cCI6MjEwMDc5Mjc5Nn0.jeCHJRyuEd_vUWI0iIZT8-uW_f61qeE13W4FKnIvlsQ';
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

// --- STATE ---
let allItems = [];
let currentFilter = 'all';

// --- DOM ELEMENTS ---
const catalogGrid = document.getElementById('catalog-grid');
const loadingIndicator = document.getElementById('loading-indicator');
const filterBtns = document.querySelectorAll('.filter-btn');

const loginOverlay = document.getElementById('login-overlay');
const loginForm = document.getElementById('login-form');
const loginPasswordInput = document.getElementById('login-password');
const loginError = document.getElementById('login-error');

const passwordModal = document.getElementById('password-modal');
const passwordForm = document.getElementById('password-form');
const oldPasswordInput = document.getElementById('old-password');
const newPasswordInput = document.getElementById('new-password');

const itemModal = document.getElementById('item-modal');
const itemForm = document.getElementById('item-form');
const modalTitle = document.getElementById('modal-title');

// --- AUTHENTICATION (STATIC PASSWORD) ---
function checkAuth() {
    const isAuth = localStorage.getItem('isAdmin');
    if (isAuth === 'true') {
        loginOverlay.classList.remove('active');
        fetchData();
    } else {
        loginOverlay.classList.add('active');
    }
}

function getSavedPassword() {
    return localStorage.getItem('adminPassword') || 'YUKCAMPING';
}

loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const pw = loginPasswordInput.value;
    if (pw === getSavedPassword()) {
        localStorage.setItem('isAdmin', 'true');
        loginOverlay.classList.remove('active');
        loginError.style.display = 'none';
        loginPasswordInput.value = '';
        fetchData();
    } else {
        loginError.style.display = 'block';
    }
});

function logout() {
    localStorage.removeItem('isAdmin');
    loginOverlay.classList.add('active');
}

// --- PASSWORD MANAGEMENT ---
function openPasswordModal() { passwordModal.classList.add('active'); }
function closePasswordModal() { 
    passwordModal.classList.remove('active'); 
    passwordForm.reset();
}

passwordForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const oldPw = oldPasswordInput.value;
    const newPw = newPasswordInput.value;
    
    if (oldPw !== getSavedPassword()) {
        alert("Password lama salah!");
        return;
    }
    
    localStorage.setItem('adminPassword', newPw);
    alert("Password berhasil diubah!");
    closePasswordModal();
});

// --- DATA FETCHING (SUPABASE) ---
async function fetchData() {
    loadingIndicator.style.display = 'block';
    catalogGrid.innerHTML = '';
    
    try {
        const { data, error } = await supabase
            .from('items')
            .select('*')
            .order('id', { ascending: false });
            
        if (error) throw error;
        
        allItems = data || [];
        updateAnalytics();
        renderCatalog();
    } catch (err) {
        console.error("Error fetching data:", err);
        // Fallback or alert if table doesn't exist yet
        if(err.message.includes('relation "public.items" does not exist')) {
            catalogGrid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: #ef4444; padding: 2rem; background: var(--bg-card); border-radius: 16px;">Tabel "items" belum dibuat di Supabase. Silakan jalankan perintah SQL yang diberikan oleh AI.</div>';
        } else {
            alert("Gagal mengambil data: " + err.message);
        }
    } finally {
        loadingIndicator.style.display = 'none';
    }
}

// --- ANALYTICS ---
function updateAnalytics() {
    let total = 0;
    let out = 0;
    
    allItems.forEach(item => {
        total += (parseInt(item.stok_total) || 0);
        out += (parseInt(item.stok_keluar) || 0);
    });
    
    let ready = total - out;
    if(ready < 0) ready = 0;
    
    document.getElementById('stat-total').innerText = total;
    document.getElementById('stat-out').innerText = out;
    document.getElementById('stat-ready').innerText = ready;
}

// --- RENDER CATALOG ---
const formatRupiah = (number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(number);
};

function renderCatalog() {
    catalogGrid.innerHTML = '';
    
    let filteredData = allItems;
    if (currentFilter !== 'all') {
        filteredData = allItems.filter(item => item.kategori === currentFilter);
    }
    
    if (filteredData.length === 0) {
        catalogGrid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--text-muted);">Tidak ada barang ditemukan.</p>';
        return;
    }
    
    filteredData.forEach(item => {
        const sisa = (item.stok_total || 0) - (item.stok_keluar || 0);
        const card = document.createElement('div');
        card.className = 'card';
        card.innerHTML = `
            <div class="card-img-wrapper">
                <img src="${item.gambar_url || 'https://via.placeholder.com/300?text=No+Image'}" alt="${item.nama}" class="card-img" onerror="this.src='https://via.placeholder.com/300?text=Error'">
                <div class="stock-badge" style="color: ${sisa > 0 ? '#10b981' : '#ef4444'};">
                    Sisa: ${sisa > 0 ? sisa : 'Habis'}
                </div>
            </div>
            <div class="card-content">
                <span class="card-category">${item.kategori}</span>
                <h3 class="card-title">${item.nama}</h3>
                <p class="card-desc">${item.deskripsi}</p>
                <div class="price">${formatRupiah(item.harga)}<span>/hari</span></div>
                
                <div class="admin-actions">
                    <button class="action-btn edit-btn" onclick="openEditModal(${item.id})"><i class="fa-solid fa-pen"></i> Edit</button>
                    <button class="action-btn del-btn" onclick="deleteItem(${item.id})"><i class="fa-solid fa-trash"></i> Hapus</button>
                </div>
            </div>
        `;
        catalogGrid.appendChild(card);
    });
}

// --- FILTERING ---
filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        filterBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentFilter = btn.getAttribute('data-filter');
        renderCatalog();
    });
});

// --- ITEM MANAGEMENT (CRUD) ---
function openItemModal() {
    modalTitle.innerText = 'Tambah Barang Baru';
    document.getElementById('item-id').value = '';
    itemForm.reset();
    itemModal.classList.add('active');
}

function openEditModal(id) {
    const item = allItems.find(i => i.id === id);
    if(!item) return;
    
    modalTitle.innerText = 'Edit Barang';
    document.getElementById('item-id').value = item.id;
    document.getElementById('item-name').value = item.nama;
    document.getElementById('item-category').value = item.kategori;
    document.getElementById('item-price').value = item.harga;
    document.getElementById('item-image').value = item.gambar_url;
    document.getElementById('item-stock-total').value = item.stok_total;
    document.getElementById('item-stock-out').value = item.stok_keluar;
    document.getElementById('item-desc').value = item.deskripsi;
    
    itemModal.classList.add('active');
}

function closeItemModal() {
    itemModal.classList.remove('active');
}

itemForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('item-id').value;
    const itemData = {
        nama: document.getElementById('item-name').value,
        kategori: document.getElementById('item-category').value,
        harga: parseInt(document.getElementById('item-price').value),
        gambar_url: document.getElementById('item-image').value,
        stok_total: parseInt(document.getElementById('item-stock-total').value),
        stok_keluar: parseInt(document.getElementById('item-stock-out').value),
        deskripsi: document.getElementById('item-desc').value,
    };
    
    try {
        if (id) {
            // Update
            const { error } = await supabase.from('items').update(itemData).eq('id', id);
            if (error) throw error;
            alert("Barang berhasil diperbarui!");
        } else {
            // Insert
            const { error } = await supabase.from('items').insert([itemData]);
            if (error) throw error;
            alert("Barang berhasil ditambahkan!");
        }
        closeItemModal();
        fetchData(); // Refresh data
    } catch (err) {
        alert("Gagal menyimpan data: " + err.message);
    }
});

async function deleteItem(id) {
    if(!confirm("Yakin ingin menghapus barang ini?")) return;
    
    try {
        const { error } = await supabase.from('items').delete().eq('id', id);
        if (error) throw error;
        alert("Barang berhasil dihapus!");
        fetchData();
    } catch (err) {
        alert("Gagal menghapus data: " + err.message);
    }
}

// --- INIT ---
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
});
