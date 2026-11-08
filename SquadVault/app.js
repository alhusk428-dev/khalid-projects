var supabase = window.supabaseClient || window.supabase;

let isSignUpMode = false;
let currentUser = null;
let currentProfile = null;
let userSquads = [];
let activeSquad = null;
let squadPosts = [];
let squadMembers = [];

// Admin/Mod State
let isModModalOpen = false;
let activeAdminTab = 'users'; // 'users' | 'logs'
let userSearchQuery = '';
let allProfilesList = [];
let auditLogsList = [];
let systemStats = { users: 0, squads: 0, posts: 0 };

function formatPostContent(content) {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return content.replace(urlRegex, (url) => {
    return `<a href="${url}" target="_blank" rel="noopener noreferrer" style="color: var(--accent-glow, #a855f7); text-decoration: underline;">${url}</a>`;
  });
}

function renderApp() {
  const appContainer = document.getElementById("app");
  if (!appContainer) return;

  const isStaff = currentProfile?.role === 'admin' || currentProfile?.role === 'mod';

  appContainer.innerHTML = `
    <header style="display: flex; justify-content: space-between; align-items: center; padding: 1rem 2rem;">
      <a href="#" class="logo">SquadVault</a>
      
      <div id="nav-actions" style="display: flex; align-items: center; gap: 0.8rem;">
        ${isStaff ? `
          <button id="open-mod-modal-btn" class="btn-secondary" style="padding: 0.35rem 0.8rem; font-size: 0.78rem; border-radius: 6px; border: 1px solid rgba(168, 85, 247, 0.4); background: rgba(168, 85, 247, 0.15); color: #fff; cursor: pointer;">
            🛡️ Staff Panel
          </button>
        ` : ''}
        <span id="user-display" class="${currentUser ? '' : 'hidden'}" style="font-size: 0.88rem;">
          ${currentProfile?.username ? `@${currentProfile.username}` : (currentUser?.email || '')}
        </span>
        <button id="signout-btn" class="btn-secondary ${currentUser ? '' : 'hidden'}" style="padding: 0.35rem 0.8rem; font-size: 0.8rem;">Sign Out</button>
      </div>
    </header>

    <main>
      ${!currentUser ? renderAuthSection() : renderDashboardSection()}
    </main>

    ${isModModalOpen && isStaff ? renderModModal(currentProfile.role === 'admin') : ''}
  `;

  attachEventListeners();
}

function renderAuthSection() {
  return `
    <div id="auth-section" class="auth-container">
      <h2>${isSignUpMode ? 'Create Your Account' : 'Sign In to SquadVault'}</h2>
      <div id="auth-error" class="error-message"></div>

      <form id="auth-form">
        <div class="input-group">
          <label for="email">Email</label>
          <input type="email" id="email" placeholder="you@example.com" required>
        </div>

        <div class="input-group">
          <label for="password">Password</label>
          <input type="password" id="password" placeholder="••••••••" required>
        </div>

        <button type="submit">${isSignUpMode ? 'Sign Up' : 'Sign In'}</button>
      </form>

      <div style="margin: 1.2rem 0; text-align: center; color: var(--muted); font-size: 0.85rem; position: relative;">
        <span>OR</span>
      </div>

      <button id="github-login-btn" class="btn-secondary" style="width: 100%; display: flex; align-items: center; justify-content: center; gap: 0.5rem; background: #24292e; color: #fff; border: 1px solid rgba(255,255,255,0.1);">
        <svg height="18" width="18" viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.28.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
        </svg>
        Sign in with GitHub
      </button>

      <div class="toggle-auth">
        <span>${isSignUpMode ? 'Already have an account?' : "Don't have an account?"}</span>
        <a href="#" id="toggle-auth-btn">${isSignUpMode ? 'Sign In' : 'Sign Up'}</a>
      </div>

      <div style="margin-top: 1.2rem; text-align: center; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 1rem;">
        <a href="../" style="color: var(--muted); font-size: 0.85rem; text-decoration: underline;">
          ← Back to Hub
        </a>
      </div>
    </div>
  `;
}

