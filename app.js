const storeKey = "redx-state-v3";
const oldStoreKeys = ["redx-state-v1", "redx-state-v2"];
const defaults = {
  account: {
    username: "redx.creator",
    name: "REDX Studio",
    bio: "Fast moments. Real signals. Built on REDX.",
    avatar: "",
    followers: [],
    following: []
  },
  settings: {
    privateAccount: false,
    activityStatus: true,
    notifications: true,
    hideLikes: false,
    darkMode: false,
    blocked: "",
    muted: ""
  },
  userPosts: [],
  interactions: {}
};

const savedState = JSON.parse(localStorage.getItem(storeKey) || "{}");
let users = Array.isArray(savedState.users) ? savedState.users : [];
let activeUsername = savedState.activeUsername || "";

if (!users.length && savedState.account) {
  users.push({
    ...defaults.account,
    ...savedState.account,
    email: "demo@redx.local",
    password: "demo",
    settings: { ...defaults.settings, ...(savedState.settings || {}) }
  });
}

if (activeUsername && !users.some((user) => user.username === activeUsername)) {
  activeUsername = "";
}

let account = activeUsername
  ? { ...defaults.account, ...(users.find((user) => user.username === activeUsername) || {}) }
  : { ...defaults.account };
let settings = activeUsername
  ? { ...defaults.settings, ...((users.find((user) => user.username === activeUsername) || {}).settings || {}) }
  : { ...defaults.settings, ...(savedState.settings || {}) };
let userPosts = Array.isArray(savedState.userPosts) ? savedState.userPosts.filter(isRealUploadPost) : [];
let interactions = savedState.interactions || {};
let messages = savedState.messages || {};
let stories = Array.isArray(savedState.stories) ? savedState.stories.filter(isRealMediaItem) : [];
let liveSessions = Array.isArray(savedState.liveSessions) ? savedState.liveSessions : [];
let notifications = savedState.notifications || {};
let selectedUploadData = "";
let selectedUploadType = "image";
let selectedStoryData = "";
let selectedStoryType = "image";
let pendingAvatar = "";
let profileTab = "posts";
let activeTag = "";
let toastTimer = 0;
let pendingOtp = null;
let authConfig = { requireSmsOtp: false, googleClientId: "", googleConfigured: false };
let googleInitialized = false;
let selectedThreadId = "";
let currentStoryId = "";
let liveStream = null;
let currentLiveId = "";
let liveHeartbeatTimer = 0;
let liveSocket = null;
let liveSocketReady = false;
let liveSocketOpening = null;
let hostPeerConnections = new Map();
let viewerPeerConnection = null;
let watchingLiveId = "";
let rtcConfig = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

pruneLocalUserData();

const feedEl = document.querySelector("#feed");
const storiesEl = document.querySelector("#stories");
const exploreGrid = document.querySelector("#exploreGrid");
const userResults = document.querySelector("#userResults");
const profileGrid = document.querySelector("#profileGrid");
const reelsStack = document.querySelector("#reelsStack");
const tagRow = document.querySelector("#tagRow");
const searchInput = document.querySelector("#searchInput");
const createDialog = document.querySelector("#createDialog");
const createMenu = document.querySelector("#createMenu");
const liveDialog = document.querySelector("#liveDialog");
const livePreview = document.querySelector("#livePreview");
const livePlaceholder = document.querySelector("#livePlaceholder");
const liveTitleInput = document.querySelector("#liveTitleInput");
const liveStatus = document.querySelector("#liveStatus");
const liveChip = document.querySelector("#liveChip");
const startLiveButton = document.querySelector("#startLiveButton");
const endLiveButton = document.querySelector("#endLiveButton");
const liveWatchDialog = document.querySelector("#liveWatchDialog");
const liveWatchTitle = document.querySelector("#liveWatchTitle");
const liveWatchVideo = document.querySelector("#liveWatchVideo");
const liveWatchPlaceholder = document.querySelector("#liveWatchPlaceholder");
const liveWatchStatus = document.querySelector("#liveWatchStatus");
const storyDialog = document.querySelector("#storyDialog");
const storyViewer = document.querySelector("#storyViewer");
const accountDialog = document.querySelector("#accountDialog");
const settingsDialog = document.querySelector("#settingsDialog");
const createForm = document.querySelector("#createForm");
const accountForm = document.querySelector("#accountForm");
const settingsForm = document.querySelector("#settingsForm");
const captionInput = document.querySelector("#captionInput");
const selectedPreview = document.querySelector("#selectedPreview");
const assetPicker = document.querySelector("#assetPicker");
const photoInput = document.querySelector("#photoInput");
const photoStatus = document.querySelector("#photoStatus");
const storyInput = document.querySelector("#storyInput");
const storyStatus = document.querySelector("#storyStatus");
const storyPreview = document.querySelector("#storyPreview");
const storyCaptionInput = document.querySelector("#storyCaptionInput");
const storyForm = document.querySelector("#storyForm");
const storyViewerAuthor = document.querySelector("#storyViewerAuthor");
const storyViewerMedia = document.querySelector("#storyViewerMedia");
const storyViewerCaption = document.querySelector("#storyViewerCaption");
const avatarInput = document.querySelector("#avatarInput");
const avatarStatus = document.querySelector("#avatarStatus");
const avatarPreview = document.querySelector("#avatarPreview");
const usernameInput = document.querySelector("#usernameInput");
const nameInput = document.querySelector("#nameInput");
const bioInput = document.querySelector("#bioInput");
const privateInput = document.querySelector("#privateInput");
const activityInput = document.querySelector("#activityInput");
const notificationsInput = document.querySelector("#notificationsInput");
const hideLikesInput = document.querySelector("#hideLikesInput");
const darkModeInput = document.querySelector("#darkModeInput");
const blockedInput = document.querySelector("#blockedInput");
const mutedInput = document.querySelector("#mutedInput");
const postCount = document.querySelector("#postCount");
const followerCount = document.querySelector("#followerCount");
const followingCount = document.querySelector("#followingCount");
const toastEl = document.querySelector("#toast");
const suggestionsEl = document.querySelector("#suggestions");
const followersList = document.querySelector("#followersList");
const profileConnections = document.querySelector("#profileConnections");
const authScreen = document.querySelector("#authScreen");
const loginForm = document.querySelector("#loginForm");
const signupForm = document.querySelector("#signupForm");
const resetForm = document.querySelector("#resetForm");
const otpForm = document.querySelector("#otpForm");
const loginId = document.querySelector("#loginId");
const loginPassword = document.querySelector("#loginPassword");
const signupEmail = document.querySelector("#signupEmail");
const signupName = document.querySelector("#signupName");
const signupUsername = document.querySelector("#signupUsername");
const signupUsernameStatus = document.querySelector("#signupUsernameStatus");
const signupPassword = document.querySelector("#signupPassword");
const resetContact = document.querySelector("#resetContact");
const resetPassword = document.querySelector("#resetPassword");
const resetPasswordConfirm = document.querySelector("#resetPasswordConfirm");
const otpInput = document.querySelector("#otpInput");
const otpDemo = document.querySelector("#otpDemo");
const otpHelp = document.querySelector("#otpHelp");
const cancelOtp = document.querySelector("#cancelOtp");
const resendOtp = document.querySelector("#resendOtp");
const authModeButton = document.querySelector("#authModeButton");
const authSwitchText = document.querySelector("#authSwitchText");
const logoutButton = document.querySelector("#logoutButton");
const authTitle = document.querySelector("#authTitle");
const authBack = document.querySelector("#authBack");
const forgotPassword = document.querySelector("#forgotPassword");
const googleAuthWrap = document.querySelector("#googleAuthWrap");
const googleSignInButton = document.querySelector("#googleSignInButton");
const googleAuthHint = document.querySelector("#googleAuthHint");
const messageList = document.querySelector("#messageList");
const messageOwner = document.querySelector("#messageOwner");
const messageSearchInput = document.querySelector("#messageSearchInput");
const chatHead = document.querySelector("#chatHead");
const chatLog = document.querySelector("#chatLog");
const messageForm = document.querySelector("#messageForm");
const messageInput = document.querySelector("#messageInput");
const notificationList = document.querySelector("#notificationList");
const profileDialog = document.querySelector("#profileDialog");
const profileDialogName = document.querySelector("#profileDialogName");
const profileDialogAvatar = document.querySelector("#profileDialogAvatar");
const profileDialogPosts = document.querySelector("#profileDialogPosts");
const profileDialogFollowers = document.querySelector("#profileDialogFollowers");
const profileDialogFollowing = document.querySelector("#profileDialogFollowing");
const profileDialogBio = document.querySelector("#profileDialogBio");
const profileDialogFollow = document.querySelector("#profileDialogFollow");
const profileDialogMessage = document.querySelector("#profileDialogMessage");
const profileDialogGrid = document.querySelector("#profileDialogGrid");
const pulseCount = document.querySelector("#pulseCount");
const pulseLabel = document.querySelector("#pulseLabel");
const pulseMeter = document.querySelector("#pulseMeter");
const pulseTags = document.querySelector("#pulseTags");

let authMode = "login";
let databaseLoaded = false;
let databaseSaveTimer = 0;

oldStoreKeys.forEach((key) => localStorage.removeItem(key));

const apiBase = window.location.protocol === "file:" ? "http://localhost:3000" : "";

function escapeHTML(value) {
  return String(value || "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[char]));
}

function cleanUsername(value) {
  const cleaned = String(value || "")
    .replace(/^@+/, "")
    .toLowerCase()
    .replace(/[^a-z0-9._]/g, "")
    .slice(0, 24);
  return cleaned || "redx.creator";
}

function cleanContact(value) {
  return String(value || "").trim().toLowerCase();
}

function isEmailContact(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanContact(value));
}

function toSmsPhone(value) {
  const raw = String(value || "").trim();
  const digits = raw.replace(/\D/g, "");
  if (raw.startsWith("+") && /^[1-9]\d{7,14}$/.test(digits)) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return "";
}

function uniqueUsername(seed, existingUsername = "") {
  const taken = new Set(users
    .map((user) => user.username)
    .filter((username) => username && username !== existingUsername));
  const base = cleanUsername(seed).replace(/^\.+|\.+$/g, "") || "redx.user";
  let username = base;
  let counter = 2;

  while (taken.has(username)) {
    const suffix = `.${counter}`;
    username = `${base.slice(0, Math.max(1, 24 - suffix.length))}${suffix}`;
    counter += 1;
  }

  return username;
}

function maskContact(value) {
  const phone = toSmsPhone(value);
  if (phone) {
    return `your number ending ${phone.slice(-4)}`;
  }

  return "your contact";
}

