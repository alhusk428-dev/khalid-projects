var supabase = window.supabaseClient || window.supabase;

let isSignUpMode = false;
let currentUser = null;
let currentProfile = null;
let userSquads = [];
let activeSquad = null;
let squadPosts = [];
let squadMembers = [];
let squadPolls = [];
let squadGoals = [];
let topGlobalSquads = [];
let activeAnnouncement = null;

// Active Vault Tab: 'feed' | 'raids' | 'games' | 'shop' | 'polls' | 'settings'
let activeVaultTab = 'feed';

// Mini-game 1: Reflex Test State
let reactionState = 'idle'; // 'idle' | 'waiting' | 'ready' | 'done'
let reactionStartTime = 0;
let reactionTimeout = null;
let lastReactionMs = null;

// Mini-game 2: Quick Blitz State
let blitzActive = false;
let blitzScore = 0;
let blitzQuestion = null;
let blitzTimeLeft = 15;
let blitzTimer = null;

// Mini-game 3: Vault Codebreaker State
let codeSecret = generateSecretCode();
let codeGuesses = []; // [{ guess: '1234', exact: 1, partial: 2 }]
let codeSolved = false;

// Modals & Admin State
let isModModalOpen = false;
let isPrivacyModalOpen = false;
let isLeaderboardModalOpen = false;
let inspectedSquadProfile = null; // { squad, members, rank }
let activeAdminTab = 'squads';
let userSearchQuery = '';
let squadSearchQuery = '';
let allProfilesList = [];
let allSquadsList = [];
let globalRecentPosts = [];
let auditLogsList = [];
let systemStats = { users: 0, squads: 0, posts: 0 };

const PERK_CATALOG = [
  { id: 'color_cyan', type: 'color', name: 'Cyber Cyan Name', value: '#22d3ee', cost: 100 },
  { id: 'color_gold', type: 'color', name: 'Champion Gold Name', value: '#fbbf24', cost: 250 },
  { id: 'color_crimson', type: 'color', name: 'Crimson Flame Name', value: '#f87171', cost: 400 },
  { id: 'title_slayer', type: 'title', name: 'Title: Boss Slayer', value: 'Boss Slayer', cost: 150 },
  { id: 'title_demon', type: 'title', name: 'Title: Speed Demon', value: 'Speed Demon', cost: 300 },
  { id: 'title_legend', type: 'title', name: 'Title: Vault Legend', value: 'Vault Legend', cost: 600 }
];

function generateSecretCode() {
  const digits = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
  let res = '';
  for (let i = 0; i < 4; i++) {
    const idx = Math.floor(Math.random() * digits.length);
    res += digits.splice(idx, 1)[0];
  }
  return res;
}

function getDailyBounty() {
  const bounties = [
    { title: 'Vault Chatterbox', desc: 'Post a message or hype ping in your squad vault today.', reward: 120 },
    { title: 'Boss Hunter', desc: 'Deal damage to your squad Raid Boss today.', reward: 150 },
    { title: 'Arena Challenger', desc: 'Play a match in the Squad Arena (Reflex, Blitz, or Codebreaker).', reward: 130 },
    { title: 'Squad Strategist', desc: 'Vote on a poll or complete a squad objective.', reward: 140 }
  ];
  const dayIndex = new Date().getDate() % bounties.length;
  return bounties[dayIndex];
}

function hasClaimedBountyToday() {
  if (!currentProfile?.last_bounty_date) return false;
  const todayStr = new Date().toISOString().split('T')[0];
  return currentProfile.last_bounty_date === todayStr;
}

function formatPostContent(content) {
  if (content.startsWith('[HYPE] ')) {
    const badgeText = content.replace('[HYPE] ', '');
    return `<span style="display:inline-block; background: linear-gradient(90deg, ${activeSquad?.theme_color || '#a855f7'}, #ec4899); color:#fff; font-weight:700; font-size:0.78rem; padding: 3px 10px; border-radius: 20px; letter-spacing: 0.03em;">${badgeText}</span>`;
  }
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return content.replace(urlRegex, (url) => {
    return `<a href="${url}" target="_blank" rel="noopener noreferrer" style="color: ${activeSquad?.theme_color || '#a855f7'}; text-decoration: underline;">${url}</a>`;
  });
}

function getSquadLevelInfo(xp = 0) {
  const level = Math.floor(xp / 250) + 1;
  const currentLevelXp = xp % 250;
  const pct = Math.min(100, Math.round((currentLevelXp / 250) * 100));
  return { level, currentLevelXp, nextLevelXp: 250, pct };
}

function hasCheckedInToday() {
  if (!currentProfile?.last_checkin) return false;
  const todayStr = new Date().toISOString().split('T')[0];
  return currentProfile.last_checkin === todayStr;
}

function renderApp() {
  const appContainer = document.getElementById("app");
  if (!appContainer) return;

  const isStaff = currentProfile?.role === 'admin' || currentProfile?.role === 'mod';

  appContainer.innerHTML = `
    <header style="display: flex; justify-content: space-between; align-items: center; padding: 1rem 2rem; flex-wrap: wrap; gap: 0.6rem;">
      <div style="display: flex; align-items: center; gap: 1rem;">
        <a href="#" class="logo">SquadVault</a>
        ${currentUser ? `
          <button id="open-leaderboard-btn" class="btn-secondary" style="padding: 0.35rem 0.85rem; font-size: 0.78rem; width: auto; margin: 0; border-color: rgba(251, 191, 36, 0.4); color: #fbbf24; background: rgba(251, 191, 36, 0.08);">
            Top Squads
          </button>
        ` : ''}
      </div>
      
      <div id="nav-actions" style="display: flex; align-items: center; gap: 0.9rem;">
        <span id="user-display" class="${currentUser ? '' : 'hidden'}" style="font-size: 0.88rem; white-space: nowrap; color: ${currentProfile?.name_color || '#fff'}; font-weight: 600;">
          ${currentProfile?.username ? `@${currentProfile.username}` : (currentUser?.email || '')}
          ${currentProfile?.active_title ? `<span style="font-size: 0.7rem; background: rgba(255,255,255,0.1); color: #e2e8f0; padding: 2px 6px; border-radius: 4px; margin-left: 0.3rem;">${currentProfile.active_title}</span>` : ''}
          ${currentProfile?.xp !== undefined ? `<span style="color: var(--muted); font-size: 0.78rem; margin-left: 0.3rem; font-weight: 400;">(${currentProfile.xp} XP)</span>` : ''}
        </span>
        <button id="signout-btn" class="btn-secondary ${currentUser ? '' : 'hidden'}" style="padding: 0.35rem 0.85rem; font-size: 0.8rem; width: auto; margin: 0; white-space: nowrap;">Sign Out</button>
      </div>
    </header>

    ${activeAnnouncement ? `
      <div style="background: rgba(168, 85, 247, 0.16); border-top: 1px solid rgba(168, 85, 247, 0.4); border-bottom: 1px solid rgba(168, 85, 247, 0.4); padding: 0.55rem 1.5rem; text-align: center; font-size: 0.84rem; color: #fff;">
        <strong>SYSTEM NOTICE:</strong> ${activeAnnouncement.message}
      </div>
    ` : ''}

    <main>
      ${!currentUser ? renderAuthSection() : renderDashboardSection(isStaff)}
    </main>

    ${isModModalOpen && isStaff ? renderModModal(currentProfile.role === 'admin') : ''}
    ${isPrivacyModalOpen && currentUser ? renderUserDataModal() : ''}
    ${isLeaderboardModalOpen && currentUser ? renderGlobalLeaderboardModal() : ''}
    ${inspectedSquadProfile ? renderSquadProfileDossierModal() : ''}
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

      <div style="margin: 1.2rem 0; text-align: center; color: var(--muted); font-size: 0.85rem;">
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

      <div style="margin-top: 1.2rem; text-align: center; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 1rem; display: flex; justify-content: center; gap: 1.2rem;">
        <a href="../" style="color: var(--muted); font-size: 0.85rem; text-decoration: underline;">← Back to Hub</a>
        <a href="privacy.html" style="color: var(--muted); font-size: 0.85rem; text-decoration: underline;">Privacy Policy</a>
      </div>
    </div>
  `;
}

