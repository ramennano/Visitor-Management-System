// Konfigurasi Supabase
const SUPABASE_URL = 'https://tgqadtkvarirvppbgyzu.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRncWFkdGt2YXJpcnZwcGJneXp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA0MzE4NzcsImV4cCI6MjEwNjAwNzg3N30.DGQAgf0qQ_scIn2XHpWSdTDxmnqr-SLyW-HiQ8WqOG0';

let supabaseClient = null;
try {
    if (window.supabase && SUPABASE_URL.includes('https://tgqadtkvarirvppbgyzu.supabase.co')) {
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    }
} catch (e) {
    console.warn('Supabase offline, menggunakan LocalStorage fallback.');
}

const DEFAULT_ID_TYPES = ["KTP", "SIM", "Paspor", "ID Pegawai", "Lainnya"];

// Kamus Bahasa
const dictionary = {
    id: {
        welcome: "Selamat Datang di Portal Tamu",
        subtitle: "Silakan pilih menu di bawah ini untuk melanjutkan.",
        getStarted: "Get Started (Registrasi Tamu)",
        gotoStatus: "Cek Status Kunjungan",
        gotoLogin: "Login Admin & Super Admin",
        regTitle: "Registrasi Tamu",
        fullname: "Nama Lengkap", idType: "Jenis ID", idTypePlaceholder: "Pilih Jenis ID",
        idNumber: "Nomor ID", company: "Asal Instansi / Perusahaan", purpose: "Tujuan Kunjungan", submitReg: "Daftar Sekarang",
        statusTitle: "Cek Status Kunjungan", statusDesc: "Masukkan Nomor Registrasi / ID Tamu Anda untuk memeriksa status approve.", checkStatusBtn: "Cek Status",
        loginTitle: "Login Admin & Super Admin"
    },
    en: {
        welcome: "Welcome to Guest Portal",
        subtitle: "Please select an option below to proceed.",
        getStarted: "Get Started (Guest Registration)",
        gotoStatus: "Check Visit Status",
        gotoLogin: "Admin & Super Admin Login",
        regTitle: "Guest Registration",
        fullname: "Full Name", idType: "ID Type", idTypePlaceholder: "Select ID Type",
        idNumber: "ID Number", company: "Origin Company", purpose: "Purpose of Visit", submitReg: "Register Now",
        statusTitle: "Check Visit Status", statusDesc: "Enter your Registration Number / Guest ID to check approve status.", checkStatusBtn: "Check Status",
        loginTitle: "Admin & Super Admin Login"
    }
};

let currentLang = 'id';
let currentUserRole = null;

function changeLanguage() {
    currentLang = document.getElementById('lang-select').value;
    const t = dictionary[currentLang];
    document.getElementById('txt-welcome').innerText = t.welcome;
    document.getElementById('txt-subtitle').innerText = t.subtitle;
    document.getElementById('btn-get-started').innerText = t.getStarted;
    document.getElementById('btn-goto-status').innerText = t.gotoStatus;
    document.getElementById('btn-goto-login').innerText = t.gotoLogin;
    document.getElementById('txt-reg-title').innerText = t.regTitle;
    document.getElementById('lbl-fullname').innerText = t.fullname;
    document.getElementById('lbl-id-type').innerText = t.idType;
    document.getElementById('lbl-id-number').innerText = t.idNumber;
    document.getElementById('lbl-company').innerText = t.company;
    document.getElementById('lbl-purpose').innerText = t.purpose;
    document.getElementById('btn-submit-reg').innerText = t.submitReg;
    document.getElementById('txt-status-title').innerText = t.statusTitle;
    document.getElementById('txt-status-desc').innerText = t.statusDesc;
    document.getElementById('btn-check-status').innerText = t.checkStatusBtn;
    document.getElementById('txt-login-title').innerText = t.loginTitle;

    loadDropdownData();
}

function showView(viewId) {
    document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
    const target = document.getElementById(viewId);
    if (target) {
        target.classList.add('active');
        sessionStorage.setItem('currentView', viewId);
    }
}