async function apiPost(path, payload) {
  const response = await fetch(`${apiBase}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) {
    throw new Error(data.message || "REDX server is not available.");
  }
  return data;
}

async function apiGet(path) {
  const response = await fetch(`${apiBase}${path}`);
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) {
    throw new Error(data.message || "REDX server is not available.");
  }
  return data;
}

function listValue(value) {
  return Array.isArray(value) ? value : [];
}

function isRealMediaItem(item) {
  const src = String(item?.image || item?.src || "");
  return Boolean(src) && !src.startsWith("assets/");
}

function isRealUploadPost(post) {
  return Boolean(post?.author) && post.source !== "demo" && isRealMediaItem(post);
}

function pruneLocalUserData() {
  const localNames = new Set(users.map((user) => user.username).filter(Boolean));

  users.forEach((user) => {
    user.followers = listValue(user.followers).filter((username) => localNames.has(username));
    user.following = listValue(user.following).filter((username) => localNames.has(username));
  });

  account.followers = listValue(account.followers).filter((username) => localNames.has(username));
  account.following = listValue(account.following).filter((username) => localNames.has(username));

  Object.keys(messages).forEach((owner) => {
    if (!localNames.has(owner)) {
      delete messages[owner];
      return;
    }
    Object.keys(messages[owner] || {}).forEach((username) => {
      if (!localNames.has(username) || username === owner) {
        delete messages[owner][username];
      }
    });
  });

  Object.keys(notifications).forEach((owner) => {
    if (!localNames.has(owner)) {
      delete notifications[owner];
      return;
    }
    notifications[owner] = listValue(notifications[owner]).filter((note) => localNames.has(note.actor));
  });
}

function publicAccount(user) {
  return {
    username: user.username,
    name: user.name,
    bio: user.bio,
    avatar: user.avatar || "",
    followers: listValue(user.followers),
    following: listValue(user.following)
  };
}

function activeUser() {
  return users.find((user) => user.username === activeUsername);
}

function syncActiveUser() {
  const user = activeUser();
  if (!user) return;
  user.username = account.username;
  user.name = account.name;
  user.bio = account.bio;
  user.avatar = account.avatar;
  user.followers = listValue(account.followers);
  user.following = listValue(account.following);
  user.settings = { ...settings };
  activeUsername = account.username;
}

function setActiveUser(user) {
  activeUsername = user.username;
  account = publicAccount(user);
  settings = { ...defaults.settings, ...(user.settings || {}) };
}

function findUser(loginValue) {
  const login = cleanContact(loginValue);
  const phone = toSmsPhone(loginValue);
  return users.find((user) =>
    user.username.toLowerCase() === cleanUsername(login) ||
    cleanContact(user.email) === login ||
    (phone && toSmsPhone(user.phone || user.email) === phone)
  );
}

function updateSignupUsernameStatus() {
  const raw = signupUsername.value.trim();
  const username = cleanUsername(raw);
  if (!raw) {
    signupUsernameStatus.textContent = "Username must be unique.";
    signupUsernameStatus.className = "username-status";
    return;
  }

  const taken = users.some((user) => user.username === username);
  signupUsernameStatus.textContent = taken ? "Username already taken." : `@${username} is available.`;
  signupUsernameStatus.className = `username-status ${taken ? "taken" : "available"}`;
}

function setAuthMode(mode) {
  authMode = mode;
  const signingUp = authMode === "signup";
  const resetting = authMode === "reset";
  const checkingOtp = authMode === "otp";
  const signupOtp = checkingOtp && pendingOtp?.type === "signup";
  const resetOtp = checkingOtp && pendingOtp?.type === "reset";
  loginForm.classList.toggle("hidden", signingUp || resetting || checkingOtp);
  signupForm.classList.toggle("hidden", !signingUp);
  resetForm.classList.toggle("hidden", !resetting);
  otpForm.classList.toggle("hidden", !checkingOtp);
  authModeButton.classList.toggle("hidden", checkingOtp);
  authSwitchText.hidden = checkingOtp;
  authSwitchText.textContent = signingUp || resetting ? "Have an account?" : "Don't have an account?";
  authModeButton.textContent = signingUp || resetting ? "Log in" : "Create new account";
  cancelOtp.textContent = signupOtp ? "Edit sign up info" : resetOtp ? "Edit reset info" : "Use different login";
  authTitle.textContent = checkingOtp
    ? signupOtp ? "Verify your account" : resetOtp ? "Reset your password" : "Enter security code"
    : signingUp ? "Create new account" : resetting ? "Reset password" : "Log into REDX";
  renderGoogleAuth();
}

function otpReturnMode() {
  if (pendingOtp?.type === "signup") return "signup";
  if (pendingOtp?.type === "reset") return "reset";
  return "login";
}

function renderAuthState() {
  const loggedOut = !activeUsername;
  document.body.classList.toggle("logged-out", loggedOut);
  if (loggedOut) {
    document.body.classList.remove("dark-mode");
    setAuthMode(authMode);
  }
}

function completeAuth(user, message) {
  setActiveUser(user);
  pendingOtp = null;
  persist();
  renderAuthState();
  renderAll();
  setView("feed");
  showToast(message);
}

async function startOtpVerification(payload) {
  const phone = toSmsPhone(payload.phone || payload.contact);
  if (!phone) {
    showToast("Enter a valid mobile number, like +1 317 555 0100.");
    return false;
  }

  pendingOtp = {
    phone,
    expiresAt: Date.now() + 10 * 60 * 1000,
    ...payload
  };
  const target = maskContact(phone);
  otpHelp.textContent = pendingOtp.type === "signup"
    ? `Enter the 6-digit code sent to ${target} to finish creating your account.`
    : pendingOtp.type === "reset"
      ? `Enter the 6-digit code sent to ${target} to reset your password.`
      : `Enter the 6-digit security code for ${target}.`;
  otpDemo.textContent = "Sending SMS...";
  otpInput.value = "";
  setAuthMode("otp");

  try {
    const result = await apiPost("/api/otp/start", {
      phone,
      purpose: pendingOtp.type
    });
    otpHelp.textContent = pendingOtp.type === "signup"
      ? `Enter the 6-digit code sent to ${target} to finish creating your account.`
      : pendingOtp.type === "reset"
        ? `Enter the 6-digit code sent to ${target} to reset your password.`
        : `Enter the 6-digit security code sent to ${target}.`;
    otpDemo.textContent = result.devCode ? `Local dev code: ${result.devCode}` : `SMS sent to ${result.masked || target}.`;
    otpInput.focus();
    showToast("Security code sent.");
    return true;
  } catch (error) {
    const returnMode = otpReturnMode();
    pendingOtp = null;
    showToast(error.message);
    setAuthMode(returnMode);
    return false;
  }
}

function startOtpLogin(user) {
  return startOtpVerification({
    type: "login",
    username: user.username,
    phone: user.phone || user.email
  });
}

function startOtpSignup(userDraft) {
  return startOtpVerification({
    type: "signup",
    username: userDraft.username,
    contact: userDraft.phone || userDraft.email,
    userDraft
  });
}

function startOtpReset(user, newPassword) {
  return startOtpVerification({
    type: "reset",
    username: user.username,
    phone: user.phone || user.email,
    newPassword
  });
}

async function verifyOtpWithBackend() {
  if (!pendingOtp?.phone) {
    throw new Error("Request a new SMS code first.");
  }

  const result = await apiPost("/api/otp/check", {
    phone: pendingOtp.phone,
    code: otpInput.value.trim()
  });
  return result.verified === true;
}

function icon(name) {
  return `<svg aria-hidden="true"><use href="#icon-${name}"></use></svg>`;
}

function formatLikes(value) {
  return new Intl.NumberFormat("en", { notation: "compact" }).format(value);
}

function sharedStateSnapshot() {
  return {
    users,
    userPosts,
    interactions,
    messages,
    stories,
    liveSessions,
    notifications
  };
}

function browserStateSnapshot() {
  return {
    account,
    settings,
    activeUsername,
    ...sharedStateSnapshot()
  };
}

function applySharedState(state = {}) {
  users = Array.isArray(state.users) ? state.users : [];
  userPosts = Array.isArray(state.userPosts) ? state.userPosts.filter(isRealUploadPost) : [];
  interactions = state.interactions && typeof state.interactions === "object" ? state.interactions : {};
  messages = state.messages && typeof state.messages === "object" ? state.messages : {};
  stories = Array.isArray(state.stories) ? state.stories.filter(isRealMediaItem) : [];
  liveSessions = Array.isArray(state.liveSessions) ? state.liveSessions : [];
  notifications = state.notifications && typeof state.notifications === "object" ? state.notifications : {};

  if (activeUsername && users.some((user) => user.username === activeUsername)) {
    setActiveUser(users.find((user) => user.username === activeUsername));
  } else {
    activeUsername = "";
    account = { ...defaults.account };
    settings = { ...defaults.settings };
  }

  pruneLocalUserData();
}

async function saveDatabaseState() {
  try {
    await apiPost("/api/state", { state: sharedStateSnapshot() });
  } catch (error) {
    showToast("Database save failed. REDX kept a browser backup.");
  }
}

function queueDatabaseSave() {
  if (!databaseLoaded) return;
  clearTimeout(databaseSaveTimer);
  databaseSaveTimer = setTimeout(saveDatabaseState, 250);
}

async function loadDatabaseState() {
  try {
    const result = await apiGet("/api/state");
    databaseLoaded = true;

    if (result.empty) {
      if (users.length || userPosts.length || stories.length) {
        await saveDatabaseState();
      }
      return;
    }

    applySharedState(result.state);
    localStorage.setItem(storeKey, JSON.stringify(browserStateSnapshot()));
  } catch (error) {
    databaseLoaded = true;
    showToast("Database unavailable. REDX is using browser storage.");
  }
}

async function refreshLiveSessionsFromDatabase() {
  if (!databaseLoaded || currentLiveId) return;

  try {
    const result = await apiGet("/api/state");
    const nextLiveSessions = Array.isArray(result.state?.liveSessions) ? result.state.liveSessions : [];
    if (JSON.stringify(nextLiveSessions) === JSON.stringify(liveSessions)) return;

    liveSessions = nextLiveSessions;
    renderStories();
    renderPulse();

    if (watchingLiveId && !activeLiveSessions().some((session) => session.id === watchingLiveId)) {
      liveWatchStatus.textContent = "This live video ended.";
      closeViewerPeer();
      watchingLiveId = "";
    }
  } catch (error) {
    // Keep the existing local view if the database is briefly unavailable.
  }
}

async function loadRtcConfig() {
  try {
    const result = await apiGet("/api/rtc-config");
    if (Array.isArray(result.iceServers) && result.iceServers.length) {
      rtcConfig = { iceServers: result.iceServers };
    }
  } catch (error) {
    rtcConfig = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };
  }
}

async function loadAuthConfig() {
  try {
    const result = await apiGet("/api/auth-config");
    authConfig = {
      requireSmsOtp: result.requireSmsOtp === true,
      googleClientId: result.googleClientId || "",
      googleConfigured: result.googleConfigured === true
    };
  } catch (error) {
    authConfig = { requireSmsOtp: false, googleClientId: "", googleConfigured: false };
  }
}

function renderGoogleAuth() {
  if (!googleAuthWrap) return;
  const checkingOtp = authMode === "otp";
  googleAuthWrap.hidden = checkingOtp || !authConfig.googleClientId;
  googleAuthWrap.classList.toggle("hidden", googleAuthWrap.hidden);
  googleAuthHint.textContent = authConfig.googleClientId ? "" : "Google sign-in needs GOOGLE_CLIENT_ID in Render.";
  if (authConfig.googleClientId && !checkingOtp) {
    initGoogleAuth();
  }
}

function initGoogleAuth() {
  if (googleInitialized || !authConfig.googleClientId || !googleSignInButton) return;
  if (!window.google?.accounts?.id) {
    setTimeout(initGoogleAuth, 350);
    return;
  }

  googleInitialized = true;
  window.google.accounts.id.initialize({
    client_id: authConfig.googleClientId,
    callback: handleGoogleCredential
  });
  window.google.accounts.id.renderButton(googleSignInButton, {
    theme: "outline",
    size: "large",
    type: "standard",
    shape: "pill",
    text: "continue_with",
    width: Math.min(360, googleSignInButton.clientWidth || 320)
  });
}

async function handleGoogleCredential(response) {
  try {
    const result = await apiPost("/api/auth/google", {
      credential: response.credential
    });
    completeGoogleAuth(result.profile);
  } catch (error) {
    showToast(error.message);
  }
}

function completeGoogleAuth(profile) {
  const email = cleanContact(profile?.email);
  if (!email) {
    showToast("Google did not return an email address.");
    return;
  }

  let user = users.find((item) => item.googleSub === profile.sub || cleanContact(item.email) === email);
  if (user) {
    user.googleSub = profile.sub;
    user.email = email;
    user.name = profile.name || user.name || user.username;
    user.avatar = profile.picture || user.avatar || "";
    user.provider = "google";
    user.settings = { ...defaults.settings, ...(user.settings || {}) };
  } else {
    const usernameSeed = email.split("@")[0] || profile.name || "google";
    user = {
      username: uniqueUsername(usernameSeed),
      name: String(profile.name || usernameSeed).slice(0, 32),
      bio: defaults.account.bio,
      avatar: profile.picture || "",
      followers: [],
      following: [],
      email,
      phone: "",
      password: "",
      provider: "google",
      googleSub: profile.sub,
      settings: { ...defaults.settings }
    };
    users.push(user);
  }

  completeAuth(user, `Signed in with Google as ${user.username}.`);
}

function persist() {
  try {
    syncActiveUser();
    localStorage.setItem(storeKey, JSON.stringify(browserStateSnapshot()));
    queueDatabaseSave();
  } catch (error) {
    showToast("Storage is full. Try smaller photos or reset REDX.");
  }
}

function showToast(message) {
  toastEl.textContent = message;
  toastEl.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove("show"), 2400);
}

function allPosts() {
  return userPosts.filter(isRealUploadPost);
}

function mutedTerms() {
  return settings.muted
    .split(",")
    .map((term) => term.trim().toLowerCase())
    .filter(Boolean);
}

function blockedAccounts() {
  return settings.blocked
    .split(",")
    .map((term) => String(term || "").replace(/^@+/, "").toLowerCase().replace(/[^a-z0-9._]/g, "").trim())
    .filter(Boolean);
}

function visiblePosts() {
  const muted = mutedTerms();
  const blocked = blockedAccounts();

  return allPosts().filter((post) => {
    const text = `${post.author} ${post.caption} ${post.tags.join(" ")}`.toLowerCase();
    return !blocked.includes(cleanUsername(post.author)) && !muted.some((term) => text.includes(term));
  });
}

function postsFor(username) {
  return allPosts().filter((post) => post.author === username);
}

function postState(post) {
  if (!interactions[post.id]) {
    interactions[post.id] = { liked: false, saved: false, reposted: false, extraComments: [], shares: 0 };
  }
  return interactions[post.id];
}

function allTags() {
  return [...new Set(visiblePosts().flatMap((post) => post.tags))];
}

function avatarHTML(postOrStory, extraClass = "") {
  const image = postOrStory.avatarImage || postOrStory.avatar || "";
  if (String(image).startsWith("data:image/")) {
    return `<span class="avatar photo-avatar ${extraClass}"><img src="${image}" alt=""></span>`;
  }
  return `<span class="avatar ${escapeHTML(image || "avatar-me")} ${extraClass}"></span>`;
}

function mediaTypeOf(item) {
  return item.mediaType === "video" ? "video" : "image";
}

function mediaHTML(item, context = "feed") {
  const src = escapeHTML(item.image || item.src || "");
  if (mediaTypeOf(item) === "video") {
    const controls = context === "grid" ? "" : "controls";
    const autoplay = context === "reel" || context === "story" || context === "grid" ? "autoplay loop muted" : "";
    return `<video src="${src}" ${controls} ${autoplay} playsinline preload="metadata"></video>`;
  }
  return `<img src="${src}" alt="">`;
}

function renderMediaPlaceholder(container) {
  if (!container) return;
  container.innerHTML = `<div class="preview-empty">${icon("camera")}</div>`;
}

function renderPreview(container, src, type = "image") {
  if (!container) return;
  container.innerHTML = type === "video"
    ? `<video src="${escapeHTML(src)}" controls muted playsinline preload="metadata"></video>`
    : `<img src="${escapeHTML(src)}" alt="">`;
}

function userPostCount() {
  return allPosts().filter((post) => post.author === account.username).length;
}

function notificationStore(username = account.username) {
  if (!notifications[username]) {
    notifications[username] = [];
  }
  return notifications[username];
}

function notifyUser(username, event) {
  if (!username || username === account.username || !users.some((user) => user.username === username)) return;
  notificationStore(username).unshift({
    id: `note-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    actor: account.username,
    actorAvatar: account.avatar,
    createdAt: Date.now(),
    read: false,
    ...event
  });
  notifications[username] = notificationStore(username).slice(0, 80);
}

