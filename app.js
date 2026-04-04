// ── Config ────────────────────────────────────────────────────────────────────
const API = 'https://delta-server-vyed.onrender.com';

// ── State ─────────────────────────────────────────────────────────────────────
let state = {
  user: null,
  token: null,
  files: [],
  currentView: 'home',
  currentFilter: 'all',
  currentSort: 'newest',
  viewMode: 'list',
  selectedAvatar: null,
  cmdSelected: 0,
  cmdItems: [],
  uploadFile: null,
  uploadPublic: true,
  searchQuery: '',
};

// ── Avatar seeds ──────────────────────────────────────────────────────────────
const AVATAR_SEEDS = ['alpha','beta','gamma','delta','echo','foxtrot','golf','hotel','india','juliet','kilo','lima'];

// ── Init ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadAuth();
  renderNavActions();
  navigate('home');
  initKeyboard();
  initSearch();
  buildAvatarPicker();
  initPasswordStrength();
});

// ── Auth ──────────────────────────────────────────────────────────────────────
function loadAuth() {
  const token = localStorage.getItem('delta_token');
  const user = localStorage.getItem('delta_user');
  if (token && user) {
    state.token = token;
    state.user = JSON.parse(user);
  }
}

async function handleLogin() {
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;
  if (!username || !password) { toast('Please fill in all fields', 'error'); return; }
  const btn = document.querySelector('#login-form .btn-primary');
  setLoading(btn, true);
  try {
    const res = await api('POST', '/auth/login', { username, password });
    state.token = res.token;
    state.user = res.user;
    localStorage.setItem('delta_token', res.token);
    localStorage.setItem('delta_user', JSON.stringify(res.user));
    closeAuthModal();
    renderNavActions();
    toast(`Welcome back, ${res.user.username}! 👋`, 'success');
    navigate('home');
  } catch (e) {
    toast(e.message || 'Login failed', 'error');
  } finally {
    setLoading(btn, false);
  }
}