window.onload = async () => {
    await loadWebSettings();
    await loadDropdownData();
    await autoClearOldGuests();

    // Pulihkan Sesi User & Halaman Aktif saat Refresh
    const savedRole = sessionStorage.getItem('currentUserRole');
    const savedView = sessionStorage.getItem('currentView') || 'view-home';
    const savedGuestId = sessionStorage.getItem('lastGuestId');

    if (savedGuestId) {
        const statusInput = document.getElementById('check-guest-id');
        if (statusInput) statusInput.value = savedGuestId;
    }

    if (savedRole) {
        currentUserRole = savedRole;
        if (currentUserRole === 'super_admin') {
            showView('view-superadmin');
            loadApproveUsers();
            loadSuperAdminGuests();
            loadManageApprovedCompanies();
            loadManageIdTypes();
        } else if (currentUserRole === 'admin') {
            showView('view-admin');
            loadAdminGuests();
        }
    } else {
        showView(savedView);
        if (savedView === 'view-status' && savedGuestId) {
            checkStatus();
        }
    }
};

async function loadWebSettings() {
    let settings = {};
    if (supabaseClient) {
        const { data } = await supabaseClient.from('web_settings').select('*');
        if (data) data.forEach(s => settings[s.setting_key] = s.setting_value);
    } else {
        settings = JSON.parse(localStorage.getItem('web_settings') || '{}');
    }

    if (settings.company_name) {
        document.getElementById('app-company-name').innerText = settings.company_name;
        document.title = settings.company_name;
    }
    if (settings.logo_url) {
        const logo = document.getElementById('app-logo');
        logo.src = settings.logo_url; logo.style.display = 'inline-block';
    } else {
        document.getElementById('app-logo').style.display = 'none';
    }
    if (settings.wallpaper_url) {
        document.body.style.backgroundImage = `url('${settings.wallpaper_url}')`;
    } else {
        document.body.style.backgroundImage = 'none';
    }
}

async function loadDropdownData() {
    let companies = [], idTypes = [];

    if (supabaseClient) {
        const compRes = await supabaseClient.from('approved_companies').select('company_name');
        if (compRes.data && compRes.data.length > 0) companies = compRes.data.map(c => c.company_name);

        const idRes = await supabaseClient.from('id_types').select('name');
        if (idRes.data && idRes.data.length > 0) idTypes = idRes.data.map(i => i.name);
        else idTypes = DEFAULT_ID_TYPES;
    } else {
        companies = JSON.parse(localStorage.getItem('approved_companies') || '["PT Maju Bersama", "PT Teknologi Nusantara"]');
        idTypes = JSON.parse(localStorage.getItem('id_types') || JSON.stringify(DEFAULT_ID_TYPES));
    }

    const datalist = document.getElementById('approved-companies-list');
    datalist.innerHTML = '';
    companies.forEach(c => datalist.innerHTML += `<option value="${c}">`);

    const idSelect = document.getElementById('reg-id-type');
    const placeholderText = dictionary[currentLang].idTypePlaceholder;
    
    idSelect.innerHTML = `<option value="" disabled selected>${placeholderText}</option>`;
    idTypes.forEach(id => {
        let opt = document.createElement('option');
        opt.value = id;
        opt.innerText = id;
        idSelect.appendChild(opt);
    });
}

// Auto Clear Data Tamu Lebih dari 1 Hari
async function autoClearOldGuests() {
    const oneDayAgo = new Date().getTime() - (24 * 60 * 60 * 1000);
    if (supabaseClient) {
        // Supabase handling jika ada kolom created_at
        const { data, error } = await supabaseClient.from('guests').select('*');
        if (data) {
            for (let g of data) {
                const createdTime = new Date(g.created_at || Date.now()).getTime();
                if (createdTime < oneDayAgo) {
                    await supabaseClient.from('guests').delete().eq('guest_id', g.guest_id);
                }
            }
        }
    } else {
        let guests = JSON.parse(localStorage.getItem('guests') || '[]');
        guests = guests.filter(g => {
            const createdTime = new Date(g.created_at || Date.now()).getTime();
            return createdTime >= oneDayAgo;
        });
        localStorage.setItem('guests', JSON.stringify(guests));
    }
}