function formatNotificationTime(time) {
  const age = Math.max(0, Date.now() - Number(time || Date.now()));
  if (age < 60000) return "now";
  if (age < 3600000) return `${Math.floor(age / 60000)}m`;
  if (age < 86400000) return `${Math.floor(age / 3600000)}h`;
  return `${Math.floor(age / 86400000)}d`;
}

function getProfile(username) {
  const local = users.find((user) => user.username === username);
  if (local) {
    return {
      username: local.username,
      name: local.name || local.username,
      avatar: local.avatar || "",
      avatarImage: local.avatar || ""
    };
  }

  return {
    username,
    name: username,
    avatar: "avatar-me"
  };
}

function suggestedAccounts() {
  const seen = new Set();
  return users
    .filter((user) => user.username !== account.username)
    .map((user) => ({
      username: user.username,
      name: user.name || user.username,
      avatar: user.avatar || "",
      avatarImage: user.avatar || "",
      local: true
    }))
    .filter((item) => {
      if (seen.has(item.username)) return false;
      seen.add(item.username);
      return true;
    })
    .slice(0, 8);
}

function searchableAccounts(query = "") {
  const needle = query.trim().toLowerCase();
  return users
    .map((user) => ({
      username: user.username,
      name: user.name || user.username,
      bio: user.bio || "",
      avatar: user.avatar || "",
      avatarImage: user.avatar || "",
      posts: postsFor(user.username).length,
      followers: listValue(user.followers).length,
      isSelf: user.username === account.username
    }))
    .filter((user) => {
      if (!needle) return true;
      const haystack = `${user.username} ${user.name} ${user.bio}`.toLowerCase();
      return haystack.includes(needle);
    })
    .sort((left, right) => {
      if (left.isSelf !== right.isSelf) return left.isSelf ? -1 : 1;
      return left.username.localeCompare(right.username);
    });
}

function renderUserSearchResults(query = "") {
  if (!userResults) return;
  const accounts = searchableAccounts(query);
  const title = query.trim() ? "People" : "People on REDX";

  userResults.innerHTML = `
    <div class="user-results-head">
      <h2>${title}</h2>
      <span>${accounts.length ? `${accounts.length} account${accounts.length === 1 ? "" : "s"}` : "No matches"}</span>
    </div>
    <div class="user-result-list">
      ${accounts.map((item) => {
        const relationship = relationshipLabel(item.username);
        const stats = `${formatLikes(item.posts)} posts - ${formatLikes(item.followers)} followers`;
        return `
          <div class="search-user-row">
            <button class="search-user-main" type="button" data-profile-user="${escapeHTML(item.username)}">
              ${avatarHTML(item)}
              <span>
                <strong>${escapeHTML(item.username)}${item.isSelf ? " - You" : ""}</strong>
                <small>${escapeHTML(item.name)} - ${stats}</small>
                ${item.bio ? `<em>${escapeHTML(item.bio)}</em>` : ""}
              </span>
            </button>
            ${item.isSelf ? `<button type="button" class="following" data-view="profile">View</button>` : `<button type="button" class="${relationship.className}" data-follow="${escapeHTML(item.username)}">${relationship.text}</button>`}
          </div>
        `;
      }).join("") || `<div class="empty-state">No REDX accounts match this search.</div>`}
    </div>
  `;
}

function relationshipLabel(username) {
  const following = listValue(account.following).includes(username);
  const followsYou = listValue(account.followers).includes(username);
  if (following) return { text: "Following", className: "following", note: followsYou ? "You follow each other" : "Following" };
  if (followsYou) return { text: "Follow Back", className: "follow-back", note: "Follows you" };
  return { text: "Follow", className: "", note: "Suggested" };
}

function renderSuggestions() {
  if (!suggestionsEl) return;
  suggestionsEl.innerHTML = suggestedAccounts().map((item) => `
    <div class="suggest-row">
      ${avatarHTML(item)}
      <div>
        <strong>${escapeHTML(item.username)}</strong>
        <span>${escapeHTML(relationshipLabel(item.username).note)}</span>
      </div>
      <button type="button" class="${relationshipLabel(item.username).className}" data-follow="${escapeHTML(item.username)}">${relationshipLabel(item.username).text}</button>
    </div>
  `).join("") || `<div class="empty-state">No local accounts yet.</div>`;
}

function renderFollowersList() {
  if (!followersList) return;
  const followers = listValue(account.followers);
  followersList.innerHTML = followers.map((username) => {
    const item = getProfile(username);
    const relationship = relationshipLabel(username);
    return `
      <div class="suggest-row">
        ${avatarHTML(item)}
        <div>
          <strong>${escapeHTML(item.username)}</strong>
          <span>${escapeHTML(relationship.note)}</span>
        </div>
        <button type="button" class="${relationship.className}" data-follow="${escapeHTML(item.username)}">${relationship.text}</button>
      </div>
    `;
  }).join("") || `<div class="empty-state">No followers yet. When someone follows you, Follow Back appears here.</div>`;
}

function renderProfileConnections() {
  if (!profileConnections) return;
  const followers = listValue(account.followers);
  const suggested = suggestedAccounts().slice(0, 4);
  const followerRows = followers.map((username) => {
    const item = getProfile(username);
    const relationship = relationshipLabel(username);
    return `
      <div class="suggest-row">
        ${avatarHTML(item)}
        <div>
          <strong>${escapeHTML(item.username)}</strong>
          <span>${escapeHTML(relationship.note)}</span>
        </div>
        <button type="button" class="${relationship.className}" data-follow="${escapeHTML(item.username)}">${relationship.text}</button>
      </div>
    `;
  }).join("");
  const suggestedRows = suggested.map((item) => {
    const relationship = relationshipLabel(item.username);
    return `
      <div class="suggest-row">
        ${avatarHTML(item)}
        <div>
          <strong>${escapeHTML(item.username)}</strong>
          <span>${escapeHTML(relationship.note)}</span>
        </div>
        <button type="button" class="${relationship.className}" data-follow="${escapeHTML(item.username)}">${relationship.text}</button>
      </div>
    `;
  }).join("");

  profileConnections.innerHTML = `
    ${followers.length ? `<div class="connection-band"><h2>Follow Back</h2>${followerRows}</div>` : ""}
    <div class="connection-band"><h2>Discover People</h2>${suggestedRows || `<div class="empty-state">No accounts to suggest.</div>`}</div>
  `;
}