async function handleRegister() {
  const username = document.getElementById('reg-username').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const password = document.getElementById('reg-password').value;
  if (!username || !email || !password) { toast('Please fill in all fields', 'error'); return; }
  if (password.length < 6) { toast('Password must be at least 6 characters', 'error'); return; }
  const avatar = state.selectedAvatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${username}`;
  const btn = document.querySelector('#register-form .btn-primary');
  setLoading(btn, true);
  try {
    const res = await api('POST', '/auth/register', { username, email, password, avatar });
    state.token = res.token;
    state.user = res.user;
    localStorage.setItem('delta_token', res.token);
    localStorage.setItem('delta_user', JSON.stringify(res.user));
    closeAuthModal();
    renderNavActions();
    toast(`Welcome to Delta, ${username}! 🎉`, 'success');
    navigate('home');
  } catch (e) {
    toast(e.message || 'Registration failed', 'error');
  } finally {
    setLoading(btn, false);
  }
}

function logout() {
  state.user = null;
  state.token = null;
  localStorage.removeItem('delta_token');
  localStorage.removeItem('delta_user');
  renderNavActions();
  navigate('home');
  toast('Signed out successfully', 'info');
  closeDropdown();
}

function switchAuthMode(mode) {
  const isReg = mode === 'register';
  document.getElementById('login-form').classList.toggle('hidden', isReg);
  document.getElementById('register-form').classList.toggle('hidden', !isReg);
  document.getElementById('auth-modal-title').textContent = isReg ? 'Create your account' : 'Sign in to Delta';
  document.getElementById('auth-modal-sub').textContent = isReg ? 'Start sharing files today.' : 'Share files with the world.';
}

function openAuthModal(mode = 'login') {
  document.getElementById('auth-modal').classList.remove('hidden');
  switchAuthMode(mode);
}
function closeAuthModal() { document.getElementById('auth-modal').classList.add('hidden'); }

// ── Nav ───────────────────────────────────────────────────────────────────────
function renderNavActions() {
  const el = document.getElementById('nav-actions');
  if (state.user) {
    el.innerHTML = `
      <button class="btn btn-primary btn-sm" onclick="navigate('upload')">
        <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor"><path d="M8.75 1.75a.75.75 0 0 0-1.5 0V5H4a.75.75 0 0 0 0 1.5h3.25v3.25a.75.75 0 0 0 1.5 0V6.5H12A.75.75 0 0 0 12 5H8.75V1.75Z"/></svg>
        Upload
      </button>
      <div class="nav-divider"></div>
      <div class="dropdown" id="user-dropdown">
        <div onclick="toggleDropdown()" style="display:flex;align-items:center;gap:8px;cursor:pointer;">
          <img src="${state.user.avatar}" class="nav-avatar" alt="${state.user.username}" />
          <span class="nav-username">${state.user.username}</span>
          <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor" style="color:var(--text-muted)"><path d="M4.427 7.427l3.396 3.396a.25.25 0 0 0 .354 0l3.396-3.396A.25.25 0 0 0 11.396 7H4.604a.25.25 0 0 0-.177.427Z"/></svg>
        </div>
        <div class="dropdown-menu hidden" id="user-dropdown-menu">
          <div class="dropdown-header">Signed in as <strong>${state.user.username}</strong></div>
          <div class="dropdown-divider"></div>
          <div class="dropdown-item" onclick="openProfileModal()">
            <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M10.561 8.073a6.005 6.005 0 0 1 3.432 5.142.75.75 0 1 1-1.498.07 4.5 4.5 0 0 0-8.99 0 .75.75 0 0 1-1.498-.07 6.004 6.004 0 0 1 3.431-5.142 3.999 3.999 0 1 1 5.123 0ZM10.5 5a2.5 2.5 0 1 0-5 0 2.5 2.5 0 0 0 5 0Z"/></svg>
            Your profile
          </div>
          <div class="dropdown-item" onclick="navigate('my-files');closeDropdown()">
            <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M1.75 1A1.75 1.75 0 0 0 0 2.75v10.5C0 14.216.784 15 1.75 15h12.5A1.75 1.75 0 0 0 16 13.25v-8.5A1.75 1.75 0 0 0 14.25 3H7.5a.25.25 0 0 1-.2-.1l-.9-1.2C6.07 1.26 5.55 1 5 1Z"/></svg>
            Your files
          </div>
          <div class="dropdown-item" onclick="navigate('upload');closeDropdown()">
            <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M8.75 1.75a.75.75 0 0 0-1.5 0V5H4a.75.75 0 0 0 0 1.5h3.25v3.25a.75.75 0 0 0 1.5 0V6.5H12A.75.75 0 0 0 12 5H8.75V1.75Zm-6 9.5a.75.75 0 0 0 0 1.5h10.5a.75.75 0 0 0 0-1.5H2.75Z"/></svg>
            Upload file
          </div>
          <div class="dropdown-divider"></div>
          <div class="dropdown-item danger" onclick="logout()">
            <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M2 2.75C2 1.784 2.784 1 3.75 1h2.5a.75.75 0 0 1 0 1.5h-2.5a.25.25 0 0 0-.25.25v10.5c0 .138.112.25.25.25h2.5a.75.75 0 0 1 0 1.5h-2.5A1.75 1.75 0 0 1 2 13.25Zm10.44 4.5-1.97-1.97a.749.749 0 0 1 .326-1.275.749.749 0 0 1 .734.215l3.25 3.25a.75.75 0 0 1 0 1.06l-3.25 3.25a.749.749 0 0 1-1.275-.326.749.749 0 0 1 .215-.734l1.97-1.97H6.75a.75.75 0 0 1 0-1.5Z"/></svg>
            Sign out
          </div>
        </div>
      </div>
    `;
  } else {
    el.innerHTML = `
      <button class="btn btn-ghost btn-sm" onclick="openAuthModal('login')">Sign in</button>
      <button class="btn btn-primary btn-sm" onclick="openAuthModal('register')">Sign up</button>
    `;
  }
}

function toggleDropdown() {
  document.getElementById('user-dropdown-menu')?.classList.toggle('hidden');
}
function closeDropdown() {
  document.getElementById('user-dropdown-menu')?.classList.add('hidden');
}
document.addEventListener('click', e => {
  if (!e.target.closest('#user-dropdown')) closeDropdown();
});

// ── Navigation ────────────────────────────────────────────────────────────────
function navigate(view) {
  state.currentView = view;
  document.querySelectorAll('.sidebar-item').forEach(el => {
    el.classList.toggle('active', el.dataset.view === view);
  });
  const main = document.getElementById('main-content');
  switch (view) {
    case 'home': renderHome(main); break;
    case 'explore': renderExplore(main); break;
    case 'my-files': renderMyFiles(main); break;
    case 'upload': renderUpload(main); break;
    default: renderHome(main);
  }
}

// ── Views ─────────────────────────────────────────────────────────────────────
async function renderHome(el) {
  el.innerHTML = `
    ${state.user ? renderDashboard() : renderLanding()}
  `;
  if (state.user) {
    loadStats();
    loadRecentFiles('recent-files-list', state.user.username);
  } else {
    loadExploreFiles('featured-files', 6);
  }
}

function renderLanding() {
  return `
    <div class="hero">
      <div class="hero-badge">
        <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor"><path d="M8 .25a7.75 7.75 0 1 0 0 15.5A7.75 7.75 0 0 0 8 .25Z"/></svg>
        Open file sharing platform
      </div>
      <h1>Share files with the world</h1>
      <p>Delta is a modern file sharing platform built on GitHub. Upload, manage, and share files with a familiar developer-friendly interface.</p>
      <div class="hero-actions">
        <button class="btn btn-primary" onclick="openAuthModal('register')">
          <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M8.75 1.75a.75.75 0 0 0-1.5 0V5H4a.75.75 0 0 0 0 1.5h3.25v3.25a.75.75 0 0 0 1.5 0V6.5H12A.75.75 0 0 0 12 5H8.75V1.75Z"/></svg>
          Get started free
        </button>
        <button class="btn btn-secondary" onclick="navigate('explore')">Browse files</button>
      </div>
    </div>

    <div class="stats-grid" id="platform-stats">
      ${['📁','👤','⬆️'].map(i=>`<div class="stat-card"><div class="stat-icon">${i}</div><div class="skeleton" style="height:32px;width:80px;margin-bottom:4px;border-radius:4px;"></div><div class="skeleton" style="height:14px;width:120px;border-radius:4px;"></div></div>`).join('')}
    </div>

    <div class="section-header"><h2>Featured files</h2><button class="btn btn-ghost btn-sm" onclick="navigate('explore')">Browse all →</button></div>
    <div class="card">
      <div id="featured-files" class="file-list">
        ${skeletonRows(5)}
      </div>
    </div>
  `;
  loadPlatformStats();
}

function renderDashboard() {
  return `
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:24px;">
      <img src="${state.user.avatar}" style="width:48px;height:48px;border-radius:50%;border:2px solid var(--border);" />
      <div>
        <h1 style="font-size:20px;font-weight:700;">Good ${getGreeting()}, ${state.user.username} 👋</h1>
        <p style="color:var(--text-secondary);font-size:13px;">Here's what's happening with your files.</p>
      </div>
    </div>

    <div class="stats-grid" id="user-stats">
      ${skeletonStats(3)}
    </div>

    <div class="section-header" style="margin-top:8px;">
      <h2>Your recent files</h2>
      <button class="btn btn-ghost btn-sm" onclick="navigate('my-files')">View all →</button>
    </div>
    <div class="card">
      <div id="recent-files-list" class="file-list">${skeletonRows(3)}</div>
    </div>

    <div class="section-header" style="margin-top:24px;"><h2>Quick actions</h2></div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px;">
      ${quickAction('📤','Upload a file','Share something new','navigate(\'upload\')')}
      ${quickAction('🔍','Explore files','See what others shared','navigate(\'explore\')')}
      ${quickAction('👤','Edit profile','Update your info','openProfileModal()')}
    </div>
  `;
}

function quickAction(icon, title, desc, onclick) {
  return `
    <div class="card" style="cursor:pointer;transition:border-color .15s,transform .15s;" onclick="${onclick}" onmouseover="this.style.borderColor='var(--accent)';this.style.transform='translateY(-1px)'" onmouseout="this.style.borderColor='';this.style.transform=''">
      <div class="card-body" style="display:flex;align-items:flex-start;gap:12px;">
        <div style="font-size:24px;">${icon}</div>
        <div>
          <div style="font-weight:600;font-size:13px;margin-bottom:2px;">${title}</div>
          <div style="font-size:12px;color:var(--text-muted);">${desc}</div>
        </div>
      </div>
    </div>
  `;
}

async function renderExplore(el) {
  el.innerHTML = `
    <div class="breadcrumb">
      <span class="breadcrumb-item" onclick="navigate('home')">Home</span>
      <span class="breadcrumb-sep">/</span>
      <span class="breadcrumb-item active">Explore</span>
    </div>
    <div class="section-header">
      <div><h2>Explore files</h2><p style="color:var(--text-secondary);font-size:13px;margin-top:2px;">Browse public files from the community</p></div>
    </div>
    <div class="filter-bar">
      ${['all','images','documents','code','archives'].map(f => `
        <div class="filter-chip ${state.currentFilter===f?'active':''}" onclick="setFilter('${f}')">${filterLabel(f)}</div>
      `).join('')}
      <div class="spacer"></div>
      <select onchange="setSort(this.value)" style="font-size:12px;padding:4px 8px;background:var(--bg-secondary);border:1px solid var(--border);border-radius:6px;color:var(--text-primary);cursor:pointer;">
        <option value="newest" ${state.currentSort==='newest'?'selected':''}>Newest</option>
        <option value="oldest" ${state.currentSort==='oldest'?'selected':''}>Oldest</option>
        <option value="largest" ${state.currentSort==='largest'?'selected':''}>Largest</option>
        <option value="name" ${state.currentSort==='name'?'selected':''}>Name A-Z</option>
      </select>
      <div class="view-toggle">
        <button class="view-btn ${state.viewMode==='list'?'active':''}" onclick="setViewMode('list')">
          <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor"><path d="M2 4.25a.75.75 0 0 1 .75-.75h10.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 4.25ZM2 8a.75.75 0 0 1 .75-.75h10.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 8Zm0 3.75a.75.75 0 0 1 .75-.75h10.5a.75.75 0 0 1 0 1.5H2.75a.75.75 0 0 1-.75-.75Z"/></svg>
        </button>
        <button class="view-btn ${state.viewMode==='grid'?'active':''}" onclick="setViewMode('grid')">
          <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor"><path d="M1 2.5A1.5 1.5 0 0 1 2.5 1h3A1.5 1.5 0 0 1 7 2.5v3A1.5 1.5 0 0 1 5.5 7h-3A1.5 1.5 0 0 1 1 5.5Zm8.5-1.5A1.5 1.5 0 0 0 8 2.5v3A1.5 1.5 0 0 0 9.5 7h3A1.5 1.5 0 0 0 14 5.5v-3A1.5 1.5 0 0 0 12.5 1ZM1 9.5A1.5 1.5 0 0 1 2.5 8h3A1.5 1.5 0 0 1 7 9.5v3A1.5 1.5 0 0 1 5.5 14h-3A1.5 1.5 0 0 1 1 12.5Zm8.5-1.5A1.5 1.5 0 0 0 8 9.5v3A1.5 1.5 0 0 0 9.5 14h3a1.5 1.5 0 0 0 1.5-1.5v-3A1.5 1.5 0 0 0 12.5 8Z"/></svg>
        </button>
      </div>
    </div>
    <div id="explore-files">
      ${state.viewMode === 'grid' ? '<div class="file-grid" id="files-container"></div>' : '<div class="card"><div class="file-list" id="files-container"></div></div>'}
    </div>
  `;
  loadExploreFiles('files-container', 50);
}

async function renderMyFiles(el) {
  if (!state.user) {
    el.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🔒</div>
        <h3>Sign in required</h3>
        <p>Please sign in to view your files.</p>
        <button class="btn btn-primary" onclick="openAuthModal('login')">Sign in</button>
      </div>
    `;
    return;
  }
  el.innerHTML = `
    <div class="breadcrumb">
      <span class="breadcrumb-item" onclick="navigate('home')">Home</span>
      <span class="breadcrumb-sep">/</span>
      <span class="breadcrumb-item active">My Files</span>
    </div>
    <div class="section-header">
      <div><h2>My Files</h2><p style="color:var(--text-secondary);font-size:13px;margin-top:2px;">Manage your uploaded files</p></div>
      <button class="btn btn-primary btn-sm" onclick="navigate('upload')">
        <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor"><path d="M8.75 1.75a.75.75 0 0 0-1.5 0V5H4a.75.75 0 0 0 0 1.5h3.25v3.25a.75.75 0 0 0 1.5 0V6.5H12A.75.75 0 0 0 12 5H8.75V1.75Z"/></svg>
        Upload new
      </button>
    </div>
    <div class="card">
      <div id="my-files-list" class="file-list">${skeletonRows(4)}</div>
    </div>
  `;
  loadRecentFiles('my-files-list', state.user.username, true);
}

