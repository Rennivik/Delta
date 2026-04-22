const API = 'https://delta-server-vyed.onrender.com';
const ADMIN_USERS = ['Rennivik', 'BanditScientistJR', 'Delta System'];

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
  searchQuery: '',
  unreadCount: 0,
};

const AVATAR_SEEDS = ['alpha','beta','gamma','delta','echo','foxtrot','golf','hotel','india','juliet','kilo','lima'];

async function waitForAPI() {
  const overlay = document.getElementById('wake-overlay');
  const statusEl = document.getElementById('wake-status');
  const barEl = document.getElementById('wake-bar');
  const dotsEl = document.getElementById('wake-dots');

  let attempts = 0;
  let dotCount = 0;
  const dotInterval = setInterval(() => {
    dotCount = (dotCount + 1) % 4;
    if (dotsEl) dotsEl.textContent = '.'.repeat(dotCount);
  }, 400);

  let barProg = 0;
  const barInterval = setInterval(() => {
    barProg = Math.min(barProg + (Math.random() * 3), 85);
    if (barEl) barEl.style.width = barProg + '%';
  }, 300);

  while (true) {
    attempts++;

    if (attempts == 11) {
      msg = "We couldn't connect to the API; Please try again later"
      statusEl.textContent = msg;
      clearInterval(dotInterval);
      clearInterval(barInterval);
      dotsEl.textContent = ''
      barEl.style.width = '0%'
      break
    }

    try {
      const res = await fetch(`${API}/health`, { signal: AbortSignal.timeout(8000) });
      if (res.ok) {
        clearInterval(dotInterval);
        clearInterval(barInterval);
        if (statusEl) statusEl.textContent = 'Connected!';
        if (barEl) barEl.style.width = '100%';
        if (dotsEl) dotsEl.textContent = '';
        await new Promise(r => setTimeout(r, 500));
        if (overlay) {
          overlay.style.transition = 'opacity 0.4s ease';
          overlay.style.opacity = '0';
          await new Promise(r => setTimeout(r, 400));
          overlay.classList.add('hidden');
          overlay.style.opacity = '';
        }
        return;
      }
    } catch {}

    const messages = ['Waking up the server','Still warming up','Almost there','Hang tight','Nearly ready'];
    msg = messages[Math.min(Math.floor(attempts / 3), messages.length - 1)];

    if (attempts == 10) {
      msg = "Final Try"
    }

    if (statusEl) statusEl.textContent = msg;
    await new Promise(r => setTimeout(r, 2000));
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  await waitForAPI();
  loadAuth();
  renderNavActions();
  navigate('home');
  initKeyboard();
  initSearch();
  buildAvatarPicker();
  initPasswordStrength();
  preloadFiles();
  setInterval(() => { if (state.user) refreshUnreadCount(); }, 30000);
});

async function preloadFiles() {
  try {
    const res = await api('GET', '/files');
    state.files = res.files || [];
  } catch {}
}

async function refreshUnreadCount() {
  if (!state.user) return;
  try {
    const res = await api('GET', '/messages/unread');
    state.unreadCount = res.unread || 0;
    updateInboxBadge();
  } catch {}
}

function updateInboxBadge() {
  const badge = document.getElementById('inbox-badge');
  if (!badge) return;
  if (state.unreadCount > 0) {
    badge.textContent = state.unreadCount > 9 ? '9+' : state.unreadCount;
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }
}

function loadAuth() {
  const token = localStorage.getItem('delta_token');
  const user = localStorage.getItem('delta_user');
  if (token && user) {
    state.token = token;
    state.user = JSON.parse(user);
    refreshUnreadCount();
  }
}

async function handleLogin() {
  const username = safeValue('login-username');
  const password = safeValue('login-password');
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
    refreshUnreadCount();
    toast(`Welcome back, ${res.user.username}!`, 'success');
    navigate('home');
  } catch (e) {
    toast(e.message || 'Login failed', 'error');
  } finally {
    setLoading(btn, false);
  }
}