function toggleFollow(username) {
  if (!username || username === account.username) return;
  const following = new Set(listValue(account.following));
  const wasFollowing = following.has(username);

  if (wasFollowing) {
    following.delete(username);
  } else {
    following.add(username);
  }
  account.following = [...following];

  const target = users.find((user) => user.username === username);
  if (target) {
    const targetFollowers = new Set(listValue(target.followers));
    if (wasFollowing) {
      targetFollowers.delete(account.username);
    } else {
      targetFollowers.add(account.username);
      notifyUser(username, {
        type: "follow",
        text: "started following you."
      });
    }
    target.followers = [...targetFollowers];
  }

  const followedBack = !wasFollowing && listValue(account.followers).includes(username);
  showToast(wasFollowing ? `Unfollowed ${username}.` : followedBack ? `Followed ${username} back.` : `Following ${username}.`);
  persist();
  renderAll();
}

function threadStore() {
  if (!activeUsername) return {};
  if (!messages[account.username]) {
    messages[account.username] = {};
  }

  const contacts = users
    .filter((user) => user.username !== account.username)
    .map((user) => ({
      username: user.username,
      name: user.name || user.username,
      avatar: user.avatar || "",
      avatarImage: user.avatar || ""
    }));
  const contactNames = new Set(contacts.map((item) => item.username));
  Object.keys(messages[account.username]).forEach((username) => {
    if (!contactNames.has(username)) {
      delete messages[account.username][username];
    }
  });

  contacts.forEach((item) => {
    if (!messages[account.username][item.username]) {
      messages[account.username][item.username] = {
        id: item.username,
        username: item.username,
        name: item.name,
        avatar: item.avatar,
        avatarImage: item.avatarImage || "",
        unread: false,
        messages: []
      };
    }
  });

  return messages[account.username];
}

function ensureMessageThread(username) {
  if (!username || username === account.username) return null;
  const profile = getProfile(username);
  const threads = threadStore();
  if (!threads[username]) {
    threads[username] = {
      id: username,
      username,
      name: profile.name || username,
      avatar: profile.avatar || "",
      avatarImage: profile.avatarImage || "",
      unread: false,
      messages: []
    };
  }
  return threads[username];
}

function openMessageThread(username) {
  const thread = ensureMessageThread(username);
  if (!thread) return;
  selectedThreadId = thread.id;
  if (profileDialog.open) closeDialog(profileDialog);
  setView("messages");
  persist();
  renderMessages();
  requestAnimationFrame(() => messageInput?.focus());
}

function renderMessages() {
  if (!messageList || !chatHead || !chatLog) return;
  if (messageOwner) {
    messageOwner.textContent = account.username;
  }
  if (!activeUsername) {
    messageList.innerHTML = "";
    chatHead.innerHTML = "";
    chatLog.innerHTML = "";
    return;
  }

  const threads = threadStore();
  const query = (messageSearchInput?.value || "").trim().toLowerCase();
  const threadItems = Object.values(threads);
  const visibleThreads = query
    ? threadItems.filter((thread) => {
      const last = thread.messages[thread.messages.length - 1]?.text || "";
      return `${thread.username} ${thread.name || ""} ${last}`.toLowerCase().includes(query);
    })
    : threadItems;
  if (!selectedThreadId || !threads[selectedThreadId]) {
    selectedThreadId = threadItems[0]?.id || "";
  }

  messageList.innerHTML = visibleThreads.map((thread) => {
    const last = thread.messages[thread.messages.length - 1];
    return `
      <button class="message-thread ${thread.id === selectedThreadId ? "active" : ""}" type="button" data-thread="${escapeHTML(thread.id)}">
        ${avatarHTML(thread)}
        <div>
          <strong>${escapeHTML(thread.username)}${thread.unread ? `<span class="unread-dot"></span>` : ""}</strong>
          <span>${escapeHTML(last?.text || "Start a conversation.")}</span>
        </div>
      </button>
    `;
  }).join("") || `<div class="empty-state">No messages match your search.</div>`;

  const thread = threads[selectedThreadId];
  if (!thread) {
    chatHead.innerHTML = "Messages";
    chatLog.innerHTML = `<div class="empty-state">No conversations yet.</div>`;
    return;
  }

  thread.unread = false;
  chatHead.innerHTML = `${avatarHTML(thread)}<span>${escapeHTML(thread.username)}</span>`;
  chatLog.innerHTML = thread.messages.map((message) => `
    <div class="message-bubble ${message.from === account.username ? "mine" : ""}">${escapeHTML(message.text)}</div>
  `).join("");
  chatLog.scrollTop = chatLog.scrollHeight;
}

function renderNotifications() {
  if (!notificationList) return;
  const notes = notificationStore();
  notificationList.innerHTML = notes.map((note) => {
    const actor = getProfile(note.actor);
    const postButton = note.postId ? `<button type="button" data-open-post="${escapeHTML(note.postId)}">View</button>` : "";
    return `
      <div class="notification-row">
        ${avatarHTML(actor)}
        <div>
          <p><button type="button" data-profile-user="${escapeHTML(note.actor)}">${escapeHTML(note.actor)}</button> ${escapeHTML(note.text)}</p>
          <span>${formatNotificationTime(note.createdAt)}</span>
        </div>
        ${postButton}
      </div>
    `;
  }).join("") || `<div class="empty-state">No notifications yet. Likes, comments, reels, and follows will show here.</div>`;
}

function storyIsActive(story) {
  return Number(story.expiresAt || 0) > Date.now();
}

function pruneExpiredStories() {
  const before = stories.length;
  stories = stories.filter(storyIsActive);
  if (stories.length !== before) {
    persist();
  }
}

function latestStoryFor(username) {
  return stories
    .filter((story) => story.username === username && storyIsActive(story))
    .sort((a, b) => b.createdAt - a.createdAt)[0];
}

function activeLiveSessions() {
  const liveMaxAge = 90 * 1000;
  const now = Date.now();
  return liveSessions.filter((session) =>
    session.active && now - Number(session.lastActiveAt || session.startedAt || 0) < liveMaxAge
  );
}

function pruneExpiredLiveSessions() {
  const activeIds = new Set(activeLiveSessions().map((session) => session.id));
  const next = liveSessions.map((session) =>
    session.active && !activeIds.has(session.id)
      ? { ...session, active: false, endedAt: Date.now() }
      : session
  );
  if (JSON.stringify(next) !== JSON.stringify(liveSessions)) {
    liveSessions = next;
    persist();
  }
}

function visibleStoryItems() {
  pruneExpiredStories();
  pruneExpiredLiveSessions();
  const following = new Set(listValue(account.following));
  const items = [];
  const ownStory = latestStoryFor(account.username);

  if (ownStory) {
    items.push({ ...ownStory, name: "Your Story", own: true });
  }

  users
    .filter((user) => user.username !== account.username && following.has(user.username))
    .forEach((user) => {
      const story = latestStoryFor(user.username);
      if (story) {
        items.push({
          ...story,
          name: user.username,
          avatar: user.avatar || "",
          avatarImage: user.avatar || ""
        });
      }
    });

  return items;
}

function renderStories() {
  const ownStory = latestStoryFor(account.username);
  const visibleStories = visibleStoryItems().filter((story) => story.username !== account.username);
  const visibleLives = activeLiveSessions()
    .filter((session) => session.username === account.username || listValue(account.following).includes(session.username))
    .slice(0, 10);
  const yourAction = ownStory ? `data-story="${escapeHTML(ownStory.id)}"` : "data-add-story";

  storiesEl.innerHTML = `
    <button class="story" type="button" ${yourAction}>
      ${avatarHTML({ avatar: account.avatar || "avatar-me", avatarImage: account.avatar })}
      <i class="story-add" data-add-story>+</i>
      <span>Your Story</span>
    </button>
    ${visibleLives.map((live) => `
      <button class="story live-story" type="button" data-live-session="${escapeHTML(live.id)}">
        ${avatarHTML(live)}
        <i class="live-ring">LIVE</i>
        <span>${escapeHTML(live.username === account.username ? "Your Live" : live.username)}</span>
      </button>
    `).join("")}
    ${visibleStories.map((story) => `
      <button class="story" type="button" data-story="${escapeHTML(story.id)}">
        ${avatarHTML(story)}
        <span>${escapeHTML(story.name || story.username)}</span>
      </button>
    `).join("")}
  `;
}

function renderFeed() {
  const posts = visiblePosts();
  feedEl.innerHTML = posts.map((post) => {
    const state = postState(post);
    const likeCount = post.likes + (state.liked ? 1 : 0);
    const comments = [...post.comments, ...state.extraComments];
    const note = state.reposted
      ? `<div class="repost-note">${icon("repost")} Reposted by ${escapeHTML(account.username)}</div>`
      : "";

    return `
      <article class="post-card" data-post-id="${post.id}">
        <div class="post-top">
          <button class="author author-link" type="button" data-profile-user="${escapeHTML(post.author)}">
            ${avatarHTML(post)}
            <div>
              <strong>${escapeHTML(post.author)}</strong>
              <span>${escapeHTML(post.location)} - ${escapeHTML(post.time)}</span>
            </div>
          </button>
          <button class="icon-button" title="More" aria-label="More">${icon("dots")}</button>
        </div>
        ${note}
        <div class="post-media" data-action="like">
          ${mediaHTML(post, "feed")}
          <div class="like-burst">${icon("heart")}</div>
        </div>
        <div class="post-actions">
          <div class="action-left">
            <button data-action="like" class="${state.liked ? "active" : ""}" title="Like" aria-label="Like">${icon("heart")}</button>
            <button data-action="focus-comment" title="Comment" aria-label="Comment">${icon("comment")}</button>
            <button data-action="share" title="Share" aria-label="Share">${icon("send")}</button>
            <button data-action="repost" class="${state.reposted ? "reposted" : ""}" title="Repost" aria-label="Repost">${icon("repost")}</button>
            <button data-action="story" title="Add to story" aria-label="Add to story">${icon("camera")}</button>
          </div>
          <button data-action="save" class="${state.saved ? "saved" : ""}" title="Save" aria-label="Save">${icon("bookmark")}</button>
        </div>
        <div class="post-body">
          <div class="likes">${settings.hideLikes ? "Liked by REDX users" : `${formatLikes(likeCount)} likes`}</div>
          <p class="caption"><strong>${escapeHTML(post.author)}</strong>${escapeHTML(post.caption)}</p>
          <div class="tagline">
            ${post.tags.map((tag) => `<button data-tag="${tag}">${escapeHTML(tag)}</button>`).join("")}
          </div>
          <div class="comments">
            ${comments.map((comment) => `<p class="comment"><strong>${escapeHTML(comment.by)}</strong> ${escapeHTML(comment.text)}</p>`).join("")}
          </div>
          <form class="comment-form" data-comment-form>
            <input name="comment" placeholder="Add a comment" autocomplete="off">
            <button type="submit">Post</button>
          </form>
        </div>
      </article>
    `;
  }).join("") || `<div class="empty-state">No posts yet. Create a post to fill your REDX feed.</div>`;
}