async function renderUpload(el) {
  if (!state.user) {
    el.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🔒</div>
        <h3>Sign in required</h3>
        <p>Please sign in to upload files.</p>
        <button class="btn btn-primary" onclick="openAuthModal('login')">Sign in</button>
      </div>
    `;
    return;
  }
  el.innerHTML = `
    <div class="breadcrumb">
      <span class="breadcrumb-item" onclick="navigate('home')">Home</span>
      <span class="breadcrumb-sep">/</span>
      <span class="breadcrumb-item active">Upload</span>
    </div>
    <div class="section-header"><h2>Upload a file</h2></div>
    <div style="max-width:560px;">
      <div class="upload-zone" id="upload-zone" onclick="document.getElementById('file-input').click()" ondragover="handleDragOver(event)" ondragleave="handleDragLeave(event)" ondrop="handleDrop(event)">
        <input type="file" id="file-input" onchange="handleFileSelect(event)" />
        <div class="upload-icon">📂</div>
        <h3>Drop files here or click to browse</h3>
        <p>Supports any file type · Max 50 MB</p>
      </div>

      <div id="upload-file-preview" class="hidden" style="margin-top:16px;"></div>

      <div id="upload-form-fields" class="hidden upload-form" style="margin-top:20px;">
        <div class="form-group">
          <label>Description <span style="color:var(--text-muted);font-weight:400;">(optional)</span></label>
          <textarea id="upload-desc" placeholder="What's this file? Add a description…" rows="2"></textarea>
        </div>
        <div class="toggle-row">
          <div>
            <div class="toggle-label">Public file</div>
            <div class="toggle-desc">Anyone can see and download this file</div>
          </div>
          <div class="toggle on" id="public-toggle" onclick="togglePublic()"></div>
        </div>
        <div id="upload-progress" class="hidden">
          <div style="font-size:12px;color:var(--text-secondary);margin-bottom:4px;" id="upload-status">Uploading…</div>
          <div class="progress-bar"><div class="progress-fill" id="progress-fill" style="width:0%"></div></div>
        </div>
        <div style="display:flex;gap:8px;">
          <button class="btn btn-primary" id="upload-btn" onclick="handleUpload()">
            <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M8.75 1.75a.75.75 0 0 0-1.5 0V5H4a.75.75 0 0 0 0 1.5h3.25v3.25a.75.75 0 0 0 1.5 0V6.5H12A.75.75 0 0 0 12 5H8.75V1.75Z"/></svg>
            Upload file
          </button>
          <button class="btn btn-secondary" onclick="clearUpload()">Cancel</button>
        </div>
      </div>
    </div>
  `;
}

// ── File Loading ──────────────────────────────────────────────────────────────
async function loadExploreFiles(containerId, limit = 50) {
  try {
    const res = await api('GET', '/files');
    state.files = res.files || [];
    let filtered = filterFiles(state.files);
    filtered = sortFiles(filtered);
    filtered = filtered.slice(0, limit);

    const container = document.getElementById(containerId);
    if (!container) return;

    if (filtered.length === 0) {
      container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">📭</div><h3>No files yet</h3><p>Be the first to share a file!</p><button class="btn btn-primary" onclick="navigate('upload')">Upload a file</button></div>`;
      if (containerId === 'featured-files') container.className = '';
      return;
    }

    if (state.viewMode === 'grid' && containerId === 'files-container') {
      container.innerHTML = filtered.map(f => renderFileCard(f)).join('');
    } else {
      container.innerHTML = filtered.map(f => renderFileRow(f)).join('');
    }
  } catch (e) {
    const container = document.getElementById(containerId);
    if (container) container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">⚠️</div><h3>Could not load files</h3><p>${e.message}</p></div>`;
  }
}