async function handleRegister() {
  const username = safeValue('reg-username');
  const password = safeValue('reg-password');
  if (!username || !password) { toast('Please fill in all fields', 'error'); return; }
  if (password.length < 6) { toast('Password must be at least 6 characters', 'error'); return; }
  const avatar = state.selectedAvatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${username}`;
  const btn = document.querySelector('#register-form .btn-primary');
  setLoading(btn, true);
  try {
    await api('POST', '/auth/register', { username, password, avatar });
    closeAuthModal();
    showPendingNotice(username);
    toast('Account request submitted! Waiting for admin approval.', 'info', 6000);
  } catch (e) {
    toast(e.message || 'Registration failed', 'error');
  } finally {
    setLoading(btn, false);
  }
}

function showPendingNotice(username) {
  const main = document.getElementById('main-content');
  main.innerHTML = `
    <div class="empty-state" style="padding:80px 20px;">
      <div class="empty-state-icon">⏳</div>
      <h3>Account pending approval</h3>
      <p style="max-width:360px;margin:0 auto 20px;">
        Your account request for <strong>${escapeHtml(username)}</strong> has been submitted.
        The admin will review it shortly.
      </p>
      <div style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:var(--radius-lg);padding:16px 20px;max-width:360px;margin:0 auto;text-align:left;">
        <div style="font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:500;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px;">What happens next</div>
        <div style="font-size:13px;color:var(--text-secondary);display:flex;flex-direction:column;gap:6px;">
          <div>1. Admin reviews your request</div>
          <div>2. You get approved or denied</div>
          <div>3. Sign in once approved</div>
        </div>
      </div>
    </div>
  `;
}

function logout() {
  state.user = null;
  state.token = null;
  state.unreadCount = 0;
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
  document.getElementById('auth-modal-sub').textContent = isReg ? 'Start sharing files today.' : 'Share files with anyone.';
}

function openAuthModal(mode = 'login') {
  document.getElementById('auth-modal').classList.remove('hidden');
  switchAuthMode(mode);
}
function closeAuthModal() { document.getElementById('auth-modal').classList.add('hidden'); }

function renderNavActions() {
  const el = document.getElementById('nav-actions');
  if (state.user) {
    el.innerHTML = `
      <button class="btn btn-primary btn-sm" onclick="navigate('upload')">
        <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor"><path d="M8.75 1.75a.75.75 0 0 0-1.5 0V5H4a.75.75 0 0 0 0 1.5h3.25v3.25a.75.75 0 0 0 1.5 0V6.5H12A.75.75 0 0 0 12 5H8.75V1.75Z"/></svg>
        Upload
      </button>
      <button class="btn btn-ghost btn-icon" onclick="navigate('inbox')" title="Inbox" style="position:relative;">
        <svg viewBox="0 0 16 16" width="15" height="15" fill="currentColor"><path d="M0 4.75C0 3.784.784 3 1.75 3h12.5c.966 0 1.75.784 1.75 1.75v7.5A1.75 1.75 0 0 1 14.25 14H1.75A1.75 1.75 0 0 1 0 12.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h12.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25ZM8 9.5l-4.5-3h9Z"/></svg>
        <span id="inbox-badge" class="hidden" style="position:absolute;top:-4px;right:-4px;background:var(--danger);color:#fff;border-radius:10px;font-size:10px;font-weight:700;padding:1px 5px;min-width:16px;text-align:center;"></span>
      </button>
      <div class="nav-divider"></div>
      <div class="dropdown" id="user-dropdown">
        <div onclick="toggleDropdown()" style="display:flex;align-items:center;gap:8px;cursor:pointer;">
          <img src="${state.user.avatar}" class="nav-avatar" alt="${state.user.username}" />
          <span class="nav-username">${state.user.username}</span>
          <svg viewBox="0 0 16 16" width="11" height="11" fill="currentColor" style="color:var(--text-muted)"><path d="M4.427 7.427l3.396 3.396a.25.25 0 0 0 .354 0l3.396-3.396A.25.25 0 0 0 11.396 7H4.604a.25.25 0 0 0-.177.427Z"/></svg>
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
          <div class="dropdown-item" onclick="navigate('inbox');closeDropdown()">
            <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M0 4.75C0 3.784.784 3 1.75 3h12.5c.966 0 1.75.784 1.75 1.75v7.5A1.75 1.75 0 0 1 14.25 14H1.75A1.75 1.75 0 0 1 0 12.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h12.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25ZM8 9.5l-4.5-3h9Z"/></svg>
            Inbox
          </div>
          <div class="dropdown-item" onclick="navigate('upload');closeDropdown()">
            <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M8.75 1.75a.75.75 0 0 0-1.5 0V5H4a.75.75 0 0 0 0 1.5h3.25v3.25a.75.75 0 0 0 1.5 0V6.5H12A.75.75 0 0 0 12 5H8.75V1.75Zm-6 9.5a.75.75 0 0 0 0 1.5h10.5a.75.75 0 0 0 0-1.5H2.75Z"/></svg>
            Upload file
          </div>
          ${ADMIN_USERS.includes(state.user.username) ? `
          <div class="dropdown-divider"></div>
          <div class="dropdown-item" onclick="navigate('admin');closeDropdown()" style="color:var(--warning);">
            <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Zm7-3.25v2.992l2.028.812a.75.75 0 0 1-.557 1.392l-2.5-1A.751.751 0 0 1 7 8.25v-3.5a.75.75 0 0 1 1.5 0Z"/></svg>
            Admin Panel
          </div>` : ''}
          <div class="dropdown-divider"></div>
          <div class="dropdown-item danger" onclick="logout()">
            <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M2 2.75C2 1.784 2.784 1 3.75 1h2.5a.75.75 0 0 1 0 1.5h-2.5a.25.25 0 0 0-.25.25v10.5c0 .138.112.25.25.25h2.5a.75.75 0 0 1 0 1.5h-2.5A1.75 1.75 0 0 1 2 13.25Zm10.44 4.5-1.97-1.97a.749.749 0 0 1 .326-1.275.749.749 0 0 1 .734.215l3.25 3.25a.75.75 0 0 1 0 1.06l-3.25 3.25a.749.749 0 0 1-1.275-.326.749.749 0 0 1 .215-.734l1.97-1.97H6.75a.75.75 0 0 1 0-1.5Z"/></svg>
            Sign out
          </div>
        </div>
      </div>
    `;
    updateInboxBadge();
  } else {
    el.innerHTML = `
      <button class="btn btn-ghost btn-sm" onclick="openAuthModal('login')">Sign in</button>
      <button class="btn btn-primary btn-sm" onclick="openAuthModal('register')">Sign up</button>
    `;
  }
}

function toggleDropdown() { document.getElementById('user-dropdown-menu')?.classList.toggle('hidden'); }
function closeDropdown() { document.getElementById('user-dropdown-menu')?.classList.add('hidden'); }
document.addEventListener('click', e => { if (!e.target.closest('#user-dropdown')) closeDropdown(); });

function navigate(view) {
  state.currentView = view;
  document.querySelectorAll('.sidebar-item').forEach(el => {
    el.classList.toggle('active', el.dataset.view === view);
  });
  const main = document.getElementById('main-content');
  switch (view) {
    case 'home':     renderHome(main); break;
    case 'explore':  renderExplore(main); break;
    case 'my-files': renderMyFiles(main); break;
    case 'upload':   renderUpload(main); break;
    case 'inbox':    renderInbox(main); break;
    case 'admin':    renderAdmin(main); break;
    default:         renderHome(main);
  }
}

async function renderHome(el) {
  el.innerHTML = state.user ? renderDashboard() : renderLanding();
  if (state.user) { loadStats(); loadRecentFiles('recent-files-list'); }
  else { loadExploreFiles('featured-files', 6); loadPlatformStats(); }
}

function renderLanding() {
  return `
    <div class="hero">
      <div class="hero-badge">
        <svg viewBox="0 0 16 16" width="11" height="11" fill="currentColor"><path d="M8 .25a7.75 7.75 0 1 0 0 15.5A7.75 7.75 0 0 0 8 .25Z"/></svg>
        open file sharing platform
      </div>
      <h1>Share files with <em>anyone</em></h1>
      <p>Delta is a file sharing platform built with GitHub. Upload, manage, and share files with a clean interface.</p>
      <div class="hero-actions">
        <button class="btn btn-primary" onclick="openAuthModal('register')">
          <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M8.75 1.75a.75.75 0 0 0-1.5 0V5H4a.75.75 0 0 0 0 1.5h3.25v3.25a.75.75 0 0 0 1.5 0V6.5H12A.75.75 0 0 0 12 5H8.75V1.75Z"/></svg>
          Get started
        </button>
        <button class="btn btn-secondary" onclick="navigate('explore')">Browse files</button>
      </div>
    </div>
    <div class="stats-grid" id="platform-stats">
      ${['📁','👤','⬆️'].map(i=>`<div class="stat-card"><div class="stat-icon">${i}</div><div class="skeleton" style="height:28px;width:80px;margin-bottom:4px;border-radius:4px;"></div><div class="skeleton" style="height:13px;width:120px;border-radius:4px;"></div></div>`).join('')}
    </div>
    <div class="section-header"><h2>Featured files</h2><button class="btn btn-ghost btn-sm" onclick="navigate('explore')">Browse all →</button></div>
    <div class="card"><div id="featured-files" class="file-list">${skeletonRows(5)}</div></div>
  `;
}

function renderDashboard() {
  return `
    <div style="display:flex;align-items:center;gap:14px;margin-bottom:28px;">
      <img src="${state.user.avatar}" style="width:46px;height:46px;border-radius:50%;border:1.5px solid var(--border);" />
      <div>
        <h1 style="font-family:'Syne',sans-serif;font-weight:800;font-size:1.2rem;letter-spacing:-0.03em;">Good ${getGreeting()}, ${state.user.username}</h1>
        <p style="color:var(--text-secondary);font-size:13px;margin-top:2px;">Here's what's happening with your files.</p>
      </div>
    </div>
    <div class="stats-grid" id="user-stats">${skeletonStats(3)}</div>
    <div class="section-header" style="margin-top:8px;">
      <h2>Recent files</h2>
      <button class="btn btn-ghost btn-sm" onclick="navigate('my-files')">View all →</button>
    </div>
    <div class="card"><div id="recent-files-list" class="file-list">${skeletonRows(3)}</div></div>
    <div class="section-header" style="margin-top:28px;"><h2>Quick actions</h2></div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px;">
      ${quickAction('📤','Upload a file','Share something new','navigate(\'upload\')')}
      ${quickAction('🔍','Explore files','See what others shared','navigate(\'explore\')')}
      ${quickAction('✉️','Inbox','Check your messages','navigate(\'inbox\')')}
      ${quickAction('👤','Edit profile','Update your info','openProfileModal()')}
    </div>
  `;
}

function quickAction(icon, title, desc, onclick) {
  return `
    <div class="card" style="cursor:pointer;transition:border-color .15s,transform .15s;" onclick="${onclick}"
      onmouseover="this.style.borderColor='var(--accent)';this.style.transform='translateY(-2px)'"
      onmouseout="this.style.borderColor='';this.style.transform=''">
      <div class="card-body" style="display:flex;align-items:flex-start;gap:12px;">
        <div style="font-size:22px;">${icon}</div>
        <div>
          <div style="font-weight:500;font-size:13px;margin-bottom:2px;">${title}</div>
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
      <div><h2>Explore files</h2><p style="color:var(--text-secondary);font-size:13px;margin-top:2px;">Browse files from the community</p></div>
    </div>
    <div class="filter-bar">
      ${['all','images','documents','code','archives'].map(f => `
        <div class="filter-chip ${state.currentFilter===f?'active':''}" onclick="setFilter('${f}')">${filterLabel(f)}</div>
      `).join('')}
      <div class="spacer"></div>
      <select onchange="setSort(this.value)" style="font-size:12px;padding:5px 10px;background:var(--bg-secondary);border:1px solid var(--border);border-radius:var(--radius);color:var(--text-primary);cursor:pointer;font-family:'DM Sans',sans-serif;">
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
  if (!state.user) { el.innerHTML = requireSignIn(); return; }
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
    <div class="card"><div id="my-files-list" class="file-list">${skeletonRows(4)}</div></div>
  `;
  loadRecentFiles('my-files-list', true);
}

async function renderUpload(el) {
  if (!state.user) { el.innerHTML = requireSignIn(); return; }
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
      <div id="upload-file-preview" class="hidden" style="margin-top:14px;"></div>
      <div id="upload-form-fields" class="hidden upload-form" style="margin-top:18px;">
        <div class="form-group">
          <label>Description <span style="color:var(--text-muted);font-weight:400;">(optional)</span></label>
          <textarea id="upload-desc" placeholder="What's this file? Add a description…" rows="2"></textarea>
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

async function renderInbox(el) {
  if (!state.user) { el.innerHTML = requireSignIn(); return; }
  el.innerHTML = `
    <div class="breadcrumb">
      <span class="breadcrumb-item" onclick="navigate('home')">Home</span>
      <span class="breadcrumb-sep">/</span>
      <span class="breadcrumb-item active">Inbox</span>
    </div>
    <div class="section-header">
      <div><h2>Inbox</h2><p style="color:var(--text-secondary);font-size:13px;margin-top:2px;">Your messages</p></div>
      <button class="btn btn-primary btn-sm" onclick="openComposeModal()">
        <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor"><path d="M11.013 1.427a1.75 1.75 0 0 1 2.474 0l1.086 1.086a1.75 1.75 0 0 1 0 2.474l-8.61 8.61c-.21.21-.47.364-.756.445l-3.251.93a.75.75 0 0 1-.927-.928l.929-3.25c.081-.286.235-.547.445-.758l8.61-8.61Z"/></svg>
        Compose
      </button>
    </div>
    <div class="card" id="inbox-list"><div style="padding:20px;">${skeletonRows(3)}</div></div>
  `;
  loadInbox();
}

async function loadInbox() {
  try {
    const res = await api('GET', '/messages');
    const el = document.getElementById('inbox-list');
    if (!el) return;
    if (res.conversations.length === 0) {
      el.innerHTML = `<div class="empty-state"><div class="empty-state-icon">✉️</div><h3>No messages yet</h3><p>Your inbox is empty.</p><button class="btn btn-primary" onclick="openComposeModal()">Send a message</button></div>`;
      return;
    }
    el.innerHTML = res.conversations.map(conv => {
      const isSystem = conv.with === 'delta-system';
      const avatar = isSystem
        ? `<div style="width:36px;height:36px;border-radius:50%;background:var(--accent-bg);border:1px solid rgba(233,150,122,0.3);display:flex;align-items:center;justify-content:center;font-family:'Syne',sans-serif;font-weight:800;font-size:14px;color:var(--accent);flex-shrink:0;">Δ</div>`
        : `<img src="${getAvatar(conv.with)}" style="width:36px;height:36px;border-radius:50%;object-fit:cover;flex-shrink:0;" />`;
      const unreadDot = conv.unreadCount > 0
        ? `<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:var(--accent);margin-left:6px;flex-shrink:0;"></span>`
        : '';
      const preview = conv.lastMessage?.body?.slice(0, 80) || '';
      const timeStr = timeAgo(conv.lastMessage?.sentAt);
      return `
        <div class="file-item" onclick="openConversation('${escapeHtml(conv.with)}')" style="grid-template-columns:44px 1fr auto;">
          ${avatar}
          <div style="min-width:0;">
            <div style="display:flex;align-items:center;gap:4px;">
              <span style="font-weight:${conv.unreadCount > 0 ? '600' : '500'};font-size:13px;">${isSystem ? 'Delta System' : escapeHtml(conv.with)}</span>
              ${unreadDot}
            </div>
            <div style="font-size:12px;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(preview)}</div>
          </div>
          <div style="font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--text-muted);flex-shrink:0;">${timeStr}</div>
        </div>
      `;
    }).join('');
    state.unreadCount = res.conversations.reduce((a, c) => a + c.unreadCount, 0);
    updateInboxBadge();
  } catch (e) {
    const el = document.getElementById('inbox-list');
    if (el) el.innerHTML = `<div class="empty-state"><div class="empty-state-icon">⚠️</div><h3>Could not load inbox</h3><p>${e.message}</p></div>`;
  }
}