function renderExplore() {
  const query = (searchInput.value || "").toLowerCase();
  renderUserSearchResults(query);
  const filtered = visiblePosts().filter((post) => {
    const haystack = `${post.author} ${post.caption} ${post.tags.join(" ")}`.toLowerCase();
    return (!query || haystack.includes(query)) && (!activeTag || post.tags.includes(activeTag));
  });

  tagRow.innerHTML = allTags().map((tag) => `
    <button type="button" data-filter-tag="${tag}" class="${activeTag === tag ? "active" : ""}">${escapeHTML(tag)}</button>
  `).join("");

  exploreGrid.innerHTML = filtered.map((post) => `
    <button class="grid-tile" type="button" data-open-post="${post.id}">
      ${mediaHTML(post, "grid")}
      <span>${settings.hideLikes ? "REDX" : formatLikes(post.likes)}</span>
    </button>
  `).join("") || `<div class="empty-state">No posts found.</div>`;
}

function renderReels() {
  const reelPosts = visiblePosts()
    .filter((post) => mediaTypeOf(post) === "video" && post.source !== "demo")
    .slice(0, 12);

  if (!reelPosts.length) {
    reelsStack.innerHTML = `<div class="empty-state">No reels yet. Upload a video from Create Post to start Reels.</div>`;
    return;
  }

  reelsStack.innerHTML = reelPosts.map((post) => {
    const state = postState(post);
    return `
      <section class="reel-card" data-post-id="${post.id}">
        ${mediaHTML(post, "reel")}
        <div class="reel-overlay">
          <div>
            <button class="reel-author" type="button" data-profile-user="${escapeHTML(post.author)}">${escapeHTML(post.author)}</button>
            <p>${escapeHTML(post.caption)}</p>
          </div>
          <div class="reel-actions">
            <button data-reel-action="like" class="${state.liked ? "active" : ""}" title="Like" aria-label="Like">${icon("heart")}<span>${settings.hideLikes ? "" : formatLikes(post.likes + (state.liked ? 1 : 0))}</span></button>
            <button data-reel-action="comment" title="Comment" aria-label="Comment">${icon("comment")}<span>${post.comments.length + state.extraComments.length}</span></button>
            <button data-reel-action="share" title="Share" aria-label="Share">${icon("send")}<span>${state.shares || ""}</span></button>
            <button data-reel-action="repost" class="${state.reposted ? "reposted" : ""}" title="Repost" aria-label="Repost">${icon("repost")}<span>${state.reposted ? "On" : ""}</span></button>
            <button data-reel-action="save" class="${state.saved ? "saved" : ""}" title="Save" aria-label="Save">${icon("bookmark")}<span>${state.saved ? "Saved" : ""}</span></button>
            <button data-reel-action="story" title="Add to story" aria-label="Add to story">${icon("camera")}<span>Story</span></button>
          </div>
        </div>
      </section>
    `;
  }).join("");
}

function renderProfile() {
  const ownPosts = allPosts().filter((post) => post.author === account.username);
  const reposted = allPosts().filter((post) => postState(post).reposted);
  const saved = allPosts().filter((post) => postState(post).saved);
  const collections = { posts: ownPosts, reposts: reposted, saved };
  const emptyText = {
    posts: "No posts yet. Tap Create and upload a real photo.",
    reposts: "No reposts yet.",
    saved: "No saved posts yet."
  };
  const collection = collections[profileTab] || ownPosts;

  postCount.textContent = userPostCount();
  followerCount.textContent = formatLikes(listValue(account.followers).length);
  followingCount.textContent = formatLikes(listValue(account.following).length);
  document.querySelectorAll("[data-profile-tab]").forEach((button) => {
    button.classList.toggle("active", button.dataset.profileTab === profileTab);
  });
  profileGrid.innerHTML = collection.map((post) => `
    <button class="grid-tile" type="button" data-open-post="${post.id}">
      ${mediaHTML(post, "grid")}
      <span>${escapeHTML(post.author === account.username ? "REDX" : post.handle)}</span>
    </button>
  `).join("") || `<div class="empty-state">${emptyText[profileTab]}</div>`;
}

function renderProfileDialog(username) {
  const profile = getProfile(username);
  const localUser = users.find((user) => user.username === username);
  const profilePosts = postsFor(username);
  const relation = relationshipLabel(username);

  profileDialogName.textContent = profile.username;
  profileDialogPosts.textContent = formatLikes(profilePosts.length);
  profileDialogFollowers.textContent = formatLikes(listValue(localUser?.followers).length);
  profileDialogFollowing.textContent = formatLikes(listValue(localUser?.following).length);
  profileDialogBio.textContent = localUser?.bio || profile.name || "";
  profileDialogFollow.textContent = relation.text;
  profileDialogFollow.className = `outline-button ${relation.className}`;
  profileDialogFollow.dataset.follow = profile.username;
  profileDialogFollow.hidden = profile.username === account.username;
  if (profileDialogMessage) {
    profileDialogMessage.hidden = profile.username === account.username;
    profileDialogMessage.dataset.messageUser = profile.username;
  }

  profileDialogAvatar.innerHTML = profile.avatarImage ? `<img src="${profile.avatarImage}" alt="">` : "";
  profileDialogAvatar.className = `profile-avatar avatar ${profile.avatarImage ? "photo-avatar" : escapeHTML(profile.avatar || "avatar-me")}`;
  profileDialogGrid.innerHTML = profilePosts.map((post) => `
    <button class="grid-tile" type="button" data-open-post="${escapeHTML(post.id)}">
      ${mediaHTML(post, "grid")}
      <span>${mediaTypeOf(post) === "video" ? "Reel" : "Post"}</span>
    </button>
  `).join("") || `<div class="empty-state">No posts yet.</div>`;
}

function renderPulse() {
  if (!pulseCount || !pulseLabel || !pulseMeter || !pulseTags) return;
  const posts = visiblePosts();
  const lives = activeLiveSessions();
  const tags = allTags().slice(0, 4);

  pulseCount.textContent = formatLikes(lives.length || posts.length);
  pulseLabel.textContent = lives.length ? lives.length === 1 ? "live now" : "lives now" : posts.length === 1 ? "post today" : "posts today";
  pulseMeter.style.width = `${Math.min(100, (lives.length || posts.length) * 20)}%`;
  const liveButtons = lives.slice(0, 4).map((session) => `
    <button type="button" class="live-pulse-button" data-live-session="${escapeHTML(session.id)}">${escapeHTML(session.username)} live</button>
  `).join("");
  const tagButtons = tags.map((tag) => `
    <button type="button" data-filter-tag="${escapeHTML(tag)}">${escapeHTML(tag)}</button>
  `).join("");
  pulseTags.innerHTML = liveButtons || tagButtons || `<span class="trend-empty">No trends yet</span>`;
}

function openProfileDialog(username) {
  if (!username || username === account.username) {
    setView("profile");
    return;
  }
  renderProfileDialog(username);
  openDialog(profileDialog, null);
}

function renderAssetPicker() {
  assetPicker.innerHTML = "";
  assetPicker.hidden = true;
  if (selectedUploadData) {
    renderPreview(selectedPreview, selectedUploadData, selectedUploadType);
  } else {
    renderMediaPlaceholder(selectedPreview);
  }
  photoStatus.textContent = selectedUploadData ? `${selectedUploadType === "video" ? "Video" : "Photo"} ready` : "Choose from your device";
}

function applyAvatarToElement(element, image) {
  if (!element) return;
  element.innerHTML = image ? `<img src="${image}" alt="">` : "";
  element.classList.toggle("photo-avatar", Boolean(image));
}

function updateAccountUI() {
  document.body.classList.toggle("dark-mode", Boolean(activeUsername && settings.darkMode));
  document.querySelector("#profileUsername").textContent = account.username;
  document.querySelector("#profileBio").textContent = `${account.bio}${settings.privateAccount ? " - Private account" : ""}`;
  document.querySelector("#railUsername").textContent = account.username;
  document.querySelector("#railName").textContent = account.name;
  document.querySelector("#accountTitle").textContent = account.username === "redx.creator" ? "Create Account" : "Edit Account";

  usernameInput.value = account.username;
  nameInput.value = account.name;
  bioInput.value = account.bio;
  pendingAvatar = account.avatar;
  avatarStatus.textContent = account.avatar ? "Profile photo selected" : "Choose a real picture";

  privateInput.checked = settings.privateAccount;
  activityInput.checked = settings.activityStatus;
  notificationsInput.checked = settings.notifications;
  hideLikesInput.checked = settings.hideLikes;
  darkModeInput.checked = settings.darkMode;
  blockedInput.value = settings.blocked;
  mutedInput.value = settings.muted;

  document.querySelectorAll(".avatar-me").forEach((element) => applyAvatarToElement(element, account.avatar));
  applyAvatarToElement(avatarPreview, pendingAvatar);
}

function renderAll() {
  renderStories();
  renderFeed();
  renderExplore();
  renderReels();
  renderProfile();
  renderMessages();
  renderNotifications();
  renderAssetPicker();
  renderSuggestions();
  renderFollowersList();
  renderProfileConnections();
  renderPulse();
  updateAccountUI();
}

function setView(viewName) {
  document.querySelectorAll(".view").forEach((view) => view.classList.remove("active"));
  document.querySelector(`#${viewName}View`)?.classList.add("active");
  document.querySelectorAll("[data-view]").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === viewName);
  });
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function openDialog(dialog, focusTarget) {
  if (typeof dialog.showModal === "function") {
    dialog.showModal();
  } else {
    dialog.classList.add("fallback-open");
  }
  focusTarget?.focus();
}

function closeDialog(dialog) {
  if (dialog.open) dialog.close();
  dialog.classList.remove("fallback-open");
}

function liveSocketUrl() {
  const base = apiBase || window.location.origin;
  return `${base.replace(/^http/, "ws")}/ws/live`;
}

function sendLiveSignal(payload) {
  if (!liveSocketReady || !liveSocket) return false;
  liveSocket.send(JSON.stringify(payload));
  return true;
}

function ensureLiveSocket() {
  if (liveSocketReady && liveSocket) return Promise.resolve(liveSocket);
  if (liveSocketOpening) return liveSocketOpening;

  liveSocketOpening = new Promise((resolve, reject) => {
    const socket = new WebSocket(liveSocketUrl());
    liveSocket = socket;

    socket.addEventListener("open", () => {
      liveSocketReady = true;
      liveSocketOpening = null;
      sendLiveSignal({ type: "hello", username: activeUsername || account.username || "viewer" });
      resolve(socket);
    });

    socket.addEventListener("message", (event) => {
      try {
        Promise.resolve(handleLiveSignal(JSON.parse(event.data))).catch(() => {
          showToast("Live signal error.");
        });
      } catch (error) {
        showToast("Live signal error.");
      }
    });

    socket.addEventListener("close", () => {
      liveSocketReady = false;
      liveSocket = null;
      liveSocketOpening = null;
      if (currentLiveId) {
        liveStatus.textContent = "Live signaling disconnected.";
      }
      if (watchingLiveId) {
        liveWatchStatus.textContent = "Live disconnected.";
      }
    });

    socket.addEventListener("error", () => {
      liveSocketReady = false;
      liveSocketOpening = null;
      reject(new Error("Live signaling server is not available."));
    });
  });

  return liveSocketOpening;
}

function closeHostPeer(viewerId) {
  const peer = hostPeerConnections.get(Number(viewerId));
  if (peer) {
    peer.close();
    hostPeerConnections.delete(Number(viewerId));
  }
}

function closeHostPeers() {
  hostPeerConnections.forEach((peer) => peer.close());
  hostPeerConnections = new Map();
}

function closeViewerPeer() {
  if (viewerPeerConnection) {
    viewerPeerConnection.close();
    viewerPeerConnection = null;
  }
  liveWatchVideo.srcObject = null;
  liveWatchPlaceholder.hidden = false;
}

