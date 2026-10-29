var supabase = window.supabaseClient || window.supabase;

let isSignUpMode = false;
let currentUser = null;
let currentProfile = null;
let userSquads = [];
let activeSquad = null;
let squadPosts = [];

// Main Render Loop
function renderApp() {
  const appContainer = document.getElementById("app");
  if (!appContainer) return;

  appContainer.innerHTML = `
    <header>
      <a href="#" class="logo">SquadVault</a>
      <div id="nav-actions">
        <span id="user-display" class="${currentUser ? '' : 'hidden'}">
          ${currentProfile?.username ? `@${currentProfile.username}` : (currentUser?.email || '')}
        </span>
        <button id="signout-btn" class="btn-secondary ${currentUser ? '' : 'hidden'}">Sign Out</button>
      </div>
    </header>

    <main>
      ${!currentUser ? renderAuthSection() : renderDashboardSection()}
    </main>
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

      <div class="toggle-auth">
        <span>${isSignUpMode ? 'Already have an account?' : "Don't have an account?"}</span>
        <a href="#" id="toggle-auth-btn">${isSignUpMode ? 'Sign In' : 'Sign Up'}</a>
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
          <div style="display:flex; justify-size:space-between; align-items:center; margin-bottom:1rem;">
            <h3>${activeSquad.name} Vault</h3>
            <span style="font-size:0.75rem; color:var(--muted); background:rgba(255,255,255,0.05); padding:0.2rem 0.5rem; border-radius:4px;">
              Invite Code: <strong>${activeSquad.invite_code}</strong>
            </span>
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
                <div style="font-size:0.75rem; color:var(--accent-glow); margin-bottom:0.2rem;">
                  @${p.profiles?.username || 'Member'} • ${new Date(p.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                </div>
                <div style="font-size:0.9rem;">${p.content}</div>
              </div>
            `).join('') : '<p style="font-size:0.85rem; color:var(--muted); text-align:center;">No posts in this vault yet.</p>'}
          </div>
        </div>
      ` : ''}
    </div>
  `;
}

function attachEventListeners() {
  const toggleBtn = document.getElementById("toggle-auth-btn");
  const authForm = document.getElementById("auth-form");
  const profileForm = document.getElementById("profile-form");
  const createSquadForm = document.getElementById("create-squad-form");
  const joinSquadForm = document.getElementById("join-squad-form");
  const postForm = document.getElementById("post-form");
  const signoutBtn = document.getElementById("signout-btn");

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

  if (profileForm) {
    profileForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const username = document.getElementById("username").value.trim();
      const { error } = await supabase.from('profiles').upsert({ id: currentUser.id, username });
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

      await supabase.from('posts').insert({ squad_id: activeSquad.id, user_id: currentUser.id, content });
      document.getElementById("post-content").value = "";
      await fetchSquadPosts(activeSquad.id);
    });
  }

  document.querySelectorAll('.btn-squad-select').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const squadId = e.target.getAttribute('data-squad-id');
      activeSquad = userSquads.find(s => s.id === squadId);
      await fetchSquadPosts(squadId);
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
      renderApp();
    });
  }
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

  // Profile Fetch
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', currentUser.id).single();
  currentProfile = profile;

  if (profile) {
    // Squads Fetch
    const { data: memberEntries } = await supabase.from('squad_members').select('squad_id').eq('user_id', currentUser.id);
    if (memberEntries && memberEntries.length > 0) {
      const squadIds = memberEntries.map(m => m.squad_id);
      const { data: squads } = await supabase.from('squads').select('*').in('id', squadIds);
      userSquads = squads || [];
      if (!activeSquad && userSquads.length > 0) {
        activeSquad = userSquads[0];
        await fetchSquadPosts(activeSquad.id);
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