// Registrasi Tamu Baru
async function handleRegister(e) {
    e.preventDefault();
    const guestId = 'GST-' + Math.floor(100000 + Math.random() * 900000);
    const compInput = document.getElementById('reg-company').value.trim();
    const idTypeInput = document.getElementById('reg-id-type').value;

    if (!idTypeInput) return alert("Silakan pilih Jenis ID terlebih dahulu.");

    const newGuest = {
        guest_id: guestId,
        fullname: document.getElementById('reg-name').value.trim(),
        id_type: idTypeInput,
        id_number: document.getElementById('reg-id-number').value.trim(),
        origin_company: compInput,
        purpose: document.getElementById('reg-purpose').value.trim(),
        status: 'Pending',
        created_at: new Date().toISOString()
    };

    if (supabaseClient) {
        const { data: exist } = await supabaseClient.from('approved_companies').select('*').eq('company_name', compInput).maybeSingle();
        if (!exist) await supabaseClient.from('approved_companies').insert([{ company_name: compInput }]);
        await supabaseClient.from('guests').insert([newGuest]);
    } else {
        let guests = JSON.parse(localStorage.getItem('guests') || '[]');
        guests.push(newGuest); 
        localStorage.setItem('guests', JSON.stringify(guests));
        let comps = JSON.parse(localStorage.getItem('approved_companies') || '[]');
        if (!comps.includes(compInput)) { comps.push(compInput); localStorage.setItem('approved_companies', JSON.stringify(comps)); }
    }

    // Simpan ke Session Storage agar tahan saat refresh
    sessionStorage.setItem('lastGuestId', guestId);
    const statusInput = document.getElementById('check-guest-id');
    if (statusInput) statusInput.value = guestId;

    alert(`Registrasi Berhasil!\n\nNomor Registrasi Tamu Anda: ${guestId}`);
    document.getElementById('form-register').reset();
    
    showView('view-status');
    checkStatus();
}

// Cek Status Kunjungan dengan Perbaikan Validasi Data
async function checkStatus() {
    const rawId = document.getElementById('check-guest-id').value;
    if (!rawId) return;
    const id = rawId.trim();
    const resDiv = document.getElementById('status-result');
    resDiv.style.display = 'block';

    sessionStorage.setItem('lastGuestId', id);

    let guest = null;
    if (supabaseClient) {
        const { data, error } = await supabaseClient.from('guests').select('*').ilike('guest_id', id).maybeSingle();
        if (!error) guest = data;
    } else {
        const guests = JSON.parse(localStorage.getItem('guests') || '[]');
        guest = guests.find(g => g.guest_id.toLowerCase() === id.toLowerCase());
    }

    if (!guest) {
        resDiv.className = 'notif rejected'; 
        resDiv.innerText = 'Nomor Registrasi / ID Tamu tidak ditemukan.';
    } else {
        let statusText = '';
        if (guest.status === 'Approved') {
            resDiv.className = 'notif success';
            statusText = '<span style="color:#155724; font-weight:bold;">DISETUJUI (APPROVED)</span>';
        } else if (guest.status === 'Rejected') {
            resDiv.className = 'notif rejected';
            statusText = '<span style="color:#721c24; font-weight:bold;">DITOLAK (REJECTED)</span>';
        } else {
            resDiv.className = 'notif pending';
            statusText = '<span style="color:#856404; font-weight:bold;">MENUNGGU VERIFIKASI (PENDING)</span>';
        }

        resDiv.innerHTML = `
            <div style="text-align: left; padding: 10px; line-height: 1.7; background:#ffffff; border-radius:6px; margin-bottom:8px; border:1px solid #ddd;">
                📌 <strong>Nomor Registrasi Tamu:</strong> <span style="color:#0066cc; font-size:1.1rem; font-weight:bold;">${guest.guest_id}</span><br>
                👤 <strong>Nama Lengkap:</strong> ${guest.fullname}<br>
                🪪 <strong>Jenis & Nomor ID:</strong> ${guest.id_type} - ${guest.id_number}<br>
                🏢 <strong>Asal Perusahaan:</strong> ${guest.origin_company}<br>
                📝 <strong>Tujuan Kunjungan:</strong> ${guest.purpose}<br>
                📊 <strong>Status Akses:</strong> ${statusText}
            </div>
        `;
    }
}