async function loadRecentFiles(containerId, username, showAll = false) {
  try {
    const res = await api('GET', '/files');
    let files = (res.files || []).filter(f => {
      // In a real setup, metadata would filter by uploader
      return true;
    });
    if (!showAll) files = files.slice(0, 5);

    const container = document.getElementById(containerId);
    if (!container) return;

    if (files.length === 0) {
      container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">📭</div><h3>No files yet</h3><p>Upload your first file to get started.</p><button class="btn btn-primary" onclick="navigate('upload')">Upload a file</button></div>`;
      return;
    }
    container.innerHTML = files.map(f => renderFileRow(f, true)).join('');
  } catch {
    const container = document.getElementById(containerId);
    if (container) container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">⚠️</div><h3>Could not load files</h3></div>`;
  }
}

async function loadStats() {
  try {
    const res = await api('GET', '/stats');
    const statsEl = document.getElementById('user-stats');
    if (!statsEl) return;
    statsEl.innerHTML = `
      ${statCard('📁', state.user.uploads || 0, 'Files uploaded')}
      ${statCard('💾', formatBytes(state.user.totalSize || 0), 'Storage used')}
      ${statCard('📅', timeAgo(state.user.createdAt), 'Member since')}
    `;
  } catch {}
}

async function loadPlatformStats() {
  try {
    const res = await api('GET', '/stats');
    const el = document.getElementById('platform-stats');
    if (!el) return;
    el.innerHTML = `
      ${statCard('📁', res.totalFiles || 0, 'Files shared')}
      ${statCard('👤', res.totalUsers || 0, 'Users')}
      ${statCard('💾', formatBytes(res.totalSize || 0), 'Total storage')}
    `;
  } catch {}
}

function statCard(icon, value, label) {
  return `<div class="stat-card"><div class="stat-icon">${icon}</div><div class="stat-number">${value}</div><div class="stat-label">${label}</div></div>`;
}

// ── File Rendering ────────────────────────────────────────────────────────────
function renderFileRow(f, showDelete = false) {
  const uploader = f.uploader || 'unknown';
  const avatarUrl = `https://api.dicebear.com/7.x/identicon/svg?seed=${uploader}`;
  return `
    <div class="file-item" onclick="openPreview('${f.name}','${f.download_url}','${f.ext || ''}')">
      <div class="file-icon">${f.icon || '📁'}</div>
      <div class="file-info">
        <div class="file-name">${f.originalName || f.name}</div>
        <div class="file-meta">
          <div class="file-uploader">
            <img src="${avatarUrl}" alt="${uploader}" />
            <span>${uploader}</span>
          </div>
          <span>·</span>
          <span>${f.formattedSize || formatBytes(f.size || 0)}</span>
          ${f.description ? `<span>·</span><span style="overflow:hidden;white-space:nowrap;text-overflow:ellipsis;max-width:200px;">${escapeHtml(f.description)}</span>` : ''}
        </div>
      </div>
      <div class="file-badge badge-public">Public</div>
      <div class="file-size mono">${f.formattedSize || ''}</div>
      <div class="file-actions" onclick="event.stopPropagation()">
        <button class="btn btn-ghost btn-icon btn-sm" title="Download" onclick="downloadFile('${f.name}','${f.download_url}')">
          <svg viewBox="0 0 16 16" width="13" height="13" fill="currentColor"><path d="M2.75 14A1.75 1.75 0 0 1 1 12.25v-2.5a.75.75 0 0 1 1.5 0v2.5c0 .138.112.25.25.25h10.5a.25.25 0 0 0 .25-.25v-2.5a.75.75 0 0 1 1.5 0v2.5A1.75 1.75 0 0 1 13.25 14Zm-1-5.573 3.25 3.25a.75.75 0 0 0 1.06 0L9.31 8.427A.75.75 0 0 0 8.25 7.5H6.25a.75.75 0 0 0-.75.75v.677Z"/></svg>
        </button>
        <button class="btn btn-ghost btn-icon btn-sm" title="Copy link" onclick="copyLink('${f.download_url}')">
          <svg viewBox="0 0 16 16" width="13" height="13" fill="currentColor"><path d="m7.775 3.275 1.25-1.25a3.5 3.5 0 1 1 4.95 4.95l-2.5 2.5a3.5 3.5 0 0 1-4.95 0 .751.751 0 0 1 .018-1.042.751.751 0 0 1 1.042-.018 2 2 0 0 0 2.83 0l2.5-2.5a2.002 2.002 0 0 0-2.83-2.83l-1.25 1.25a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042Zm-4.69 9.64a2.002 2.002 0 0 0 2.83 0l1.25-1.25a.751.751 0 0 1 1.042.018.751.751 0 0 1 .018 1.042l-1.25 1.25a3.5 3.5 0 1 1-4.95-4.95l2.5-2.5a3.5 3.5 0 0 1 4.95 0 .751.751 0 0 1-.018 1.042.751.751 0 0 1-1.042.018 2 2 0 0 0-2.83 0l-2.5 2.5a2.002 2.002 0 0 0 0 2.83Z"/></svg>
        </button>
        ${showDelete && state.user ? `<button class="btn btn-ghost btn-icon btn-sm" title="Delete" style="color:var(--danger)" onclick="deleteFile('${f.name}')">
          <svg viewBox="0 0 16 16" width="13" height="13" fill="currentColor"><path d="M11 1.75V3h2.25a.75.75 0 0 1 0 1.5H2.75a.75.75 0 0 1 0-1.5H5V1.75C5 .784 5.784 0 6.75 0h2.5C10.216 0 11 .784 11 1.75ZM4.496 6.675l.66 6.6a.25.25 0 0 0 .249.225h5.19a.25.25 0 0 0 .249-.225l.66-6.6a.75.75 0 0 1 1.49.149l-.66 6.6A1.748 1.748 0 0 1 10.595 15h-5.19a1.75 1.75 0 0 1-1.74-1.575l-.66-6.6a.75.75 0 1 1 1.49-.15ZM6.5 1.75V3h3V1.75a.25.25 0 0 0-.25-.25h-2.5a.25.25 0 0 0-.25.25Z"/></svg>
        </button>` : ''}
      </div>
    </div>
  `;
}