function renderDashboardSection(isStaff) {
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

  const theme = activeSquad?.theme_color || '#a855f7';
  const levelInfo = getSquadLevelInfo(activeSquad?.xp || 0);
  const isInspectingExternalSquad = activeSquad && !userSquads.some(s => s.id === activeSquad.id);
  const checkedIn = hasCheckedInToday();
  const bounty = getDailyBounty();
  const bountyClaimed = hasClaimedBountyToday();

  return `
    <div class="dashboard-container" style="max-width: 740px;">
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.8rem; margin-bottom: 0.7rem;">
        <div style="display: flex; align-items: center; gap: 0.6rem;">
          <h2 style="margin: 0; text-align: left;">Welcome, @${currentProfile.username}!</h2>
          <span style="font-size: 0.75rem; background: rgba(245, 158, 11, 0.15); border: 1px solid rgba(245, 158, 11, 0.4); color: #fbbf24; padding: 2px 8px; border-radius: 12px; font-weight: 700;">
            ${currentProfile.streak || 0}d Streak
          </span>
        </div>

        <div style="display: flex; gap: 0.5rem; align-items: center;">
          <button id="daily-checkin-btn" ${checkedIn ? 'disabled' : ''} style="width: auto; margin: 0; padding: 0.4rem 0.85rem; font-size: 0.78rem; border-radius: 8px; background: ${checkedIn ? 'rgba(255,255,255,0.05)' : '#10b981'}; color: ${checkedIn ? 'var(--muted)' : '#fff'}; border: none; cursor: ${checkedIn ? 'default' : 'pointer'}; font-weight: 600;">
            ${checkedIn ? 'Checked In' : 'Check-In (+50 XP)'}
          </button>

          ${isStaff ? `
            <button id="open-mod-modal-btn" style="width: auto; margin: 0; padding: 0.4rem 0.9rem; font-size: 0.78rem; border-radius: 8px; background: rgba(168, 85, 247, 0.16); border: 1px solid rgba(168, 85, 247, 0.5); color: #fff; cursor: pointer; font-weight: 600;">
              Staff Control Center
            </button>
          ` : ''}
        </div>
      </div>

      <!-- Daily Rotating Bounty Banner -->
      <div style="background: linear-gradient(90deg, rgba(168,85,247,0.12), rgba(59,130,246,0.12)); border: 1px solid rgba(168,85,247,0.3); padding: 0.65rem 0.9rem; border-radius: 8px; margin-bottom: 0.7rem; display: flex; justify-content: space-between; align-items: center; gap: 0.8rem; flex-wrap: wrap;">
        <div style="font-size: 0.8rem;">
          <span style="color: #c084fc; font-weight: 700; text-transform: uppercase; font-size: 0.7rem; letter-spacing: 0.04em;">DAILY BOUNTY: ${bounty.title}</span>
          <div style="color: #e2e8f0; margin-top: 0.1rem;">${bounty.desc}</div>
        </div>
        <button id="claim-bounty-btn" ${bountyClaimed ? 'disabled' : ''} style="width: auto; margin: 0; padding: 0.35rem 0.8rem; font-size: 0.75rem; border-radius: 6px; background: ${bountyClaimed ? 'rgba(255,255,255,0.06)' : '#a855f7'}; color: ${bountyClaimed ? 'var(--muted)' : '#fff'}; border: none; cursor: ${bountyClaimed ? 'default' : 'pointer'}; font-weight: 600;">
          ${bountyClaimed ? 'Claimed' : `Claim +${bounty.reward} XP`}
        </button>
      </div>

      <!-- Live Status Bar -->
      <div style="display: flex; gap: 0.5rem; align-items: center; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); padding: 0.55rem 0.8rem; border-radius: 8px; margin-bottom: 1.4rem;">
        <span style="width: 8px; height: 8px; border-radius: 50%; background: #10b981; flex-shrink: 0;"></span>
        <span style="font-size: 0.78rem; color: var(--muted); white-space: nowrap;">Your Move:</span>
        <input type="text" id="user-status-input" value="${currentProfile.status || 'Online'}" placeholder="What are you playing or doing?" style="flex: 1; background: transparent; border: none; color: #fff; font-size: 0.82rem; padding: 0.2rem;">
        <button id="save-status-btn" class="btn-secondary" style="width: auto; margin: 0; padding: 0.25rem 0.7rem; font-size: 0.75rem;">Update</button>
      </div>

      <!-- Squad Creation & Join -->
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
                style="width:auto; padding: 0.4rem 0.9rem; margin:0; ${activeSquad?.id === s.id ? `background: ${s.theme_color || '#a855f7'}; border-color: ${s.theme_color || '#a855f7'};` : ''}"
              >
                ${s.name}
              </button>
            `).join('')}
          </div>
        </div>
      ` : '<p style="font-size:0.85rem; color: var(--muted); text-align:center;">You are not in any squads yet.</p>'}

      <!-- Active Squad Hub -->
      ${activeSquad ? `
        <div style="border-top: 2px solid ${theme}; padding-top: 1.2rem; margin-top: 1.2rem;">
          ${isInspectingExternalSquad ? `
            <div style="background: rgba(59, 130, 246, 0.15); border: 1px solid #3b82f6; color: #93c5fd; padding: 0.5rem 0.8rem; border-radius: 6px; font-size: 0.78rem; margin-bottom: 0.9rem; display: flex; justify-content: space-between; align-items: center;">
              <span>Owner Inspector Mode: Viewing external squad <strong>${activeSquad.name}</strong></span>
              <button id="exit-inspect-btn" style="width: auto; margin: 0; padding: 0.2rem 0.6rem; font-size: 0.72rem; background: #3b82f6;">Exit View</button>
            </div>
          ` : ''}

          <!-- Squad Banner Header + Level Bar -->
          <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; padding: 1rem; margin-bottom: 1.2rem;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; gap: 1rem; flex-wrap: wrap;">
              <div>
                <div style="display: flex; align-items: center; gap: 0.6rem;">
                  <h3 style="margin: 0; font-size: 1.25rem; color: #fff;">${activeSquad.name}</h3>
                  <span style="font-size: 0.72rem; background: ${theme}; color: #fff; padding: 2px 8px; border-radius: 12px; font-weight: 700;">
                    LVL ${levelInfo.level}
                  </span>
                </div>
                <p style="margin: 0.3rem 0 0.6rem; font-size: 0.85rem; color: var(--muted);">
                  ${activeSquad.description || 'Welcome to our shared squad vault!'}
                </p>
              </div>
              <div style="display: flex; gap: 0.5rem; align-items: center;">
                <button class="view-squad-profile-btn btn-secondary" data-squad-id="${activeSquad.id}" style="width: auto; margin: 0; font-size: 0.75rem; padding: 0.35rem 0.7rem;">
                  Squad Card
                </button>
                <button id="copy-invite-btn" data-code="${activeSquad.invite_code}" style="width: auto; margin: 0; font-size: 0.75rem; background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.1); padding: 0.35rem 0.7rem; border-radius: 6px; color: #fff; cursor: pointer;">
                  Code: <strong>${activeSquad.invite_code}</strong>
                </button>
              </div>
            </div>

            <!-- XP Progress Bar -->
            <div style="margin: 0.4rem 0 0.7rem;">
              <div style="display: flex; justify-content: space-between; font-size: 0.72rem; color: var(--muted); margin-bottom: 0.25rem;">
                <span>Squad XP Progress</span>
                <span>${levelInfo.currentLevelXp} / ${levelInfo.nextLevelXp} XP</span>
              </div>
              <div style="width: 100%; height: 6px; background: rgba(255,255,255,0.08); border-radius: 4px; overflow: hidden;">
                <div style="width: ${levelInfo.pct}%; height: 100%; background: ${theme}; transition: width 0.3s ease;"></div>
              </div>
            </div>

            <!-- Live Member Roster with Status & Ranks -->
            <div style="border-top: 1px solid rgba(255,255,255,0.05); padding-top: 0.6rem; display: flex; flex-wrap: wrap; gap: 0.5rem;">
              ${squadMembers.map(m => `
                <div style="background: rgba(0,0,0,0.25); border: 1px solid rgba(255,255,255,0.06); padding: 0.25rem 0.6rem; border-radius: 6px; font-size: 0.74rem; display: flex; align-items: center; gap: 0.4rem;">
                  <span style="width: 6px; height: 6px; border-radius: 50%; background: #10b981;"></span>
                  <strong style="color: ${m.profiles?.name_color || '#fff'};">@${m.profiles?.username || 'User'}</strong>
                  <span style="color: ${theme}; font-size: 0.68rem;">[${m.custom_rank || 'Member'}]</span>
                  <span style="color: var(--muted); font-style: italic;">• ${m.profiles?.status || 'Online'}</span>
                </div>
              `).join('')}
            </div>
          </div>

          <!-- Vault Navigation Tabs -->
          <div style="display: flex; gap: 0.4rem; flex-wrap: wrap; margin-bottom: 1.2rem; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 0.6rem;">
            <button class="vault-tab-btn" data-tab="feed" style="width:auto; margin:0; padding: 0.4rem 0.8rem; font-size: 0.78rem; background: ${activeVaultTab === 'feed' ? theme : 'transparent'}; border: 1px solid ${activeVaultTab === 'feed' ? theme : 'rgba(255,255,255,0.1)'};">
              Vault Feed (${squadPosts.length})
            </button>
            <button class="vault-tab-btn" data-tab="raids" style="width:auto; margin:0; padding: 0.4rem 0.8rem; font-size: 0.78rem; background: ${activeVaultTab === 'raids' ? theme : 'transparent'}; border: 1px solid ${activeVaultTab === 'raids' ? theme : 'rgba(255,255,255,0.1)'};">
              Boss & Goals
            </button>
            <button class="vault-tab-btn" data-tab="games" style="width:auto; margin:0; padding: 0.4rem 0.8rem; font-size: 0.78rem; background: ${activeVaultTab === 'games' ? theme : 'transparent'}; border: 1px solid ${activeVaultTab === 'games' ? theme : 'rgba(255,255,255,0.1)'};">
              Arena & Ranks
            </button>
            <button class="vault-tab-btn" data-tab="shop" style="width:auto; margin:0; padding: 0.4rem 0.8rem; font-size: 0.78rem; background: ${activeVaultTab === 'shop' ? theme : 'transparent'}; border: 1px solid ${activeVaultTab === 'shop' ? theme : 'rgba(255,255,255,0.1)'};">
              XP Armory
            </button>
            <button class="vault-tab-btn" data-tab="polls" style="width:auto; margin:0; padding: 0.4rem 0.8rem; font-size: 0.78rem; background: ${activeVaultTab === 'polls' ? theme : 'transparent'}; border: 1px solid ${activeVaultTab === 'polls' ? theme : 'rgba(255,255,255,0.1)'};">
              Polls (${squadPolls.length})
            </button>
            <button class="vault-tab-btn" data-tab="settings" style="width:auto; margin:0; padding: 0.4rem 0.8rem; font-size: 0.78rem; background: ${activeVaultTab === 'settings' ? theme : 'transparent'}; border: 1px solid ${activeVaultTab === 'settings' ? theme : 'rgba(255,255,255,0.1)'};">
              Customize
            </button>
          </div>

          ${activeVaultTab === 'feed' ? renderVaultFeedTab(theme) : ''}
          ${activeVaultTab === 'raids' ? renderVaultRaidsTab(theme) : ''}
          ${activeVaultTab === 'games' ? renderVaultGamesTab(theme) : ''}
          ${activeVaultTab === 'shop' ? renderVaultShopTab(theme) : ''}
          ${activeVaultTab === 'polls' ? renderVaultPollsTab(theme) : ''}
          ${activeVaultTab === 'settings' ? renderVaultSettingsTab(theme) : ''}
        </div>
      ` : ''}

      <!-- Footer Links -->
      <div style="margin-top: 2rem; text-align: center; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 1rem; display: flex; justify-content: center; gap: 1.2rem;">
        <a href="privacy.html" style="color: var(--muted); font-size: 0.8rem; text-decoration: underline;">Privacy Policy</a>
        <a href="#" id="open-user-data-btn" style="color: var(--muted); font-size: 0.8rem; text-decoration: underline;">Manage My Data</a>
      </div>
    </div>
  `;
}

function renderVaultFeedTab(theme) {
  const isStaff = currentProfile?.role === 'admin' || currentProfile?.role === 'mod';
  const pinnedPosts = squadPosts.filter(p => p.is_pinned);
  const regularPosts = squadPosts.filter(p => !p.is_pinned);
  const hypeCallouts = ['SQUAD UP!', 'GGs ONLY', 'CLUTCH PLAY', 'HOP ON NOW', 'LETS GOOO'];

  const renderPostCard = (p, isPinnedCard = false) => {
    const reactions = p.reactions || {};
    const emojis = ['🔥', '👍', '❤️', '😂'];

    return `
      <div style="background:${isPinnedCard ? 'rgba(168, 85, 247, 0.08)' : 'rgba(10,14,26,0.5)'}; padding:0.85rem; border-radius:8px; border:1px solid ${isPinnedCard ? theme : 'rgba(255,255,255,0.06)'};">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.35rem;">
          <span style="font-size:0.75rem; color:${p.profiles?.name_color || theme}; font-weight:600;">
            ${isPinnedCard ? 'PINNED • ' : ''}@${p.profiles?.username || 'Member'}
            ${p.profiles?.active_title ? `<span style="font-size:0.65rem; background:rgba(255,255,255,0.08); color:#cbd5e1; padding:1px 5px; border-radius:4px; margin-left:4px;">${p.profiles.active_title}</span>` : ''}
            <span style="color:var(--muted); font-weight:400;"> • ${new Date(p.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
          </span>
          <div style="display:flex; gap:0.6rem; align-items:center;">
            <button class="pin-post-btn" data-post-id="${p.id}" data-pinned="${p.is_pinned}" style="background:none; border:none; color:var(--muted); font-size:0.72rem; cursor:pointer; padding:0; width:auto; margin:0;">
              ${p.is_pinned ? 'Unpin' : 'Pin'}
            </button>
            ${(isStaff || p.user_id === currentUser?.id) ? `
              <button class="delete-post-btn" data-post-id="${p.id}" data-author="${p.profiles?.username || 'user'}" style="background:none; border:none; color:#ff4757; font-size:0.72rem; cursor:pointer; padding:0; width:auto; margin:0;">Delete</button>
            ` : ''}
          </div>
        </div>
        <div style="font-size:0.92rem; word-break: break-word; margin-bottom: 0.6rem;">${formatPostContent(p.content)}</div>
        
        <div style="display:flex; gap:0.4rem; flex-wrap:wrap;">
          ${emojis.map(emoji => {
            const usersList = reactions[emoji] || [];
            const hasReacted = usersList.includes(currentUser?.id);
            return `
              <button class="react-btn" data-post-id="${p.id}" data-emoji="${emoji}" style="width:auto; margin:0; padding: 2px 7px; font-size: 0.75rem; border-radius: 12px; background: ${hasReacted ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.04)'}; border: 1px solid ${hasReacted ? theme : 'rgba(255,255,255,0.08)'}; color: #fff; cursor: pointer;">
                ${emoji} ${usersList.length > 0 ? usersList.length : ''}
              </button>
            `;
          }).join('')}
        </div>
      </div>
    `;
  };

  return `
    <div style="display: flex; gap: 0.4rem; flex-wrap: wrap; align-items: center; margin-bottom: 0.8rem;">
      <span style="font-size: 0.72rem; color: var(--muted);">Quick Hype:</span>
      ${hypeCallouts.map(text => `
        <button type="button" class="hype-ping-btn" data-hype="${text}" style="width: auto; margin: 0; padding: 2px 8px; font-size: 0.7rem; border-radius: 12px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: #e2e8f0; cursor: pointer;">
          ${text}
        </button>
      `).join('')}
    </div>

    <form id="post-form" style="margin-bottom: 1.2rem; display: flex; gap: 0.5rem;">
      <input type="text" id="post-content" placeholder="Share a message or drop a link (+15 XP)..." required style="flex: 1; margin: 0;">
      <button type="submit" style="width: auto; margin: 0; padding: 0 1.2rem; background: ${theme};">Post</button>
    </form>

    ${pinnedPosts.length > 0 ? `
      <div style="display:flex; flex-direction:column; gap:0.6rem; margin-bottom: 1rem;">
        ${pinnedPosts.map(p => renderPostCard(p, true)).join('')}
      </div>
    ` : ''}

    <div style="display:flex; flex-direction:column; gap:0.8rem; max-height:340px; overflow-y:auto;">
      ${regularPosts.length > 0 ? regularPosts.map(p => renderPostCard(p, false)).join('') : (pinnedPosts.length === 0 ? '<p style="font-size:0.85rem; color:var(--muted); text-align:center; padding: 1.5rem 0;">No posts in this vault yet. Start the conversation!</p>' : '')}
    </div>
  `;
}