// Login Admin & Super Admin
async function handleLogin(e) {
    e.preventDefault();
    const user = document.getElementById('login-username').value.trim();
    const pass = document.getElementById('login-password').value.trim();

    if (!user || !pass) return alert('Username dan password wajib diisi!');

    let loggedIn = null;

    if (supabaseClient) {
        try {
            const { data, error } = await supabaseClient
                .from('users')
                .select('*')
                .eq('username', user)
                .eq('password', pass)
                .maybeSingle();
            if (!error && data) loggedIn = data;
        } catch (err) {
            console.warn('Gagal auth Supabase.');
        }
    }

    if (!loggedIn) {
        let users = JSON.parse(localStorage.getItem('users') || '[]');
        const defaultUsers = [
            { username: "superadmin", password: "super123", role: "super_admin" },
            { username: "admin", password: "admin123", role: "admin" }
        ];
        defaultUsers.forEach(def => {
            if (!users.some(u => u.username === def.username)) users.push(def);
        });
        localStorage.setItem('users', JSON.stringify(users));
        loggedIn = users.find(u => u.username === user && u.password === pass);
    }

    if (loggedIn) {
        currentUserRole = loggedIn.role;
        sessionStorage.setItem('currentUserRole', currentUserRole);
        document.getElementById('form-login').reset();
        
        if (currentUserRole === 'super_admin') {
            showView('view-superadmin');
            loadApproveUsers();
            loadSuperAdminGuests();
            loadManageApprovedCompanies();
            loadManageIdTypes();
        } else {
            showView('view-admin');
            loadAdminGuests();
        }
    } else {
        alert('Username atau password salah!');
    }
}

function logout() { 
    currentUserRole = null; 
    sessionStorage.removeItem('currentUserRole');
    sessionStorage.removeItem('currentView');
    showView('view-home'); 
}

async function handleResetPassword() {
    const user = document.getElementById('reset-username').value.trim();
    const newPass = document.getElementById('reset-new-password').value.trim();
    if (!user || !newPass) return alert('Lengkapi username dan password baru!');

    if (supabaseClient) {
        await supabaseClient.from('users').update({ password: newPass }).eq('username', user);
    } else {
        let users = JSON.parse(localStorage.getItem('users') || '[]');
        let f = users.find(u => u.username === user);
        if (f) { f.password = newPass; localStorage.setItem('users', JSON.stringify(users)); }
    }
    alert('Password berhasil direset!');
    showView('view-login');
}

// Manajemen User Approve
async function addApproveUser() {
    const u = document.getElementById('new-admin-user').value.trim();
    const p = document.getElementById('new-admin-pass').value.trim();
    if (!u || !p) return alert('Isi username dan password admin baru.');

    if (supabaseClient) {
        await supabaseClient.from('users').insert([{ username: u, password: p, role: 'admin' }]);
    }
    let users = JSON.parse(localStorage.getItem('users') || '[]');
    if (!users.some(x => x.username === u)) {
        users.push({ username: u, password: p, role: 'admin' });
        localStorage.setItem('users', JSON.stringify(users));
    }

    document.getElementById('new-admin-user').value = '';
    document.getElementById('new-admin-pass').value = '';
    await loadApproveUsers();
    await loadSuperAdminGuests();
    alert(`Akun Admin Approve "${u}" berhasil ditambahkan!`);
}

