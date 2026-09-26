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
let currentUsername = null;

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
    await cleanupExpiredGuests(); // Auto clear data > 1 hari

    // Pemulihan Sesi & Posisi Halaman saat Refresh
    const savedRole = sessionStorage.getItem('currentUserRole');
    const savedUser = sessionStorage.getItem('currentUsername');
    const savedView = sessionStorage.getItem('currentView');
    const savedGuestId = sessionStorage.getItem('lastGuestId');

    if (savedRole && savedUser) {
        currentUserRole = savedRole;
        currentUsername = savedUser;
        if (currentUserRole === 'super_admin') {
            showView(savedView || 'view-superadmin');
            loadApproveUsers();
            loadSuperAdminGuests();
            loadManageApprovedCompanies();
            loadManageIdTypes();
        } else if (currentUserRole === 'admin') {
            showView(savedView || 'view-admin');
            loadAdminGuests();
        }
    } else if (savedView) {
        showView(savedView);
        if (savedView === 'view-status' && savedGuestId) {
            document.getElementById('check-guest-id').value = savedGuestId;
            checkStatus();
        }
    }
};

// Auto Clear Data Tamu > 1 Hari (24 Jam)
async function cleanupExpiredGuests() {
    const oneDayAgo = new Date(Date.now() - 86400000).toISOString();
    if (supabaseClient) {
        await supabaseClient.from('guests').delete().lt('created_at', oneDayAgo);
    } else {
        let guests = JSON.parse(localStorage.getItem('guests') || '[]');
        guests = guests.filter(g => new Date(g.created_at || Date.now()) > new Date(oneDayAgo));
        localStorage.setItem('guests', JSON.stringify(guests));
    }
}

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

// Registrasi Tamu dengan Auto-Fill & Auto Redirect ke Cek Status
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
        processed_by: '-',
        created_at: new Date().toISOString()
    };

    if (supabaseClient) {
        const { data: exist } = await supabaseClient.from('approved_companies').select('*').eq('company_name', compInput).maybeSingle();
        if (!exist) await supabaseClient.from('approved_companies').insert([{ company_name: compInput }]);
        await supabaseClient.from('guests').insert([newGuest]);
    } else {
        let guests = JSON.parse(localStorage.getItem('guests') || '[]');
        guests.push(newGuest); localStorage.setItem('guests', JSON.stringify(guests));
        let comps = JSON.parse(localStorage.getItem('approved_companies') || '[]');
        if (!comps.includes(compInput)) { comps.push(compInput); localStorage.setItem('approved_companies', JSON.stringify(comps)); }
    }

    sessionStorage.setItem('lastGuestId', guestId);
    const statusInput = document.getElementById('check-guest-id');
    if (statusInput) statusInput.value = guestId;

    alert(`Registrasi Berhasil!\n\nNomor Registrasi Tamu Anda: ${guestId}`);
    document.getElementById('form-register').reset();
    showView('view-status');
    checkStatus();
}

async function checkStatus() {
    const id = document.getElementById('check-guest-id').value.trim();
    const resDiv = document.getElementById('status-result');
    resDiv.style.display = 'block';

    if (!id) {
        resDiv.className = 'notif rejected'; 
        resDiv.innerText = 'Masukkan Nomor Registrasi / ID Tamu terlebih dahulu.'; 
        return;
    }

    sessionStorage.setItem('lastGuestId', id);

    let guest = null;
    if (supabaseClient) {
        const { data } = await supabaseClient.from('guests').select('*').eq('guest_id', id).maybeSingle();
        guest = data;
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
            statusText = '<span style="color:#155724; font-weight:bold;">DISETUJUI (APPROVED)</span>';
        } else if (guest.status === 'Rejected') {
            statusText = '<span style="color:#721c24; font-weight:bold;">DITOLAK (REJECTED)</span>';
        } else {
            statusText = '<span style="color:#856404; font-weight:bold;">MENUNGGU VERIFIKASI (PENDING)</span>';
        }

        resDiv.innerHTML = `
            <div style="text-align: left; padding: 10px; line-height: 1.7; background:#ffffff; border-radius:6px; border:1px solid #ddd;">
                📌 <strong>Nomor Registrasi:</strong> <span style="color:#0066cc; font-weight:bold;">${guest.guest_id}</span><br>
                👤 <strong>Nama:</strong> ${guest.fullname}<br>
                🪪 <strong>ID:</strong> ${guest.id_type} - ${guest.id_number}<br>
                🏢 <strong>Perusahaan:</strong> ${guest.origin_company}<br>
                📝 <strong>Tujuan:</strong> ${guest.purpose}<br>
                📊 <strong>Status:</strong> ${statusText}<br>
                🛠️ <strong>Diproses Oleh:</strong> ${guest.processed_by || '-'}
            </div>
        `;
    }
}

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
        currentUsername = loggedIn.username;
        sessionStorage.setItem('currentUserRole', currentUserRole);
        sessionStorage.setItem('currentUsername', currentUsername);

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
    currentUsername = null;
    sessionStorage.clear();
    showView('view-home'); 
}