function renderFileCard(f) {
  const uploader = f.uploader || 'unknown';
  const avatarUrl = `https://api.dicebear.com/7.x/identicon/svg?seed=${uploader}`;
  const isImage = ['png','jpg','jpeg','gif','webp','svg'].includes(f.ext || '');
  return `
    <div class="file-card" onclick="openPreview('${f.name}','${f.download_url}','${f.ext || ''}')">
      <div class="file-card-preview">
        ${isImage && f.download_url ? `<img src="${f.download_url}" alt="${f.name}" onerror="this.parentElement.innerHTML='${f.icon || '📁'}'" />` : (f.icon || '📁')}
      </div>
      <div class="file-card-body">
        <div class="file-card-name" title="${f.originalName || f.name}">${f.originalName || f.name}</div>
        <div class="file-card-meta">
          <div class="file-card-uploader">
            <img src="${avatarUrl}" alt="${uploader}" />
            <span>${uploader}</span>
          </div>
          <span>·</span>
          <span class="mono">${f.formattedSize || formatBytes(f.size || 0)}</span>
        </div>
      </div>
    </div>
  `;
}

// ── File Actions ──────────────────────────────────────────────────────────────
function openPreview(name, url, ext) {
  const isImage = ['png','jpg','jpeg','gif','webp','svg','bmp'].includes(ext);
  const isPdf = ext === 'pdf';
  const isText = ['txt','md','json','js','ts','html','css','py','rs','go','java','cpp','c','yaml','yml','toml','xml'].includes(ext);

  document.getElementById('preview-modal').classList.remove('hidden');
  const content = document.getElementById('preview-modal-content');
  content.innerHTML = `
    <div style="padding:20px 24px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:12px;">
      <div style="font-size:24px;">${getFileIcon(ext)}</div>
      <div style="flex:1;min-width:0;">
        <div style="font-weight:600;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${decodeURIComponent(name)}</div>
        <div style="font-size:12px;color:var(--text-muted);">.${ext || 'file'}</div>
      </div>
      <div style="display:flex;gap:8px;flex-shrink:0;">
        <button class="btn btn-secondary btn-sm" onclick="copyLink('${url}')">Copy link</button>
        <a class="btn btn-primary btn-sm" href="${url}" download target="_blank">Download</a>
      </div>
    </div>
    <div style="padding:20px;min-height:200px;display:flex;align-items:center;justify-content:center;">
      ${isImage ? `<img src="${url}" style="max-width:100%;max-height:60vh;object-fit:contain;border-radius:4px;" />` :
        isPdf ? `<iframe src="${url}" style="width:100%;height:60vh;border:none;border-radius:4px;"></iframe>` :
        isText ? `<div style="width:100%;"><div style="font-size:12px;color:var(--text-muted);margin-bottom:8px;">Text preview not available for remote files.</div><a href="${url}" target="_blank" class="btn btn-secondary">Open in new tab</a></div>` :
        `<div style="text-align:center;padding:40px;">
          <div style="font-size:56px;margin-bottom:16px;">${getFileIcon(ext)}</div>
          <div style="font-weight:600;margin-bottom:8px;">No preview available</div>
          <div style="color:var(--text-secondary);font-size:13px;margin-bottom:20px;">This file type cannot be previewed in the browser.</div>
          <a class="btn btn-primary" href="${url}" download target="_blank">Download file</a>
        </div>`
      }
    </div>
  `;
}
function closePreviewModal() { document.getElementById('preview-modal').classList.add('hidden'); }

async function downloadFile(name, url) {
  if (url) { window.open(url, '_blank'); }
  else {
    try {
      const res = await api('GET', `/files/${name}/download`);
      window.open(res.url, '_blank');
    } catch { toast('Could not get download link', 'error'); }
  }
  toast('Opening download…', 'info');
}

function copyLink(url) {
  navigator.clipboard.writeText(url || window.location.href).then(() => {
    toast('Link copied to clipboard! 📋', 'success');
  });
}

async function deleteFile(name) {
  if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
  try {
    await api('DELETE', `/files/${name}`);
    toast('File deleted successfully', 'success');
    navigate(state.currentView);
  } catch (e) {
    toast(e.message || 'Could not delete file', 'error');
  }
}

// ── Upload ────────────────────────────────────────────────────────────────────
function handleFileSelect(e) {
  const file = e.target.files[0];
  if (file) setUploadFile(file);
}
function handleDragOver(e) { e.preventDefault(); document.getElementById('upload-zone').classList.add('drag-over'); }
function handleDragLeave() { document.getElementById('upload-zone').classList.remove('drag-over'); }
function handleDrop(e) {
  e.preventDefault();
  document.getElementById('upload-zone').classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file) setUploadFile(file);
}

function setUploadFile(file) {
  state.uploadFile = file;
  const preview = document.getElementById('upload-file-preview');
  const fields = document.getElementById('upload-form-fields');
  preview.classList.remove('hidden');
  fields.classList.remove('hidden');
  preview.innerHTML = `
    <div class="upload-file-info">
      <div class="upload-file-icon">${getFileIcon(file.name.split('.').pop().toLowerCase())}</div>
      <div class="upload-file-details">
        <div class="upload-file-name">${escapeHtml(file.name)}</div>
        <div class="upload-file-size">${formatBytes(file.size)}</div>
      </div>
      <button class="btn btn-ghost btn-icon btn-sm" onclick="clearUpload()" title="Remove">
        <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.749.749 0 0 1 1.275.326.749.749 0 0 1-.215.734L9.06 8l3.22 3.22a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215L8 9.06l-3.22 3.22a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z"/></svg>
      </button>
    </div>
  `;
}