async function createHostPeer(viewerId) {
  if (!liveStream || !currentLiveId || hostPeerConnections.has(Number(viewerId))) return;
  const peer = new RTCPeerConnection(rtcConfig);
  hostPeerConnections.set(Number(viewerId), peer);
  liveStream.getTracks().forEach((track) => peer.addTrack(track, liveStream));
  peer.addEventListener("icecandidate", (event) => {
    if (event.candidate) {
      sendLiveSignal({
        type: "host-ice",
        liveId: currentLiveId,
        viewerId: Number(viewerId),
        candidate: event.candidate
      });
    }
  });
  peer.addEventListener("connectionstatechange", () => {
    if (["closed", "failed", "disconnected"].includes(peer.connectionState)) {
      closeHostPeer(viewerId);
    }
  });

  const offer = await peer.createOffer();
  await peer.setLocalDescription(offer);
  sendLiveSignal({
    type: "offer",
    liveId: currentLiveId,
    viewerId: Number(viewerId),
    sdp: peer.localDescription
  });
}

async function acceptLiveOffer(message) {
  const liveId = message.liveId;
  if (watchingLiveId !== liveId) return;
  closeViewerPeer();
  const peer = new RTCPeerConnection(rtcConfig);
  viewerPeerConnection = peer;

  peer.addEventListener("track", (event) => {
    if (viewerPeerConnection !== peer) return;
    liveWatchVideo.srcObject = event.streams[0];
    liveWatchPlaceholder.hidden = true;
    liveWatchStatus.textContent = "Live now";
    liveWatchVideo.play().catch(() => {});
  });

  peer.addEventListener("icecandidate", (event) => {
    if (event.candidate && watchingLiveId === liveId) {
      sendLiveSignal({
        type: "viewer-ice",
        liveId,
        candidate: event.candidate
      });
    }
  });

  peer.addEventListener("connectionstatechange", () => {
    if (viewerPeerConnection === peer && ["failed", "disconnected", "closed"].includes(peer.connectionState)) {
      liveWatchStatus.textContent = "Live connection ended.";
    }
  });

  await peer.setRemoteDescription(message.sdp);
  if (viewerPeerConnection !== peer || watchingLiveId !== liveId) return;

  const answer = await peer.createAnswer();
  await peer.setLocalDescription(answer);
  sendLiveSignal({
    type: "answer",
    liveId,
    sdp: peer.localDescription
  });
}

async function handleLiveSignal(message) {
  if (message.type === "host-ready") {
    liveStatus.textContent = Number(message.viewerCount || 0)
      ? `${message.viewerCount} viewer${Number(message.viewerCount) === 1 ? "" : "s"} connected.`
      : "Live now. Waiting for viewers.";
    return;
  }

  if (message.type === "viewer-joined") {
    liveStatus.textContent = "Viewer connected. Sending video...";
    await createHostPeer(message.viewerId);
    return;
  }

  if (message.type === "viewer-left") {
    closeHostPeer(message.viewerId);
    return;
  }

  if (message.type === "offer") {
    await acceptLiveOffer(message);
    return;
  }

  if (message.type === "answer") {
    const peer = hostPeerConnections.get(Number(message.viewerId));
    if (peer) await peer.setRemoteDescription(message.sdp);
    return;
  }

  if (message.type === "ice") {
    const candidate = message.candidate ? new RTCIceCandidate(message.candidate) : null;
    if (!candidate) return;
    if (message.viewerId) {
      const peer = hostPeerConnections.get(Number(message.viewerId));
      if (peer) await peer.addIceCandidate(candidate);
    } else if (viewerPeerConnection) {
      await viewerPeerConnection.addIceCandidate(candidate);
    }
    return;
  }

  if (message.type === "join-waiting") {
    liveWatchStatus.textContent = "Waiting for broadcaster...";
    return;
  }

  if (message.type === "no-host" || message.type === "live-ended") {
    liveWatchStatus.textContent = "This live video ended.";
    closeViewerPeer();
  }
}

async function prepareLiveCamera() {
  if (!navigator.mediaDevices?.getUserMedia) {
    liveStatus.textContent = "Camera is not available in this browser.";
    return false;
  }

  if (liveStream) return true;

  try {
    liveStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    livePreview.srcObject = liveStream;
    livePlaceholder.hidden = true;
    liveStatus.textContent = "Camera ready";
    return true;
  } catch (error) {
    liveStatus.textContent = "Camera permission was blocked.";
    showToast("Allow camera and microphone to go live.");
    return false;
  }
}

async function openLiveDialog() {
  if (createMenu) createMenu.hidden = true;
  liveTitleInput.value = "";
  const activeLive = activeLiveSessions().find((session) => session.username === account.username);
  currentLiveId = activeLive?.id || "";
  liveChip.hidden = !currentLiveId;
  startLiveButton.disabled = Boolean(currentLiveId);
  endLiveButton.disabled = !currentLiveId;
  liveStatus.textContent = currentLiveId ? "You are live" : "Ready";
  openDialog(liveDialog, liveTitleInput);
  await prepareLiveCamera();
}

function stopLiveCamera() {
  if (!liveStream) return;
  liveStream.getTracks().forEach((track) => track.stop());
  liveStream = null;
  livePreview.srcObject = null;
  livePlaceholder.hidden = false;
}

function touchLiveSession() {
  if (!currentLiveId) return;
  let touched = false;
  liveSessions = liveSessions.map((session) => {
    if (session.id !== currentLiveId || !session.active) return session;
    touched = true;
    return { ...session, lastActiveAt: Date.now() };
  });
  if (touched) persist();
}

function startLiveHeartbeat() {
  clearInterval(liveHeartbeatTimer);
  touchLiveSession();
  liveHeartbeatTimer = setInterval(touchLiveSession, 30000);
}

function stopLiveHeartbeat() {
  clearInterval(liveHeartbeatTimer);
  liveHeartbeatTimer = 0;
}

async function startLiveSession() {
  const existing = activeLiveSessions().find((session) => session.username === account.username);
  if (existing) {
    currentLiveId = existing.id;
    showToast("You are already live.");
    return;
  }

  try {
    await ensureLiveSocket();
  } catch (error) {
    liveStatus.textContent = error.message;
    showToast(error.message);
    return;
  }

  const createdAt = Date.now();
  const session = {
    id: `live-${account.username}-${createdAt}`,
    username: account.username,
    name: account.name,
    avatar: account.avatar || "avatar-me",
    avatarImage: account.avatar,
    title: liveTitleInput.value.trim().slice(0, 70) || `${account.username} is live`,
    startedAt: createdAt,
    lastActiveAt: createdAt,
    active: true,
    viewers: 1
  };
  liveSessions = [session, ...activeLiveSessions().filter((item) => item.username !== account.username)];
  currentLiveId = session.id;
  liveChip.hidden = false;
  startLiveButton.disabled = true;
  endLiveButton.disabled = false;
  liveStatus.textContent = "You are live";
  sendLiveSignal({
    type: "host-live",
    liveId: session.id,
    username: account.username,
    title: session.title
  });
  listValue(account.followers).forEach((username) => {
    notifyUser(username, {
      type: "live",
      text: `started a live video: ${session.title}`
    });
  });
  startLiveHeartbeat();
  persist();
  renderStories();
  showToast("REDX Live started.");
}

function endLiveSession() {
  const active = activeLiveSessions().find((session) => session.id === currentLiveId || session.username === account.username);
  if (!active) {
    currentLiveId = "";
    stopLiveHeartbeat();
    liveChip.hidden = true;
    startLiveButton.disabled = false;
    endLiveButton.disabled = true;
    showToast("No live session is running.");
    return;
  }

  liveSessions = liveSessions.map((session) => session.id === active.id
    ? { ...session, active: false, endedAt: Date.now() }
    : session);
  sendLiveSignal({ type: "end-live", liveId: active.id });
  closeHostPeers();
  currentLiveId = "";
  stopLiveHeartbeat();
  liveChip.hidden = true;
  startLiveButton.disabled = false;
  endLiveButton.disabled = true;
  liveStatus.textContent = "Live ended";
  persist();
  renderStories();
  showToast("Live ended.");
}

function openLiveSession(sessionId) {
  const session = activeLiveSessions().find((item) => item.id === sessionId);
  if (!session) {
    showToast("That live ended.");
    renderStories();
    return;
  }

  if (session.username === account.username) {
    openLiveDialog();
    return;
  }

  watchLiveSession(session);
}

async function watchLiveSession(session) {
  watchingLiveId = session.id;
  liveWatchTitle.textContent = `${session.username} live`;
  liveWatchStatus.textContent = "Connecting to broadcaster...";
  liveWatchPlaceholder.hidden = false;
  openDialog(liveWatchDialog, null);

  try {
    await ensureLiveSocket();
    sendLiveSignal({
      type: "join-live",
      liveId: session.id,
      username: account.username
    });
  } catch (error) {
    liveWatchStatus.textContent = error.message;
    showToast(error.message);
  }
}

function closeLiveWatch() {
  if (watchingLiveId) {
    sendLiveSignal({ type: "leave-live", liveId: watchingLiveId });
  }
  watchingLiveId = "";
  closeViewerPeer();
  closeDialog(liveWatchDialog);
}

function openCreateDialog() {
  if (createMenu) createMenu.hidden = true;
  openDialog(createDialog, captionInput);
}

function toggleCreateMenu(anchor) {
  if (!createMenu) {
    openCreateDialog();
    return;
  }

  if (!createMenu.hidden) {
    createMenu.hidden = true;
    return;
  }

  const rect = anchor?.getBoundingClientRect();
  if (rect) {
    const left = Math.min(window.innerWidth - 276, Math.max(12, rect.left));
    const top = Math.min(window.innerHeight - 190, Math.max(12, rect.bottom + 8));
    createMenu.style.left = `${left}px`;
    createMenu.style.top = `${top}px`;
  }
  createMenu.hidden = false;
}

function openStoryDialog() {
  selectedStoryData = "";
  selectedStoryType = "image";
  storyInput.value = "";
  storyCaptionInput.value = "";
  renderMediaPlaceholder(storyPreview);
  storyStatus.textContent = "Choose a photo or video for 24 hours";
  openDialog(storyDialog, storyCaptionInput);
}

function openAccountDialog() {
  pendingAvatar = account.avatar;
  updateAccountUI();
  openDialog(accountDialog, usernameInput);
}

function openSettingsDialog() {
  updateAccountUI();
  openDialog(settingsDialog, privateInput);
}

function findPostElement(target) {
  return target.closest(".post-card, .reel-card");
}

function findPost(id) {
  return allPosts().find((post) => post.id === id);
}

function findStory(id) {
  return stories.find((story) => story.id === id && storyIsActive(story));
}

function openStoryViewer(storyId) {
  const story = findStory(storyId);
  if (!story) {
    showToast("That story expired.");
    renderStories();
    return;
  }

  currentStoryId = storyId;
  storyViewerAuthor.innerHTML = `${avatarHTML(story)}<div><strong>${escapeHTML(story.name || story.username)}</strong><span>Story</span></div>`;
  storyViewerMedia.innerHTML = mediaHTML(story, "story");
  storyViewerCaption.textContent = story.caption || "";
  openDialog(storyViewer, null);
}