function renderDashboardSection() {
  if (!currentProfile?.username) {
    return `
      <div class="dashboard-container">
        <h2>Setup Your Profile</h2>
        <p style="color: var(--muted); font-size:0.9rem; text-align:center; margin-bottom:1.2rem;">
          Choose a username to start creating or joining squads.
        </p>
        <div id="profile-error" class="error-message"></div>
        <form id="profile-form">
          <div class="input-group">
            <label for="username">Username</label>
            <input type="text" id="username" placeholder="e.g. ShadowSlayer" required>
          </div>
          <button type="submit">Save Profile</button>
        </form>
      </div>
    `;
  }

  const isStaff = currentProfile?.role === 'admin' || currentProfile?.role === 'mod';

  return `
    <div class="dashboard-container" style="max-width: 600px;">
      <h2>Welcome, @${currentProfile.username}!</h2>
      <p style="color: var(--muted); text-align: center; margin-bottom: 1.5rem;">
        Select a squad or start a new one to unlock your shared vault.
      </p>

      <!-- Squad Management -->
      <div style="display: flex; gap: 1rem; margin-bottom: 1.5rem; flex-wrap: wrap;">
        <form id="create-squad-form" style="flex: 1; min-width: 200px;">
          <div class="input-group">
            <input type="text" id="squad-name" placeholder="New Squad Name" required>
          </div>
          <button type="submit" style="margin-top:0;">Create Squad</button>
        </form>

        <form id="join-squad-form" style="flex: 1; min-width: 200px;">
          <div class="input-group">
            <input type="text" id="invite-code" placeholder="Invite Code" required>
          </div>
          <button type="submit" class="btn-secondary" style="margin-top:0; width:100%;">Join Squad</button>
        </form>
      </div>

      <div id="squad-error" class="error-message"></div>

      <!-- Squad Selector -->
      ${userSquads.length > 0 ? `
        <div style="margin-bottom: 1.5rem;">
          <label style="font-size:0.85rem; color: var(--muted);">Your Squads:</label>
          <div style="display:flex; gap:0.5rem; flex-wrap:wrap; margin-top:0.5rem;">
            ${userSquads.map(s => `
              <button 
                class="btn-squad-select ${activeSquad?.id === s.id ? 'active-squad' : 'btn-secondary'}" 
                data-squad-id="${s.id}" 
                style="width:auto; padding: 0.4rem 0.8rem; margin:0;"
              >
                ${s.name}
              </button>
            `).join('')}
          </div>
        </div>
      ` : '<p style="font-size:0.85rem; color: var(--muted); text-align:center;">You are not in any squads yet.</p>'}

      <!-- Active Squad Vault -->
      ${activeSquad ? `
        <div style="border-top: 1px solid var(--border); padding-top: 1.5rem; margin-top: 1.5rem;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem;">
            <h3>${activeSquad.name} Vault</h3>
            <span style="font-size:0.75rem; color:var(--muted); background:rgba(255,255,255,0.05); padding:0.2rem 0.5rem; border-radius:4px;">
              Invite Code: <strong>${activeSquad.invite_code}</strong>
            </span>
          </div>

          <!-- Members List -->
          <div style="margin-bottom: 1rem; font-size: 0.78rem; color: var(--muted);">
            Members: ${squadMembers.length > 0 ? squadMembers.map(m => `@${m.profiles?.username || 'User'}`).join(', ') : '@' + currentProfile.username}
          </div>

          <!-- Post Input -->
          <form id="post-form" style="margin-bottom: 1.5rem;">
            <div class="input-group">
              <input type="text" id="post-content" placeholder="Share a message or link with your squad..." required>
            </div>
            <button type="submit">Post to Vault</button>
          </form>

          <!-- Posts Feed -->
          <div style="display:flex; flex-direction:column; gap:0.8rem; max-height:300px; overflow-y:auto;">
            ${squadPosts.length > 0 ? squadPosts.map(p => `
              <div style="background:rgba(10,14,26,0.5); padding:0.8rem; border-radius:8px; border:1px solid rgba(255,255,255,0.05);">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.2rem;">
                  <span style="font-size:0.75rem; color:var(--accent-glow);">
                    @${p.profiles?.username || 'Member'} • ${new Date(p.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                  </span>
                  ${(isStaff || p.user_id === currentUser?.id) ? `
                    <button class="delete-post-btn" data-post-id="${p.id}" data-author="${p.profiles?.username || 'user'}" style="background:none; border:none; color:#ff4757; font-size:0.75rem; cursor:pointer; padding:0;">Delete</button>
                  ` : ''}
                </div>
                <div style="font-size:0.9rem; word-break: break-word;">${formatPostContent(p.content)}</div>
              </div>
            `).join('') : '<p style="font-size:0.85rem; color:var(--muted); text-align:center;">No posts in this vault yet.</p>'}
          </div>
        </div>
      ` : ''}
    </div>
  `;
}