async function handleResetPassword() {
    const user = document.getElementById('reset-username').value.trim();
    const newPass = document.getElementById('reset-new-password').value.trim();
    if (!user || !newPass) return alert('Lengkapi data!');

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

async function addApproveUser() {
    const u = document.getElementById('new-admin-user').value.trim();
    const p = document.getElementById('new-admin-pass').value.trim();
    if (!u || !p) return alert('Isi data admin baru.');

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
    loadApproveUsers();
    alert('Admin berhasil ditambahkan!');
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
    c.innerHTML = '';
    users.forEach(u => {
        c.innerHTML += `<div class="item-row"><span><strong>${u.username}</strong></span><button onclick="deleteApproveUser('${u.username}')" class="btn-danger" style="width:auto; padding:3px 8px;">Hapus</button></div>`;
    });
}

async function deleteApproveUser(username) {
    if (confirm(`Hapus ${username}?`)) {
        if (supabaseClient) await supabaseClient.from('users').delete().eq('username', username);
        let users = JSON.parse(localStorage.getItem('users') || '[]');
        users = users.filter(x => x.username !== username);
        localStorage.setItem('users', JSON.stringify(users));
        loadApproveUsers();
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
    c.innerHTML = '';
    guests.forEach(g => {
        c.innerHTML += `
            <div class="item-row">
                <div>
                    <strong>${g.guest_id}</strong> - ${g.fullname}<br>
                    <small>ID: ${g.id_type} (${g.id_number}) | PT: ${g.origin_company}</small><br>
                    <small>Status: <b>${g.status}</b> | Diproses Oleh: <b>${g.processed_by || '-'}</b></small>
                </div>
                <div class="action-btns">
                    <button onclick="updateGuestStatus('${g.guest_id}', 'Approved')" class="btn-secondary" style="padding:4px 8px;">Approve</button>
                    <button onclick="updateGuestStatus('${g.guest_id}', 'Rejected')" class="btn-danger" style="padding:4px 8px;">Reject</button>
                </div>
            </div>`;
    });
}

async function updateGuestStatus(id, status) {
    const updater = currentUsername || currentUserRole || 'Admin';
    if (supabaseClient) {
        await supabaseClient.from('guests').update({ status: status, processed_by: updater }).eq('guest_id', id);
    } else {
        let guests = JSON.parse(localStorage.getItem('guests') || '[]');
        let g = guests.find(x => x.guest_id === id); 
        if (g) { g.status = status; g.processed_by = updater; }
        localStorage.setItem('guests', JSON.stringify(guests));
    }
    if (currentUserRole === 'super_admin') loadSuperAdminGuests();
    else loadAdminGuests();
}

async function loadSuperAdminGuests() {
    let guests = [];
    if (supabaseClient) {
        const { data } = await supabaseClient.from('guests').select('*').order('created_at', { ascending: false });
        guests = data || [];
    } else {
        guests = JSON.parse(localStorage.getItem('guests') || '[]');
    }

    const c = document.getElementById('superadmin-guest-container'); 
    c.innerHTML = '';
    guests.forEach(g => {
        c.innerHTML += `
            <div class="item-row">
                <div>
                    <strong>${g.guest_id}</strong> - ${g.fullname} (${g.origin_company})<br>
                    <small>ID: ${g.id_type} (${g.id_number}) | Status: <b>${g.status}</b></small><br>
                    <small style="color: #0066cc;">👤 Diproses/Di-approve oleh: <b>${g.processed_by || 'Belum diproses'}</b></small>
                </div>
                <div class="action-btns">
                    <button onclick="updateGuestStatus('${g.guest_id}', 'Approved')" class="btn-secondary" style="padding:3px 6px;">Approve</button>
                    <button onclick="updateGuestStatus('${g.guest_id}', 'Rejected')" class="btn-danger" style="padding:3px 6px;">Reject</button>
                    <button onclick="deleteGuestRecord('${g.guest_id}')" class="btn-danger" style="padding:3px 6px; background:#8b0000;">Hapus</button>
                </div>
            </div>`;
    });
}

async function deleteGuestRecord(id) {
    if (confirm(`Hapus permanen tamu ${id}?`)) {
        if (supabaseClient) await supabaseClient.from('guests').delete().eq('guest_id', id);
        else {
            let guests = JSON.parse(localStorage.getItem('guests') || '[]');
            guests = guests.filter(g => g.guest_id !== id);
            localStorage.setItem('guests', JSON.stringify(guests));
        }
        loadSuperAdminGuests();
    }
}

async function saveWebConfiguration() {
    const ptName = document.getElementById('config-pt-name').value.trim();
    if (ptName && supabaseClient) {
        await supabaseClient.from('web_settings').upsert({ setting_key: 'company_name', setting_value: ptName });
    }
    alert('Konfigurasi disimpan!');
    loadWebSettings();
}

async function resetAllConfigurations() {
    if (confirm('Reset konfigurasi?')) {
        if (supabaseClient) await supabaseClient.from('web_settings').delete().neq('setting_key', '');
        localStorage.removeItem('web_settings');
        loadWebSettings();
        alert('Dihapus!');
    }
}

async function addApprovedCompany() {
    const c = document.getElementById('new-approved-company').value.trim(); 
    if (!c) return;
    if (supabaseClient) await supabaseClient.from('approved_companies').insert([{ company_name: c }]);
    loadManageApprovedCompanies(); 
    loadDropdownData(); 
    document.getElementById('new-approved-company').value = '';
}

async function loadManageApprovedCompanies() {
    let comps = [];
    if (supabaseClient) { 
        const { data } = await supabaseClient.from('approved_companies').select('*'); 
        comps = data || []; 
    }
    const container = document.getElementById('approved-companies-manage-list'); 
    container.innerHTML = '';
    comps.forEach(c => container.innerHTML += `<div class="item-row"><span>${c.company_name}</span><button onclick="deleteComp('${c.company_name}')" class="btn-danger" style="width:auto; padding:3px 8px;">Hapus</button></div>`);
}

async function deleteComp(name) {
    if (supabaseClient) await supabaseClient.from('approved_companies').delete().eq('company_name', name);
    loadManageApprovedCompanies(); 
    loadDropdownData();
}

async function addIdType() {
    const t = document.getElementById('new-id-type').value.trim();
    if (!t) return;
    if (supabaseClient) await supabaseClient.from('id_types').insert([{ name: t }]);
    loadManageIdTypes();
    loadDropdownData();
    document.getElementById('new-id-type').value = '';
}

async function loadManageIdTypes() {
    let types = [];
    if (supabaseClient) {
        const { data } = await supabaseClient.from('id_types').select('*');
        types = data || [];
    }
    const container = document.getElementById('id-types-manage-list');
    container.innerHTML = '';
    types.forEach(t => {
        container.innerHTML += `<div class="item-row"><span><strong>${t.name}</strong></span><button onclick="deleteId('${t.name}')" class="btn-danger" style="width:auto; padding:3px 8px;">Hapus</button></div>`;
    });
}

async function deleteId(name) {
    if (confirm(`Hapus Jenis ID ${name}?`)) {
        if (supabaseClient) await supabaseClient.from('id_types').delete().eq('name', name);
        loadManageIdTypes();
        loadDropdownData();
    }
}