async function loadApproveUsers() {
    let users = [];
    if (supabaseClient) {
        const { data } = await supabaseClient.from('users').select('*').eq('role', 'admin');
        users = data || [];
    } else {
        let arr = JSON.parse(localStorage.getItem('users') || '[]');
        users = arr.filter(x => x.role === 'admin');
    }

    const c = document.getElementById('approve-users-list'); 
    if (c) {
        c.innerHTML = '';
        if (users.length === 0) {
            c.innerHTML = '<small style="color:#666;">Belum ada akun admin approve tambahan.</small>';
            return;
        }
        users.forEach(u => {
            c.innerHTML += `
                <div class="item-row">
                    <span>User Admin: <strong>${u.username}</strong></span>
                    <button onclick="deleteApproveUser('${u.username}')" class="btn-danger" style="width:auto; padding:3px 8px; font-size:0.8rem;">Hapus Akses</button>
                </div>`;
        });
    }
}

async function deleteApproveUser(username) {
    if (confirm(`Hapus akses approve untuk user ${username}?`)) {
        if (supabaseClient) {
            await supabaseClient.from('users').delete().eq('username', username);
        }
        let users = JSON.parse(localStorage.getItem('users') || '[]');
        users = users.filter(x => x.username !== username);
        localStorage.setItem('users', JSON.stringify(users));

        loadApproveUsers();
        loadSuperAdminGuests();
    }
}

async function loadAdminGuests() {
    let guests = [];
    if (supabaseClient) {
        const { data } = await supabaseClient.from('guests').select('*').order('created_at', { ascending: false });
        guests = data || [];
    } else {
        guests = JSON.parse(localStorage.getItem('guests') || '[]');
    }

    const c = document.getElementById('admin-guest-container'); 
    if (c) {
        c.innerHTML = '';
        guests.forEach(g => {
            c.innerHTML += `
                <div class="item-row">
                    <div>
                        <strong>${g.guest_id}</strong> - ${g.fullname}<br>
                        <small>ID: ${g.id_type} (${g.id_number}) | PT: ${g.origin_company}</small><br>
                        <small>Status: <b>${g.status}</b></small>
                    </div>
                    <div class="action-btns">
                        <button onclick="updateGuestStatus('${g.guest_id}', 'Approved')" class="btn-secondary" style="padding:4px 8px; font-size:0.8rem;">Approve</button>
                        <button onclick="updateGuestStatus('${g.guest_id}', 'Rejected')" class="btn-danger" style="padding:4px 8px; font-size:0.8rem;">Reject</button>
                    </div>
                </div>`;
        });
    }
}

async function updateGuestStatus(id, status) {
    if (supabaseClient) {
        await supabaseClient.from('guests').update({ status: status }).eq('guest_id', id);
    } else {
        let guests = JSON.parse(localStorage.getItem('guests') || '[]');
        let g = guests.find(x => x.guest_id === id); 
        if (g) g.status = status;
        localStorage.setItem('guests', JSON.stringify(guests));
    }
    if (currentUserRole === 'super_admin') loadSuperAdminGuests();
    else loadAdminGuests();
}