function addPostToStory(post) {
  const createdAt = Date.now();
  stories.push({
    id: `story-${account.username}-${createdAt}`,
    username: account.username,
    name: "Your Story",
    avatar: account.avatar || "avatar-me",
    avatarImage: account.avatar,
    image: post.image,
    mediaType: mediaTypeOf(post),
    caption: `From @${post.author}: ${post.caption}`.slice(0, 80),
    createdAt,
    expiresAt: createdAt + 24 * 60 * 60 * 1000
  });
  showToast("Added to your story.");
}

function togglePostAction(postId, action) {
  const post = findPost(postId);
  if (!post) return;
  const state = postState(post);

  if (action === "like") {
    state.liked = !state.liked;
    if (state.liked) {
      notifyUser(post.author, {
        type: "like",
        postId: post.id,
        text: `liked your ${mediaTypeOf(post) === "video" ? "reel" : "post"}.`
      });
    }
  }
  if (action === "save") state.saved = !state.saved;
  if (action === "repost") {
    state.reposted = !state.reposted;
    showToast(state.reposted ? "Reposted to your profile." : "Repost removed.");
  }
  if (action === "story") {
    addPostToStory(post);
  }
  if (action === "share") {
    state.shares = (state.shares || 0) + 1;
    showToast("Share link copied.");
    navigator.clipboard?.writeText(`REDX post by ${post.author}`).catch(() => {});
  }
  persist();
}

function commentOnPost(postId, text) {
  const post = findPost(postId);
  if (!post || !text.trim()) return;
  const cleanText = text.trim().slice(0, 160);
  postState(post).extraComments.push({ by: account.username, text: cleanText });
  notifyUser(post.author, {
    type: "comment",
    postId: post.id,
    text: `commented on your ${mediaTypeOf(post) === "video" ? "reel" : "post"}: "${cleanText}"`
  });
  persist();
}