function renderModModal(isAdmin) {
  const filteredUsers = allProfilesList.filter(u => 
    (u.username || '').toLowerCase().includes(userSearchQuery.toLowerCase())
  );

  return `
    <div id="modal-backdrop" style="position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.75); backdrop-filter: blur(5px); z-index: 9999; display: flex; align-items: center; justify-content: center; padding: 1rem;">
      <div style="background: #0d111a; border: 1px solid var(--border); width: 100%; max-width: 650px; border-radius: 12px; padding: 1.5rem; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
        
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 1rem; margin-bottom: 1rem;">
          <h3 style="margin: 0; font-size: 1.1rem; color: #fff;">
            🛡️ Staff Control Center
          </h3>
          <button id="close-mod-modal-btn" style="background: none; border: none; color: var(--muted); font-size: 1.2rem; cursor: pointer;">✕</button>
        </div>

        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.8rem; margin-bottom: 1rem; text-align: center;">
          <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05); padding: 0.6rem; border-radius: 6px;">
            <div style="font-size: 1.1rem; font-weight: bold; color: var(--accent-glow);">${systemStats.users}</div>
            <div style="font-size: 0.7rem; color: var(--muted);">Total Users</div>
          </div>
          <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05); padding: 0.6rem; border-radius: 6px;">
            <div style="font-size: 1.1rem; font-weight: bold; color: var(--accent-glow);">${systemStats.squads}</div>
            <div style="font-size: 0.7rem; color: var(--muted);">Active Squads</div>
          </div>
          <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05); padding: 0.6rem; border-radius: 6px;">
            <div style="font-size: 1.1rem; font-weight: bold; color: var(--accent-glow);">${systemStats.posts}</div>
            <div style="font-size: 0.7rem; color: var(--muted);">Vault Posts</div>
          </div>
        </div>

        <div style="display: flex; gap: 0.5rem; margin-bottom: 1rem;">
          <button id="modal-tab-users" class="${activeAdminTab === 'users' ? 'btn-squad-select active-squad' : 'btn-secondary'}" style="padding: 0.3rem 0.8rem; font-size: 0.8rem;">
            Users & Roles
          </button>
          ${isAdmin ? `
            <button id="modal-tab-logs" class="${activeAdminTab === 'logs' ? 'btn-squad-select active-squad' : 'btn-secondary'}" style="padding: 0.3rem 0.8rem; font-size: 0.8rem;">
              Audit Logs
            </button>
          ` : ''}
        </div>

        ${activeAdminTab === 'users' ? `
          <div style="margin-bottom: 0.8rem;">
            <input type="text" id="mod-user-search" placeholder="Search username..." value="${userSearchQuery}" style="width: 100%; padding: 0.5rem; background: rgba(0,0,0,0.3); border: 1px solid var(--border); border-radius: 6px; color: #fff; font-size: 0.82rem;">
          </div>
          <div style="max-height: 250px; overflow-y: auto;">
            <table style="width:100%; border-collapse:collapse; font-size:0.85rem;">
              <thead>
                <tr style="border-bottom:1px solid rgba(255,255,255,0.1); text-align:left; color:var(--muted);">
                  <th style="padding:0.4rem;">User</th>
                  <th style="padding:0.4rem;">Role</th>
                  <th style="padding:0.4rem; text-align:right;">Actions</th>
                </tr>
              </thead>
              <tbody>
                ${filteredUsers.map(u => `
                  <tr style="border-bottom:1px solid rgba(255,255,255,0.05);">
                    <td style="padding:0.4rem;">@${u.username || 'Anonymous'}</td>
                    <td style="padding:0.4rem;">
                      <span style="padding:2px 6px; border-radius:4px; font-size:0.7rem; background:${u.role === 'admin' ? '#a855f7' : (u.role === 'mod' ? '#3b82f6' : 'rgba(255,255,255,0.1)')};">
                        ${u.role || 'user'}
                      </span>
                    </td>
                    <td style="padding:0.4rem; text-align:right; display:flex; gap:0.4rem; justify-content:flex-end;">
                      ${isAdmin && u.id !== currentUser.id ? `
                        ${u.role === 'mod' ? `
                          <button class="role-btn btn-secondary" data-id="${u.id}" data-role="user" data-name="${u.username}" style="padding:0.2rem 0.4rem; font-size:0.7rem;">Demote</button>
                        ` : `
                          <button class="role-btn btn-secondary" data-id="${u.id}" data-role="mod" data-name="${u.username}" style="padding:0.2rem 0.4rem; font-size:0.7rem; background:rgba(168,85,247,0.2); border:1px solid #a855f7; color:#fff;">Make Mod</button>
                        `}
                      ` : ''}
                      ${(isAdmin || currentProfile?.role === 'mod') && u.id !== currentUser.id ? `
                        <button class="remove-user-btn" data-id="${u.id}" data-name="${u.username}" style="padding:0.2rem 0.4rem; font-size:0.7rem; background:#ff4757; color:#fff; border:none; border-radius:4px; cursor:pointer;">Remove</button>
                      ` : ''}
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        ` : `
          <div style="max-height: 280px; overflow-y: auto; font-size:0.8rem;">
            ${auditLogsList.length > 0 ? auditLogsList.map(log => `
              <div style="border-bottom:1px solid rgba(255,255,255,0.05); padding:0.5rem 0;">
                <strong style="color:var(--accent-glow);">${log.action}</strong> by 
                <em>@${log.profiles?.username || 'Staff'}</em>: ${log.target_info}
                <div style="font-size:0.7rem; color:var(--muted);">${new Date(log.created_at).toLocaleString()}</div>
              </div>
            `).join('') : '<p style="color:var(--muted); font-size:0.8rem; text-align:center;">No audit records logged yet.</p>'}
          </div>
        `}
      </div>
    </div>
  `;
}

function attachEventListeners() {
  const toggleBtn = document.getElementById("toggle-auth-btn");
  const authForm = document.getElementById("auth-form");
  const githubBtn = document.getElementById("github-login-btn");
  const profileForm = document.getElementById("profile-form");
  const createSquadForm = document.getElementById("create-squad-form");
  const joinSquadForm = document.getElementById("join-squad-form");
  const postForm = document.getElementById("post-form");
  const signoutBtn = document.getElementById("signout-btn");

  const openModModalBtn = document.getElementById("open-mod-modal-btn");
  const closeModModalBtn = document.getElementById("close-mod-modal-btn");
  const modalBackdrop = document.getElementById("modal-backdrop");

  const modalTabUsers = document.getElementById("modal-tab-users");
  const modalTabLogs = document.getElementById("modal-tab-logs");
  const userSearchInput = document.getElementById("mod-user-search");

  if (openModModalBtn) {
    openModModalBtn.addEventListener("click", async () => {
      isModModalOpen = true;
      await fetchStaffData();
      renderApp();
    });
  }

  if (closeModModalBtn) {
    closeModModalBtn.addEventListener("click", () => {
      isModModalOpen = false;
      renderApp();
    });
  }

  if (modalBackdrop) {
    modalBackdrop.addEventListener("click", (e) => {
      if (e.target.id === 'modal-backdrop') {
        isModModalOpen = false;
        renderApp();
      }
    });
  }

  if (modalTabUsers) {
    modalTabUsers.addEventListener("click", () => {
      activeAdminTab = 'users';
      renderApp();
    });
  }

  if (modalTabLogs) {
    modalTabLogs.addEventListener("click", async () => {
      activeAdminTab = 'logs';
      await fetchAuditLogs();
      renderApp();
    });
  }

  if (userSearchInput) {
    userSearchInput.addEventListener("input", (e) => {
      userSearchQuery = e.target.value;
      renderApp();
      const newInput = document.getElementById("mod-user-search");
      if (newInput) {
        newInput.focus();
        newInput.setSelectionRange(newInput.value.length, newInput.value.length);
      }
    });
  }

  if (toggleBtn) {
    toggleBtn.addEventListener("click", (e) => {
      e.preventDefault();
      isSignUpMode = !isSignUpMode;
      renderApp();
    });
  }

  if (authForm) {
    authForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = document.getElementById("email").value;
      const password = document.getElementById("password").value;
      const errorDiv = document.getElementById("auth-error");

      let result = isSignUpMode 
        ? await supabase.auth.signUp({ email, password })
        : await supabase.auth.signInWithPassword({ email, password });

      if (result.error) {
        errorDiv.innerText = result.error.message;
      } else {
        currentUser = result.data.user;
        await loadUserData();
      }
    });
  }

  if (githubBtn) {
    githubBtn.addEventListener("click", async () => {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'github',
        options: {
          redirectTo: 'https://alhusk428-dev.github.io/khalid-projects/SquadVault/'
        }
      });
      if (error) {
        document.getElementById("auth-error").innerText = error.message;
      }
    });
  }

  if (profileForm) {
    profileForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const username = document.getElementById("username").value.trim();
      const { error } = await supabase.from('profiles').upsert({ id: currentUser.id, username, role: 'user' });
      if (error) {
        document.getElementById("profile-error").innerText = error.message;
      } else {
        await loadUserData();
      }
    });
  }

  if (createSquadForm) {
    createSquadForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const name = document.getElementById("squad-name").value.trim();
      const invite_code = Math.random().toString(36).substring(2, 8).toUpperCase();

      const { data: squad, error } = await supabase.from('squads').insert({ name, invite_code, created_by: currentUser.id }).select().single();
      if (!error && squad) {
        await supabase.from('squad_members').insert({ squad_id: squad.id, user_id: currentUser.id });
        await loadUserData();
      }
    });
  }

  if (joinSquadForm) {
    joinSquadForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const code = document.getElementById("invite-code").value.trim().toUpperCase();
      const { data: squad } = await supabase.from('squads').select('id').eq('invite_code', code).single();

      if (squad) {
        await supabase.from('squad_members').insert({ squad_id: squad.id, user_id: currentUser.id });
        await loadUserData();
      } else {
        document.getElementById("squad-error").innerText = "Invalid invite code.";
      }
    });
  }

  if (postForm) {
    postForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const content = document.getElementById("post-content").value.trim();
      if (!content || !activeSquad) return;

      const { error } = await supabase.from('posts').insert({ squad_id: activeSquad.id, user_id: currentUser.id, content });
      if (error) {
        console.error("Post creation error:", error.message);
      } else {
        document.getElementById("post-content").value = "";
        await fetchSquadPosts(activeSquad.id);
        renderApp();
      }
    });
  }

  document.querySelectorAll('.delete-post-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const postId = e.target.getAttribute('data-post-id');
      const author = e.target.getAttribute('data-author');

      await supabase.from('posts').delete().eq('id', postId);

      if (currentProfile?.role === 'admin' || currentProfile?.role === 'mod') {
        await logStaffAction('DELETE_POST', `Deleted post authored by @${author}`);
      }

      if (activeSquad) await fetchSquadPosts(activeSquad.id);
      renderApp();
    });
  });

  document.querySelectorAll('.role-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const targetId = e.target.getAttribute('data-id');
      const newRole = e.target.getAttribute('data-role');
      const targetName = e.target.getAttribute('data-name');

      await supabase.from('profiles').update({ role: newRole }).eq('id', targetId);
      await logStaffAction('UPDATE_ROLE', `Changed @${targetName}'s role to ${newRole}`);
      await fetchStaffData();
      renderApp();
    });
  });

  document.querySelectorAll('.remove-user-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const targetId = e.target.getAttribute('data-id');
      const targetName = e.target.getAttribute('data-name');

      if (confirm(`Remove @${targetName}'s profile and posts?`)) {
        await supabase.from('posts').delete().eq('user_id', targetId);
        await supabase.from('squad_members').delete().eq('user_id', targetId);
        await supabase.from('profiles').delete().eq('id', targetId);
        await logStaffAction('REMOVE_USER', `Removed user account @${targetName}`);
        await fetchStaffData();
        renderApp();
      }
    });
  });

  document.querySelectorAll('.btn-squad-select').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const squadId = e.target.getAttribute('data-squad-id');
      activeSquad = userSquads.find(s => s.id === squadId);
      await fetchSquadPosts(squadId);
      await fetchSquadMembers(squadId);
      renderApp();
    });
  });

  if (signoutBtn) {
    signoutBtn.addEventListener("click", async () => {
      await supabase.auth.signOut();
      currentUser = null;
      currentProfile = null;
      userSquads = [];
      activeSquad = null;
      squadPosts = [];
      squadMembers = [];
      isModModalOpen = false;
      renderApp();
    });
  }
}