// Menampilkan Manajemen Akses User Approve di Hak Penuh Persetujuan & Hapus Data Tamu
async function loadSuperAdminGuests() {
    let guests = [];
    if (supabaseClient) {
        const { data } = await supabaseClient.from('guests').select('*').order('created_at', { ascending: false });
        guests = data || [];
    } else {
        guests = JSON.parse(localStorage.getItem('guests') || '[]');
    }

    let adminUsers = [];
    if (supabaseClient) {
        const { data } = await supabaseClient.from('users').select('*').eq('role', 'admin');
        adminUsers = data || [];
    } else {
        let arr = JSON.parse(localStorage.getItem('users') || '[]');
        adminUsers = arr.filter(x => x.role === 'admin');
    }

    const c = document.getElementById('superadmin-guest-container'); 
    if (c) {
        let adminListHtml = `<div style="background:#f8f9fa; padding:10px; border-radius:6px; margin-bottom:15px; border:1px solid #ddd;">
            <strong>ℹ️ Daftar Manajemen Akses User Approve Aktif:</strong><br>`;
        if (adminUsers.length === 0) {
            adminListHtml += `<small style="color:#666;">Belum ada user admin tambahan.</small>`;
        } else {
            adminUsers.forEach(au => {
                adminListHtml += `<small>• <b>${au.username}</b> (Admin Approve)</small><br>`;
            });
        }
        adminListHtml += `</div>`;

        let guestListHtml = '';
        guests.forEach(g => {
            guestListHtml += `
                <div class="item-row">
                    <div>
                        <strong>${g.guest_id}</strong> - ${g.fullname} (${g.origin_company})<br>
                        <small>ID: ${g.id_type} (${g.id_number}) | Status: <b>${g.status}</b></small>
                    </div>
                    <div class="action-btns">
                        <button onclick="updateGuestStatus('${g.guest_id}', 'Approved')" class="btn-secondary" style="padding:3px 6px; font-size:0.75rem;">Approve</button>
                        <button onclick="updateGuestStatus('${g.guest_id}', 'Rejected')" class="btn-danger" style="padding:3px 6px; font-size:0.75rem;">Reject</button>
                        <button onclick="deleteGuestRecord('${g.guest_id}')" class="btn-danger" style="padding:3px 6px; font-size:0.75rem; background:#8b0000;">Hapus Data</button>
                    </div>
                </div>`;
        });

        c.innerHTML = adminListHtml + guestListHtml;
    }
}

async function deleteGuestRecord(id) {
    if (confirm(`Hapus permanen record tamu ${id}?`)) {
        if (supabaseClient) {
            await supabaseClient.from('guests').delete().eq('guest_id', id);
        } else {
            let guests = JSON.parse(localStorage.getItem('guests') || '[]');
            guests = guests.filter(g => g.guest_id !== id);
            localStorage.setItem('guests', JSON.stringify(guests));
        }
        loadSuperAdminGuests();
    }
}

async function saveWebConfiguration() {
    const ptName = document.getElementById('config-pt-name').value.trim();
    const logoFile = document.getElementById('config-logo').files[0];
    const wallFile = document.getElementById('config-wallpaper').files[0];

    let s = JSON.parse(localStorage.getItem('web_settings') || '{}');

    if (ptName) {
        if (supabaseClient) await supabaseClient.from('web_settings').upsert({ setting_key: 'company_name', setting_value: ptName });
        else s.company_name = ptName;
    }
    if (logoFile) {
        const r = new FileReader();
        r.onload = async (e) => {
            if (supabaseClient) await supabaseClient.from('web_settings').upsert({ setting_key: 'logo_url', setting_value: e.target.result });
            else s.logo_url = e.target.result;
            localStorage.setItem('web_settings', JSON.stringify(s)); 
            loadWebSettings();
        }; 
        r.readAsDataURL(logoFile);
    }
    if (wallFile) {
        const r = new FileReader();
        r.onload = async (e) => {
            if (supabaseClient) await supabaseClient.from('web_settings').upsert({ setting_key: 'wallpaper_url', setting_value: e.target.result });
            else s.wallpaper_url = e.target.result;
            localStorage.setItem('web_settings', JSON.stringify(s)); 
            loadWebSettings();
        }; 
        r.readAsDataURL(wallFile);
    }
    if (!supabaseClient) localStorage.setItem('web_settings', JSON.stringify(s));
    alert('Konfigurasi berhasil disimpan!');
    setTimeout(loadWebSettings, 500);
}

async function resetAllConfigurations() {
    if (confirm('Reset seluruh konfigurasi web (Nama PT, Logo, Wallpaper)?')) {
        if (supabaseClient) {
            await supabaseClient.from('web_settings').upsert([
                { setting_key: 'company_name', setting_value: 'PT Solusi Teknologi Indonesia' },
                { setting_key: 'logo_url', setting_value: '' },
                { setting_key: 'wallpaper_url', setting_value: '' }
            ]);
        } else { 
            localStorage.removeItem('web_settings'); 
        }
        loadWebSettings();
        alert('Seluruh konfigurasi web berhasil direset!');
    }
}