function imageFileToDataUrl(file, maxSide = 1200, quality = 0.84) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith("image/")) {
      reject(new Error("Please choose an image file."));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read the image."));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error("This image type is not supported in the browser."));
      image.onload = () => {
        const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
        const width = Math.max(1, Math.round(image.width * scale));
        const height = Math.max(1, Math.round(image.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext("2d");
        context.drawImage(image, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read the file."));
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });
}

async function mediaFileToData(file, imageMaxSide = 1280) {
  if (!file) {
    throw new Error("Choose a photo or video first.");
  }

  if (file.type.startsWith("image/")) {
    return {
      src: await imageFileToDataUrl(file, imageMaxSide, 0.84),
      type: "image"
    };
  }

  if (file.type.startsWith("video/")) {
    const maxVideoBytes = 8 * 1024 * 1024;
    if (file.size > maxVideoBytes) {
      throw new Error("For local REDX, choose a video under 8 MB.");
    }
    return {
      src: await fileToDataUrl(file),
      type: "video"
    };
  }

  throw new Error("Choose an image or video file.");
}

document.addEventListener("click", (event) => {
  const viewButton = event.target.closest("[data-view]");
  const createButton = event.target.closest(".create-trigger");
  const createOption = event.target.closest("[data-create-option]");
  const accountButton = event.target.closest(".account-trigger");
  const settingsButton = event.target.closest(".settings-trigger");
  const actionButton = event.target.closest("[data-action]");
  const reelAction = event.target.closest("[data-reel-action]");
  const tagButton = event.target.closest("[data-tag]");
  const filterTag = event.target.closest("[data-filter-tag]");
  const profileButton = event.target.closest("[data-profile-tab]");
  const openPost = event.target.closest("[data-open-post]");
  const followButton = event.target.closest("[data-follow]");
  const threadButton = event.target.closest("[data-thread]");
  const messageUserButton = event.target.closest("[data-message-user]");
  const newMessageButton = event.target.closest("[data-new-message]");
  const archiveButton = event.target.closest("[data-view-archive]");
  const addStoryButton = event.target.closest("[data-add-story]");
  const storyButton = event.target.closest("[data-story]");
  const liveSessionButton = event.target.closest("[data-live-session]");
  const profileUserButton = event.target.closest("[data-profile-user]");

  if (createOption) {
    const option = createOption.dataset.createOption;
    if (createMenu) createMenu.hidden = true;
    if (option === "post") {
      openCreateDialog();
    } else if (option === "live") {
      openLiveDialog();
    } else if (option === "ad") {
      showToast("Ad creation needs payments and campaign setup.");
    }
    return;
  }

  if (createButton) {
    toggleCreateMenu(createButton);
    return;
  }

  if (createMenu && !createMenu.hidden && !event.target.closest("#createMenu")) {
    createMenu.hidden = true;
  }

  if (newMessageButton) {
    setView("search");
    requestAnimationFrame(() => searchInput?.focus());
    return;
  }

  if (archiveButton) {
    showToast("Archive is ready for hidden posts and old stories.");
    return;
  }

  if (addStoryButton) {
    openStoryDialog();
    return;
  }

  if (storyButton) {
    openStoryViewer(storyButton.dataset.story);
    return;
  }

  if (liveSessionButton) {
    openLiveSession(liveSessionButton.dataset.liveSession);
    return;
  }

  if (profileUserButton) {
    openProfileDialog(profileUserButton.dataset.profileUser);
    return;
  }

  if (accountButton) {
    openAccountDialog();
    return;
  }

  if (settingsButton) {
    openSettingsDialog();
    return;
  }

  if (followButton) {
    const username = followButton.dataset.follow;
    toggleFollow(username);
    if (profileDialog.open && username) {
      renderProfileDialog(username);
    }
    return;
  }

  if (messageUserButton) {
    openMessageThread(messageUserButton.dataset.messageUser);
    return;
  }

  if (threadButton) {
    selectedThreadId = threadButton.dataset.thread;
    const threads = threadStore();
    if (threads[selectedThreadId]) {
      threads[selectedThreadId].unread = false;
    }
    persist();
    renderMessages();
    return;
  }

  if (viewButton && viewButton.dataset.view) {
    setView(viewButton.dataset.view);
  }

  if (actionButton) {
    const postEl = findPostElement(actionButton);
    if (!postEl) return;
    const postId = postEl.dataset.postId;
    const action = actionButton.dataset.action;

    if (action === "focus-comment") {
      postEl.querySelector("input[name='comment']")?.focus();
      return;
    }

    togglePostAction(postId, action);
    if (action === "like") {
      postEl.classList.remove("burst");
      void postEl.offsetWidth;
      postEl.classList.add("burst");
    }
    renderAll();
  }

  if (reelAction) {
    const postEl = findPostElement(reelAction);
    if (!postEl) return;
    const postId = postEl.dataset.postId;
    const action = reelAction.dataset.reelAction;

    if (action === "comment") {
      const text = prompt("Comment on this reel");
      if (text) commentOnPost(postId, text);
    } else {
      togglePostAction(postId, action);
    }
    renderAll();
  }

  if (tagButton) {
    activeTag = tagButton.dataset.tag;
    searchInput.value = "";
    renderExplore();
    setView("search");
  }

  if (filterTag) {
    activeTag = activeTag === filterTag.dataset.filterTag ? "" : filterTag.dataset.filterTag;
    renderExplore();
  }

  if (profileButton) {
    profileTab = profileButton.dataset.profileTab;
    document.querySelectorAll("[data-profile-tab]").forEach((button) => {
      button.classList.toggle("active", button.dataset.profileTab === profileTab);
    });
    renderProfile();
  }

  if (openPost) {
    closeDialog(profileDialog);
    setView("feed");
    requestAnimationFrame(() => {
      document.querySelector(`[data-post-id="${openPost.dataset.openPost}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }
});

feedEl.addEventListener("submit", (event) => {
  const form = event.target.closest("[data-comment-form]");
  if (!form) return;
  event.preventDefault();

  const postEl = findPostElement(form);
  const input = form.elements.comment;
  commentOnPost(postEl.dataset.postId, input.value);
  input.value = "";
  renderAll();
});

searchInput.addEventListener("input", () => {
  activeTag = "";
  renderExplore();
});

messageForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const text = messageInput.value.trim();
  if (!text || !selectedThreadId) return;

  const threads = threadStore();
  const thread = threads[selectedThreadId];
  if (!thread) return;

  thread.messages.push({
    from: account.username,
    text: text.slice(0, 220),
    time: "now"
  });
  messageInput.value = "";
  persist();
  renderMessages();
});

messageSearchInput?.addEventListener("input", renderMessages);

photoInput.addEventListener("change", async () => {
  const file = photoInput.files?.[0];
  if (!file) return;
  photoStatus.textContent = "Preparing media...";
  try {
    const media = await mediaFileToData(file, 1280);
    selectedUploadData = media.src;
    selectedUploadType = media.type;
    renderAssetPicker();
    showToast(`${media.type === "video" ? "Video" : "Photo"} selected.`);
  } catch (error) {
    photoStatus.textContent = "Choose from your device";
    showToast(error.message);
  }
});

storyInput.addEventListener("change", async () => {
  const file = storyInput.files?.[0];
  if (!file) return;
  storyStatus.textContent = "Preparing story...";
  try {
    const media = await mediaFileToData(file, 1280);
    selectedStoryData = media.src;
    selectedStoryType = media.type;
    renderPreview(storyPreview, selectedStoryData, selectedStoryType);
    storyStatus.textContent = `${media.type === "video" ? "Story video" : "Story photo"} ready`;
    showToast(`${media.type === "video" ? "Story video" : "Story photo"} selected.`);
  } catch (error) {
    storyStatus.textContent = "Choose a photo or video for 24 hours";
    showToast(error.message);
  }
});

avatarInput.addEventListener("change", async () => {
  const file = avatarInput.files?.[0];
  if (!file) return;
  avatarStatus.textContent = "Preparing profile photo...";
  try {
    pendingAvatar = await imageFileToDataUrl(file, 420, 0.82);
    applyAvatarToElement(avatarPreview, pendingAvatar);
    avatarStatus.textContent = "Profile photo ready";
  } catch (error) {
    avatarStatus.textContent = "Choose a real picture";
    showToast(error.message);
  }
});

createForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!selectedUploadData) {
    showToast("Choose a real photo or video first.");
    return;
  }
  const caption = captionInput.value.trim() || "New REDX moment.";
  const image = selectedUploadData;
  const mediaType = selectedUploadType;
  const id = `user-${Date.now()}`;
  userPosts.unshift({
    id,
    author: account.username,
    handle: "you",
    avatar: "avatar-me",
    avatarImage: account.avatar,
    location: settings.privateAccount ? "Private account" : "REDX",
    image,
    mediaType,
    caption,
    tags: ["#redx", "#fresh", "#creator"],
    likes: 0,
    comments: [],
    time: "now",
    source: "upload"
  });
  captionInput.value = "";
  selectedUploadData = "";
  selectedUploadType = "image";
  photoInput.value = "";
  persist();
  closeDialog(createDialog);
  renderAll();
  setView("feed");
  showToast("Posted to REDX.");
});

storyForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!selectedStoryData) {
    showToast("Choose a story photo first.");
    return;
  }

  const createdAt = Date.now();
  stories.push({
    id: `story-${account.username}-${createdAt}`,
    username: account.username,
    name: "Your Story",
    avatar: account.avatar || "avatar-me",
    avatarImage: account.avatar,
    image: selectedStoryData,
    mediaType: selectedStoryType,
    caption: storyCaptionInput.value.trim().slice(0, 80),
    createdAt,
    expiresAt: createdAt + 24 * 60 * 60 * 1000
  });

  selectedStoryData = "";
  selectedStoryType = "image";
  storyInput.value = "";
  storyCaptionInput.value = "";
  persist();
  closeDialog(storyDialog);
  renderAll();
  showToast("Story shared for 24 hours.");
});

accountForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const nextUsername = cleanUsername(usernameInput.value);
  const oldUsername = account.username;

  if (nextUsername !== oldUsername && users.some((user) => user.username === nextUsername)) {
    showToast("That username is already taken.");
    return;
  }

  account = {
    username: nextUsername,
    name: nameInput.value.trim().slice(0, 32) || nextUsername,
    bio: bioInput.value.trim().slice(0, 120) || defaults.account.bio,
    avatar: pendingAvatar,
    followers: listValue(account.followers),
    following: listValue(account.following)
  };

  if (nextUsername !== oldUsername) {
    users.forEach((user) => {
      user.followers = listValue(user.followers).map((name) => name === oldUsername ? nextUsername : name);
      user.following = listValue(user.following).map((name) => name === oldUsername ? nextUsername : name);
    });
    stories = stories.map((story) => story.username === oldUsername ? {
      ...story,
      username: nextUsername,
      avatar: account.avatar || "avatar-me",
      avatarImage: account.avatar
    } : story);
    if (messages[oldUsername] && !messages[nextUsername]) {
      messages[nextUsername] = messages[oldUsername];
      delete messages[oldUsername];
    }
  }

  userPosts = userPosts.map((post) => post.author === oldUsername ? {
    ...post,
    author: account.username,
    avatarImage: account.avatar,
    location: settings.privateAccount ? "Private account" : "REDX"
  } : post);

  persist();
  closeDialog(accountDialog);
  renderAll();
  showToast("Account saved.");
});

settingsForm.addEventListener("submit", (event) => {
  event.preventDefault();
  settings = {
    privateAccount: privateInput.checked,
    activityStatus: activityInput.checked,
    notifications: notificationsInput.checked,
    hideLikes: hideLikesInput.checked,
    darkMode: darkModeInput.checked,
    blocked: blockedInput.value.trim(),
    muted: mutedInput.value.trim()
  };
  persist();
  closeDialog(settingsDialog);
  renderAll();
  showToast("Settings saved.");
});

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const user = findUser(loginId.value);
  if (!user) {
    showToast("Incorrect username or password.");
    return;
  }

  if (!user.password && user.provider === "google") {
    showToast("Use Google sign-in for this account.");
    return;
  }

  if (user.password !== loginPassword.value) {
    showToast("Incorrect username or password.");
    return;
  }

  if (authConfig.requireSmsOtp && toSmsPhone(user.phone || user.email)) {
    const sent = await startOtpLogin(user);
    if (sent) loginPassword.value = "";
    return;
  }

  loginPassword.value = "";
  completeAuth(user, `Welcome back, ${user.username}.`);
});

otpForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!pendingOtp) {
    showToast("Start again to get a new code.");
    setAuthMode("login");
    return;
  }

  if (Date.now() > pendingOtp.expiresAt) {
    const expiredMode = otpReturnMode();
    pendingOtp = null;
    showToast("That code expired. Request a new one.");
    setAuthMode(expiredMode);
    return;
  }

  let verified = false;
  try {
    verified = await verifyOtpWithBackend();
  } catch (error) {
    showToast(error.message);
    return;
  }

  if (!verified) {
    showToast("Incorrect security code.");
    return;
  }

  if (pendingOtp.type === "signup") {
    const draft = pendingOtp.userDraft;
    if (!draft) {
      pendingOtp = null;
      showToast("Sign up details expired. Try again.");
      setAuthMode("signup");
      return;
    }

    if (users.some((user) => user.username === draft.username)) {
      pendingOtp = null;
      showToast("That username is already taken.");
      setAuthMode("signup");
      return;
    }

    if (users.some((user) => toSmsPhone(user.phone || user.email) === toSmsPhone(draft.phone || draft.email))) {
      pendingOtp = null;
      showToast("That phone number already has an account.");
      setAuthMode("signup");
      return;
    }

    users.push(draft);
    signupForm.reset();
    completeAuth(draft, `Account verified for ${draft.username}.`);
    return;
  }

  if (pendingOtp.type === "reset") {
    const user = users.find((item) => item.username === pendingOtp.username);
    if (!user || !pendingOtp.newPassword) {
      pendingOtp = null;
      showToast("Reset details expired. Try again.");
      setAuthMode("reset");
      return;
    }

    user.password = pendingOtp.newPassword;
    resetForm.reset();
    completeAuth(user, `Password reset for ${user.username}.`);
    return;
  }

  const user = users.find((item) => item.username === pendingOtp.username);
  if (!user) {
    pendingOtp = null;
    showToast("Account not found.");
    setAuthMode("login");
    return;
  }

  completeAuth(user, `Welcome back, ${user.username}.`);
});

signupForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const username = cleanUsername(signupUsername.value);
  const contact = cleanContact(signupEmail.value);
  const phone = toSmsPhone(contact);
  const email = isEmailContact(contact) ? contact : "";

  if (!phone && !email) {
    showToast("Enter a valid email or mobile number.");
    return;
  }

  if (users.some((user) => user.username === username)) {
    showToast("That username is already taken.");
    return;
  }

  if (phone && users.some((user) => toSmsPhone(user.phone || user.email) === phone)) {
    showToast("That phone number already has an account.");
    return;
  }

  if (email && users.some((user) => cleanContact(user.email) === email)) {
    showToast("That email already has an account.");
    return;
  }

  const user = {
    username,
    name: signupName.value.trim().slice(0, 32) || username,
    bio: defaults.account.bio,
    avatar: "",
    followers: [],
    following: [],
    phone,
    email: email || phone,
    password: signupPassword.value,
    provider: "password",
    settings: { ...defaults.settings }
  };

  if (authConfig.requireSmsOtp) {
    if (!phone) {
      showToast("SMS OTP is enabled. Sign up with a mobile number.");
      return;
    }
    await startOtpSignup(user);
    return;
  }

  users.push(user);
  signupForm.reset();
  completeAuth(user, `Account created for ${user.username}.`);
});

resetForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const user = findUser(resetContact.value);
  const nextPassword = resetPassword.value;

  if (!user) {
    showToast("No REDX account found for that username, email, or phone.");
    return;
  }

  if (!user.password && user.provider === "google") {
    showToast("Use Google sign-in for this account.");
    return;
  }

  if (nextPassword.length < 4) {
    showToast("Use at least 4 characters for the new password.");
    return;
  }

  if (nextPassword !== resetPasswordConfirm.value) {
    showToast("New passwords do not match.");
    return;
  }

  if (authConfig.requireSmsOtp) {
    if (!toSmsPhone(user.phone || user.email)) {
      showToast("This account does not have a phone number for SMS reset.");
      return;
    }
    await startOtpReset(user, nextPassword);
    return;
  }

  user.password = nextPassword;
  resetForm.reset();
  completeAuth(user, `Password reset for ${user.username}.`);
});

authModeButton.addEventListener("click", () => {
  setAuthMode(authMode === "login" ? "signup" : "login");
  updateSignupUsernameStatus();
});

authBack.addEventListener("click", () => {
  if (authMode !== "login") {
    const returnMode = authMode === "otp" ? otpReturnMode() : "login";
    pendingOtp = null;
    setAuthMode(returnMode);
  }
});

forgotPassword.addEventListener("click", () => {
  resetContact.value = loginId.value.trim();
  resetPassword.value = "";
  resetPasswordConfirm.value = "";
  setAuthMode("reset");
  resetContact.focus();
});

signupUsername.addEventListener("input", updateSignupUsernameStatus);

cancelOtp.addEventListener("click", () => {
  const returnMode = otpReturnMode();
  pendingOtp = null;
  setAuthMode(returnMode);
});

resendOtp.addEventListener("click", async () => {
  if (!pendingOtp) {
    showToast("Start again to request a new code.");
    setAuthMode("login");
    return;
  }

  if (pendingOtp.type === "signup") {
    if (!pendingOtp.userDraft) {
      pendingOtp = null;
      showToast("Sign up details expired. Try again.");
      setAuthMode("signup");
      return;
    }
    await startOtpSignup(pendingOtp.userDraft);
  } else if (pendingOtp.type === "reset") {
    const user = users.find((item) => item.username === pendingOtp.username);
    if (!user || !pendingOtp.newPassword) {
      pendingOtp = null;
      showToast("Reset details expired. Try again.");
      setAuthMode("reset");
      return;
    }
    await startOtpReset(user, pendingOtp.newPassword);
  } else {
    const user = users.find((item) => item.username === pendingOtp.username);
    if (!user) {
      pendingOtp = null;
      showToast("Account not found.");
      setAuthMode("login");
      return;
    }
    await startOtpLogin(user);
  }
});

logoutButton.addEventListener("click", () => {
  if (currentLiveId) {
    endLiveSession();
    stopLiveCamera();
  }
  syncActiveUser();
  activeUsername = "";
  account = { ...defaults.account };
  settings = { ...defaults.settings };
  persist();
  closeDialog(settingsDialog);
  renderAuthState();
  renderAll();
  setAuthMode("login");
  showToast("Logged out.");
});

document.querySelector("#closeDialog").addEventListener("click", () => closeDialog(createDialog));
document.querySelector("#closeLiveDialog").addEventListener("click", () => closeDialog(liveDialog));
document.querySelector("#closeLiveWatchDialog").addEventListener("click", closeLiveWatch);
document.querySelector("#closeStoryDialog").addEventListener("click", () => closeDialog(storyDialog));
document.querySelector("#closeStoryViewer").addEventListener("click", () => closeDialog(storyViewer));
document.querySelector("#closeProfileDialog").addEventListener("click", () => closeDialog(profileDialog));
document.querySelector("#closeAccountDialog").addEventListener("click", () => closeDialog(accountDialog));
document.querySelector("#closeSettingsDialog").addEventListener("click", () => closeDialog(settingsDialog));
startLiveButton.addEventListener("click", async () => {
  const ready = await prepareLiveCamera();
  if (ready) await startLiveSession();
});
endLiveButton.addEventListener("click", endLiveSession);
liveDialog.addEventListener("close", () => {
  if (!currentLiveId) stopLiveCamera();
});
liveWatchDialog.addEventListener("close", () => {
  if (watchingLiveId) {
    sendLiveSignal({ type: "leave-live", liveId: watchingLiveId });
    watchingLiveId = "";
    closeViewerPeer();
  }
});
window.addEventListener("beforeunload", () => {
  if (currentLiveId) {
    sendLiveSignal({ type: "end-live", liveId: currentLiveId });
  }
  if (watchingLiveId) {
    sendLiveSignal({ type: "leave-live", liveId: watchingLiveId });
  }
});
document.querySelector("#resetDemo").addEventListener("click", async () => {
  localStorage.removeItem(storeKey);
  try {
    await apiPost("/api/state/reset", {});
  } catch (error) {
    showToast("Could not reset the database, but browser data was cleared.");
  }
  location.reload();
});

async function bootRedx() {
  await Promise.all([loadDatabaseState(), loadRtcConfig(), loadAuthConfig()]);
  renderAuthState();
  renderAll();
  setInterval(refreshLiveSessionsFromDatabase, 7000);
}

bootRedx();