function clearUpload() {
  state.uploadFile = null;
  document.getElementById('upload-file-preview')?.classList.add('hidden');
  document.getElementById('upload-form-fields')?.classList.add('hidden');
  const input = document.getElementById('file-input');
  if (input) input.value = '';
}

function togglePublic() {
  state.uploadPublic = !state.uploadPublic;
  document.getElementById('public-toggle').classList.toggle('on', state.uploadPublic);
}

async function handleUpload() {
  if (!state.uploadFile) { toast('Please select a file', 'error'); return; }
  const btn = document.getElementById('upload-btn');
  const progressEl = document.getElementById('upload-progress');
  const statusEl = document.getElementById('upload-status');
  const fillEl = document.getElementById('progress-fill');

  setLoading(btn, true);
  progressEl.classList.remove('hidden');

  // Simulate progress
  let prog = 0;
  const interval = setInterval(() => {
    prog = Math.min(prog + Math.random() * 15, 90);
    fillEl.style.width = prog + '%';
  }, 200);

  try {
    const formData = new FormData();
    formData.append('file', state.uploadFile);
    formData.append('description', document.getElementById('upload-desc').value);
    formData.append('isPublic', state.uploadPublic);

    const res = await fetch(`${API}/files/upload`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${state.token}` },
      body: formData,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Upload failed');

    clearInterval(interval);
    fillEl.style.width = '100%';
    statusEl.textContent = 'Upload complete! ✓';

    // Update user stats
    if (state.user) {
      state.user.uploads = (state.user.uploads || 0) + 1;
      state.user.totalSize = (state.user.totalSize || 0) + state.uploadFile.size;
      localStorage.setItem('delta_user', JSON.stringify(state.user));
    }

    toast(`File uploaded successfully! 🎉`, 'success');
    setTimeout(() => navigate('my-files'), 1000);
  } catch (e) {
    clearInterval(interval);
    toast(e.message || 'Upload failed', 'error');
    fillEl.style.width = '0%';
    progressEl.classList.add('hidden');
  } finally {
    setLoading(btn, false);
  }
}

// ── Profile Modal ─────────────────────────────────────────────────────────────
function openProfileModal() {
  if (!state.user) { openAuthModal('login'); return; }
  closeDropdown();
  document.getElementById('profile-modal').classList.remove('hidden');
  const content = document.getElementById('profile-modal-content');
  const user = state.user;
  content.innerHTML = `
    <div class="profile-header">
      <div class="profile-avatar-wrap">
        <img src="${user.avatar}" class="profile-avatar" id="profile-avatar-img" />
        <div class="profile-avatar-edit" onclick="document.getElementById('profile-avatar-picker').classList.toggle('hidden')">
          <svg viewBox="0 0 16 16" width="12" height="12" fill="white"><path d="M11.013 1.427a1.75 1.75 0 0 1 2.474 0l1.086 1.086a1.75 1.75 0 0 1 0 2.474l-8.61 8.61c-.21.21-.47.364-.756.445l-3.251.93a.75.75 0 0 1-.927-.928l.929-3.25c.081-.286.235-.547.445-.758l8.61-8.61Z"/></svg>
        </div>
      </div>
      <div class="profile-info">
        <div class="profile-username">${user.username}</div>
        <div class="profile-bio">${escapeHtml(user.bio || 'No bio yet.')}</div>
        <div class="profile-meta">
          ${user.location ? `<div class="profile-meta-item"><svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor"><path d="m12.596 11.596-3.535 3.536a1.5 1.5 0 0 1-2.122 0l-3.535-3.536a6.5 6.5 0 1 1 9.192-9.193 6.5 6.5 0 0 1 0 9.193Zm-1.06-8.132v-.001a5 5 0 1 0-7.072 7.072L8 14.07l3.536-3.534a5 5 0 0 0 0-7.072ZM8 9a2 2 0 1 1-.001-3.999A2 2 0 0 1 8 9Z"/></svg>${escapeHtml(user.location)}</div>` : ''}
          <div class="profile-meta-item"><svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor"><path d="M4.75 0A1.75 1.75 0 0 0 3 1.75v12.5C3 15.216 3.784 16 4.75 16h6.5A1.75 1.75 0 0 0 13 14.25V1.75A1.75 1.75 0 0 0 11.25 0ZM4.5 1.75a.25.25 0 0 1 .25-.25h6.5a.25.25 0 0 1 .25.25v12.5a.25.25 0 0 1-.25.25h-6.5a.25.25 0 0 1-.25-.25Zm3.75 10a.75.75 0 1 1 0 1.5.75.75 0 0 1 0-1.5Z"/></svg>Member since ${new Date(user.createdAt).toLocaleDateString()}</div>
        </div>
      </div>
    </div>

    <!-- Avatar picker (hidden by default) -->
    <div id="profile-avatar-picker" class="hidden" style="padding:12px 24px;border-bottom:1px solid var(--border);">
      <div style="font-size:12px;font-weight:600;color:var(--text-muted);margin-bottom:8px;text-transform:uppercase;letter-spacing:.05em;">Choose avatar style</div>
      <div class="avatar-picker">
        ${AVATAR_SEEDS.map(seed => {
          const url = `https://api.dicebear.com/7.x/identicon/svg?seed=${user.username}_${seed}`;
          return `<img src="${url}" class="avatar-option ${user.avatar.includes(seed) ? 'selected' : ''}" onclick="selectProfileAvatar('${url}', this)" />`;
        }).join('')}
        ${['bottts','micah','fun-emoji','lorelei','avataaars'].map(style => {
          const url = `https://api.dicebear.com/7.x/${style}/svg?seed=${user.username}`;
          return `<img src="${url}" class="avatar-option" onclick="selectProfileAvatar('${url}', this)" />`;
        }).join('')}
      </div>
    </div>

    <div class="profile-stats">
      <div class="profile-stat"><div class="profile-stat-num">${user.uploads || 0}</div><div class="profile-stat-label">Files</div></div>
      <div class="profile-stat"><div class="profile-stat-num">${formatBytes(user.totalSize || 0)}</div><div class="profile-stat-label">Storage</div></div>
    </div>

    <div style="padding:20px 24px;display:flex;flex-direction:column;gap:14px;">
      <div class="form-group">
        <label>Bio</label>
        <textarea id="profile-bio-input" rows="2" placeholder="Tell the world about yourself…">${escapeHtml(user.bio || '')}</textarea>
      </div>
      <div class="form-group">
        <label>Location</label>
        <input type="text" id="profile-location-input" placeholder="San Francisco, CA" value="${escapeHtml(user.location || '')}" />
      </div>
      <div style="display:flex;gap:8px;">
        <button class="btn btn-primary" onclick="saveProfile()">Save changes</button>
        <button class="btn btn-secondary" onclick="closeProfileModal()">Cancel</button>
      </div>
    </div>
  `;
}

function selectProfileAvatar(url, el) {
  document.querySelectorAll('#profile-avatar-picker .avatar-option').forEach(e => e.classList.remove('selected'));
  el.classList.add('selected');
  document.getElementById('profile-avatar-img').src = url;
  state._pendingAvatar = url;
}

async function saveProfile() {
  const bio = document.getElementById('profile-bio-input').value;
  const location = document.getElementById('profile-location-input').value;
  const avatar = state._pendingAvatar || state.user.avatar;
  try {
    const res = await api('PATCH', '/auth/profile', { bio, location, avatar });
    state.user = res.user;
    localStorage.setItem('delta_user', JSON.stringify(res.user));
    renderNavActions();
    closeProfileModal();
    toast('Profile updated! ✓', 'success');
    delete state._pendingAvatar;
  } catch (e) {
    toast(e.message || 'Could not save profile', 'error');
  }
}

function closeProfileModal() { document.getElementById('profile-modal').classList.add('hidden'); }

// ── Filters ───────────────────────────────────────────────────────────────────
function setFilter(f) {
  state.currentFilter = f;
  navigate('explore');
}
function setSort(s) {
  state.currentSort = s;
  navigate('explore');
}
function setViewMode(m) {
  state.viewMode = m;
  navigate('explore');
}

function filterFiles(files) {
  if (state.currentFilter === 'all') return files;
  const map = {
    images: ['png','jpg','jpeg','gif','webp','svg','bmp'],
    documents: ['pdf','doc','docx','txt','md','xls','xlsx','ppt','pptx'],
    code: ['js','ts','jsx','tsx','html','css','py','rs','go','java','cpp','c','json','yaml','yml'],
    archives: ['zip','tar','gz','rar','7z'],
  };
  const exts = map[state.currentFilter] || [];
  return files.filter(f => exts.includes((f.ext || f.name.split('.').pop() || '').toLowerCase()));
}

function sortFiles(files) {
  const sorted = [...files];
  switch (state.currentSort) {
    case 'newest': sorted.sort((a, b) => (b.size || 0) - (a.size || 0)); break; // proxy sort since we don't have date
    case 'oldest': sorted.sort((a, b) => (a.size || 0) - (b.size || 0)); break;
    case 'largest': sorted.sort((a, b) => (b.size || 0) - (a.size || 0)); break;
    case 'name': sorted.sort((a, b) => (a.name || '').localeCompare(b.name || '')); break;
  }
  return sorted;
}

function filterLabel(f) {
  const labels = { all: '🗂 All', images: '🖼 Images', documents: '📄 Docs', code: '💻 Code', archives: '📦 Archives' };
  return labels[f] || f;
}

// ── Command Palette ───────────────────────────────────────────────────────────
function openCommandPalette() {
  document.getElementById('cmd-palette').classList.remove('hidden');
  document.getElementById('cmd-input').focus();
  updateCmdResults('');
}
function closeCommandPalette() { document.getElementById('cmd-palette').classList.add('hidden'); }

function updateCmdResults(query) {
  const pages = [
    { icon: '🏠', name: 'Home', meta: 'Go to dashboard', action: () => navigate('home') },
    { icon: '🔍', name: 'Explore', meta: 'Browse all files', action: () => navigate('explore') },
    { icon: '📁', name: 'My Files', meta: 'View your files', action: () => navigate('my-files') },
    { icon: '📤', name: 'Upload', meta: 'Share a file', action: () => navigate('upload') },
    { icon: '👤', name: 'Profile', meta: 'Edit your profile', action: () => openProfileModal() },
  ];

  const filtered = query ? pages.filter(p => p.name.toLowerCase().includes(query.toLowerCase())) : pages;
  state.cmdItems = filtered;
  state.cmdSelected = 0;

  const fileItems = state.files.filter(f => f.name.toLowerCase().includes(query.toLowerCase())).slice(0, 5);

  const el = document.getElementById('cmd-results');
  let html = '';

  if (filtered.length) {
    html += `<div class="cmd-section">Navigation</div>`;
    html += filtered.map((p, i) => `
      <div class="cmd-item ${i===state.cmdSelected?'selected':''}" onclick="p${i}_action()" id="cmd-item-${i}">
        <div class="cmd-item-icon">${p.icon}</div>
        <div class="cmd-item-info">
          <div class="cmd-item-name">${p.name}</div>
          <div class="cmd-item-meta">${p.meta}</div>
        </div>
      </div>
    `).join('');
  }

  if (fileItems.length) {
    html += `<div class="cmd-section">Files</div>`;
    html += fileItems.map(f => `
      <div class="cmd-item" onclick="openPreview('${f.name}','${f.download_url}','${f.ext||''}');closeCommandPalette()">
        <div class="cmd-item-icon">${f.icon || '📁'}</div>
        <div class="cmd-item-info">
          <div class="cmd-item-name">${f.originalName || f.name}</div>
          <div class="cmd-item-meta">${f.formattedSize || ''}</div>
        </div>
      </div>
    `).join('');
  }

  if (!html) html = `<div class="cmd-item" style="color:var(--text-muted);justify-content:center;">No results for "${query}"</div>`;
  el.innerHTML = html;

  // Re-bind nav actions
  filtered.forEach((p, i) => {
    const item = document.getElementById(`cmd-item-${i}`);
    if (item) item.onclick = () => { p.action(); closeCommandPalette(); };
  });
}

// ── Keyboard ──────────────────────────────────────────────────────────────────
function initKeyboard() {
  document.addEventListener('keydown', e => {
    // Cmd+K or Ctrl+K
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      if (document.getElementById('cmd-palette').classList.contains('hidden')) {
        openCommandPalette();
      } else {
        closeCommandPalette();
      }
    }
    if (e.key === 'Escape') {
      closeCommandPalette();
      closePreviewModal();
      closeAuthModal();
      closeProfileModal();
    }
  });

  document.getElementById('cmd-input').addEventListener('input', e => {
    updateCmdResults(e.target.value);
  });

  // Click outside to close cmd palette
  document.getElementById('cmd-palette').addEventListener('click', e => {
    if (e.target === document.getElementById('cmd-palette')) closeCommandPalette();
  });
  document.getElementById('auth-modal').addEventListener('click', e => {
    if (e.target === document.getElementById('auth-modal')) closeAuthModal();
  });
  document.getElementById('profile-modal').addEventListener('click', e => {
    if (e.target === document.getElementById('profile-modal')) closeProfileModal();
  });
  document.getElementById('preview-modal').addEventListener('click', e => {
    if (e.target === document.getElementById('preview-modal')) closePreviewModal();
  });
}

// ── Search ────────────────────────────────────────────────────────────────────
function initSearch() {
  const input = document.getElementById('search-input');
  const searchBox = document.getElementById('nav-search-box');
  searchBox.addEventListener('click', () => { openCommandPalette(); });
  input.addEventListener('focus', () => { openCommandPalette(); input.blur(); });
}

// ── Avatar Picker (Register) ──────────────────────────────────────────────────
function buildAvatarPicker() {
  const picker = document.getElementById('avatar-picker');
  const styles = ['identicon','bottts','micah','fun-emoji','lorelei','avataaars','pixel-art','thumbs'];
  const seed = Math.random().toString(36).slice(2, 8);
  picker.innerHTML = styles.map(style => {
    const url = `https://api.dicebear.com/7.x/${style}/svg?seed=${seed}`;
    return `<img src="${url}" class="avatar-option" title="${style}" onclick="selectAvatar('${url}', this)" />`;
  }).join('');
}