function openConversation(withUser) {
  const main = document.getElementById('main-content');
  const isSystem = withUser === 'delta-system';
  main.innerHTML = `
    <div class="breadcrumb">
      <span class="breadcrumb-item" onclick="navigate('home')">Home</span>
      <span class="breadcrumb-sep">/</span>
      <span class="breadcrumb-item" onclick="navigate('inbox')">Inbox</span>
      <span class="breadcrumb-sep">/</span>
      <span class="breadcrumb-item active">${isSystem ? 'Delta System' : escapeHtml(withUser)}</span>
    </div>
    <div class="card" style="margin-bottom:14px;">
      <div class="card-header" style="gap:10px;">
        ${isSystem
          ? `<div style="width:30px;height:30px;border-radius:50%;background:var(--accent-bg);border:1px solid rgba(233,150,122,0.3);display:flex;align-items:center;justify-content:center;font-family:'Syne',sans-serif;font-weight:800;font-size:13px;color:var(--accent);">Δ</div>`
          : `<img src="${getAvatar(withUser)}" style="width:30px;height:30px;border-radius:50%;" />`
        }
        <h3>${isSystem ? 'Delta System' : escapeHtml(withUser)}</h3>
        ${!isSystem ? `<button class="btn btn-danger btn-sm" style="margin-left:auto;" onclick="deleteConversation('${escapeHtml(withUser)}')">Delete</button>` : ''}
      </div>
      <div id="conv-messages" style="padding:16px;display:flex;flex-direction:column;gap:10px;min-height:200px;max-height:480px;overflow-y:auto;">
        ${skeletonRows(3)}
      </div>
    </div>
    ${!isSystem ? `
    <div class="card">
      <div class="card-body" style="display:flex;gap:8px;align-items:flex-end;">
        <textarea id="reply-input" placeholder="Write a message…" rows="2" style="flex:1;resize:none;"></textarea>
        <button class="btn btn-primary" onclick="sendReply('${escapeHtml(withUser)}')">Send</button>
      </div>
    </div>` : ''}
  `;
  loadConversation(withUser);
}

async function loadConversation(withUser) {
  try {
    const res = await api('GET', `/messages/${encodeURIComponent(withUser)}`);
    const el = document.getElementById('conv-messages');
    if (!el) return;
    const me = state.user.username;
    if (res.messages.length === 0) {
      el.innerHTML = `<div style="text-align:center;color:var(--text-muted);font-size:13px;padding:20px;">No messages yet. Say hello!</div>`;
      return;
    }
    el.innerHTML = res.messages.map(msg => {
      const isMine = msg.from === me;
      const isSystem = msg.from === 'delta-system';
      const formattedBody = escapeHtml(msg.body).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
      if (isSystem) {
        return `
          <div style="background:var(--accent-bg);border:1px solid rgba(233,150,122,0.25);border-radius:var(--radius-lg);padding:12px 16px;margin:4px 0;">
            ${msg.subject ? `<div style="font-family:'Syne',sans-serif;font-weight:700;font-size:13px;margin-bottom:4px;">${escapeHtml(msg.subject)}</div>` : ''}
            <div style="font-size:13px;color:var(--text-primary);">${formattedBody}</div>
            <div style="font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--text-muted);margin-top:6px;">${timeAgo(msg.sentAt)}</div>
          </div>
        `;
      }
      return `
        <div style="display:flex;flex-direction:column;align-items:${isMine ? 'flex-end' : 'flex-start'};">
          <div style="max-width:75%;background:${isMine ? 'var(--accent)' : 'var(--bg-tertiary)'};color:${isMine ? '#fff' : 'var(--text-primary)'};border-radius:${isMine ? '12px 12px 4px 12px' : '12px 12px 12px 4px'};padding:10px 14px;font-size:13px;">
            ${formattedBody}
          </div>
          <div style="font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--text-muted);margin-top:3px;">${timeAgo(msg.sentAt)}</div>
        </div>
      `;
    }).join('');
    el.scrollTop = el.scrollHeight;
    refreshUnreadCount();
  } catch (e) {
    const el = document.getElementById('conv-messages');
    if (el) el.innerHTML = `<div style="color:var(--danger);padding:20px;text-align:center;">${e.message}</div>`;
  }
}

async function sendReply(toUser) {
  const input = document.getElementById('reply-input');
  const body = input?.value?.trim();
  if (!body) return;
  input.value = '';
  try {
    await api('POST', '/messages/send', { to: toUser, body });
    loadConversation(toUser);
  } catch (e) {
    toast(e.message || 'Could not send message', 'error');
  }
}

