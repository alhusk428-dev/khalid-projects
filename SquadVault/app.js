console.log("SquadVault app ready.");

// App State
let isSignUpMode = false;
let currentUser = null;

// Render Layout inside #app
function renderApp() {
  const appContainer = document.getElementById("app");
  if (!appContainer) return;

  appContainer.innerHTML = `
    <header>
      <a href="#" class="logo">SquadVault</a>
      <div id="nav-actions" class="nav-actions">
        <span id="user-display" class="${currentUser ? '' : 'hidden'}">${currentUser ? currentUser.email : ''}</span>
        <button id="signout-btn" class="btn-secondary ${currentUser ? '' : 'hidden'}">Sign Out</button>
      </div>
    </header>

    <main>
      <!-- Auth View -->
      <div id="auth-section" class="auth-container ${currentUser ? 'hidden' : ''}">
        <h2 id="auth-title">${isSignUpMode ? 'Create Your Account' : 'Sign In to SquadVault'}</h2>
        <div id="auth-error" class="error-message"></div>

        <form id="auth-form">
          <div class="form-group">
            <label for="email">Email</label>
            <input type="email" id="email" required placeholder="you@example.com">
          </div>

          <div class="form-group">
            <label for="password">Password</label>
            <input type="password" id="password" required placeholder="••••••••">
            <div id="password-hint" class="password-hint ${isSignUpMode ? '' : 'hidden'}">
              Must be at least 8 characters long, include uppercase, lowercase, and a number.
            </div>
          </div>

          <button type="submit" id="auth-submit-btn" class="auth-btn">
            ${isSignUpMode ? 'Sign Up' : 'Sign In'}
          </button>
        </form>

        <div class="divider">
          <span>OR</span>
        </div>

        <button id="github-btn" class="github-btn">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
          </svg>
          Sign in with GitHub
        </button>

        <div class="toggle-auth">
          <span id="toggle-text">${isSignUpMode ? 'Already have an account?' : "Don't have an account?"}</span>
          <a id="toggle-auth-link">${isSignUpMode ? 'Sign In' : 'Sign Up'}</a>
        </div>
      </div>

      <!-- Dashboard View -->
      <div id="app-dashboard" class="dashboard-view ${currentUser ? '' : 'hidden'}">
        <h1 style="margin-bottom: 1rem;">Welcome to SquadVault!</h1>
        <p style="color: #a0aab2;">You are logged in. Profile setup and feed features coming next!</p>
      </div>
    </main>
  `;

  attachEventListeners();
}

// Attach Event Listeners after DOM injection
function attachEventListeners() {
  const toggleAuthLink = document.getElementById("toggle-auth-link");
  const authForm = document.getElementById("auth-form");
  const githubBtn = document.getElementById("github-btn");
  const signoutBtn = document.getElementById("signout-btn");

  if (toggleAuthLink) {
    toggleAuthLink.addEventListener("click", () => {
      isSignUpMode = !isSignUpMode;
      renderApp();
    });
  }

  if (authForm) {
    authForm.addEventListener("submit", handleFormSubmit);
  }

  if (githubBtn) {
    githubBtn.addEventListener("click", handleGitHubSignIn);
  }

  if (signoutBtn) {
    signoutBtn.addEventListener("click", async () => {
      if (!supabase) return;
      await supabase.auth.signOut();
    });
  }
}

// Password Validation
function validatePassword(password) {
  const minLength = password.length >= 8;
  const hasLowercase = /[a-z]/.test(password);
  const hasUppercase = /[A-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);

  return minLength && hasLowercase && hasUppercase && hasNumber;
}

// Show Error Message
function showError(message) {
  const authError = document.getElementById("auth-error");
  if (authError) {
    authError.textContent = message;
    authError.style.display = "block";
  }
}

// Auth Form Handler
async function handleFormSubmit(e) {
  e.preventDefault();

  if (!supabase) {
    showError("Please update config.js with your real Supabase URL and key to log in.");
    return;
  }

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  if (isSignUpMode) {
    if (!validatePassword(password)) {
      showError("Password must be at least 8 characters long, contain an uppercase letter, a lowercase letter, and a number.");
      return;
    }

    const { data, error } = await supabase.auth.signUp({ email, password });

    if (error) {
      showError(error.message);
    } else if (data.user && !data.session) {
      showError("Account created! Please check your email to confirm registration.");
    }
  } else {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      showError(error.message);
    }
  }
}

// GitHub Auth Handler
async function handleGitHubSignIn() {
  if (!supabase) {
    showError("Please update config.js with your real Supabase URL and key to enable OAuth.");
    return;
  }

  const { error } = await supabase.auth.signInWithOAuth({ provider: "github" });
  if (error) {
    showError(error.message);
  }
}

// Auth Listener
function initAuthListener() {
  if (!supabase) {
    console.warn("Supabase is not configured yet. Rendering interface without active backend connection.");
    renderApp();
    return;
  }

  supabase.auth.onAuthStateChange((event, session) => {
    currentUser = session && session.user ? session.user : null;
    renderApp();
  });
}

// Initial Run
document.addEventListener("DOMContentLoaded", () => {
  initAuthListener();
});