function selectAvatar(url, el) {
  document.querySelectorAll('#avatar-picker .avatar-option').forEach(e => e.classList.remove('selected'));
  el.classList.add('selected');
  state.selectedAvatar = url;
}

// ── Password Strength ─────────────────────────────────────────────────────────
function initPasswordStrength() {
  document.getElementById('reg-password')?.addEventListener('input', e => {
    const val = e.target.value;
    const el = document.getElementById('pass-strength');
    if (!el || !val) { el.innerHTML = ''; return; }
    const strength = getPasswordStrength(val);
    const classes = ['weak','fair','fair','good','good'];
    el.innerHTML = [1,2,3,4].map(i => `<div class="strength-bar ${i <= strength ? classes[strength-1] : ''}"></div>`).join('');
  });
}

function getPasswordStrength(p) {
  let s = 0;
  if (p.length >= 6) s++;
  if (p.length >= 10) s++;
  if (/[A-Z]/.test(p) && /[a-z]/.test(p)) s++;
  if (/[0-9]/.test(p)) s++;
  if (/[^A-Za-z0-9]/.test(p)) s++;
  return Math.min(4, s);
}

function togglePass(id, btn) {
  const input = document.getElementById(id);
  input.type = input.type === 'password' ? 'text' : 'password';
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function toast(message, type = 'info', duration = 3000) {
  const container = document.getElementById('toast-container');
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.innerHTML = `<div class="toast-dot"></div><span>${escapeHtml(message)}</span>`;
  container.appendChild(t);
  setTimeout(() => {
    t.style.opacity = '0';
    t.style.transform = 'translateX(20px)';
    t.style.transition = 'all 0.25s';
    setTimeout(() => t.remove(), 250);
  }, duration);
}

// ── API ───────────────────────────────────────────────────────────────────────
async function api(method, path, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (state.token) opts.headers['Authorization'] = `Bearer ${state.token}`;
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${API}${path}`, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

// ── Theme ─────────────────────────────────────────────────────────────────────
function toggleTheme() {
  const html = document.documentElement;
  const current = html.getAttribute('data-theme');
  html.setAttribute('data-theme', current === 'dark' ? 'light' : 'dark');
  localStorage.setItem('delta_theme', html.getAttribute('data-theme'));
}
(() => {
  const saved = localStorage.getItem('delta_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
})();

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024, sizes = ['B','KB','MB','GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function timeAgo(iso) {
  if (!iso) return 'Unknown';
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days < 1) return 'Today';
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days/30)}mo ago`;
  return `${Math.floor(days/365)}y ago`;
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 18) return 'afternoon';
  return 'evening';
}