async function deleteConversation(withUser) {
  if (!confirm(`Delete conversation with ${withUser}?`)) return;
  try {
    await api('DELETE', `/messages/${encodeURIComponent(withUser)}`);
    toast('Conversation deleted', 'info');
    navigate('inbox');
  } catch (e) { toast(e.message || 'Could not delete', 'error'); }
}

function openComposeModal() {
  document.getElementById('compose-modal').classList.remove('hidden');
  document.getElementById('compose-to').focus();
}

function closeComposeModal() {
  const modal = document.getElementById('compose-modal');
  if (modal) modal.classList.add('hidden');
  const to = document.getElementById('compose-to');
  const body = document.getElementById('compose-body');
  if (to) to.value = '';
  if (body) body.value = '';
}

async function sendCompose() {
  const to = safeValue('compose-to');
  const body = safeValue('compose-body');
  if (!to || !body) { toast('Please fill in all fields', 'error'); return; }
  const btn = document.getElementById('compose-send-btn');
  setLoading(btn, true);
  try {
    await api('POST', '/messages/send', { to, body });
    closeComposeModal();
    toast(`Message sent to ${to}!`, 'success');
    if (state.currentView === 'inbox') navigate('inbox');
  } catch (e) {
    toast(e.message || 'Could not send', 'error');
  } finally {
    setLoading(btn, false);
  }
}

async function renderAdmin(el) {
  if (!state.user || !ADMIN_USERS.includes(state.user.username)) {
    el.innerHTML = `<div class="empty-state"><div class="empty-state-icon">🔒</div><h3>Access denied</h3></div>`;
    return;
  }
  el.innerHTML = `
    <div class="breadcrumb">
      <span class="breadcrumb-item" onclick="navigate('home')">Home</span>
      <span class="breadcrumb-sep">/</span>
      <span class="breadcrumb-item active">Admin Panel</span>
    </div>
    <div class="section-header">
      <div><h2>Admin Panel</h2><p style="color:var(--text-secondary);font-size:13px;margin-top:2px;">Manage users and approvals</p></div>
    </div>
    <div style="display:flex;gap:8px;margin-bottom:20px;border-bottom:1px solid var(--border);padding-bottom:0;">
      <button class="btn btn-ghost btn-sm" id="tab-btn-pending" onclick="switchAdminTab('pending')"
        style="border-bottom:2px solid var(--accent);border-radius:0;padding-bottom:10px;">
        Pending Approvals
      </button>
      <button class="btn btn-ghost btn-sm" id="tab-btn-users" onclick="switchAdminTab('users')"
        style="border-bottom:2px solid transparent;border-radius:0;padding-bottom:10px;">
        User Management
      </button>
    </div>
    <div id="admin-tab-pending">
      <div class="card" id="pending-list"><div style="padding:20px;">${skeletonRows(2)}</div></div>
    </div>
    <div id="admin-tab-users" class="hidden">
      <div class="card" id="users-list"><div style="padding:20px;">${skeletonRows(3)}</div></div>
    </div>
  `;
  loadPendingAccounts();
  loadAdminUsers();
}

async function loadPendingAccounts() {
  try {
    const res = await api('GET', '/admin/pending');
    const el = document.getElementById('pending-list');
    if (!el) return;
    if (res.pending.length === 0) {
      el.innerHTML = `<div class="empty-state"><div class="empty-state-icon">✅</div><h3>No pending approvals</h3><p>All accounts are up to date.</p></div>`;
      return;
    }
    el.innerHTML = `
      <div class="card-header"><h3>Pending accounts (${res.pending.length})</h3></div>
      ${res.pending.map(u => `
        <div class="file-item" style="grid-template-columns:44px 1fr auto;">
          <img src="${escapeHtml(u.avatar)}" style="width:36px;height:36px;border-radius:50%;object-fit:cover;" />
          <div>
            <div style="font-weight:600;font-size:13px;">${escapeHtml(u.username)}</div>
            <div style="font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--text-muted);">Requested ${timeAgo(u.createdAt)}</div>
          </div>
          <div style="display:flex;gap:6px;">
            <button class="btn btn-primary btn-sm" onclick="approveAccount('${escapeHtml(u.username)}')">Approve</button>
            <button class="btn btn-danger btn-sm" onclick="denyAccount('${escapeHtml(u.username)}')">Deny</button>
          </div>
        </div>
      `).join('')}
    `;
  } catch (e) {
    const el = document.getElementById('pending-list');
    if (el) el.innerHTML = `<div class="empty-state"><div class="empty-state-icon">⚠️</div><h3>Could not load</h3><p>${e.message}</p></div>`;
  }
}

function switchAdminTab(tab) {
  const isPending = tab === 'pending';
  document.getElementById('admin-tab-pending').classList.toggle('hidden', !isPending);
  document.getElementById('admin-tab-users').classList.toggle('hidden', isPending);
  document.getElementById('tab-btn-pending').style.borderBottomColor = isPending ? 'var(--accent)' : 'transparent';
  document.getElementById('tab-btn-users').style.borderBottomColor = !isPending ? 'var(--accent)' : 'transparent';
}

async function loadAdminUsers() {
  try {
    const res = await api('GET', '/admin/users');
    const el = document.getElementById('users-list');
    if (!el) return;
    if (res.users.length === 0) {
      el.innerHTML = `<div class="empty-state"><div class="empty-state-icon">👥</div><h3>No users yet</h3></div>`;
      return;
    }
    el.innerHTML = `
      <div class="card-header"><h3>All users (${res.users.length})</h3></div>
      ${res.users.map(u => {
        const isAdmin = ADMIN_USERS.includes(u.username)
        return `
          <div class="file-item" style="grid-template-columns:44px 1fr auto;">
            <img src="${escapeHtml(u.avatar)}" style="width:36px;height:36px;border-radius:50%;object-fit:cover;flex-shrink:0;" />
            <div style="min-width:0;">
              <div style="display:flex;align-items:center;gap:6px;">
                <span style="font-weight:500;font-size:13px;">${escapeHtml(u.username)}</span>
                ${isAdmin ? `<span style="font-family:'JetBrains Mono',monospace;font-size:10px;font-weight:500;background:var(--warning-bg);color:var(--warning);border-radius:4px;padding:1px 6px;">admin</span>` : ''}
              </div>
              <div style="font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--text-muted);">
                ${u.uploads || 0} files · ${formatBytes(u.totalSize || 0)} · joined ${timeAgo(u.createdAt)}
              </div>
            </div>
            ${isAdmin
              ? `<div style="font-size:12px;color:var(--text-muted);padding-right:4px;">Protected</div>`
              : `<div style="display:flex;gap:6px;flex-shrink:0;">
                  <button class="btn btn-secondary btn-sm" onclick="openResetPasswordModal('${escapeHtml(u.username)}')">Reset PW</button>
                  <button class="btn btn-danger btn-sm" onclick="adminDeleteUser('${escapeHtml(u.username)}')">Delete</button>
                </div>`
            }
          </div>
        `;
      }).join('')}
    `;
  } catch (e) {
    const el = document.getElementById('users-list');
    if (el) el.innerHTML = `<div class="empty-state"><div class="empty-state-icon">⚠️</div><h3>Could not load users</h3><p>${e.message}</p></div>`;
  }
}

let resetPwState = null;

function openResetPasswordModal(username) {
  const modal = document.getElementById('compose-modal');
  const inner = document.getElementById('compose-modal-inner');
  if (!modal || !inner) return;
  inner.innerHTML = `
    <div class="modal-header">
      <h2>Reset Password</h2>
      <p>Set a new password for <strong>${escapeHtml(username)}</strong></p>
    </div>
    <div style="display:flex;flex-direction:column;gap:14px;">
      <input type="password" id="reset-pw-input" placeholder="at least 6 characters" />
      <div style="display:flex;gap:8px;">
        <button class="btn btn-primary" id="reset-pw-btn">Set password</button>
        <button class="btn btn-secondary" id="cancel-btn">Cancel</button>
      </div>
    </div>
  `;
  modal.classList.remove('hidden');
  const input = inner.querySelector('#reset-pw-input');
  const btn = inner.querySelector('#reset-pw-btn');
  const cancel = inner.querySelector('#cancel-btn');
  resetPwState = { username, input, btn };
  input.focus();
  btn.onclick = () => submitResetPassword();
  cancel.onclick = closeComposeModal;
}