function renderVaultRaidsTab(theme) {
  const hp = activeSquad.boss_hp ?? 500;
  const maxHp = activeSquad.boss_max_hp ?? 500;
  const hpPct = Math.max(0, Math.min(100, Math.round((hp / maxHp) * 100)));

  return `
    <div style="background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.35); border-radius: 10px; padding: 1rem; margin-bottom: 1.4rem;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
        <div>
          <span style="font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.05em; color: #f87171; font-weight: 700;">ACTIVE SQUAD RAID BOSS</span>
          <h4 style="margin: 0.1rem 0 0; font-size: 1.05rem; color: #fff;">${activeSquad.boss_name || 'Shadow Warden'}</h4>
        </div>
        <span style="font-size: 0.85rem; font-weight: 700; color: #f87171;">${hp} / ${maxHp} HP</span>
      </div>

      <div style="width: 100%; height: 10px; background: rgba(0,0,0,0.4); border-radius: 6px; overflow: hidden; margin-bottom: 0.8rem;">
        <div style="width: ${hpPct}%; height: 100%; background: linear-gradient(90deg, #ef4444, #f97316); transition: width 0.3s ease;"></div>
      </div>

      <div style="display: flex; gap: 0.6rem; flex-wrap: wrap;">
        <button id="attack-boss-btn" style="flex: 1; margin: 0; background: #ef4444; font-size: 0.82rem; font-weight: 600;">
          Strike Boss (-35 HP • +20 XP)
        </button>
        ${hp === 0 ? `
          <button id="summon-boss-btn" class="btn-secondary" style="width: auto; margin: 0; font-size: 0.82rem; border-color: #10b981; color: #10b981;">
            Summon Stronger Boss (+100 Squad XP)
          </button>
        ` : ''}
      </div>
    </div>

    <h4 style="margin: 0 0 0.6rem; font-size: 0.92rem; color: var(--muted);">Shared Squad Objectives</h4>
    <form id="create-goal-form" style="display: flex; gap: 0.5rem; margin-bottom: 1rem;">
      <input type="text" id="goal-title" placeholder="Add a squad goal or target..." required style="flex: 1; margin: 0;">
      <button type="submit" style="width: auto; margin: 0; padding: 0 1.1rem; background: ${theme};">Add</button>
    </form>

    <div style="display: flex; flex-direction: column; gap: 0.55rem; max-height: 240px; overflow-y: auto;">
      ${squadGoals.length > 0 ? squadGoals.map(g => `
        <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(10,14,26,0.5); padding: 0.7rem 0.9rem; border-radius: 8px; border: 1px solid rgba(255,255,255,0.06);">
          <label style="display: flex; align-items: center; gap: 0.7rem; cursor: pointer; font-size: 0.88rem; text-decoration: ${g.is_completed ? 'line-through' : 'none'}; color: ${g.is_completed ? 'var(--muted)' : '#fff'};">
            <input type="checkbox" class="toggle-goal-cb" data-goal-id="${g.id}" ${g.is_completed ? 'checked' : ''} style="width: 16px; height: 16px; accent-color: ${theme};">
            ${g.title}
          </label>
          <button class="delete-goal-btn" data-goal-id="${g.id}" style="width: auto; margin: 0; background: none; border: none; color: #ff4757; font-size: 0.75rem; cursor: pointer;">✕</button>
        </div>
      `).join('') : '<p style="font-size:0.82rem; color:var(--muted); text-align:center;">No squad objectives yet.</p>'}
    </div>
  `;
}

function renderVaultGamesTab(theme) {
  const sortedLeaderboard = [...squadMembers].sort((a, b) => (b.profiles?.xp || 0) - (a.profiles?.xp || 0));

  let btnBg = theme;
  let btnText = 'Start Reflex Test';
  if (reactionState === 'waiting') {
    btnBg = '#ef4444';
    btnText = 'WAIT FOR GREEN...';
  } else if (reactionState === 'ready') {
    btnBg = '#10b981';
    btnText = 'CLICK NOW!';
  } else if (reactionState === 'done') {
    btnBg = theme;
    btnText = `${lastReactionMs} ms — Play Again`;
  }

  return `
    <!-- Game 1: Squad Reflex Challenge -->
    <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 1rem; margin-bottom: 1rem; text-align: center;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.4rem;">
        <h4 style="margin: 0; font-size: 0.95rem;">1. Squad Reflex Challenge</h4>
        <span style="font-size: 0.74rem; color: ${theme}; font-weight: 600;">
          Record: ${activeSquad.best_reaction_ms ? `${activeSquad.best_reaction_ms}ms (@${activeSquad.best_reaction_user})` : 'Unclaimed'}
        </span>
      </div>
      <button id="reflex-game-btn" style="width: 100%; height: 50px; font-size: 0.92rem; font-weight: 700; border-radius: 8px; background: ${btnBg}; margin: 0;">
        ${btnText}
      </button>
    </div>

    <!-- Game 2: 15s Speed Math Blitz -->
    <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 1rem; margin-bottom: 1rem; text-align: center;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
        <h4 style="margin: 0; font-size: 0.95rem;">2. 15s Speed Blitz (+10 XP / Hit)</h4>
        <span style="font-size: 0.75rem; color: var(--muted);">Score: <strong>${blitzScore}</strong> ${blitzActive ? `• ${blitzTimeLeft}s left` : ''}</span>
      </div>

      ${!blitzActive ? `
        <button id="start-blitz-btn" class="btn-secondary" style="width: 100%; margin: 0; border-color: ${theme}; color: #fff;">
          Start 15-Second Blitz
        </button>
      ` : `
        <form id="blitz-answer-form" style="display: flex; gap: 0.6rem; align-items: center; justify-content: center;">
          <span style="font-size: 1.2rem; font-weight: 700; color: ${theme};">${blitzQuestion?.text} =</span>
          <input type="number" id="blitz-input" autofocus required style="width: 100px; margin: 0; text-align: center; font-size: 1.1rem;">
          <button type="submit" style="width: auto; margin: 0; padding: 0.5rem 1rem; background: ${theme};">Go</button>
        </form>
      `}
    </div>

    <!-- Game 3: Vault Codebreaker -->
    <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 1rem; margin-bottom: 1.4rem;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.4rem;">
        <h4 style="margin: 0; font-size: 0.95rem;">3. Vault Codebreaker (+75 XP)</h4>
        <button id="reset-codebreaker-btn" class="btn-secondary" style="width: auto; margin: 0; padding: 2px 8px; font-size: 0.7rem;">New PIN</button>
      </div>
      <p style="font-size: 0.76rem; color: var(--muted); margin: 0 0 0.7rem;">
        Crack the 4-digit PIN (digits 1-9, no repeats). <strong>Exact</strong> = right digit & spot. <strong>Close</strong> = right digit, wrong spot.
      </p>

      ${!codeSolved ? `
        <form id="codebreaker-form" style="display: flex; gap: 0.5rem; margin-bottom: 0.6rem;">
          <input type="text" id="codebreaker-input" maxlength="4" pattern="[1-9]{4}" placeholder="e.g. 4829" required style="flex: 1; margin: 0; letter-spacing: 0.25em; text-align: center; font-weight: 700;">
          <button type="submit" style="width: auto; margin: 0; padding: 0 1rem; background: ${theme};">Crack</button>
        </form>
      ` : `
        <div style="background: rgba(16, 185, 129, 0.15); border: 1px solid #10b981; color: #34d399; padding: 0.5rem; border-radius: 6px; font-size: 0.82rem; text-align: center; margin-bottom: 0.6rem;">
          VAULT CRACKED! PIN was <strong>${codeSecret}</strong> (+75 XP awarded!)
        </div>
      `}

      <div style="display: flex; flex-direction: column; gap: 0.3rem; max-height: 110px; overflow-y: auto;">
        ${codeGuesses.map((g, i) => `
          <div style="display: flex; justify-content: space-between; font-size: 0.78rem; background: rgba(0,0,0,0.25); padding: 0.3rem 0.6rem; border-radius: 4px;">
            <span>Attempt #${i + 1}: <strong style="letter-spacing: 0.15em;">${g.guess}</strong></span>
            <span><strong style="color: #10b981;">${g.exact} Exact</strong> • <strong style="color: #fbbf24;">${g.partial} Close</strong></span>
          </div>
        `).join('')}
      </div>
    </div>

    <!-- Squad MVP Leaderboard -->
    <h4 style="margin: 0 0 0.6rem; font-size: 0.92rem;">Squad MVP Leaderboard</h4>
    <div style="display: flex; flex-direction: column; gap: 0.45rem; margin-bottom: 1.4rem;">
      ${sortedLeaderboard.map((m, idx) => `
        <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(10,14,26,0.5); padding: 0.55rem 0.9rem; border-radius: 8px; border: 1px solid ${idx === 0 ? theme : 'rgba(255,255,255,0.05)'};">
          <div style="display: flex; align-items: center; gap: 0.6rem; font-size: 0.85rem;">
            <strong style="color: ${idx === 0 ? theme : 'var(--muted)'};">#${idx + 1}</strong>
            <span style="color: ${m.profiles?.name_color || '#fff'}; font-weight: 600;">@${m.profiles?.username || 'Member'}</span>
            <span style="font-size: 0.7rem; color: var(--muted);">(${m.custom_rank || 'Member'})</span>
          </div>
          <strong style="font-size: 0.84rem; color: #fff;">${m.profiles?.xp || 0} XP</strong>
        </div>
      `).join('')}
    </div>

    <!-- Global Top Squads Ranking (Clickable!) -->
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.6rem;">
      <h4 style="margin: 0; font-size: 0.92rem;">Global Top Squads</h4>
      <span style="font-size: 0.72rem; color: var(--muted);">Click any squad to inspect profile</span>
    </div>
    <div style="display: flex; flex-direction: column; gap: 0.45rem;">
      ${topGlobalSquads.map((s, idx) => `
        <button type="button" class="view-squad-profile-btn" data-squad-id="${s.id}" style="width: 100%; margin: 0; display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.03); padding: 0.6rem 0.9rem; border-radius: 8px; border: 1px solid ${s.id === activeSquad.id ? theme : 'rgba(255,255,255,0.06)'}; cursor: pointer; text-align: left;">
          <div style="display: flex; align-items: center; gap: 0.6rem; font-size: 0.85rem;">
            <strong style="color: ${idx === 0 ? '#fbbf24' : 'var(--muted)'};">#${idx + 1}</strong>
            <span style="font-weight: 700; color: ${s.theme_color || '#fff'}; text-decoration: underline;">${s.name}</span>
            <span style="font-size: 0.7rem; color: var(--muted);">LVL ${Math.floor((s.xp || 0)/250) + 1}</span>
          </div>
          <strong style="font-size: 0.84rem; color: #e2e8f0;">${s.xp || 0} XP →</strong>
        </button>
      `).join('')}
    </div>
  `;
}