function escapeHtml(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function setLoading(btn, loading) {
  if (!btn) return;
  btn.disabled = loading;
  btn.innerHTML = loading
    ? `<svg class="spin" viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8Z" opacity=".25"/><path d="M8 1.5a6.5 6.5 0 0 1 6.5 6.5.75.75 0 0 0 1.5 0A8 8 0 0 0 8 0a.75.75 0 0 0 0 1.5Z"/></svg> Loading…`
    : btn._origText || 'Submit';
}

function getFileIcon(ext) {
  const map = {
    pdf:'📄',zip:'📦',tar:'📦',gz:'📦',rar:'📦',
    png:'🖼️',jpg:'🖼️',jpeg:'🖼️',gif:'🖼️',webp:'🖼️',svg:'🖼️',
    mp4:'🎬',mov:'🎬',avi:'🎬',mkv:'🎬',
    mp3:'🎵',wav:'🎵',flac:'🎵',
    js:'📜',ts:'📜',jsx:'📜',tsx:'📜',
    html:'🌐',css:'🎨',json:'📋',
    py:'🐍',rs:'⚙️',go:'🔵',java:'☕',cpp:'⚙️',c:'⚙️',
    md:'📝',txt:'📝',doc:'📝',docx:'📝',
    xls:'📊',xlsx:'📊',csv:'📊',
  };
  return map[(ext||'').toLowerCase()] || '📁';
}

function skeletonRows(n) {
  return Array(n).fill(0).map(()=>`
    <div class="file-item" style="pointer-events:none;">
      <div class="skeleton" style="width:36px;height:36px;border-radius:8px;"></div>
      <div style="flex:1;min-width:0;">
        <div class="skeleton skeleton-line" style="width:180px;"></div>
        <div class="skeleton skeleton-line" style="width:120px;height:12px;"></div>
      </div>
      <div class="skeleton" style="width:60px;height:20px;border-radius:20px;"></div>
      <div class="skeleton" style="width:50px;height:14px;border-radius:4px;"></div>
    </div>
  `).join('');
}

function skeletonStats(n) {
  return `<div class="stats-grid">${Array(n).fill(0).map(()=>`
    <div class="stat-card">
      <div class="skeleton" style="width:28px;height:28px;border-radius:4px;margin-bottom:8px;"></div>
      <div class="skeleton" style="height:28px;width:80px;border-radius:4px;margin-bottom:4px;"></div>
      <div class="skeleton" style="height:14px;width:100px;border-radius:4px;"></div>
    </div>
  `).join('')}</div>`;
}