async function submitResetPassword() {
  if (!resetPwState?.input || !resetPwState?.btn) { toast('UI broken. Reopen modal.', 'error'); return; }
  const { username, input, btn } = resetPwState;
  const password = input.value.trim();
  if (password.length < 6) { toast('Password must be at least 6 characters', 'error'); return; }
  setLoading(btn, true);
  try {
    await api('POST', `/admin/users/${encodeURIComponent(username)}/password`, { password });
    closeComposeModal();
    toast(`Password reset for ${username}`, 'success');
  } catch (e) {
    toast(e.message || 'Could not reset password', 'error');
  } finally {
    setLoading(btn, false);
    resetPwState = null;
  }
}

async function adminDeleteUser(username) {
  if (!confirm(`Permanently delete user "${username}"?\n\nThis cannot be undone.`)) return;
  try {
    await api('DELETE', `/admin/users/${encodeURIComponent(username)}`);
    toast(`${username} deleted.`, 'info');
    loadAdminUsers();
  } catch (e) { toast(e.message || 'Could not delete user', 'error'); }
}

async function approveAccount(username) {
  try {
    await api('POST', `/admin/approve/${encodeURIComponent(username)}`);
    toast(`${username} approved!`, 'success');
    loadPendingAccounts();
    loadAdminUsers();
  } catch (e) { toast(e.message || 'Could not approve', 'error'); }
}

async function denyAccount(username) {
  if (!confirm(`Deny account for ${username}? This cannot be undone.`)) return;
  try {
    await api('POST', `/admin/deny/${encodeURIComponent(username)}`);
    toast(`${username} denied.`, 'info');
    loadPendingAccounts();
  } catch (e) { toast(e.message || 'Could not deny', 'error'); }
}

