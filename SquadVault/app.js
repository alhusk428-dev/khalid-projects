var supabase = window.supabaseClient || window.supabase;

let isSignUpMode = false;
let currentUser = null;

function renderApp() {
  const appContainer = document.getElementById("app");
  if (!appContainer) return;

  appContainer.innerHTML = `
    <header>
      <a href="#" class="logo">SquadVault</a>
      <div id="nav-actions">
        <span id="user-display" class="${currentUser ? '' : 'hidden'}">${currentUser ? currentUser.email : ''}</span>
        <button id="signout-btn" class="btn-secondary ${currentUser ? '' : 'hidden'}">Sign Out</button>
      </div>
    </header>

    <main>
      <div id="auth-section" class="auth-container ${currentUser ? 'hidden' : ''}">
        <h2 id="auth-title">${isSignUpMode ? 'Create Your Account' : 'Sign In to SquadVault'}</h2>
        <div id="auth-error" class="error-message"></div>

        <form id="auth-form">
          <div class="input-group">
            <label for="email">Email</label>
            <input type="email" id="email" placeholder="you@example.com" required>
          </div>

          <div class="input-group">
            <label for="password">Password</label>
            <input type="password" id="password" placeholder="••••••••" required>
            <p class="help-text">Must be at least 8 characters long, include uppercase, lowercase, and a number.</p>
          </div>

          <button type="submit" id="auth-submit">${isSignUpMode ? 'Sign Up' : 'Sign In'}</button>
        </form>

        <div class="divider">OR</div>

        <button type="button" id="github-btn" class="btn-github">Sign in with GitHub</button>

        <div class="toggle-auth">
          <span id="toggle-text">${isSignUpMode ? 'Already have an account?' : "Don't have an account?"}</span>
          <a href="#" id="toggle-auth-btn">${isSignUpMode ? 'Sign In' : 'Sign Up'}</a>
        </div>
      </div>

      <div id="dashboard-section" class="dashboard-container ${currentUser ? '' : 'hidden'}">
        <h2>Welcome to SquadVault!</h2>
        <p style="color: var(--muted); text-align: center; margin-top: 0.5rem;">
          You are logged in. Profile setup and feed features coming next!
        </p>
      </div>
    </main>
  `;

  attachEventListeners();
}

function attachEventListeners() {
  const authForm = document.getElementById("auth-form");
  const toggleBtn = document.getElementById("toggle-auth-btn");
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

      errorDiv.innerText = "";

      if (!supabase) {
        errorDiv.innerText = "Supabase client not initialized properly.";
        return;
      }

      let result;
      if (isSignUpMode) {
        result = await supabase.auth.signUp({ email, password });
      } else {
        result = await supabase.auth.signInWithPassword({ email, password });
      }

      if (result.error) {
        errorDiv.innerText = result.error.message;
      } else {
        currentUser = result.data.user;
        renderApp();
      }
    });
  }

  if (signoutBtn) {
    signoutBtn.addEventListener("click", async () => {
      if (supabase) await supabase.auth.signOut();
      currentUser = null;
      renderApp();
    });
  }
}

async function initAuthListener() {
  if (supabase && supabase.auth) {
    const { data } = await supabase.auth.getSession();
    currentUser = data?.session?.user || null;

    supabase.auth.onAuthStateChange((_event, session) => {
      currentUser = session?.user || null;
      renderApp();
    });
  }
  renderApp();
}

initAuthListener();