async function addApprovedCompany() {
    const c = document.getElementById('new-approved-company').value.trim(); 
    if (!c) return;
    if (supabaseClient) await supabaseClient.from('approved_companies').insert([{ company_name: c }]);
    else { 
        let arr = JSON.parse(localStorage.getItem('approved_companies') || '[]'); 
        arr.push(c); 
        localStorage.setItem('approved_companies', JSON.stringify(arr)); 
    }
    loadManageApprovedCompanies(); 
    loadDropdownData(); 
    document.getElementById('new-approved-company').value = '';
}

async function loadManageApprovedCompanies() {
    let comps = [];
    if (supabaseClient) { 
        const { data } = await supabaseClient.from('approved_companies').select('*'); 
        comps = data || []; 
    } else { 
        let arr = JSON.parse(localStorage.getItem('approved_companies') || '[]'); 
        comps = arr.map(c => ({ company_name: c })); 
    }
    const container = document.getElementById('approved-companies-manage-list'); 
    if (container) {
        container.innerHTML = '';
        comps.forEach(c => container.innerHTML += `<div class="item-row"><span>${c.company_name}</span><button onclick="deleteComp('${c.company_name}')" class="btn-danger" style="width:auto; padding:3px 8px; font-size:0.8rem;">Hapus</button></div>`);
    }
}

async function deleteComp(name) {
    if (supabaseClient) await supabaseClient.from('approved_companies').delete().eq('company_name', name);
    else { 
        let arr = JSON.parse(localStorage.getItem('approved_companies') || '[]'); 
        arr = arr.filter(c => c !== name); 
        localStorage.setItem('approved_companies', JSON.stringify(arr)); 
    }
    loadManageApprovedCompanies(); 
    loadDropdownData();
}

async function addIdType() {
    const t = document.getElementById('new-id-type').value.trim();
    if (!t) return;

    if (supabaseClient) {
        await supabaseClient.from('id_types').insert([{ name: t }]);
    } else {
        let arr = JSON.parse(localStorage.getItem('id_types') || JSON.stringify(DEFAULT_ID_TYPES));
        if (!arr.includes(t)) arr.push(t);
        localStorage.setItem('id_types', JSON.stringify(arr));
    }
    loadManageIdTypes();
    loadDropdownData();
    document.getElementById('new-id-type').value = '';
}

async function loadManageIdTypes() {
    let types = [];
    if (supabaseClient) {
        const { data } = await supabaseClient.from('id_types').select('*');
        types = data || [];
    } else {
        let arr = JSON.parse(localStorage.getItem('id_types') || JSON.stringify(DEFAULT_ID_TYPES));
        types = arr.map(t => ({ name: t }));
    }
    const container = document.getElementById('id-types-manage-list');
    if (container) {
        container.innerHTML = '';
        types.forEach(t => {
            container.innerHTML += `
                <div class="item-row">
                    <span>Jenis ID: <strong>${t.name}</strong></span>
                    <button onclick="deleteId('${t.name}')" class="btn-danger" style="width:auto; padding:3px 8px; font-size:0.8rem;">Hapus</button>
                </div>`;
        });
    }
}

async function deleteId(name) {
    if (confirm(`Hapus Jenis ID "${name}" dari daftar pilihan?`)) {
        if (supabaseClient) {
            await supabaseClient.from('id_types').delete().eq('name', name);
        } else {
            let arr = JSON.parse(localStorage.getItem('id_types') || JSON.stringify(DEFAULT_ID_TYPES));
            arr = arr.filter(t => t !== name);
            localStorage.setItem('id_types', JSON.stringify(arr));
        }
        loadManageIdTypes();
        loadDropdownData();
    }
}