function renderVaultShopTab(theme) {
  const userXp = currentProfile?.xp || 0;
  const unlocked = currentProfile?.unlocked_perks || [];

  return `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
      <div>
        <h4 style="margin: 0; font-size: 0.98rem;">XP Armory & Cosmetics</h4>
        <p style="margin: 0.2rem 0 0; font-size: 0.78rem; color: var(--muted);">Spend your earned XP on profile titles and colored usernames.</p>
      </div>
      <span style="background: rgba(168,85,247,0.15); border: 1px solid ${theme}; padding: 0.35rem 0.8rem; border-radius: 8px; font-size: 0.85rem; font-weight: 700; color: #fff;">
        Balance: ${userXp} XP
      </span>
    </div>

    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 0.75rem;">
      ${PERK_CATALOG.map(perk => {
        const isUnlocked = unlocked.includes(perk.id);
        const isEquipped = (perk.type === 'color' && currentProfile?.name_color === perk.value) ||
                           (perk.type === 'title' && currentProfile?.active_title === perk.value);

        return `
          <div style="background: rgba(10,14,26,0.55); border: 1px solid ${isEquipped ? theme : 'rgba(255,255,255,0.08)'}; border-radius: 8px; padding: 0.85rem; display: flex; flex-direction: column; justify-content: space-between; gap: 0.7rem;">
            <div>
              <span style="font-size: 0.68rem; text-transform: uppercase; color: var(--muted);">${perk.type}</span>
              <div style="font-weight: 700; font-size: 0.9rem; color: ${perk.type === 'color' ? perk.value : '#fff'}; margin-top: 0.2rem;">
                ${perk.name}
              </div>
            </div>

            ${isUnlocked ? `
              <button class="equip-perk-btn btn-secondary" data-perk-id="${perk.id}" style="width: 100%; margin: 0; font-size: 0.78rem; border-color: ${isEquipped ? theme : 'rgba(255,255,255,0.15)'}; color: #fff;">
                ${isEquipped ? 'Equipped' : 'Equip'}
              </button>
            ` : `
              <button class="buy-perk-btn" data-perk-id="${perk.id}" ${userXp < perk.cost ? 'disabled' : ''} style="width: 100%; margin: 0; font-size: 0.78rem; background: ${userXp >= perk.cost ? theme : 'rgba(255,255,255,0.06)'}; color: ${userXp >= perk.cost ? '#fff' : 'var(--muted)'}; cursor: ${userXp >= perk.cost ? 'pointer' : 'not-allowed'};">
                Unlock (${perk.cost} XP)
              </button>
            `}
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function renderVaultPollsTab(theme) {
  return `
    <form id="create-poll-form" style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); padding: 1rem; border-radius: 8px; margin-bottom: 1.2rem;">
      <div class="input-group" style="margin-bottom: 0.6rem;">
        <input type="text" id="poll-question" placeholder="Ask your squad a question..." required>
      </div>
      <div style="display: flex; gap: 0.5rem; margin-bottom: 0.6rem;">
        <input type="text" id="poll-opt-1" placeholder="Option 1" required style="flex: 1;">
        <input type="text" id="poll-opt-2" placeholder="Option 2" required style="flex: 1;">
        <input type="text" id="poll-opt-3" placeholder="Option 3 (optional)" style="flex: 1;">
      </div>
      <button type="submit" style="margin: 0; background: ${theme}; font-size: 0.85rem;">Launch Squad Poll (+20 XP)</button>
    </form>

    <div style="display: flex; flex-direction: column; gap: 1rem; max-height: 320px; overflow-y: auto;">
      ${squadPolls.length > 0 ? squadPolls.map(poll => {
        const totalVotes = poll.options.reduce((sum, opt) => sum + (opt.votes?.length || 0), 0);
        return `
          <div style="background: rgba(10,14,26,0.6); border: 1px solid rgba(255,255,255,0.08); padding: 1rem; border-radius: 8px;">
            <div style="font-weight: 600; font-size: 0.95rem; margin-bottom: 0.8rem;">${poll.question}</div>
            <div style="display: flex; flex-direction: column; gap: 0.5rem;">
              ${poll.options.map((opt, idx) => {
                const count = opt.votes?.length || 0;
                const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
                const voted = (opt.votes || []).includes(currentUser?.id);
                return `
                  <button class="vote-poll-btn" data-poll-id="${poll.id}" data-opt-idx="${idx}" style="width: 100%; margin: 0; text-align: left; padding: 0.55rem 0.8rem; border-radius: 6px; background: rgba(255,255,255,0.04); border: 1px solid ${voted ? theme : 'rgba(255,255,255,0.1)'}; color: #fff; cursor: pointer; position: relative; overflow: hidden;">
                    <div style="position: absolute; top: 0; left: 0; height: 100%; width: ${pct}%; background: ${theme}; opacity: 0.22; z-index: 0;"></div>
                    <div style="position: relative; z-index: 1; display: flex; justify-content: space-between; font-size: 0.85rem;">
                      <span>${voted ? '✓ ' : ''}${opt.text}</span>
                      <span>${pct}% (${count})</span>
                    </div>
                  </button>
                `;
              }).join('')}
            </div>
            <div style="font-size: 0.72rem; color: var(--muted); margin-top: 0.5rem;">Total votes: ${totalVotes}</div>
          </div>
        `;
      }).join('') : '<p style="font-size:0.85rem; color:var(--muted); text-align:center;">No polls yet. Create one above!</p>'}
    </div>
  `;
}

function renderVaultSettingsTab(theme) {
  const colors = [
    { name: 'Neon Purple', hex: '#a855f7' },
    { name: 'Cyber Blue', hex: '#3b82f6' },
    { name: 'Emerald Green', hex: '#10b981' },
    { name: 'Crimson Red', hex: '#ef4444' },
    { name: 'Solar Gold', hex: '#f59e0b' }
  ];

  const isCreatorOrAdmin = activeSquad.created_by === currentUser?.id || currentProfile?.role === 'admin';

  return `
    <form id="customize-squad-form" style="display: flex; flex-direction: column; gap: 1rem; margin-bottom: 1.5rem;">
      <div class="input-group" style="margin: 0;">
        <label>Squad Name</label>
        <input type="text" id="edit-squad-name" value="${activeSquad.name}" required>
      </div>

      <div class="input-group" style="margin: 0;">
        <label>Squad Motto / Description</label>
        <input type="text" id="edit-squad-desc" value="${activeSquad.description || ''}" placeholder="What is this squad about?">
      </div>

      <div>
        <label style="font-size: 0.85rem; color: var(--muted); display: block; margin-bottom: 0.5rem;">Vault Accent Theme</label>
        <div style="display: flex; gap: 0.6rem; flex-wrap: wrap;">
          ${colors.map(c => `
            <button type="button" class="theme-swatch-btn" data-color="${c.hex}" style="width: auto; margin: 0; padding: 0.4rem 0.8rem; font-size: 0.78rem; border-radius: 6px; background: rgba(255,255,255,0.05); border: 2px solid ${theme === c.hex ? c.hex : 'transparent'}; color: #fff; display: flex; align-items: center; gap: 0.4rem;">
              <span style="width: 12px; height: 12px; border-radius: 50%; background: ${c.hex}; display: inline-block;"></span>
              ${c.name}
            </button>
          `).join('')}
        </div>
        <input type="hidden" id="selected-theme-color" value="${theme}">
      </div>

      <button type="submit" style="background: ${theme}; margin-top: 0.2rem;">Save Squad Customization</button>
    </form>

    <div style="border-top: 1px solid rgba(255,255,255,0.08); padding-top: 1rem; margin-bottom: 1.5rem;">
      <h4 style="margin: 0 0 0.6rem; font-size: 0.9rem;">Assign Custom Member Titles</h4>
      <div style="display: flex; flex-direction: column; gap: 0.5rem;">
        ${squadMembers.map(m => `
          <div style="display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; background: rgba(0,0,0,0.2); padding: 0.5rem 0.75rem; border-radius: 6px;">
            <span style="font-size: 0.84rem;">@${m.profiles?.username || 'Member'}</span>
            <div style="display: flex; gap: 0.4rem;">
              <input type="text" class="rank-input" data-user-id="${m.user_id}" value="${m.custom_rank || 'Member'}" placeholder="e.g. Captain" style="width: 130px; padding: 0.3rem 0.5rem; font-size: 0.78rem;">
              <button type="button" class="save-rank-btn btn-secondary" data-user-id="${m.user_id}" style="width: auto; margin: 0; padding: 0.3rem 0.6rem; font-size: 0.75rem;">Set</button>
            </div>
          </div>
        `).join('')}
      </div>
    </div>

    <div style="border-top: 1px solid rgba(239, 68, 68, 0.25); padding-top: 1rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.8rem;">
      <div>
        <strong style="font-size: 0.85rem; color: #f87171;">Squad Actions</strong>
        <p style="margin: 0.2rem 0 0; font-size: 0.75rem; color: var(--muted);">
          ${isCreatorOrAdmin ? 'Permanently delete this squad and all its vault data.' : 'Leave this squad and remove it from your dashboard.'}
        </p>
      </div>
      ${isCreatorOrAdmin ? `
        <button type="button" id="delete-current-squad-btn" style="width: auto; margin: 0; padding: 0.45rem 0.95rem; font-size: 0.8rem; background: #ef4444; color: #fff; border: none; border-radius: 6px; cursor: pointer;">
          Delete Squad
        </button>
      ` : `
        <button type="button" id="leave-current-squad-btn" class="btn-secondary" style="width: auto; margin: 0; padding: 0.45rem 0.95rem; font-size: 0.8rem; border-color: #ef4444; color: #f87171;">
          Leave Squad
        </button>
      `}
    </div>
  `;
}

// GLOBAL LEADERBOARD MODAL
function renderGlobalLeaderboardModal() {
  return `
    <div id="leaderboard-backdrop" style="position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.78); backdrop-filter: blur(6px); z-index: 9999; display: flex; align-items: center; justify-content: center; padding: 1rem;">
      <div style="background: #0d111a; border: 1px solid var(--border); width: 100%; max-width: 580px; border-radius: 12px; padding: 1.5rem; box-shadow: 0 12px 35px rgba(0,0,0,0.6);">
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 0.9rem; margin-bottom: 1rem;">
          <div>
            <h3 style="margin: 0; font-size: 1.15rem; color: #fbbf24;">Global Squad Rankings</h3>
            <span style="font-size: 0.76rem; color: var(--muted);">Click any squad to inspect its owner, members, and stats</span>
          </div>
          <button id="close-leaderboard-btn" style="background: none; border: none; color: var(--muted); font-size: 1.2rem; cursor: pointer; width: auto; margin: 0;">✕</button>
        </div>

        <div style="display: flex; flex-direction: column; gap: 0.55rem; max-height: 360px; overflow-y: auto;">
          ${topGlobalSquads.map((s, idx) => `
            <button type="button" class="view-squad-profile-btn" data-squad-id="${s.id}" style="width: 100%; margin: 0; display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.03); padding: 0.75rem 1rem; border-radius: 8px; border: 1px solid rgba(255,255,255,0.08); cursor: pointer; text-align: left;">
              <div style="display: flex; align-items: center; gap: 0.8rem;">
                <span style="font-size: 1rem; font-weight: 800; color: ${idx === 0 ? '#fbbf24' : (idx === 1 ? '#cbd5e1' : (idx === 2 ? '#d97706' : 'var(--muted)'))}; width: 26px;">
                  #${idx + 1}
                </span>
                <div>
                  <div style="font-weight: 700; font-size: 0.95rem; color: ${s.theme_color || '#fff'};">${s.name}</div>
                  <div style="font-size: 0.72rem; color: var(--muted);">Owner: @${s.profiles?.username || 'Unknown'} • LVL ${Math.floor((s.xp || 0)/250) + 1}</div>
                </div>
              </div>
              <div style="text-align: right;">
                <div style="font-weight: 700; font-size: 0.9rem; color: #fff;">${s.xp || 0} XP</div>
                <div style="font-size: 0.7rem; color: var(--accent-glow);">View Info →</div>
              </div>
            </button>
          `).join('')}
        </div>
      </div>
    </div>
  `;
}

// CLICKABLE SQUAD PROFILE DOSSIER MODAL
function renderSquadProfileDossierModal() {
  const { squad, members, rank } = inspectedSquadProfile;
  const theme = squad.theme_color || '#a855f7';
  const lvl = getSquadLevelInfo(squad.xp || 0);

  return `
    <div id="dossier-backdrop" style="position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.82); backdrop-filter: blur(6px); z-index: 10000; display: flex; align-items: center; justify-content: center; padding: 1rem;">
      <div style="background: #0d111a; border: 2px solid ${theme}; width: 100%; max-width: 520px; border-radius: 14px; padding: 1.5rem; box-shadow: 0 15px 40px rgba(0,0,0,0.7);">
        
        <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 1rem; margin-bottom: 1rem;">
          <div>
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <span style="background: ${theme}; color: #fff; font-size: 0.72rem; font-weight: 800; padding: 2px 8px; border-radius: 6px;">
                RANK #${rank || '—'}
              </span>
              <span style="background: rgba(255,255,255,0.08); color: #fff; font-size: 0.72rem; font-weight: 700; padding: 2px 8px; border-radius: 6px;">
                LEVEL ${lvl.level}
              </span>
            </div>
            <h2 style="margin: 0.45rem 0 0.2rem; font-size: 1.4rem; color: #fff; text-align: left;">${squad.name}</h2>
            <p style="margin: 0; font-size: 0.82rem; color: var(--muted);">${squad.description || 'No motto set.'}</p>
          </div>
          <button id="close-dossier-btn" style="background: none; border: none; color: var(--muted); font-size: 1.25rem; cursor: pointer; width: auto; margin: 0;">✕</button>
        </div>

        <!-- Key Stats Grid -->
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.6rem; margin-bottom: 1.2rem; text-align: center;">
          <div style="background: rgba(255,255,255,0.03); padding: 0.6rem; border-radius: 8px; border: 1px solid rgba(255,255,255,0.06);">
            <div style="font-size: 0.7rem; color: var(--muted);">Owner</div>
            <div style="font-size: 0.88rem; font-weight: 700; color: #fff; margin-top: 0.15rem;">@${squad.profiles?.username || 'Unknown'}</div>
          </div>
          <div style="background: rgba(255,255,255,0.03); padding: 0.6rem; border-radius: 8px; border: 1px solid rgba(255,255,255,0.06);">
            <div style="font-size: 0.7rem; color: var(--muted);">Total Squad XP</div>
            <div style="font-size: 0.88rem; font-weight: 700; color: ${theme}; margin-top: 0.15rem;">${squad.xp || 0} XP</div>
          </div>
          <div style="background: rgba(255,255,255,0.03); padding: 0.6rem; border-radius: 8px; border: 1px solid rgba(255,255,255,0.06);">
            <div style="font-size: 0.7rem; color: var(--muted);">Members</div>
            <div style="font-size: 0.88rem; font-weight: 700; color: #fff; margin-top: 0.15rem;">${members.length}</div>
          </div>
        </div>

        <!-- Roster List -->
        <h4 style="margin: 0 0 0.6rem; font-size: 0.88rem; color: var(--muted);">Squad Roster (${members.length})</h4>
        <div style="display: flex; flex-direction: column; gap: 0.45rem; max-height: 220px; overflow-y: auto; margin-bottom: 1rem;">
          ${members.map(m => `
            <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(0,0,0,0.3); padding: 0.55rem 0.8rem; border-radius: 8px; border: 1px solid rgba(255,255,255,0.05);">
              <div>
                <strong style="font-size: 0.85rem; color: ${m.profiles?.name_color || '#fff'};">@${m.profiles?.username || 'Member'}</strong>
                <span style="font-size: 0.7rem; color: ${theme}; margin-left: 0.4rem;">[${m.custom_rank || 'Member'}]</span>
                <div style="font-size: 0.7rem; color: var(--muted);">${m.profiles?.status || 'Online'}</div>
              </div>
              <span style="font-size: 0.8rem; font-weight: 700; color: #e2e8f0;">${m.profiles?.xp || 0} XP</span>
            </div>
          `).join('')}
        </div>

        <button id="close-dossier-footer-btn" class="btn-secondary" style="width: 100%; margin: 0;">Close Squad Card</button>
      </div>
    </div>
  `;
}

function renderUserDataModal() {
  return `
    <div id="user-data-backdrop" style="position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.75); backdrop-filter: blur(5px); z-index: 9999; display: flex; align-items: center; justify-content: center; padding: 1rem;">
      <div style="background: #0d111a; border: 1px solid var(--border); width: 100%; max-width: 450px; border-radius: 12px; padding: 1.5rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 0.8rem; margin-bottom: 1rem;">
          <h3 style="margin: 0; font-size: 1.05rem;">Privacy & Data Controls</h3>
          <button id="close-user-data-btn" style="background: none; border: none; color: var(--muted); font-size: 1.2rem; cursor: pointer; width: auto; margin: 0;">✕</button>
        </div>

        <p style="font-size: 0.8rem; color: var(--muted); margin-bottom: 1rem;">
          Email on file: <strong>${currentUser?.email || 'GitHub OAuth'}</strong>
        </p>

        <form id="update-username-form" style="margin-bottom: 1.2rem;">
          <label style="font-size: 0.8rem; color: var(--muted);">Change Username</label>
          <div style="display: flex; gap: 0.5rem; margin-top: 0.3rem;">
            <input type="text" id="new-username-input" value="${currentProfile?.username || ''}" required style="flex: 1; padding: 0.45rem; background: rgba(0,0,0,0.3); border: 1px solid var(--border); border-radius: 6px; color: #fff;">
            <button type="submit" style="width: auto; margin: 0; padding: 0.45rem 0.9rem;">Update</button>
          </div>
        </form>

        <div style="border-top: 1px solid rgba(255,255,255,0.08); padding-top: 1rem; display: flex; flex-direction: column; gap: 0.6rem;">
          <button id="delete-my-posts-btn" class="btn-secondary" style="width: 100%; font-size: 0.82rem; color: #ffa502; border-color: rgba(255,165,2,0.3);">
            Delete All My Vault Posts
          </button>
          <button id="delete-my-account-btn" style="width: 100%; font-size: 0.82rem; background: #ff4757; color: #fff; border: none; padding: 0.6rem; border-radius: 6px; cursor: pointer;">
            Wipe My Profile & Sign Out
          </button>
        </div>
      </div>
    </div>
  `;
}

function renderModModal(isAdmin) {
  const filteredUsers = allProfilesList.filter(u => 
    (u.username || '').toLowerCase().includes(userSearchQuery.toLowerCase())
  );

  const filteredSquads = allSquadsList.filter(s =>
    (s.name || '').toLowerCase().includes(squadSearchQuery.toLowerCase()) ||
    (s.invite_code || '').toLowerCase().includes(squadSearchQuery.toLowerCase())
  );

  return `
    <div id="modal-backdrop" style="position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.78); backdrop-filter: blur(6px); z-index: 9999; display: flex; align-items: center; justify-content: center; padding: 1rem;">
      <div style="background: #0d111a; border: 1px solid var(--border); width: 100%; max-width: 740px; border-radius: 12px; padding: 1.5rem; box-shadow: 0 12px 35px rgba(0,0,0,0.6);">
        
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 0.9rem; margin-bottom: 1rem;">
          <div>
            <h3 style="margin: 0; font-size: 1.15rem; color: #fff;">Staff Control Center</h3>
            <span style="font-size: 0.75rem; color: var(--muted);">Platform Administration & Global Vault Oversight</span>
          </div>
          <button id="close-mod-modal-btn" style="background: none; border: none; color: var(--muted); font-size: 1.2rem; cursor: pointer; width: auto; margin: 0;">✕</button>
        </div>

        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.8rem; margin-bottom: 1rem; text-align: center;">
          <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05); padding: 0.6rem; border-radius: 6px;">
            <div style="font-size: 1.15rem; font-weight: bold; color: var(--accent-glow);">${systemStats.users}</div>
            <div style="font-size: 0.7rem; color: var(--muted);">Registered Users</div>
          </div>
          <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05); padding: 0.6rem; border-radius: 6px;">
            <div style="font-size: 1.15rem; font-weight: bold; color: var(--accent-glow);">${systemStats.squads}</div>
            <div style="font-size: 0.7rem; color: var(--muted);">Total Squads</div>
          </div>
          <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05); padding: 0.6rem; border-radius: 6px;">
            <div style="font-size: 1.15rem; font-weight: bold; color: var(--accent-glow);">${systemStats.posts}</div>
            <div style="font-size: 0.7rem; color: var(--muted);">Total Vault Posts</div>
          </div>
        </div>

        <div style="display: flex; gap: 0.45rem; flex-wrap: wrap; margin-bottom: 1rem;">
          <button id="modal-tab-squads" class="${activeAdminTab === 'squads' ? 'btn-squad-select active-squad' : 'btn-secondary'}" style="padding: 0.35rem 0.75rem; font-size: 0.78rem; width: auto; margin: 0;">
            All Squads (${allSquadsList.length})
          </button>
          <button id="modal-tab-users" class="${activeAdminTab === 'users' ? 'btn-squad-select active-squad' : 'btn-secondary'}" style="padding: 0.35rem 0.75rem; font-size: 0.78rem; width: auto; margin: 0;">
            Users & Roles (${allProfilesList.length})
          </button>
          <button id="modal-tab-feed" class="${activeAdminTab === 'feed' ? 'btn-squad-select active-squad' : 'btn-secondary'}" style="padding: 0.35rem 0.75rem; font-size: 0.78rem; width: auto; margin: 0;">
            Global Feed
          </button>
          ${isAdmin ? `
            <button id="modal-tab-broadcast" class="${activeAdminTab === 'broadcast' ? 'btn-squad-select active-squad' : 'btn-secondary'}" style="padding: 0.35rem 0.75rem; font-size: 0.78rem; width: auto; margin: 0;">
              Broadcast
            </button>
            <button id="modal-tab-logs" class="${activeAdminTab === 'logs' ? 'btn-squad-select active-squad' : 'btn-secondary'}" style="padding: 0.35rem 0.75rem; font-size: 0.78rem; width: auto; margin: 0;">
              Audit Logs
            </button>
          ` : ''}
        </div>

        ${activeAdminTab === 'squads' ? `
          <div style="margin-bottom: 0.8rem;">
            <input type="text" id="mod-squad-search" placeholder="Search any squad name or invite code..." value="${squadSearchQuery}" style="width: 100%; padding: 0.5rem; background: rgba(0,0,0,0.3); border: 1px solid var(--border); border-radius: 6px; color: #fff; font-size: 0.82rem;">
          </div>
          <div style="max-height: 270px; overflow-y: auto;">
            <table style="width:100%; border-collapse:collapse; font-size:0.84rem;">
              <thead>
                <tr style="border-bottom:1px solid rgba(255,255,255,0.1); text-align:left; color:var(--muted);">
                  <th style="padding:0.4rem;">Squad Name</th>
                  <th style="padding:0.4rem;">Invite Code</th>
                  <th style="padding:0.4rem;">Level / XP</th>
                  <th style="padding:0.4rem; text-align:right;">Oversight</th>
                </tr>
              </thead>
              <tbody>
                ${filteredSquads.map(s => `
                  <tr style="border-bottom:1px solid rgba(255,255,255,0.05);">
                    <td style="padding:0.45rem;">
                      <strong style="color: ${s.theme_color || '#fff'};">${s.name}</strong>
                      <div style="font-size: 0.7rem; color: var(--muted);">by @${s.profiles?.username || 'Unknown'}</div>
                    </td>
                    <td style="padding:0.45rem; font-family: monospace;">${s.invite_code}</td>
                    <td style="padding:0.45rem;">LVL ${Math.floor((s.xp || 0)/250) + 1} (${s.xp || 0} XP)</td>
                    <td style="padding:0.45rem; text-align:right; display:flex; gap:0.4rem; justify-content:flex-end;">
                      <button class="inspect-squad-btn btn-secondary" data-squad-id="${s.id}" style="padding:0.25rem 0.55rem; font-size:0.72rem; width:auto; margin:0; border-color: #a855f7; color: #fff;">Inspect Vault</button>
                      ${isAdmin ? `
                        <button class="delete-squad-btn" data-squad-id="${s.id}" data-squad-name="${s.name}" style="padding:0.25rem 0.55rem; font-size:0.72rem; background:#ff4757; color:#fff; border:none; border-radius:4px; cursor:pointer; width:auto; margin:0;">Disband</button>
                      ` : ''}
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        ` : ''}

        ${activeAdminTab === 'users' ? `
          <div style="margin-bottom: 0.8rem;">
            <input type="text" id="mod-user-search" placeholder="Search username..." value="${userSearchQuery}" style="width: 100%; padding: 0.5rem; background: rgba(0,0,0,0.3); border: 1px solid var(--border); border-radius: 6px; color: #fff; font-size: 0.82rem;">
          </div>
          <div style="max-height: 270px; overflow-y: auto;">
            <table style="width:100%; border-collapse:collapse; font-size:0.84rem;">
              <thead>
                <tr style="border-bottom:1px solid rgba(255,255,255,0.1); text-align:left; color:var(--muted);">
                  <th style="padding:0.4rem;">User</th>
                  <th style="padding:0.4rem;">XP</th>
                  <th style="padding:0.4rem;">Role</th>
                  <th style="padding:0.4rem; text-align:right;">Actions</th>
                </tr>
              </thead>
              <tbody>
                ${filteredUsers.map(u => `
                  <tr style="border-bottom:1px solid rgba(255,255,255,0.05);">
                    <td style="padding:0.4rem;">@${u.username || 'Anonymous'}</td>
                    <td style="padding:0.4rem;">${u.xp || 0}</td>
                    <td style="padding:0.4rem;">
                      <span style="padding:2px 6px; border-radius:4px; font-size:0.7rem; background:${u.role === 'admin' ? '#a855f7' : (u.role === 'mod' ? '#3b82f6' : 'rgba(255,255,255,0.1)')};">
                        ${u.role || 'user'}
                      </span>
                    </td>
                    <td style="padding:0.4rem; text-align:right; display:flex; gap:0.4rem; justify-content:flex-end;">
                      ${isAdmin && u.id !== currentUser.id ? `
                        ${u.role === 'mod' ? `
                          <button class="role-btn btn-secondary" data-id="${u.id}" data-role="user" data-name="${u.username}" style="padding:0.2rem 0.45rem; font-size:0.7rem; width: auto; margin: 0;">Demote</button>
                        ` : `
                          <button class="role-btn btn-secondary" data-id="${u.id}" data-role="mod" data-name="${u.username}" style="padding:0.2rem 0.45rem; font-size:0.7rem; background:rgba(168,85,247,0.2); border:1px solid #a855f7; color:#fff; width: auto; margin: 0;">Make Mod</button>
                        `}
                      ` : ''}
                      ${(isAdmin || currentProfile?.role === 'mod') && u.id !== currentUser.id ? `
                        <button class="remove-user-btn" data-id="${u.id}" data-name="${u.username}" style="padding:0.2rem 0.45rem; font-size:0.7rem; background:#ff4757; color:#fff; border:none; border-radius:4px; cursor:pointer; width: auto; margin: 0;">Remove</button>
                      ` : ''}
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        ` : ''}

        ${activeAdminTab === 'feed' ? `
          <div style="max-height: 290px; overflow-y: auto; display: flex; flex-direction: column; gap: 0.6rem;">
            ${globalRecentPosts.length > 0 ? globalRecentPosts.map(p => `
              <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); padding: 0.65rem; border-radius: 6px; font-size: 0.82rem;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 0.25rem;">
                  <span><strong style="color: var(--accent-glow);">@${p.profiles?.username || 'User'}</strong> in <strong>${p.squads?.name || 'Unknown Squad'}</strong></span>
                  <button class="global-delete-post-btn" data-post-id="${p.id}" data-author="${p.profiles?.username || 'User'}" style="background:none; border:none; color:#ff4757; font-size:0.72rem; cursor:pointer; padding:0; width:auto; margin:0;">Delete</button>
                </div>
                <div style="color: #e2e8f0;">${p.content}</div>
              </div>
            `).join('') : '<p style="color:var(--muted); font-size:0.82rem; text-align:center;">No posts recorded across the platform yet.</p>'}
          </div>
        ` : ''}

        ${activeAdminTab === 'broadcast' ? `
          <div>
            <p style="font-size: 0.82rem; color: var(--muted); margin-bottom: 0.8rem;">
              Post a live system banner across the top of SquadVault for every online user.
            </p>
            <form id="broadcast-form" style="display: flex; gap: 0.5rem; margin-bottom: 1rem;">
              <input type="text" id="broadcast-msg-input" placeholder="e.g. Weekend Double XP Event is LIVE!" value="${activeAnnouncement?.message || ''}" required style="flex: 1; margin: 0;">
              <button type="submit" style="width: auto; margin: 0; padding: 0 1rem;">Publish</button>
            </form>
            ${activeAnnouncement ? `
              <button id="clear-broadcast-btn" class="btn-secondary" style="width: 100%; font-size: 0.8rem; color: #ff4757; border-color: rgba(255,71,87,0.3);">
                Remove Active Banner
              </button>
            ` : ''}
          </div>
        ` : ''}

        ${activeAdminTab === 'logs' ? `
          <div style="max-height: 290px; overflow-y: auto; font-size:0.8rem;">
            ${auditLogsList.length > 0 ? auditLogsList.map(log => `
              <div style="border-bottom:1px solid rgba(255,255,255,0.05); padding:0.5rem 0;">
                <strong style="color:var(--accent-glow);">${log.action}</strong> by 
                <em>@${log.profiles?.username || 'Staff'}</em>: ${log.target_info}
                <div style="font-size:0.7rem; color:var(--muted);">${new Date(log.created_at).toLocaleString()}</div>
              </div>
            `).join('') : '<p style="color:var(--muted); font-size:0.8rem; text-align:center;">No audit records logged yet.</p>'}
          </div>
        ` : ''}

      </div>
    </div>
  `;
}

async function grantXp(userXpDelta, squadXpDelta) {
  if (!currentUser || !currentProfile) return;
  const newUserXp = (currentProfile.xp || 0) + userXpDelta;
  currentProfile.xp = newUserXp;
  await supabase.from('profiles').update({ xp: newUserXp }).eq('id', currentUser.id);

  if (activeSquad) {
    const newSquadXp = (activeSquad.xp || 0) + squadXpDelta;
    activeSquad.xp = newSquadXp;
    userSquads = userSquads.map(s => s.id === activeSquad.id ? activeSquad : s);
    await supabase.from('squads').update({ xp: newSquadXp }).eq('id', activeSquad.id);
  }
}

function generateBlitzQuestion() {
  const a = Math.floor(Math.random() * 15) + 3;
  const b = Math.floor(Math.random() * 15) + 2;
  const isAdd = Math.random() > 0.35;
  return isAdd ? { text: `${a} + ${b}`, ans: a + b } : { text: `${a + b} - ${b}`, ans: a };
}

async function openSquadDossierById(squadId) {
  await fetchTopGlobalSquads();
  const rankIdx = topGlobalSquads.findIndex(s => s.id === squadId);
  const { data: squad } = await supabase.from('squads').select('*, profiles:created_by(username)').eq('id', squadId).single();
  const { data: members } = await supabase.from('squad_members').select('user_id, custom_rank, profiles(username, xp, status, name_color)').eq('squad_id', squadId);

  if (squad) {
    inspectedSquadProfile = {
      squad,
      members: members || [],
      rank: rankIdx !== -1 ? rankIdx + 1 : null
    };
    renderApp();
  }
}

function attachEventListeners() {
  // Open Global Leaderboard Modal
  const openLeaderboardBtn = document.getElementById('open-leaderboard-btn');
  if (openLeaderboardBtn) {
    openLeaderboardBtn.addEventListener('click', async () => {
      await fetchTopGlobalSquads();
      isLeaderboardModalOpen = true;
      renderApp();
    });
  }

  const closeLeaderboardBtn = document.getElementById('close-leaderboard-btn');
  const leaderboardBackdrop = document.getElementById('leaderboard-backdrop');
  if (closeLeaderboardBtn) {
    closeLeaderboardBtn.addEventListener('click', () => {
      isLeaderboardModalOpen = false;
      renderApp();
    });
  }
  if (leaderboardBackdrop) {
    leaderboardBackdrop.addEventListener('click', (e) => {
      if (e.target.id === 'leaderboard-backdrop') {
        isLeaderboardModalOpen = false;
        renderApp();
      }
    });
  }

  // Clickable Squad Profile Dossier Triggers
  document.querySelectorAll('.view-squad-profile-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const targetId = e.currentTarget.getAttribute('data-squad-id');
      await openSquadDossierById(targetId);
    });
  });

  const closeDossierBtn = document.getElementById('close-dossier-btn');
  const closeDossierFooterBtn = document.getElementById('close-dossier-footer-btn');
  const dossierBackdrop = document.getElementById('dossier-backdrop');
  if (closeDossierBtn) closeDossierBtn.addEventListener('click', () => { inspectedSquadProfile = null; renderApp(); });
  if (closeDossierFooterBtn) closeDossierFooterBtn.addEventListener('click', () => { inspectedSquadProfile = null; renderApp(); });
  if (dossierBackdrop) {
    dossierBackdrop.addEventListener('click', (e) => {
      if (e.target.id === 'dossier-backdrop') {
        inspectedSquadProfile = null;
        renderApp();
      }
    });
  }

  // Claim Daily Bounty
  const claimBountyBtn = document.getElementById('claim-bounty-btn');
  if (claimBountyBtn && !hasClaimedBountyToday()) {
    claimBountyBtn.addEventListener('click', async () => {
      const todayStr = new Date().toISOString().split('T')[0];
      const bounty = getDailyBounty();
      currentProfile.last_bounty_date = todayStr;
      await supabase.from('profiles').update({ last_bounty_date: todayStr }).eq('id', currentUser.id);
      await grantXp(bounty.reward, bounty.reward);
      await fetchTopGlobalSquads();
      renderApp();
    });
  }

  // Daily Check-In Streak
  const dailyCheckinBtn = document.getElementById('daily-checkin-btn');
  if (dailyCheckinBtn && !hasCheckedInToday()) {
    dailyCheckinBtn.addEventListener('click', async () => {
      const todayStr = new Date().toISOString().split('T')[0];
      const newStreak = (currentProfile.streak || 0) + 1;
      currentProfile.streak = newStreak;
      currentProfile.last_checkin = todayStr;

      await supabase.from('profiles').update({ streak: newStreak, last_checkin: todayStr }).eq('id', currentUser.id);
      await grantXp(50, 50);
      await fetchTopGlobalSquads();
      renderApp();
    });
  }

  // XP Shop Buy & Equip Perks
  document.querySelectorAll('.buy-perk-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const perkId = e.currentTarget.getAttribute('data-perk-id');
      const perk = PERK_CATALOG.find(p => p.id === perkId);
      if (!perk || (currentProfile.xp || 0) < perk.cost) return;

      const newXp = currentProfile.xp - perk.cost;
      const newUnlocked = [...(currentProfile.unlocked_perks || []), perk.id];
      const updates = { xp: newXp, unlocked_perks: newUnlocked };
      if (perk.type === 'color') updates.name_color = perk.value;
      if (perk.type === 'title') updates.active_title = perk.value;

      currentProfile = { ...currentProfile, ...updates };
      await supabase.from('profiles').update(updates).eq('id', currentUser.id);
      if (activeSquad) await fetchSquadMembers(activeSquad.id);
      renderApp();
    });
  });

  document.querySelectorAll('.equip-perk-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const perkId = e.currentTarget.getAttribute('data-perk-id');
      const perk = PERK_CATALOG.find(p => p.id === perkId);
      if (!perk) return;

      const updates = perk.type === 'color' ? { name_color: perk.value } : { active_title: perk.value };
      currentProfile = { ...currentProfile, ...updates };
      await supabase.from('profiles').update(updates).eq('id', currentUser.id);
      if (activeSquad) await fetchSquadMembers(activeSquad.id);
      renderApp();
    });
  });

  // Mini-Game 3: Vault Codebreaker
  const resetCodebreakerBtn = document.getElementById('reset-codebreaker-btn');
  if (resetCodebreakerBtn) {
    resetCodebreakerBtn.addEventListener('click', () => {
      codeSecret = generateSecretCode();
      codeGuesses = [];
      codeSolved = false;
      renderApp();
    });
  }

  const codebreakerForm = document.getElementById('codebreaker-form');
  if (codebreakerForm) {
    codebreakerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const guess = document.getElementById('codebreaker-input').value.trim();
      if (guess.length !== 4) return;

      let exact = 0;
      let partial = 0;
      for (let i = 0; i < 4; i++) {
        if (guess[i] === codeSecret[i]) exact++;
        else if (codeSecret.includes(guess[i])) partial++;
      }

      codeGuesses.unshift({ guess, exact, partial });
      if (exact === 4) {
        codeSolved = true;
        await grantXp(75, 75);
        await fetchSquadMembers(activeSquad.id);
        await fetchTopGlobalSquads();
      }
      renderApp();
    });
  }

  // Quick Hype Callouts
  document.querySelectorAll('.hype-ping-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      if (!activeSquad) return;
      const hypeText = e.currentTarget.getAttribute('data-hype');
      await supabase.from('posts').insert({
        squad_id: activeSquad.id,
        user_id: currentUser.id,
        content: `[HYPE] ${hypeText}`
      });
      await grantXp(5, 5);
      await fetchSquadPosts(activeSquad.id);
      renderApp();
    });
  });

  // Delete Current Squad (Creator or Admin)
  const deleteCurrentSquadBtn = document.getElementById('delete-current-squad-btn');
  if (deleteCurrentSquadBtn) {
    deleteCurrentSquadBtn.addEventListener('click', async () => {
      if (!activeSquad) return;
      if (confirm(`Are you sure you want to permanently delete "${activeSquad.name}"? All posts, polls, and goals inside it will be erased.`)) {
        const deletedId = activeSquad.id;
        await supabase.from('squads').delete().eq('id', deletedId);
        userSquads = userSquads.filter(s => s.id !== deletedId);
        activeSquad = userSquads[0] || null;
        activeVaultTab = 'feed';
        if (activeSquad) await loadActiveSquadData(activeSquad.id);
        await fetchTopGlobalSquads();
        renderApp();
      }
    });
  }

  // Leave Current Squad (Member)
  const leaveCurrentSquadBtn = document.getElementById('leave-current-squad-btn');
  if (leaveCurrentSquadBtn) {
    leaveCurrentSquadBtn.addEventListener('click', async () => {
      if (!activeSquad) return;
      if (confirm(`Leave "${activeSquad.name}"?`)) {
        const leftId = activeSquad.id;
        await supabase.from('squad_members').delete().eq('squad_id', leftId).eq('user_id', currentUser.id);
        userSquads = userSquads.filter(s => s.id !== leftId);
        activeSquad = userSquads[0] || null;
        activeVaultTab = 'feed';
        if (activeSquad) await loadActiveSquadData(activeSquad.id);
        renderApp();
      }
    });
  }

  // Status Update
  const saveStatusBtn = document.getElementById('save-status-btn');
  if (saveStatusBtn) {
    saveStatusBtn.addEventListener('click', async () => {
      const status = document.getElementById('user-status-input').value.trim() || 'Online';
      await supabase.from('profiles').update({ status }).eq('id', currentUser.id);
      currentProfile.status = status;
      if (activeSquad) await fetchSquadMembers(activeSquad.id);
      renderApp();
    });
  }

  // Exit Owner Inspection Mode
  const exitInspectBtn = document.getElementById('exit-inspect-btn');
  if (exitInspectBtn) {
    exitInspectBtn.addEventListener('click', async () => {
      activeSquad = userSquads[0] || null;
      if (activeSquad) await loadActiveSquadData(activeSquad.id);
      renderApp();
    });
  }

  // Vault Tab Switching
  document.querySelectorAll('.vault-tab-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      activeVaultTab = e.currentTarget.getAttribute('data-tab');
      if (activeVaultTab === 'games') await fetchTopGlobalSquads();
      renderApp();
    });
  });

  // Copy Invite Code
  const copyInviteBtn = document.getElementById('copy-invite-btn');
  if (copyInviteBtn) {
    copyInviteBtn.addEventListener('click', () => {
      const code = copyInviteBtn.getAttribute('data-code');
      navigator.clipboard.writeText(code);
      copyInviteBtn.innerHTML = 'Copied!';
      setTimeout(() => { copyInviteBtn.innerHTML = `Code: <strong>${code}</strong>`; }, 1500);
    });
  }

  // Attack Boss Raid
  const attackBossBtn = document.getElementById('attack-boss-btn');
  if (attackBossBtn) {
    attackBossBtn.addEventListener('click', async () => {
      if (!activeSquad) return;
      const currentHp = activeSquad.boss_hp ?? 500;
      if (currentHp <= 0) return;

      const newHp = Math.max(0, currentHp - 35);
      activeSquad.boss_hp = newHp;
      await supabase.from('squads').update({ boss_hp: newHp }).eq('id', activeSquad.id);
      await grantXp(20, 20);
      await fetchSquadMembers(activeSquad.id);
      renderApp();
    });
  }

  // Summon Stronger Boss
  const summonBossBtn = document.getElementById('summon-boss-btn');
  if (summonBossBtn) {
    summonBossBtn.addEventListener('click', async () => {
      const bosses = ['Cyber Leviathan', 'Abyssal Titan', 'Void Overlord', 'Mecha Dragon', 'Solar Colossus'];
      const nextBoss = bosses[Math.floor(Math.random() * bosses.length)];
      const nextMaxHp = (activeSquad.boss_max_hp || 500) + 250;

      activeSquad.boss_name = nextBoss;
      activeSquad.boss_hp = nextMaxHp;
      activeSquad.boss_max_hp = nextMaxHp;

      await supabase.from('squads').update({
        boss_name: nextBoss,
        boss_hp: nextMaxHp,
        boss_max_hp: nextMaxHp
      }).eq('id', activeSquad.id);

      await grantXp(25, 100);
      renderApp();
    });
  }

  // Reflex Mini-Game
  const reflexGameBtn = document.getElementById('reflex-game-btn');
  if (reflexGameBtn) {
    reflexGameBtn.addEventListener('click', async () => {
      if (reactionState === 'idle' || reactionState === 'done') {
        reactionState = 'waiting';
        renderApp();
        const delay = 1500 + Math.random() * 2500;
        reactionTimeout = setTimeout(() => {
          reactionState = 'ready';
          reactionStartTime = performance.now();
          renderApp();
        }, delay);
      } else if (reactionState === 'waiting') {
        clearTimeout(reactionTimeout);
        reactionState = 'idle';
        alert('Too early! Wait for the button to turn green.');
        renderApp();
      } else if (reactionState === 'ready') {
        const elapsed = Math.round(performance.now() - reactionStartTime);
        lastReactionMs = elapsed;
        reactionState = 'done';

        const prevRecord = activeSquad.best_reaction_ms;
        if (!prevRecord || elapsed < prevRecord) {
          activeSquad.best_reaction_ms = elapsed;
          activeSquad.best_reaction_user = currentProfile.username;
          await supabase.from('squads').update({
            best_reaction_ms: elapsed,
            best_reaction_user: currentProfile.username
          }).eq('id', activeSquad.id);
          await grantXp(30, 30);
        } else {
          await grantXp(5, 5);
        }
        await fetchSquadMembers(activeSquad.id);
        renderApp();
      }
    });
  }

  // 15s Speed Math Blitz
  const startBlitzBtn = document.getElementById('start-blitz-btn');
  if (startBlitzBtn) {
    startBlitzBtn.addEventListener('click', () => {
      blitzActive = true;
      blitzScore = 0;
      blitzTimeLeft = 15;
      blitzQuestion = generateBlitzQuestion();
      renderApp();

      clearInterval(blitzTimer);
      blitzTimer = setInterval(async () => {
        blitzTimeLeft -= 1;
        if (blitzTimeLeft <= 0) {
          clearInterval(blitzTimer);
          blitzActive = false;
          if (blitzScore > 0) {
            await grantXp(blitzScore * 10, blitzScore * 10);
            await fetchSquadMembers(activeSquad.id);
            await fetchTopGlobalSquads();
          }
        }
        renderApp();
        const inp = document.getElementById('blitz-input');
        if (inp) inp.focus();
      }, 1000);
    });
  }

  const blitzAnswerForm = document.getElementById('blitz-answer-form');
  if (blitzAnswerForm) {
    blitzAnswerForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const val = parseInt(document.getElementById('blitz-input').value, 10);
      if (val === blitzQuestion?.ans) {
        blitzScore += 1;
        blitzQuestion = generateBlitzQuestion();
      }
      renderApp();
      const inp = document.getElementById('blitz-input');
      if (inp) inp.focus();
    });
  }

  // Save Custom Member Rank
  document.querySelectorAll('.save-rank-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const targetUserId = e.currentTarget.getAttribute('data-user-id');
      const input = document.querySelector(`.rank-input[data-user-id="${targetUserId}"]`);
      const newRank = input?.value.trim() || 'Member';
      await supabase.from('squad_members').update({ custom_rank: newRank }).eq('squad_id', activeSquad.id).eq('user_id', targetUserId);
      await fetchSquadMembers(activeSquad.id);
      renderApp();
    });
  });

  // Post Reactions
  document.querySelectorAll('.react-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const postId = e.currentTarget.getAttribute('data-post-id');
      const emoji = e.currentTarget.getAttribute('data-emoji');
      const post = squadPosts.find(p => p.id === postId);
      if (!post) return;

      const reactions = { ...(post.reactions || {}) };
      const list = reactions[emoji] || [];
      if (list.includes(currentUser.id)) {
        reactions[emoji] = list.filter(id => id !== currentUser.id);
      } else {
        reactions[emoji] = [...list, currentUser.id];
      }

      await supabase.from('posts').update({ reactions }).eq('id', postId);
      await fetchSquadPosts(activeSquad.id);
      renderApp();
    });
  });

  // Pin / Unpin Posts
  document.querySelectorAll('.pin-post-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const postId = e.currentTarget.getAttribute('data-post-id');
      const currentlyPinned = e.currentTarget.getAttribute('data-pinned') === 'true';
      await supabase.from('posts').update({ is_pinned: !currentlyPinned }).eq('id', postId);
      await fetchSquadPosts(activeSquad.id);
      renderApp();
    });
  });

  // Create Poll
  const createPollForm = document.getElementById('create-poll-form');
  if (createPollForm) {
    createPollForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const question = document.getElementById('poll-question').value.trim();
      const opt1 = document.getElementById('poll-opt-1').value.trim();
      const opt2 = document.getElementById('poll-opt-2').value.trim();
      const opt3 = document.getElementById('poll-opt-3').value.trim();

      const options = [
        { text: opt1, votes: [] },
        { text: opt2, votes: [] }
      ];
      if (opt3) options.push({ text: opt3, votes: [] });

      await supabase.from('squad_polls').insert({
        squad_id: activeSquad.id,
        created_by: currentUser.id,
        question,
        options
      });
      await grantXp(20, 20);
      await fetchSquadPolls(activeSquad.id);
      renderApp();
    });
  }

  // Vote on Poll
  document.querySelectorAll('.vote-poll-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const pollId = e.currentTarget.getAttribute('data-poll-id');
      const optIdx = parseInt(e.currentTarget.getAttribute('data-opt-idx'), 10);
      const poll = squadPolls.find(p => p.id === pollId);
      if (!poll) return;

      const updatedOptions = poll.options.map((opt, idx) => {
        const filteredVotes = (opt.votes || []).filter(id => id !== currentUser.id);
        if (idx === optIdx) {
          return { ...opt, votes: [...filteredVotes, currentUser.id] };
        }
        return { ...opt, votes: filteredVotes };
      });

      await supabase.from('squad_polls').update({ options: updatedOptions }).eq('id', pollId);
      await fetchSquadPolls(activeSquad.id);
      renderApp();
    });
  });

  // Create Goal
  const createGoalForm = document.getElementById('create-goal-form');
  if (createGoalForm) {
    createGoalForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const title = document.getElementById('goal-title').value.trim();
      if (!title) return;
      await supabase.from('squad_goals').insert({
        squad_id: activeSquad.id,
        title,
        created_by: currentUser.id
      });
      await fetchSquadGoals(activeSquad.id);
      renderApp();
    });
  }

  // Toggle Goal Completion
  document.querySelectorAll('.toggle-goal-cb').forEach(cb => {
    cb.addEventListener('change', async (e) => {
      const goalId = e.target.getAttribute('data-goal-id');
      await supabase.from('squad_goals').update({ is_completed: e.target.checked }).eq('id', goalId);
      if (e.target.checked) await grantXp(15, 15);
      await fetchSquadGoals(activeSquad.id);
      renderApp();
    });
  });

  // Delete Goal
  document.querySelectorAll('.delete-goal-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const goalId = e.target.getAttribute('data-goal-id');
      await supabase.from('squad_goals').delete().eq('id', goalId);
      await fetchSquadGoals(activeSquad.id);
      renderApp();
    });
  });

  // Theme Swatches & Squad Customization
  document.querySelectorAll('.theme-swatch-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const color = e.currentTarget.getAttribute('data-color');
      document.getElementById('selected-theme-color').value = color;
      document.querySelectorAll('.theme-swatch-btn').forEach(b => b.style.borderColor = 'transparent');
      e.currentTarget.style.borderColor = color;
    });
  });

  const customizeSquadForm = document.getElementById('customize-squad-form');
  if (customizeSquadForm) {
    customizeSquadForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('edit-squad-name').value.trim();
      const description = document.getElementById('edit-squad-desc').value.trim();
      const theme_color = document.getElementById('selected-theme-color').value;

      await supabase.from('squads').update({ name, description, theme_color }).eq('id', activeSquad.id);
      activeSquad = { ...activeSquad, name, description, theme_color };
      userSquads = userSquads.map(s => s.id === activeSquad.id ? activeSquad : s);
      activeVaultTab = 'feed';
      renderApp();
    });
  }

  // Staff Control Center Modal Listeners
  const openModModalBtn = document.getElementById("open-mod-modal-btn");
  const closeModModalBtn = document.getElementById("close-mod-modal-btn");
  const modalBackdrop = document.getElementById("modal-backdrop");

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

  ['squads', 'users', 'feed', 'broadcast', 'logs'].forEach(tab => {
    const el = document.getElementById(`modal-tab-${tab}`);
    if (el) {
      el.addEventListener('click', async () => {
        activeAdminTab = tab;
        if (tab === 'logs') await fetchAuditLogs();
        if (tab === 'feed') await fetchGlobalRecentPosts();
        renderApp();
      });
    }
  });

  const squadSearchInput = document.getElementById("mod-squad-search");
  if (squadSearchInput) {
    squadSearchInput.addEventListener("input", (e) => {
      squadSearchQuery = e.target.value;
      renderApp();
      const newInput = document.getElementById("mod-squad-search");
      if (newInput) {
        newInput.focus();
        newInput.setSelectionRange(newInput.value.length, newInput.value.length);
      }
    });
  }

  const userSearchInput = document.getElementById("mod-user-search");
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

  document.querySelectorAll('.inspect-squad-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const targetSquadId = e.currentTarget.getAttribute('data-squad-id');
      const targetSquad = allSquadsList.find(s => s.id === targetSquadId);
      if (targetSquad) {
        activeSquad = targetSquad;
        activeVaultTab = 'feed';
        isModModalOpen = false;
        await loadActiveSquadData(targetSquad.id);
        renderApp();
      }
    });
  });

  document.querySelectorAll('.delete-squad-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const targetSquadId = e.currentTarget.getAttribute('data-squad-id');
      const targetSquadName = e.currentTarget.getAttribute('data-squad-name');
      if (confirm(`Permanently disband squad "${targetSquadName}" and delete all its posts?`)) {
        await supabase.from('squads').delete().eq('id', targetSquadId);
        await logStaffAction('DISBAND_SQUAD', `Disbanded squad "${targetSquadName}"`);
        userSquads = userSquads.filter(s => s.id !== targetSquadId);
        if (activeSquad?.id === targetSquadId) activeSquad = userSquads[0] || null;
        await fetchStaffData();
        renderApp();
      }
    });
  });

  document.querySelectorAll('.global-delete-post-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const postId = e.currentTarget.getAttribute('data-post-id');
      const author = e.currentTarget.getAttribute('data-author');
      await supabase.from('posts').delete().eq('id', postId);
      await logStaffAction('DELETE_POST', `Deleted global feed post by @${author}`);
      await fetchGlobalRecentPosts();
      renderApp();
    });
  });

  const broadcastForm = document.getElementById('broadcast-form');
  if (broadcastForm) {
    broadcastForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const message = document.getElementById('broadcast-msg-input').value.trim();
      if (!message) return;

      await supabase.from('announcements').update({ is_active: false }).eq('is_active', true);
      await supabase.from('announcements').insert({ message, created_by: currentUser.id, is_active: true });
      await logStaffAction('BROADCAST', `Published banner: "${message}"`);
      await fetchActiveAnnouncement();
      isModModalOpen = false;
      renderApp();
    });
  }

  const clearBroadcastBtn = document.getElementById('clear-broadcast-btn');
  if (clearBroadcastBtn) {
    clearBroadcastBtn.addEventListener('click', async () => {
      await supabase.from('announcements').update({ is_active: false }).eq('is_active', true);
      activeAnnouncement = null;
      await logStaffAction('CLEAR_BROADCAST', 'Cleared active system banner');
      renderApp();
    });
  }

  // User Data Modal Listeners
  const openUserDataBtn = document.getElementById("open-user-data-btn");
  const closeUserDataBtn = document.getElementById("close-user-data-btn");
  const userDataBackdrop = document.getElementById("user-data-backdrop");
  const updateUsernameForm = document.getElementById("update-username-form");
  const deleteMyPostsBtn = document.getElementById("delete-my-posts-btn");
  const deleteMyAccountBtn = document.getElementById("delete-my-account-btn");

  if (openUserDataBtn) {
    openUserDataBtn.addEventListener("click", (e) => {
      e.preventDefault();
      isPrivacyModalOpen = true;
      renderApp();
    });
  }

  if (closeUserDataBtn) {
    closeUserDataBtn.addEventListener("click", () => {
      isPrivacyModalOpen = false;
      renderApp();
    });
  }

  if (userDataBackdrop) {
    userDataBackdrop.addEventListener("click", (e) => {
      if (e.target.id === 'user-data-backdrop') {
        isPrivacyModalOpen = false;
        renderApp();
      }
    });
  }

  if (updateUsernameForm) {
    updateUsernameForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const newName = document.getElementById("new-username-input").value.trim();
      if (!newName) return;
      await supabase.from('profiles').update({ username: newName }).eq('id', currentUser.id);
      isPrivacyModalOpen = false;
      await loadUserData();
    });
  }

  if (deleteMyPostsBtn) {
    deleteMyPostsBtn.addEventListener("click", async () => {
      if (confirm("Delete all posts you have ever made across all squads?")) {
        await supabase.from('posts').delete().eq('user_id', currentUser.id);
        isPrivacyModalOpen = false;
        if (activeSquad) await fetchSquadPosts(activeSquad.id);
        renderApp();
      }
    });
  }

  if (deleteMyAccountBtn) {
    deleteMyAccountBtn.addEventListener("click", async () => {
      if (confirm("Are you sure? This will wipe your profile, squad memberships, and posts.")) {
        await supabase.from('posts').delete().eq('user_id', currentUser.id);
        await supabase.from('squad_members').delete().eq('user_id', currentUser.id);
        await supabase.from('profiles').delete().eq('id', currentUser.id);
        await supabase.auth.signOut();
        currentUser = null;
        currentProfile = null;
        isPrivacyModalOpen = false;
        renderApp();
      }
    });
  }

  // Standard Auth & Squad Listeners
  const toggleBtn = document.getElementById("toggle-auth-btn");
  const authForm = document.getElementById("auth-form");
  const githubBtn = document.getElementById("github-login-btn");
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
      const { error } = await supabase.from('profiles').upsert({ id: currentUser.id, username, role: 'user', xp: 0, status: 'Online' });
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
        await supabase.from('squad_members').insert({ squad_id: squad.id, user_id: currentUser.id, custom_rank: 'Captain' });
        activeSquad = squad;
        await loadUserData();
      }
    });
  }

  if (joinSquadForm) {
    joinSquadForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const code = document.getElementById("invite-code").value.trim().toUpperCase();
      const { data: squad } = await supabase.from('squads').select('*').eq('invite_code', code).single();

      if (squad) {
        await supabase.from('squad_members').insert({ squad_id: squad.id, user_id: currentUser.id, custom_rank: 'Member' });
        activeSquad = squad;
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
      if (!error) {
        document.getElementById("post-content").value = "";
        await grantXp(15, 15);
        await fetchSquadPosts(activeSquad.id);
        await fetchSquadMembers(activeSquad.id);
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
      activeVaultTab = 'feed';
      await loadActiveSquadData(squadId);
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
      squadPolls = [];
      squadGoals = [];
      isModModalOpen = false;
      isPrivacyModalOpen = false;
      isLeaderboardModalOpen = false;
      inspectedSquadProfile = null;
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

async function fetchActiveAnnouncement() {
  const { data } = await supabase
    .from('announcements')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1);
  activeAnnouncement = (data && data.length > 0) ? data[0] : null;
}

async function fetchTopGlobalSquads() {
  const { data } = await supabase
    .from('squads')
    .select('id, name, xp, theme_color, profiles:created_by(username)')
    .order('xp', { ascending: false })
    .limit(20);
  topGlobalSquads = data || [];
}

async function fetchAuditLogs() {
  const { data } = await supabase
    .from('audit_logs')
    .select('*, profiles:performed_by_id(username)')
    .order('created_at', { ascending: false })
    .limit(50);
  auditLogsList = data || [];
}

async function fetchGlobalRecentPosts() {
  const { data } = await supabase
    .from('posts')
    .select('*, profiles(username), squads(name)')
    .order('created_at', { ascending: false })
    .limit(40);
  globalRecentPosts = data || [];
}

async function fetchStaffData() {
  if (currentProfile?.role === 'admin' || currentProfile?.role === 'mod') {
    const { data: profiles } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
    allProfilesList = profiles || [];

    const { data: squads } = await supabase.from('squads').select('*, profiles:created_by(username)').order('created_at', { ascending: false });
    allSquadsList = squads || [];
    
    const { count: userCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
    const { count: squadCount } = await supabase.from('squads').select('*', { count: 'exact', head: true });
    const { count: postCount } = await supabase.from('posts').select('*', { count: 'exact', head: true });

    systemStats = { users: userCount || 0, squads: squadCount || 0, posts: postCount || 0 };

    await fetchGlobalRecentPosts();
    if (currentProfile?.role === 'admin') {
      await fetchAuditLogs();
    }
  }
}

async function fetchSquadMembers(squadId) {
  const { data } = await supabase
    .from('squad_members')
    .select('user_id, custom_rank, profiles(username, xp, status, name_color, active_title)')
    .eq('squad_id', squadId);
  squadMembers = data || [];
}

async function fetchSquadPosts(squadId) {
  if (!squadId) return;
  const { data, error } = await supabase
    .from('posts')
    .select('*, profiles(username, name_color, active_title)')
    .eq('squad_id', squadId)
    .order('created_at', { ascending: false });

  if (error) {
    const { data: rawPosts } = await supabase
      .from('posts')
      .select('*')
      .eq('squad_id', squadId)
      .order('created_at', { ascending: false });
    squadPosts = rawPosts || [];
  } else {
    squadPosts = data || [];
  }
}

async function fetchSquadPolls(squadId) {
  const { data } = await supabase
    .from('squad_polls')
    .select('*')
    .eq('squad_id', squadId)
    .order('created_at', { ascending: false });
  squadPolls = data || [];
}

async function fetchSquadGoals(squadId) {
  const { data } = await supabase
    .from('squad_goals')
    .select('*')
    .eq('squad_id', squadId)
    .order('created_at', { ascending: true });
  squadGoals = data || [];
}

async function loadActiveSquadData(squadId) {
  await Promise.all([
    fetchSquadPosts(squadId),
    fetchSquadMembers(squadId),
    fetchSquadPolls(squadId),
    fetchSquadGoals(squadId),
    fetchTopGlobalSquads()
  ]);
}

async function loadUserData() {
  if (!currentUser) return;

  await fetchActiveAnnouncement();

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
      }
      if (activeSquad) {
        await loadActiveSquadData(activeSquad.id);
      }
    }
  }

  renderApp();
}

async function initAuthListener() {
  await fetchActiveAnnouncement();
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