async function logStaffAction(action, target_info) {
  if (!currentUser) return;
  await supabase.from('audit_logs').insert({
    action,
    performed_by_id: currentUser.id,
    target_info
  });
}

async function fetchAuditLogs() {
  const { data } = await supabase
    .from('audit_logs')
    .select('*, profiles:performed_by_id(username)')
    .order('created_at', { ascending: false })
    .limit(50);
  auditLogsList = data || [];
}

async function fetchStaffData() {
  if (currentProfile?.role === 'admin' || currentProfile?.role === 'mod') {
    const { data: profiles } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
    allProfilesList = profiles || [];
    
    const { count: userCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
    const { count: squadCount } = await supabase.from('squads').select('*', { count: 'exact', head: true });
    const { count: postCount } = await supabase.from('posts').select('*', { count: 'exact', head: true });

    systemStats = { users: userCount || 0, squads: squadCount || 0, posts: postCount || 0 };

    if (currentProfile?.role === 'admin') {
      await fetchAuditLogs();
    }
  }
}

async function fetchSquadMembers(squadId) {
  const { data } = await supabase
    .from('squad_members')
    .select('user_id, profiles(username)')
    .eq('squad_id', squadId);
  squadMembers = data || [];
}

async function fetchSquadPosts(squadId) {
  const { data } = await supabase
    .from('posts')
    .select('*, profiles(username)')
    .eq('squad_id', squadId)
    .order('created_at', { ascending: false });
  squadPosts = data || [];
}

async function loadUserData() {
  if (!currentUser) return;

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', currentUser.id).single();
  currentProfile = profile;

  if (profile) {
    const { data: memberEntries } = await supabase.from('squad_members').select('squad_id').eq('user_id', currentUser.id);
    if (memberEntries && memberEntries.length > 0) {
      const squadIds = memberEntries.map(m => m.squad_id);
      const { data: squads } = await supabase.from('squads').select('*').in('id', squadIds);
      userSquads = squads || [];
      if (!activeSquad && userSquads.length > 0) {
        activeSquad = userSquads[0];
        await fetchSquadPosts(activeSquad.id);
        await fetchSquadMembers(activeSquad.id);
      }
    }
  }

  renderApp();
}

async function initAuthListener() {
  if (supabase && supabase.auth) {
    const { data } = await supabase.auth.getSession();
    currentUser = data?.session?.user || null;
    if (currentUser) await loadUserData();

    supabase.auth.onAuthStateChange(async (_event, session) => {
      currentUser = session?.user || null;
      if (currentUser) await loadUserData();
      else renderApp();
    });
  }
  renderApp();
}

initAuthListener();