async function loadExploreFiles(containerId, limit = 50) {
  try {
    const res = await api('GET', '/files');
    state.files = res.files || [];
    let filtered = sortFiles(filterFiles(state.files)).slice(0, limit);
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

async function loadRecentFiles(containerId, showAll = false) {
  try {
    const res = await api('GET', '/files');
    state.files = res.files || [];
    let files = res.files || [];
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

function renderFileRow(f, showDelete = false) {
  if (f.name === '.gitkeep') return '';
  const uploader = f.uploader || 'unknown';
  return `
    <div class="file-item" onclick="openPreview('${escapeHtml(f.name)}','${escapeHtml(f.download_url)}','${f.ext || ''}')">
      <div class="file-icon">${f.icon || '📁'}</div>
      <div class="file-info">
        <div class="file-name">${escapeHtml(f.originalName || f.name)}</div>
        <div class="file-meta">
          <div class="file-uploader">
            <img src="${getAvatar(uploader)}" alt="${escapeHtml(uploader)}" />
            <span>${escapeHtml(uploader)}</span>
          </div>
          <span>·</span>
          <span>${f.formattedSize || formatBytes(f.size || 0)}</span>
          ${f.description ? `<span>·</span><span style="overflow:hidden;white-space:nowrap;text-overflow:ellipsis;max-width:200px;">${escapeHtml(f.description)}</span>` : ''}
        </div>
      </div>
      <div class="file-size mono">${f.formattedSize || ''}</div>
      <div class="file-actions" onclick="event.stopPropagation()">
        <button class="btn btn-ghost btn-icon btn-sm" title="Download" onclick="downloadFile('${escapeHtml(f.name)}','${escapeHtml(f.download_url)}')">
          <svg viewBox="0 0 16 16" width="13" height="13" fill="currentColor"><path d="M2.75 14A1.75 1.75 0 0 1 1 12.25v-2.5a.75.75 0 0 1 1.5 0v2.5c0 .138.112.25.25.25h10.5a.25.25 0 0 0 .25-.25v-2.5a.75.75 0 0 1 1.5 0v2.5A1.75 1.75 0 0 1 13.25 14Zm-1-5.573 3.25 3.25a.75.75 0 0 0 1.06 0L9.31 8.427A.75.75 0 0 0 8.25 7.5H6.25a.75.75 0 0 0-.75.75v.677Z"/></svg>
        </button>
        <button class="btn btn-ghost btn-icon btn-sm" title="Copy link" onclick="copyLink('${escapeHtml(f.download_url)}')">
          <svg viewBox="0 0 16 16" width="13" height="13" fill="currentColor"><path d="m7.775 3.275 1.25-1.25a3.5 3.5 0 1 1 4.95 4.95l-2.5 2.5a3.5 3.5 0 0 1-4.95 0 .751.751 0 0 1 .018-1.042.751.751 0 0 1 1.042-.018 2 2 0 0 0 2.83 0l2.5-2.5a2.002 2.002 0 0 0-2.83-2.83l-1.25 1.25a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042Zm-4.69 9.64a2.002 2.002 0 0 0 2.83 0l1.25-1.25a.751.751 0 0 1 1.042.018.751.751 0 0 1 .018 1.042l-1.25 1.25a3.5 3.5 0 1 1-4.95-4.95l2.5-2.5a3.5 3.5 0 0 1 4.95 0 .751.751 0 0 1-.018 1.042.751.751 0 0 1-1.042.018 2 2 0 0 0-2.83 0l-2.5 2.5a2.002 2.002 0 0 0 0 2.83Z"/></svg>
        </button>
        ${showDelete && state.user ? `<button class="btn btn-ghost btn-icon btn-sm" title="Delete" style="color:var(--danger)" onclick="deleteFile('${escapeHtml(f.name)}')">
          <svg viewBox="0 0 16 16" width="13" height="13" fill="currentColor"><path d="M11 1.75V3h2.25a.75.75 0 0 1 0 1.5H2.75a.75.75 0 0 1 0-1.5H5V1.75C5 .784 5.784 0 6.75 0h2.5C10.216 0 11 .784 11 1.75ZM4.496 6.675l.66 6.6a.25.25 0 0 0 .249.225h5.19a.25.25 0 0 0 .249-.225l.66-6.6a.75.75 0 0 1 1.49.149l-.66 6.6A1.748 1.748 0 0 1 10.595 15h-5.19a1.75 1.75 0 0 1-1.74-1.575l-.66-6.6a.75.75 0 1 1 1.49-.15ZM6.5 1.75V3h3V1.75a.25.25 0 0 0-.25-.25h-2.5a.25.25 0 0 0-.25.25Z"/></svg>
        </button>` : ''}
      </div>
    </div>
  `;
}

function renderFileCard(f) {
  if (f.name === '.gitkeep') return '';
  const uploader = f.uploader || 'unknown';
  const isImage = ['png','jpg','jpeg','gif','webp','svg'].includes(f.ext || '');
  return `
    <div class="file-card" onclick="openPreview('${escapeHtml(f.name)}','${escapeHtml(f.download_url)}','${f.ext || ''}')">
      <div class="file-card-preview">
        ${isImage && f.download_url ? `<img src="${escapeHtml(f.download_url)}" alt="${escapeHtml(f.name)}" onerror="this.parentElement.innerHTML='${f.icon || '📁'}'" />` : (f.icon || '📁')}
      </div>
      <div class="file-card-body">
        <div class="file-card-name" title="${escapeHtml(f.originalName || f.name)}">${escapeHtml(f.originalName || f.name)}</div>
        <div class="file-card-meta">
          <div class="file-card-uploader">
            <img src="${getAvatar(uploader)}" alt="${escapeHtml(uploader)}" />
            <span>${escapeHtml(uploader)}</span>
          </div>
          <span>·</span>
          <span class="mono">${f.formattedSize || formatBytes(f.size || 0)}</span>
        </div>
      </div>
    </div>
  `;
}

function openPreview(name, url, ext) {
  const isImage = ['png','jpg','jpeg','gif','webp','svg','bmp'].includes(ext);
  const isPdf = ext === 'pdf';
  const isText = ['txt','md','json','js','ts','html','css','py','rs','go','java','cpp','c','yaml','yml','toml','xml'].includes(ext);
  document.getElementById('preview-modal').classList.remove('hidden');
  const content = document.getElementById('preview-modal-content');
  content.innerHTML = `
    <div style="padding:18px 24px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:12px;">
      <div style="font-size:22px;">${getFileIcon(ext)}</div>
      <div style="flex:1;min-width:0;">
        <div style="font-family:'Syne',sans-serif;font-weight:700;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${decodeURIComponent(name)}</div>
        <div style="font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--text-muted);">.${ext || 'file'}</div>
      </div>
      <div style="display:flex;gap:8px;flex-shrink:0;">
        <button class="btn btn-secondary btn-sm" onclick="copyLink('${url}')">Copy link</button>
        <a class="btn btn-primary btn-sm" href="${url}" download target="_blank">Download</a>
      </div>
    </div>
    <div style="padding:20px;min-height:200px;display:flex;align-items:center;justify-content:center;">
      ${isImage ? `<img src="${url}" style="max-width:100%;max-height:60vh;object-fit:contain;border-radius:var(--radius);" />` :
        isPdf ? `<iframe src="${url}" style="width:100%;height:60vh;border:none;border-radius:var(--radius);"></iframe>` :
        isText ? `<div style="width:100%;"><div style="font-size:12px;color:var(--text-muted);margin-bottom:8px;">Text preview not available for remote files.</div><a href="${url}" target="_blank" class="btn btn-secondary">Open in new tab</a></div>` :
        `<div style="text-align:center;padding:40px;">
          <div style="font-size:52px;margin-bottom:16px;">${getFileIcon(ext)}</div>
          <div style="font-family:'Syne',sans-serif;font-weight:700;margin-bottom:8px;">No preview available</div>
          <div style="color:var(--text-secondary);font-size:13px;margin-bottom:20px;">This file type cannot be previewed in the browser.</div>
          <a class="btn btn-primary" href="${url}" download target="_blank">Download file</a>
        </div>`
      }
    </div>
  `;
}
function closePreviewModal() { document.getElementById('preview-modal').classList.add('hidden'); }

async function downloadFile(name, url) {
  if (url) window.open(url, '_blank');
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
    toast('Link copied to clipboard!', 'success');
  });
}

async function deleteFile(name) {
  if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
  try {
    await api('DELETE', `/files/${name}`);
    toast('File deleted successfully', 'success');
    navigate(state.currentView);
  } catch (e) { toast(e.message || 'Could not delete file', 'error'); }
}

function handleFileSelect(e) { const file = e.target.files[0]; if (file) setUploadFile(file); }
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

async function handleUpload() {
  if (!state.uploadFile) { toast('Please select a file', 'error'); return; }
  const btn = document.getElementById('upload-btn');
  const progressEl = document.getElementById('upload-progress');
  const statusEl = document.getElementById('upload-status');
  const fillEl = document.getElementById('progress-fill');
  const descEl = document.getElementById('upload-desc');
  if (!btn || !progressEl || !statusEl || !fillEl || !descEl) { console.error('Upload UI missing'); return; }
  setLoading(btn, true);
  progressEl.classList.remove('hidden');
  let prog = 0;
  const interval = setInterval(() => {
    prog = Math.min(prog + Math.random() * 15, 90);
    if (fillEl) fillEl.style.width = prog + '%';
  }, 200);
  try {
    const formData = new FormData();
    formData.append('file', state.uploadFile);
    formData.append('description', descEl.value);
    const res = await fetch(`${API}/files/upload`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${state.token}` },
      body: formData,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Upload failed');
    clearInterval(interval);
    if (fillEl) fillEl.style.width = '100%';
    if (statusEl) statusEl.textContent = 'Upload complete!';
    if (state.user) {
      state.user.uploads = (state.user.uploads || 0) + 1;
      state.user.totalSize = (state.user.totalSize || 0) + state.uploadFile.size;
      localStorage.setItem('delta_user', JSON.stringify(state.user));
    }
    toast('File uploaded successfully!', 'success');
    setTimeout(() => navigate('my-files'), 1000);
  } catch (e) {
    clearInterval(interval);
    if (fillEl) fillEl.style.width = '0%';
    if (progressEl) progressEl.classList.add('hidden');
    toast(e.message || 'Upload failed', 'error');
  } finally {
    if (btn) setLoading(btn, false);
  }
}

function openProfileModal() {
  if (!state.user) { openAuthModal('login'); return; }
  closeDropdown();
  document.getElementById('profile-modal').classList.remove('hidden');
  renderProfileModalContent();
}

function renderProfileModalContent() {
  const content = document.getElementById('profile-modal-content');
  const user = state.user;
  content.innerHTML = `
    <div class="profile-header">
      <div class="profile-avatar-wrap">
        <img src="${user.avatar}" class="profile-avatar" id="profile-avatar-img" />
        <div class="profile-avatar-edit" onclick="toggleAvatarPanel()" title="Change avatar">
          <svg viewBox="0 0 16 16" width="11" height="11" fill="white"><path d="M11.013 1.427a1.75 1.75 0 0 1 2.474 0l1.086 1.086a1.75 1.75 0 0 1 0 2.474l-8.61 8.61c-.21.21-.47.364-.756.445l-3.251.93a.75.75 0 0 1-.927-.928l.929-3.25c.081-.286.235-.547.445-.758l8.61-8.61Z"/></svg>
        </div>
      </div>
      <div class="profile-info">
        <div class="profile-username">${user.username}</div>
        <div class="profile-bio">${escapeHtml(user.bio || 'No bio yet.')}</div>
        <div class="profile-meta">
          ${user.location ? `<div class="profile-meta-item"><svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor"><path d="m12.596 11.596-3.535 3.536a1.5 1.5 0 0 1-2.122 0l-3.535-3.536a6.5 6.5 0 1 1 9.192-9.193 6.5 6.5 0 0 1 0 9.193Zm-1.06-8.132v-.001a5 5 0 1 0-7.072 7.072L8 14.07l3.536-3.534a5 5 0 0 0 0-7.072ZM8 9a2 2 0 1 1-.001-3.999A2 2 0 0 1 8 9Z"/></svg>${escapeHtml(user.location)}</div>` : ''}
          <div class="profile-meta-item">
            <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor"><path d="M4.75 0A1.75 1.75 0 0 0 3 1.75v12.5C3 15.216 3.784 16 4.75 16h6.5A1.75 1.75 0 0 0 13 14.25V1.75A1.75 1.75 0 0 0 11.25 0ZM4.5 1.75a.25.25 0 0 1 .25-.25h6.5a.25.25 0 0 1 .25.25v12.5a.25.25 0 0 1-.25.25h-6.5a.25.25 0 0 1-.25-.25Zm3.75 10a.75.75 0 1 1 0 1.5.75.75 0 0 1 0-1.5Z"/></svg>
            Member since ${new Date(user.createdAt).toLocaleDateString()}
          </div>
        </div>
      </div>
    </div>
    <div id="avatar-panel" class="hidden" style="border-bottom:1px solid var(--border);background:var(--bg-tertiary);">
      <div style="display:flex;border-bottom:1px solid var(--border);">
        <div class="avatar-tab active" id="tab-upload" onclick="switchAvatarTab('upload')"
          style="flex:1;text-align:center;padding:10px;font-size:12px;font-weight:500;cursor:pointer;border-bottom:2px solid var(--accent);color:var(--text-primary);">
          Upload image
        </div>
        <div class="avatar-tab" id="tab-generated" onclick="switchAvatarTab('generated')"
          style="flex:1;text-align:center;padding:10px;font-size:12px;font-weight:500;cursor:pointer;border-bottom:2px solid transparent;color:var(--text-secondary);">
          Generated
        </div>
      </div>
      <div id="avatar-tab-upload" style="padding:16px;">
        <div id="avatar-upload-zone"
          style="border:1.5px dashed var(--border-hover);border-radius:var(--radius-lg);padding:24px;text-align:center;cursor:pointer;transition:all .2s;"
          onclick="document.getElementById('avatar-file-input').click()"
          ondragover="avatarDragOver(event)" ondragleave="avatarDragLeave(event)" ondrop="avatarDrop(event)">
          <input type="file" id="avatar-file-input" accept="image/jpeg,image/png,image/gif,image/webp" style="display:none" onchange="handleAvatarFileSelect(event)" />
          <div style="font-size:26px;margin-bottom:8px;">🖼️</div>
          <div style="font-size:13px;font-weight:500;margin-bottom:4px;">Drop image here or click to browse</div>
          <div style="font-size:12px;color:var(--text-muted);">JPEG, PNG, GIF, WebP · Max 5 MB</div>
        </div>
        <div id="avatar-upload-preview" class="hidden" style="margin-top:12px;">
          <div style="display:flex;align-items:center;gap:12px;background:var(--bg-secondary);border:1px solid var(--border);border-radius:var(--radius);padding:12px;">
            <img id="avatar-preview-img" style="width:44px;height:44px;border-radius:50%;object-fit:cover;border:1.5px solid var(--border);" />
            <div style="flex:1;min-width:0;">
              <div id="avatar-preview-name" style="font-size:13px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;"></div>
              <div id="avatar-preview-size" style="font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--text-muted);"></div>
            </div>
            <button class="btn btn-ghost btn-icon btn-sm" onclick="clearAvatarFile()" title="Remove">
              <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.749.749 0 0 1 1.275.326.749.749 0 0 1-.215.734L9.06 8l3.22 3.22a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215L8 9.06l-3.22 3.22a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z"/></svg>
            </button>
          </div>
          <button class="btn btn-primary btn-sm" style="margin-top:10px;width:100%;justify-content:center;" onclick="uploadCustomAvatar()" id="avatar-upload-btn">
            Set as profile picture
          </button>
        </div>
        <div id="avatar-upload-progress" class="hidden" style="margin-top:10px;">
          <div style="font-size:12px;color:var(--text-secondary);margin-bottom:4px;">Uploading avatar…</div>
          <div class="progress-bar"><div class="progress-fill" id="avatar-progress-fill" style="width:0%"></div></div>
        </div>
      </div>
      <div id="avatar-tab-generated" class="hidden" style="padding:16px;">
        <div style="font-family:'JetBrains Mono',monospace;font-size:10px;font-weight:500;color:var(--text-muted);margin-bottom:10px;text-transform:uppercase;letter-spacing:.06em;">Choose a style</div>
        <div class="avatar-picker" id="profile-avatar-picker-generated">
          ${AVATAR_SEEDS.map(seed => {
            const url = `https://api.dicebear.com/7.x/identicon/svg?seed=${user.username}_${seed}`;
            return `<img src="${url}" class="avatar-option" onclick="selectProfileAvatar('${url}', this)" title="${seed}" />`;
          }).join('')}
          ${['bottts','micah','fun-emoji','lorelei','avataaars','pixel-art','thumbs'].map(style => {
            const url = `https://api.dicebear.com/7.x/${style}/svg?seed=${user.username}`;
            return `<img src="${url}" class="avatar-option" onclick="selectProfileAvatar('${url}', this)" title="${style}" />`;
          }).join('')}
        </div>
        <button class="btn btn-primary btn-sm" style="margin-top:12px;" onclick="applyGeneratedAvatar()" id="apply-generated-btn" disabled>
          Apply selected avatar
        </button>
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
        <input type="text" id="profile-location-input" placeholder="England, UK" value="${escapeHtml(user.location || '')}" />
      </div>
      <div style="display:flex;gap:8px;">
        <button class="btn btn-primary" onclick="saveProfile()">Save changes</button>
        <button class="btn btn-secondary" onclick="closeProfileModal()">Cancel</button>
      </div>
    </div>
  `;
}

function toggleAvatarPanel() { document.getElementById('avatar-panel').classList.toggle('hidden'); }

function switchAvatarTab(tab) {
  const isUpload = tab === 'upload';
  document.getElementById('avatar-tab-upload').classList.toggle('hidden', !isUpload);
  document.getElementById('avatar-tab-generated').classList.toggle('hidden', isUpload);
  document.getElementById('tab-upload').style.borderBottomColor = isUpload ? 'var(--accent)' : 'transparent';
  document.getElementById('tab-upload').style.color = isUpload ? 'var(--text-primary)' : 'var(--text-secondary)';
  document.getElementById('tab-generated').style.borderBottomColor = !isUpload ? 'var(--accent)' : 'transparent';
  document.getElementById('tab-generated').style.color = !isUpload ? 'var(--text-primary)' : 'var(--text-secondary)';
}

function avatarDragOver(e) { e.preventDefault(); document.getElementById('avatar-upload-zone').style.borderColor = 'var(--accent)'; document.getElementById('avatar-upload-zone').style.background = 'var(--accent-bg)'; }
function avatarDragLeave() { document.getElementById('avatar-upload-zone').style.borderColor = ''; document.getElementById('avatar-upload-zone').style.background = ''; }
function avatarDrop(e) { e.preventDefault(); avatarDragLeave(); const file = e.dataTransfer.files[0]; if (file) processAvatarFile(file); }
function handleAvatarFileSelect(e) { const file = e.target.files[0]; if (file) processAvatarFile(file); }

function processAvatarFile(file) {
  const allowed = ['image/jpeg','image/png','image/gif','image/webp'];
  if (!allowed.includes(file.type)) { toast('Please select a JPEG, PNG, GIF, or WebP image', 'error'); return; }
  if (file.size > 5 * 1024 * 1024) { toast('Image must be under 5 MB', 'error'); return; }
  state._pendingAvatarFile = file;
  const reader = new FileReader();
  reader.onload = (e) => {
    document.getElementById('avatar-preview-img').src = e.target.result;
    document.getElementById('profile-avatar-img').src = e.target.result;
  };
  reader.readAsDataURL(file);
  document.getElementById('avatar-preview-name').textContent = file.name;
  document.getElementById('avatar-preview-size').textContent = formatBytes(file.size);
  document.getElementById('avatar-upload-preview').classList.remove('hidden');
  document.getElementById('avatar-upload-zone').classList.add('hidden');
}

function clearAvatarFile() {
  state._pendingAvatarFile = null;
  document.getElementById('avatar-upload-preview').classList.add('hidden');
  document.getElementById('avatar-upload-zone').classList.remove('hidden');
  document.getElementById('avatar-file-input').value = '';
  document.getElementById('profile-avatar-img').src = state.user.avatar;
}

async function uploadCustomAvatar() {
  if (!state._pendingAvatarFile) return;
  const btn = document.getElementById('avatar-upload-btn');
  const progressEl = document.getElementById('avatar-upload-progress');
  const fillEl = document.getElementById('avatar-progress-fill');
  btn.disabled = true; btn.textContent = 'Uploading…';
  progressEl.classList.remove('hidden');
  let prog = 0;
  const interval = setInterval(() => { prog = Math.min(prog + Math.random() * 20, 85); fillEl.style.width = prog + '%'; }, 150);
  try {
    const formData = new FormData();
    formData.append('avatar', state._pendingAvatarFile);
    const res = await fetch(`${API}/auth/avatar`, { method: 'POST', headers: { 'Authorization': `Bearer ${state.token}` }, body: formData });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Upload failed');
    clearInterval(interval); fillEl.style.width = '100%';
    state.user = data.user;
    localStorage.setItem('delta_user', JSON.stringify(data.user));
    state._pendingAvatarFile = null;
    renderNavActions();
    toast('Profile picture updated!', 'success');
    setTimeout(() => renderProfileModalContent(), 400);
  } catch (e) {
    clearInterval(interval);
    toast(e.message || 'Avatar upload failed', 'error');
    btn.disabled = false; btn.textContent = 'Set as profile picture';
    progressEl.classList.add('hidden'); fillEl.style.width = '0%';
  }
}

function selectProfileAvatar(url, el) {
  document.querySelectorAll('#profile-avatar-picker-generated .avatar-option').forEach(e => e.classList.remove('selected'));
  el.classList.add('selected');
  state._pendingAvatar = url;
  document.getElementById('profile-avatar-img').src = url;
  const applyBtn = document.getElementById('apply-generated-btn');
  if (applyBtn) applyBtn.disabled = false;
}

async function applyGeneratedAvatar() {
  if (!state._pendingAvatar) return;
  const btn = document.getElementById('apply-generated-btn');
  btn.disabled = true; btn.textContent = 'Applying…';
  try {
    const res = await api('PATCH', '/auth/profile', { avatar: state._pendingAvatar });
    state.user = res.user;
    localStorage.setItem('delta_user', JSON.stringify(res.user));
    renderNavActions();
    toast('Avatar updated!', 'success');
    delete state._pendingAvatar;
    setTimeout(() => renderProfileModalContent(), 200);
  } catch (e) {
    toast(e.message || 'Could not update avatar', 'error');
    btn.disabled = false; btn.textContent = 'Apply selected avatar';
  }
}

async function saveProfile() {
  const bio = document.getElementById('profile-bio-input').value;
  const location = document.getElementById('profile-location-input').value;
  try {
    const res = await api('PATCH', '/auth/profile', { bio, location });
    state.user = res.user;
    localStorage.setItem('delta_user', JSON.stringify(res.user));
    renderNavActions();
    closeProfileModal();
    toast('Profile updated!', 'success');
  } catch (e) { toast(e.message || 'Could not save profile', 'error'); }
}

function closeProfileModal() { document.getElementById('profile-modal').classList.add('hidden'); }

function setFilter(f) { state.currentFilter = f; navigate('explore'); }
function setSort(s) { state.currentSort = s; navigate('explore'); }
function setViewMode(m) { state.viewMode = m; navigate('explore'); }

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
    case 'newest': sorted.sort((a, b) => new Date(b.uploadedAt || 0) - new Date(a.uploadedAt || 0)); break;
    case 'oldest': sorted.sort((a, b) => new Date(a.uploadedAt || 0) - new Date(b.uploadedAt || 0)); break;
    case 'largest': sorted.sort((a, b) => (b.size || 0) - (a.size || 0)); break;
    case 'name': sorted.sort((a, b) => (a.name || '').localeCompare(b.name || '')); break;
  }
  return sorted;
}

function filterLabel(f) {
  const labels = { all: 'All', images: 'Images', documents: 'Docs', code: 'Code', archives: 'Archives' };
  return labels[f] || f;
}

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
    { icon: '✉️', name: 'Inbox', meta: 'Your messages', action: () => navigate('inbox') },
    { icon: '👤', name: 'Profile', meta: 'Edit your profile', action: () => openProfileModal() },
  ];
  const filtered = query ? pages.filter(p => p.name.toLowerCase().includes(query.toLowerCase())) : pages;
  state.cmdItems = filtered;
  state.cmdSelected = 0;
  const fileItems = state.files
    .filter(f => f.name !== '.gitkeep' && (f.originalName || f.name).toLowerCase().includes(query.toLowerCase()))
    .slice(0, 5);
  const el = document.getElementById('cmd-results');
  let html = '';
  if (filtered.length) {
    html += `<div class="cmd-section">Navigation</div>`;
    html += filtered.map((p, i) => `
      <div class="cmd-item ${i===state.cmdSelected?'selected':''}" id="cmd-item-${i}">
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
      <div class="cmd-item" onclick="openPreview('${escapeHtml(f.name)}','${escapeHtml(f.download_url)}','${f.ext||''}');closeCommandPalette()">
        <div class="cmd-item-icon">${f.icon || '📁'}</div>
        <div class="cmd-item-info">
          <div class="cmd-item-name">${escapeHtml(f.originalName || f.name)}</div>
          <div class="cmd-item-meta">${f.formattedSize || ''}</div>
        </div>
      </div>
    `).join('');
  }
  if (!html) html = `<div class="cmd-item" style="color:var(--text-muted);justify-content:center;">No results for "${escapeHtml(query)}"</div>`;
  el.innerHTML = html;
  filtered.forEach((p, i) => {
    const item = document.getElementById(`cmd-item-${i}`);
    if (item) item.onclick = () => { p.action(); closeCommandPalette(); };
  });
}

function initKeyboard() {
  document.addEventListener('keydown', e => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      document.getElementById('cmd-palette').classList.contains('hidden') ? openCommandPalette() : closeCommandPalette();
    }
    if (e.key === 'Escape') {
      closeCommandPalette(); closePreviewModal(); closeAuthModal();
      closeProfileModal(); closeComposeModal();
    }
  });
  document.getElementById('cmd-input').addEventListener('input', e => updateCmdResults(e.target.value));
  document.getElementById('cmd-palette').addEventListener('click', e => { if (e.target === document.getElementById('cmd-palette')) closeCommandPalette(); });
  document.getElementById('auth-modal').addEventListener('click', e => { if (e.target === document.getElementById('auth-modal')) closeAuthModal(); });
  document.getElementById('profile-modal').addEventListener('click', e => { if (e.target === document.getElementById('profile-modal')) closeProfileModal(); });
  document.getElementById('preview-modal').addEventListener('click', e => { if (e.target === document.getElementById('preview-modal')) closePreviewModal(); });
  document.getElementById('compose-modal').addEventListener('click', e => { if (e.target === document.getElementById('compose-modal')) closeComposeModal(); });
}

function initSearch() {
  const searchBox = document.getElementById('nav-search-box');
  const input = document.getElementById('search-input');
  searchBox.addEventListener('click', () => openCommandPalette());
  input.addEventListener('focus', () => { openCommandPalette(); input.blur(); });
}

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

function initPasswordStrength() {
  document.getElementById('reg-password')?.addEventListener('input', e => {
    const val = e.target.value;
    const el = document.getElementById('pass-strength');
    if (!el || !val) { if (el) el.innerHTML = ''; return; }
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

function togglePass(id) {
  const input = document.getElementById(id);
  input.type = input.type === 'password' ? 'text' : 'password';
}

function toast(message, type = 'info', duration = 3000) {
  const container = document.getElementById('toast-container');
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.innerHTML = `<div class="toast-dot"></div><span>${escapeHtml(message)}</span>`;
  container.appendChild(t);
  setTimeout(() => {
    t.style.opacity = '0'; t.style.transform = 'translateX(16px)'; t.style.transition = 'all 0.2s';
    setTimeout(() => t.remove(), 200);
  }, duration);
}

async function api(method, path, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (state.token) opts.headers['Authorization'] = `Bearer ${state.token}`;
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${API}${path}`, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

function updateThemeIcon(theme) {
  const btn = document.getElementById('theme-toggle');
  if (!btn) return;
  const icon = theme === 'dark'
    ? `<svg viewBox="0 0 16 16" width="15" height="15" fill="currentColor"><path d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8Z"/></svg>`
    : `<svg viewBox="0 0 16 16" width="15" height="15" fill="currentColor"><path d="M8 12a4 4 0 1 1 0-8 4 4 0 0 1 0 8Zm0-1.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM8 0a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0V.75A.75.75 0 0 1 8 0Zm0 13a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5A.75.75 0 0 1 8 13Z"/></svg>`;
  btn.innerHTML = `${icon} Toggle Theme`;
}

function toggleTheme() {
  const html = document.documentElement;
  const newTheme = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  html.setAttribute('data-theme', newTheme);
  localStorage.setItem('delta_theme', newTheme);
  updateThemeIcon(newTheme);
}

(() => {
  const saved = localStorage.getItem('delta_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
  updateThemeIcon(saved);
})();

function getAvatar(user) { return `${API}/avatar/${encodeURIComponent(user)}`; }
function requireSignIn() { return `<div class="empty-state"><div class="empty-state-icon">🔒</div><h3>Sign in required</h3><p>Please sign in to access this page.</p><button class="btn btn-primary" onclick="openAuthModal('login')">Sign in</button></div>`; }

function safeValue(id) {
  const el = document.getElementById(id);
  if (!el) { console.error(`Missing element: ${id}`); toast('UI error (missing field)', 'error'); return null; }
  return el.value;
}

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024, sizes = ['B','KB','MB','GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function timeAgo(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
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
  if (loading) {
    btn._origText = btn.innerHTML; btn.disabled = true;
    btn.innerHTML = `<svg class="spin" viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8Z" opacity=".25"/><path d="M8 1.5a6.5 6.5 0 0 1 6.5 6.5.75.75 0 0 0 1.5 0A8 8 0 0 0 8 0a.75.75 0 0 0 0 1.5Z"/></svg>`;
  } else {
    btn.disabled = false; btn.innerHTML = btn._origText || 'Submit';
  }
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
      <div class="skeleton" style="width:34px;height:34px;border-radius:var(--radius);"></div>
      <div style="flex:1;min-width:0;">
        <div class="skeleton skeleton-line" style="width:180px;"></div>
        <div class="skeleton skeleton-line" style="width:120px;height:11px;"></div>
      </div>
      <div class="skeleton" style="width:56px;height:18px;border-radius:999px;"></div>
      <div class="skeleton" style="width:48px;height:13px;border-radius:4px;"></div>
    </div>
  `).join('');
}

function skeletonStats(n) {
  return `<div class="stats-grid">${Array(n).fill(0).map(()=>`
    <div class="stat-card">
      <div class="skeleton" style="width:26px;height:26px;border-radius:4px;margin-bottom:10px;"></div>
      <div class="skeleton" style="height:26px;width:80px;border-radius:4px;margin-bottom:4px;"></div>
      <div class="skeleton" style="height:13px;width:100px;border-radius:4px;"></div>
    </div>
  `).join('')}</div>`;
}