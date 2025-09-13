// Simple localStorage replacement for Node.js environment
const localStorage = {
  data: {},
  getItem: function(key) {
    return this.data[key] || null;
  },
  setItem: function(key, value) {
    this.data[key] = value;
  },
  removeItem: function(key) {
    delete this.data[key];
  }
};

// Remove Electron detection and IPC
const isElectron = false;
let ipcRenderer = null;

function updatePortUIState() {
  if (!executorSelect) return;
  const isHydro = executorSelect.value === "Hydrogen";
  if (portSelect) {
    portSelect.disabled = isHydro;
    portSelect.classList.toggle("disabled", !!isHydro);
    try {
      portSelect.setAttribute("aria-hidden", isHydro ? "true" : "false");
    } catch (e) {}
  }
  if (portDropdownToggle) {
    portDropdownToggle.classList.toggle("disabled", !!isHydro);
    try {
      portDropdownToggle.disabled = !!isHydro;
    } catch (e) {}
    try {
      portDropdownToggle.setAttribute(
        "aria-disabled",
        !!isHydro ? "true" : "false",
      );
    } catch (e) {}
  }
  if (portDropdown) {
    try {
      portDropdown.classList.toggle("disabled", !!isHydro);
    } catch (e) {}
  }
}

const tabs = document.getElementById("tabs");
const editorContainer = document.getElementById("editor-container");
const scriptsList = document.getElementById("scripts");
const searchBox = document.getElementById("searchBox");
const sidebar = document.getElementById("sidebar");
const toast = document.getElementById("toast");
const contextMenu = document.getElementById("contextMenu");
const renameScriptBtn = document.getElementById("renameScript");
const deleteScriptBtn = document.getElementById("deleteScript");
const autoExecuteScriptBtn = document.getElementById("autoExecuteScript");
const autoExecuteCheckbox = document.getElementById("autoExecuteCheckbox");

// Remove Node.js requires that won't work in browser
const fs = null;
const spawn = null;
const path = null;
const net = null;
const clipboard = null;

const consoleOutput = document.getElementById("consoleOutput");
const clearConsoleBtn = document.getElementById("clearConsole");
const settingsButton = document.getElementById("settings-button");
const settingsPane = document.getElementById("settingsPane");
const glowModeSelect = document.getElementById("glowMode");
const resetColorBtn = document.getElementById("resetColor");

// Mock scripts directory for browser environment
const scriptsDirectory = "tritium-scripts";

const toggleConsole = document.getElementById("toggleConsole");
const consoleContainer = document.querySelector(".console-container");
const toggleSidebar = document.getElementById("sidebar-toggle-btn");
const promptInput = document.getElementById("promptInput");
const generateBtn = document.getElementById("generateBtn");
const cancelBtn = document.getElementById("cancelBtn");
const msUpdateBtn = document.getElementById("updateMacSploit");
const workspacesList = document.getElementById("workspaces-list");
const workspaceSidebar = document.getElementById("workspace-sidebar");
const workspaceToggleBtn = document.getElementById("workspace-toggle-btn");
const newWorkspaceBtn = document.getElementById("new-workspace-btn");
const clearWorkspaceBtn = document.getElementById("clear-workspace-btn");
const vibrancyToggle = document.getElementById("vibrancyToggle");
const vibrancyOpacityInput = document.getElementById("vibrancyOpacity");
const vibrancyOpacityValue = document.getElementById("vibrancyOpacityValue");
const vibrancyOpacityGroup = document.getElementById("vibrancyOpacityGroup");
const scriptHubSelect = document.getElementById("scriptHub");
const executorSelect = document.getElementById("executorSelect");
const discordBtn = document.getElementById("discord-button");
const discordDialog = document.getElementById("discordDialog");
const joinDiscordBtn = document.getElementById("joinDiscord");
const skipDiscordBtn = document.getElementById("skipDiscord");

const portSelect = document.getElementById("portSelect");
const portStatusDot = document.getElementById("portStatusDot");
const portDropdown = document.getElementById("portDropdown");
const portDropdownToggle = document.getElementById("portDropdownToggle");
const portDropdownMenu = document.getElementById("portDropdownMenu");
const portDropdownLabel = document.getElementById("portDropdownLabel");
let PORT_START = 5553;
let PORT_END = 5563;
let selectedPort = null;
let lastPortStatus = null;
let portPingCooldown = 0;
let lastAllPortsPingTime = 0;

function initPortSelector() {
  if (!portSelect) return;

  portSelect.innerHTML = "";
  for (let p = PORT_START; p <= PORT_END; p++) {
    const opt = document.createElement("option");
    opt.value = p;
    opt.textContent = p;
    portSelect.appendChild(opt);
  }
  const saved = getLocalStorage("selectedPort", PORT_START);
  if (saved >= PORT_START && saved <= PORT_END) {
    portSelect.value = saved;
    selectedPort = saved;
  } else {
    selectedPort = PORT_START;
    portSelect.value = PORT_START;
  }
  updatePortStatusVisual("offline");
  portSelect.addEventListener("change", () => {
    selectedPort = parseInt(portSelect.value, 10);
    setLocalStorage("selectedPort", selectedPort);
    portPingCooldown = 0;
    queuePortStatusCheck(true);
  });
  setTimeout(() => queuePortStatusCheck(true), 1200);
  buildCustomDropdown();
}

function setPortRange(start, end) {
  PORT_START = start;
  PORT_END = end;

  const saved = getLocalStorage("selectedPort", PORT_START);
  if (saved < PORT_START || saved > PORT_END) {
    setLocalStorage("selectedPort", PORT_START);
  }
  initPortSelector();
  queuePortStatusCheck(true);
}

function updatePortStatusVisual(state) {
  if (!portStatusDot) return;
  if (lastPortStatus === state) return;
  portStatusDot.classList.remove("online", "offline");
  if (state === "online") portStatusDot.classList.add("online");
  else if (state === "offline") portStatusDot.classList.add("offline");
  lastPortStatus = state;
}

function buildCustomDropdown() {
  if (!portDropdownMenu) return;
  portDropdownMenu.innerHTML = "";
  for (let p = PORT_START; p <= PORT_END; p++) {
    const item = document.createElement("div");
    item.className = "port-option";
    item.setAttribute("role", "option");
    item.setAttribute("data-port", p);
    item.setAttribute("aria-selected", p === selectedPort ? "true" : "false");
    item.innerHTML = `<span>${p}</span><span class="port-option-status" id="port-status-${p}"></span>`;
    item.addEventListener("click", () => {
      if (selectedPort !== p) {
        selectedPort = p;
        portSelect.value = p;
        setLocalStorage("selectedPort", selectedPort);
        portDropdownLabel.textContent = p;
        Array.from(portDropdownMenu.children).forEach((c) =>
          c.setAttribute("aria-selected", c === item ? "true" : "false"),
        );
        portPingCooldown = 0;
        queuePortStatusCheck(true);
      }
      closeDropdown();
    });
    portDropdownMenu.appendChild(item);
  }
  portDropdownLabel.textContent = selectedPort;
}

function openDropdown() {
  if (!portDropdown) return;
  portDropdown.classList.add("open");
  if (portDropdownToggle)
    portDropdownToggle.setAttribute("aria-expanded", "true");

  if (portDropdownMenu) {
    if (portDropdownMenu.parentElement !== portDropdown) {
      portDropdown.appendChild(portDropdownMenu);
    }

    portDropdownMenu.style.visibility = "hidden";
    portDropdownMenu.style.display = "block";
    portDropdownMenu.style.position = "fixed";
    const rectToggle = portDropdownToggle.getBoundingClientRect();

    const menuWidth = portDropdownMenu.offsetWidth || 120;
    let left = rectToggle.right - menuWidth;
    const margin = 8;
    if (left < margin) left = margin;
    if (left + menuWidth > window.innerWidth - margin) {
      left = window.innerWidth - margin - menuWidth;
    }
    portDropdownMenu.style.left = left + "px";
    portDropdownMenu.style.top = rectToggle.bottom + 4 + "px";
    portDropdownMenu.style.right = "auto";
    portDropdownMenu.style.zIndex = 10000;

    portDropdownMenu.style.visibility = "visible";
  }

  const now = Date.now();
  if (now - lastAllPortsPingTime > 1200) {
    lastAllPortsPingTime = now;
    pingAllPorts();
  }
}

function closeDropdown() {
  if (!portDropdown) return;
  portDropdown.classList.remove("open");
  if (portDropdownToggle)
    portDropdownToggle.setAttribute("aria-expanded", "false");

  if (portDropdownMenu) {
    portDropdownMenu.style.display = "none";
    portDropdownMenu.style.visibility = "hidden";
  }
}

function toggleDropdown() {
  if (portDropdown.classList.contains("open")) closeDropdown();
  else openDropdown();
}

if (portDropdownToggle) {
  portDropdownToggle.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleDropdown();
  });
}

document.addEventListener("click", (e) => {
  const menu = portDropdownMenu;
  const clickInsideToggle =
    portDropdownToggle &&
    (e.target === portDropdownToggle || portDropdownToggle.contains(e.target));
  const clickInsideMenu =
    menu && (e.target === menu || menu.contains(e.target));
  if (!clickInsideToggle && !clickInsideMenu) {
    closeDropdown();
  }
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeDropdown();
});

const portStatusCache = {};

function setPortBadge(port, state) {
  const badge = document.getElementById(`port-status-${port}`);
  if (badge) {
    badge.classList.remove("online", "offline");
    badge.classList.add(state === "online" ? "online" : "offline");
  }
  portStatusCache[port] = state;
  if (port === selectedPort) {
    updatePortStatusVisual(state);
  }

  if (!window.__portLockEvaluateTimer) {
    window.__portLockEvaluateTimer = setTimeout(() => {
      window.__portLockEvaluateTimer = null;
      evaluateConsoleLock();
    }, 120);
  }
}

let consoleLockActive = false;
let consoleLockReason = null;
let lastOnlinePortCount = 0;

function collapseConsole(forceIcon) {
  if (!consoleContainer) return;
  if (!consoleContainer.classList.contains("collapsed")) {
    consoleContainer.classList.add("collapsed");
  }
  consoleExpanded = false;
  if (
    toggleConsole &&
    (forceIcon || toggleConsole.innerHTML.indexOf("chevron-up") === -1)
  ) {
    toggleConsole.innerHTML = '<i class="fa-solid fa-chevron-up"></i>';
  }
}

function expandConsole() {
  if (!consoleContainer) return;
  consoleContainer.classList.remove("collapsed");
  consoleExpanded = true;
  if (toggleConsole) {
    toggleConsole.innerHTML = '<i class="fa-solid fa-chevron-down"></i>';
  }
}

function evaluateConsoleLock() {
  const wasLocked = consoleLockActive;
  let onlineCount = 0;
  for (let p = PORT_START; p <= PORT_END; p++) {
    if (portStatusCache[p] === "online") onlineCount++;
    if (onlineCount > 1) break;
  }

  let newLockActive = false;
  let newReason = null;
  if (onlineCount === 0) {
    newLockActive = true;
    newReason = "zero";
  } else if (onlineCount > 1) {
    newLockActive = true;
    newReason = "multi";
  } else if (consoleOutput && consoleOutput.children.length === 0) {
    newLockActive = true;
    newReason = "empty";
  }

  if (newLockActive) {
    collapseConsole(true);
    if (!consoleLockActive || consoleLockReason !== newReason) {
      consoleLockActive = true;
      consoleLockReason = newReason;
      if (toggleConsole) {
        toggleConsole.classList.add("locked");
        toggleConsole.title =
          newReason === "multi"
            ? "Multiple Roblox instances detected (console locked)"
            : newReason === "zero"
              ? "No Roblox instance detected (console locked)"
              : "Console empty (locked until output appears)";
      }
    }
  } else {
    if (consoleLockActive) {
      consoleLockActive = false;
      consoleLockReason = null;
      if (toggleConsole) {
        toggleConsole.classList.remove("locked");
        toggleConsole.title = "Toggle Console";
      }
    }

    if (wasLocked && !newLockActive) {
      expandConsole();
    } else if (lastOnlinePortCount === 0 && onlineCount === 1) {
      expandConsole();
    }
  }

  lastOnlinePortCount = onlineCount;
}

// Mock port ping functions for browser environment
function pingPort(port, onDone) {
  // Simulate port checking in browser environment
  setTimeout(() => {
    setPortBadge(port, "offline");
    if (onDone) onDone();
  }, 100);
}

function pingAllPorts() {
  for (let p = PORT_START; p <= PORT_END; p++) {
    const badge = document.getElementById(`port-status-${p}`);
    if (badge) {
      badge.classList.remove("online", "offline");
    }
  }

  for (let p = PORT_START; p <= PORT_END; p++) {
    pingPort(p);
  }
}

function pingAllExecutors() {
  const msStart = 5553,
    msEnd = 5563;
  const opStart = 8392,
    opEnd = 8397;
  const hydroStart = 6969,
    hydroEnd = 6969;

  for (let p = msStart; p <= msEnd; p++) {
    const b = document.getElementById(`port-status-${p}`);
    if (b) b.classList.remove("online", "offline");
  }
  for (let p = opStart; p <= opEnd; p++) {
    const b = document.getElementById(`port-status-${p}`);
    if (b) b.classList.remove("online", "offline");
  }

  for (let p = msStart; p <= msEnd; p++) pingPort(p);
  for (let p = opStart; p <= opEnd; p++) pingPort(p);
  for (let p = hydroStart; p <= hydroEnd; p++) pingPort(p);

  setTimeout(() => {
    checkSingleOnlineAcrossExecutors(msStart, msEnd, opStart, opEnd);
  }, 1000);
}

function checkSingleOnlineAcrossExecutors(msStart, msEnd, opStart, opEnd) {
  const online = [];
  for (let p = msStart; p <= msEnd; p++) {
    if (portStatusCache[p] === "online") online.push(p);
  }
  for (let p = opStart; p <= opEnd; p++) {
    if (portStatusCache[p] === "online") online.push(p);
  }
  const hydroStart = 6969, hydroEnd = 6969;
  for (let p = hydroStart; p <= hydroEnd; p++) {
    if (portStatusCache[p] === "online") online.push(p);
  }

  if (online.length === 1) {
    const port = online[0];
    const isOpium = port >= opStart && port <= opEnd;
    const isHydro = port >= hydroStart && port <= hydroEnd;

    if (executorSelect) {
      const desiredExec = isOpium
        ? "Opiumware"
        : isHydro
          ? "Hydrogen"
          : "MacSploit";
      if (executorSelect.value !== desiredExec) {
        executorSelect.value = desiredExec;
        try {
          localStorage.setItem("executorType", desiredExec);
        } catch (e) {}
        try {
          updatePortUIState();
        } catch (e) {}
      }
    }

    if (isOpium) setPortRange(opStart, opEnd);
    else setPortRange(msStart, msEnd);

    try {
      updatePortUIState();
    } catch (e) {}

    if (selectedPort !== port) {
      selectedPort = port;
      if (portSelect) portSelect.value = port;
      try {
        setLocalStorage("selectedPort", port);
      } catch (e) {}
      if (portDropdownLabel) portDropdownLabel.textContent = port;
    }
  }
}

function queuePortStatusCheck(force = false) {
  // Mock implementation for browser
  const now = Date.now();
  if (!force && now - lastAllPortsPingTime < 2500) return;
  lastAllPortsPingTime = now;
  if (force) pingAllExecutors();
  else pingAllPorts();
}

setInterval(() => {
  queuePortStatusCheck();
}, 5000);

let editors = {};
let savedScripts = [];
let currentTab = null;
let currentContextScript = null;
let updatedLoaded = false;
let updating = false;
let currentSearchId = 0;
let updatedScripts = [];
let consoleExpanded = true;
let sidebarOpen = false;
let workspaces = [];
let currentWorkspace = "default";
let workspaceSidebarOpen = true;

clearWorkspaceBtn.addEventListener("click", () => {
  if (confirm("Are you sure you want to delete all workspaces?")) {
    workspaces = [];
    setLocalStorage("workspaces", workspaces);
    loadWorkspaces();
    showToast("All workspaces deleted");
    if (sidebar.classList.contains("open")) {
      renderSidebar();
    }
  }
});

msUpdateBtn.addEventListener("click", async () => {
  showToast("MacSploit update not available in browser mode", true);
});

discordBtn.addEventListener("click", () => {
  openDiscordLink();
});

joinDiscordBtn.addEventListener("click", () => {
  openDiscordLink();
  closeDiscordDialog();
  setLocalStorage("discordPromptShown", "true");
});

skipDiscordBtn.addEventListener("click", () => {
  closeDiscordDialog();
  setLocalStorage("discordPromptShown", "true");
});

function openDiscordLink() {
  window.open("https://discord.gg/7Ds6JvpqQK", "_blank");
}

function showDiscordDialog() {
  discordDialog.classList.add("open");
}

function closeDiscordDialog() {
  discordDialog.classList.add("closing");
  setTimeout(() => {
    discordDialog.classList.remove("open", "closing");
  }, 350);
}

function checkFirstTimeUser() {
  const hasShownDiscordPrompt = getLocalStorage("discordPromptShown", "false");
  if (hasShownDiscordPrompt === "false") {
    setTimeout(() => {
      showDiscordDialog();
    }, 1000);
  }
}

toggleConsole.addEventListener("click", function () {
  if (consoleLockActive) {
    let msg;
    switch (consoleLockReason) {
      case "multi":
        msg = "Multiple ports online; console locked until only one is active";
        break;
      case "zero":
        msg = "No ports online; console locked until Roblox is detected";
        break;
      case "empty":
        msg = "Console empty; will unlock automatically when output appears";
        break;
      default:
        msg = "Console locked";
    }
    showToast(msg, true);
    return;
  }
  if (!consoleExpanded) {
    consoleContainer.classList.remove("collapsed");
    toggleConsole.style.transition = "transform 0.3s ease";
    toggleConsole.style.transform = "rotate(360deg)";
    toggleConsole.innerHTML = '<i class="fa-solid fa-chevron-down"></i>';
  } else {
    consoleContainer.classList.remove("collapsed");
    toggleConsole.style.transition = "transform 0.3s ease";
    toggleConsole.style.transform = "rotate(-360deg)";
    consoleContainer.classList.add("collapsed");
    toggleConsole.innerHTML = '<i class="fa-solid fa-chevron-up"></i>';
  }
  consoleExpanded = !consoleExpanded;
});

toggleConsole.innerHTML = '<i class="fa-solid fa-chevron-down"></i>';

toggleSidebar.addEventListener("click", () => {
  renderSidebar();
  if (sidebarOpen) {
    toggleSidebar.style.transition = "transform 0.3s ease";
    toggleSidebar.style.transform = "rotate(360deg)";
    sidebar.classList.remove("open");
    sidebarOpen = false;
    try {
      localStorage.setItem("sidebarOpen", "false");
    } catch (_) {}
  } else {
    toggleSidebar.style.transition = "transform 0.3s ease";
    toggleSidebar.style.transform = "rotate(-360deg)";
    sidebar.classList.add("open");
    sidebarOpen = true;
    try {
      localStorage.setItem("sidebarOpen", "true");
    } catch (_) {}
  }
});

function addLog(message, type = "info") {
  const logElement = document.createElement("div");
  logElement.className = `log-${type} log-entry`;
  logElement.textContent = message;
  consoleOutput.appendChild(logElement);
  setTimeout(() => {
    logElement.classList.add("show");
  }, 10);
  consoleOutput.scrollTop = consoleOutput.scrollHeight;

  if (consoleLockReason === "empty") {
    evaluateConsoleLock();
  }
}

clearConsoleBtn.addEventListener("click", () => {
  consoleOutput.innerHTML = "";
  evaluateConsoleLock();
});

// Mock log watcher for browser environment
function startLogWatcher() {
  console.log("Log watcher not available in browser mode");
}

let toastTimeout = null;
function showToast(message, isError = false) {
  if (toastTimeout) {
    clearTimeout(toastTimeout);
    toastTimeout = null;
  }
  toast.textContent = message;
  toast.className = isError ? "toast error show" : "toast show";
  toastTimeout = setTimeout(() => {
    toast.className = "toast";
    setTimeout(() => {
      toast.textContent = "";
    }, 300);
    toastTimeout = null;
  }, 3000);
}

function createEditor(tabId, content) {
  const editorWrapper = document.createElement("div");
  editorWrapper.className = "editor-wrapper";
  editorWrapper.id = `editor-${tabId}`;
  editorContainer.appendChild(editorWrapper);
  
  const luaGlobals = [
    "and", "break", "do", "else", "elseif", "end", "false", "for", "function", "goto", "if", "in", "local", "nil", "not", "or", "repeat", "return", "then", "true", "until", "while",
    "assert", "collectgarbage", "dofile", "error", "getmetatable", "ipairs", "load", "loadfile", "next", "pairs", "pcall", "print", "rawequal", "rawget", "rawlen", "rawset", "select", "setmetatable", "tonumber", "tostring", "type", "xpcall", "warn",
    "coroutine", "table", "string", "math", "io", "os", "debug", "package", "utf8", "bit32",
    "typeof", "getfenv", "setfenv", "shared", "script", "require", "spawn", "delay", "tick", "time", "UserSettings", "settings", "game", "workspace", "wait",
    "Vector2", "Vector3", "CFrame", "Color3", "UDim2", "BrickColor", "Enum", "Instance", "TweenInfo"
  ];

  const editorAPI = {
    _editor: null,
    getValue: () => content || "-- New script",
    setValue: (v) => { content = v; },
    refresh: () => {},
    focus: () => {},
    setSize: () => {},
  };

  function initMonaco() {
    console.debug("Loading Monaco modules...");

    if (typeof amdRequire !== 'undefined') {
      amdRequire(
        ["vs/editor/editor.main", "vs/basic-languages/lua/lua"],
        function (_, luaBasics) {
          console.debug("Monaco modules loaded");
          try {
            if (!monaco.languages.getLanguages().some((l) => l.id === "lua")) {
              monaco.languages.register({ id: "lua" });
            }

            if (!monaco.languages.getLanguages().some((l) => l.id === "luau")) {
              monaco.languages.register({
                id: "luau",
                aliases: ["Luau", "luau"],
              });
            }

            if (luaBasics && luaBasics.language) {
              monaco.languages.setMonarchTokensProvider("lua", luaBasics.language);
              monaco.languages.setMonarchTokensProvider("luau", luaBasics.language);
            }

            if (luaBasics && luaBasics.conf) {
              monaco.languages.setLanguageConfiguration("lua", luaBasics.conf);
              monaco.languages.setLanguageConfiguration("luau", luaBasics.conf);
            }

            monaco.editor.defineTheme("tritium-dark", {
              base: "vs-dark",
              inherit: true,
              rules: [
                { token: "comment", foreground: "6A9955", fontStyle: "italic" },
                { token: "string", foreground: "CE9178" },
                { token: "number", foreground: "B5CEA8" },
                { token: "keyword", foreground: "C586C0" },
                { token: "operator", foreground: "D4D4D4" },
                { token: "delimiter", foreground: "808080" },
                { token: "variable.predefined", foreground: "9CDCFE" },
              ],
              colors: {
                "editor.background": "#1e1e1e",
                focusBorder: "#00000000",
                contrastBorder: "#00000000",
              },
            });

            const monacoEditor = monaco.editor.create(editorWrapper, {
              value: content || "-- New script",
              language: "luau",
              theme: "tritium-dark",
              automaticLayout: true,
              autoIndent: "full",
              formatOnType: true,
              contextmenu: false,
              lineNumbers: "on",
              tabSize: 2,
              insertSpaces: true,
              wordWrap: "off",
              matchBrackets: "always",
              autoClosingBrackets: "languageDefined",
              fontFamily: 'Fira Code, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
              fontLigatures: true,
              fontSize: 15,
              lineHeight: 22,
              glyphMargin: false,
              lineNumbersMinChars: 3,
              lineDecorationsWidth: 8,
              padding: { top: 12, bottom: 12 },
              cursorStyle: "line",
              cursorSmoothCaretAnimation: true,
              cursorBlinking: "phase",
              cursorSurroundingLines: 15,
              minimap: { enabled: false },
            });

            editorAPI._editor = monacoEditor;
            editorAPI.getValue = () => monacoEditor.getValue();
            editorAPI.setValue = (v) => monacoEditor.setValue(v);
            editorAPI.refresh = () => monacoEditor.layout();
            editorAPI.focus = () => monacoEditor.focus();
            editorAPI.setSize = (w, h) => {
              if (w) editorWrapper.style.width = typeof w === "string" ? w : `${w}px`;
              if (h) editorWrapper.style.height = typeof h === "string" ? h : `${h}px`;
              monacoEditor.layout();
            };

            setTimeout(() => monacoEditor.layout(), 0);
          } catch (err) {
            console.error("Failed to initialize Monaco:", err);
          }
        },
      );
    } else {
      // Fallback to simple textarea if Monaco is not available
      const textarea = document.createElement("textarea");
      textarea.value = content || "-- New script";
      textarea.style.width = "100%";
      textarea.style.height = "100%";
      textarea.style.background = "#1e1e1e";
      textarea.style.color = "#e0e0e0";
      textarea.style.border = "none";
      textarea.style.outline = "none";
      textarea.style.fontFamily = 'Fira Code, monospace';
      textarea.style.fontSize = "15px";
      textarea.style.padding = "12px";
      editorWrapper.appendChild(textarea);

      editorAPI.getValue = () => textarea.value;
      editorAPI.setValue = (v) => { textarea.value = v; };
      editorAPI.focus = () => textarea.focus();
    }

    return editorAPI;
  }

  const api = initMonaco();
  editorWrapper.style.width = "100%";
  editorWrapper.style.height = "100%";
  return api;
}

function setLocalStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.error(`Error saving ${key}:`, err);
  }
}

function getLocalStorage(key, fallback) {
  try {
    const val = localStorage.getItem(key);
    return val ? JSON.parse(val) : fallback;
  } catch (err) {
    console.error(`Error loading ${key}:`, err);
    return fallback;
  }
}

function updateTabDisplayName(tab, newName) {
  let displayName = newName;
  if (newName.length >= 10) displayName = newName.substring(0, 5) + "...";
  tab.dataset.name = displayName;
  tab.querySelector("span").textContent = displayName;
}

function updateScriptNameEverywhere(originalName, newName) {
  const scriptIndex = savedScripts.findIndex((s) => s.title === originalName);
  if (scriptIndex !== -1) {
    savedScripts[scriptIndex].title = newName;
    let autoExecScripts = getLocalStorage("autoExecuteScripts", []);
    const autoExecIndex = autoExecScripts.indexOf(originalName);
    if (autoExecIndex !== -1) {
      autoExecScripts[autoExecIndex] = newName;
      setLocalStorage("autoExecuteScripts", autoExecScripts);
    }
    setLocalStorage("savedScripts", savedScripts);
    showToast(`Script renamed to "${newName}"`);
    Array.from(tabs.children).forEach((tab) => {
      if (tab.dataset.realTabName === originalName) {
        tab.dataset.realTabName = newName;
        updateTabDisplayName(tab, newName);
      }
    });
  }
}

function loadSavedScripts() {
  savedScripts = getLocalStorage("savedScripts", []);
}

function persistSavedScripts() {
  setLocalStorage("savedScripts", savedScripts);
}

function loadAutoExecuteScripts() {
  return getLocalStorage("autoExecuteScripts", []);
}

function saveAutoExecuteScripts(scripts) {
  setLocalStorage("autoExecuteScripts", scripts);
}

function isAutoExecuteScript(scriptName) {
  return loadAutoExecuteScripts().includes(scriptName);
}

function toggleAutoExecuteScript(scriptName) {
  const autoExecScripts = loadAutoExecuteScripts();
  const index = autoExecScripts.indexOf(scriptName);

  if (index === -1) {
    autoExecScripts.push(scriptName);
  } else {
    autoExecScripts.splice(index, 1);
  }

  saveAutoExecuteScripts(autoExecScripts);
  updateAutoExecuteCheckbox(scriptName);
  renderSidebar();
}

function updateAutoExecuteCheckbox(scriptName) {
  autoExecuteCheckbox.style.display = isAutoExecuteScript(scriptName)
    ? "inline"
    : "none";
}

function showContextMenu(e, scriptName) {
  e.preventDefault();
  currentContextScript = scriptName;
  currentContextWorkspace = null;
  contextMenu.innerHTML = "";
  
  const renameOption = document.createElement("div");
  renameOption.className = "context-menu-item";
  renameOption.innerHTML = '<i class="fas fa-edit"></i> Rename';
  renameOption.onclick = () => {
    renameScriptBtn.click();
    contextMenu.classList.remove("open");
  };

  const deleteOption = document.createElement("div");
  deleteOption.className = "context-menu-item";
  deleteOption.innerHTML = '<i class="fas fa-trash"></i> Delete';
  deleteOption.onclick = () => {
    deleteScriptBtn.click();
    contextMenu.classList.remove("open");
  };

  const autoExecuteOption = document.createElement("div");
  autoExecuteOption.className = "context-menu-item";
  autoExecuteOption.innerHTML = '<i class="fas fa-bolt"></i>Auto Execute';
  autoExecuteOption.onclick = () => {
    autoExecuteScriptBtn.click();
    contextMenu.classList.remove("open");
  };

  contextMenu.appendChild(renameOption);
  contextMenu.appendChild(deleteOption);
  contextMenu.appendChild(autoExecuteOption);

  contextMenu.style.left = `${e.pageX}px`;
  contextMenu.style.top = `${e.pageY}px`;
  contextMenu.classList.add("open");
  updateAutoExecuteCheckbox(scriptName);
}

function showWorkspaceContextMenu(e, workspaceId) {
  e.preventDefault();
  currentContextWorkspace = workspaceId;
  currentContextScript = null;
  contextMenu.innerHTML = "";

  const renameOption = document.createElement("div");
  renameOption.className = "context-menu-item";
  renameOption.innerHTML = '<i class="fas fa-edit"></i> Rename';
  renameOption.onclick = () => {
    renameWorkspace(workspaceId);
    contextMenu.classList.remove("open");
  };

  const deleteOption = document.createElement("div");
  deleteOption.className = "context-menu-item";
  deleteOption.innerHTML = '<i class="fas fa-trash"></i> Delete';
  deleteOption.onclick = () => {
    if (workspaces.length > 1) {
      deleteWorkspace(workspaceId);
    } else {
      showToast("Cannot delete the last workspace", true);
    }
    contextMenu.classList.remove("open");
  };

  contextMenu.appendChild(renameOption);
  contextMenu.appendChild(deleteOption);

  contextMenu.style.left = `${e.pageX}px`;
  contextMenu.style.top = `${e.pageY}px`;
  contextMenu.classList.add("open");
}

document.addEventListener("click", () => {
  contextMenu.classList.remove("open");
  currentContextScript = null;
  currentContextWorkspace = null;
});

renameScriptBtn.addEventListener("click", () => {
  if (!currentContextScript) return;
  const scriptItem = Array.from(document.querySelectorAll(".script-item")).find(
    (item) => {
      return (
        item.querySelector(".script-title").textContent === currentContextScript
      );
    },
  );
  if (!scriptItem) return;
  const titleElement = scriptItem.querySelector(".script-title");
  const originalName = titleElement.textContent;
  const input = document.createElement("input");
  input.type = "text";
  input.value = originalName;
  titleElement.replaceWith(input);
  input.focus();
  
  function handleRename() {
    const newName = input.value.trim().split(".")[0];
    if (newName === "Untitled") {
      showToast("Script name cannot be 'Untitled'", true);
      input.focus();
      return;
    }
    if (newName && newName !== originalName) {
      updateScriptNameEverywhere(originalName, newName);
    }
    titleElement.textContent = newName || originalName;
    input.replaceWith(titleElement);
  }
  
  input.addEventListener("blur", handleRename);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      const newName = input.value.trim();
      if (newName === "Untitled") {
        showToast("Script name cannot be 'Untitled'", true);
        input.focus();
        return;
      }
      if (savedScripts.some((s) => s.title === newName)) {
        showToast(`Script "${newName}" already exists`, true);
        input.focus();
        return;
      }
      handleRename();
    } else if (e.key === "Escape") {
      input.value = originalName;
      input.blur();
    }
  });
  contextMenu.classList.remove("open");
});

deleteScriptBtn.addEventListener("click", () => {
  if (!currentContextScript) return;
  if (confirm(`Are you sure you want to delete "${currentContextScript}"?`)) {
    const scriptIndex = savedScripts.findIndex(
      (s) => s.title === currentContextScript,
    );
    if (scriptIndex !== -1) {
      if (isAutoExecuteScript(currentContextScript)) {
        toggleAutoExecuteScript(currentContextScript);
      }
      savedScripts.splice(scriptIndex, 1);
      persistSavedScripts();
      renderSidebar();
      showToast(`Script "${currentContextScript}" deleted`);
      const tabsToClose = Array.from(tabs.children).filter(
        (tab) => tab.dataset.realTabName === currentContextScript,
      );
      tabsToClose.forEach((tab) => {
        if (Array.from(tabs.children).length === 1) {
          createTab();
        }
        closeTab(true, tab.dataset.id);
      });
    }
  }
});

autoExecuteScriptBtn.addEventListener("click", () => {
  if (!currentContextScript) return;
  toggleAutoExecuteScript(currentContextScript);
  if (sidebar.classList.contains("open")) {
    renderSidebar();
  }
});

function createTab(name = "Untitled", content = "-- New script") {
  if (tabs.children.length >= 20) {
    showToast("Maximum tabs reached for current workspace", true);
    return;
  }
  const id = "tab" + Date.now();
  const tab = document.createElement("div");
  tab.className = "tab new-tab";
  tab.draggable = true;
  const tabName = document.createElement("span");
  const realTabName = name;
  if (name.length >= 10) {
    name = name.substring(0, 5) + "...";
  }
  tab.dataset.realTabName = realTabName;
  tabName.innerText = name;
  tab.appendChild(tabName);
  const closeBtn = document.createElement("span");
  closeBtn.className = "close-btn";
  const closeIcon = document.createElement("i");
  closeIcon.className = "fas fa-times";
  closeBtn.appendChild(closeIcon);
  closeBtn.onclick = (e) => {
    e.stopPropagation();
    closeTab(false, id);
  };
  tab.appendChild(closeBtn);
  tab.dataset.id = id;
  tab.dataset.name = name;

  if (
    realTabName !== "Untitled" &&
    savedScripts.some((s) => s.title === realTabName)
  ) {
    tab.classList.add("saved-tab");
  }

  tabs.appendChild(tab);
  let editor;
  if (editors[id]) {
    editor = editors[id];
    editorWrapper = document.getElementById(`editor-${id}`);
    editorWrapper.style.display = "block";
  } else {
    editor = createEditor(id, content);
    editors[id] = editor;
  }
  switchTab(id);
  tab.addEventListener("click", () => switchTab(id));

  tab.addEventListener("dragstart", handleDragStart);
  tab.addEventListener("dragover", handleDragOver);
  tab.addEventListener("dragend", handleDragEnd);
  tab.addEventListener("drop", handleDrop);
  if (typeof scheduleWorkspaceAutosave === "function")
    scheduleWorkspaceAutosave();
}

let draggedTab = null;
let dragTabPlaceholder = null;
let originalTabRect = null;
let dropTarget = null;

function handleDragStart(e) {
  if (e.target.classList.contains("close-btn")) {
    e.preventDefault();
    return;
  }

  draggedTab = this;
  originalTabRect = draggedTab.getBoundingClientRect();

  const dragImage = this.cloneNode(true);
  dragImage.style.position = "absolute";
  dragImage.style.top = "-1000px";
  document.body.appendChild(dragImage);

  e.dataTransfer.effectAllowed = "move";
  e.dataTransfer.setDragImage(dragImage, 10, 10);
  e.dataTransfer.setData("application/x-tab", this.dataset.id);

  setTimeout(() => document.body.removeChild(dragImage), 0);

  this.classList.add("dragging");

  dragTabPlaceholder = document.createElement("div");
  dragTabPlaceholder.className = "tab tab-placeholder";
  dragTabPlaceholder.style.width = originalTabRect.width + "px";
  dragTabPlaceholder.style.height = originalTabRect.height + "px";
  dragTabPlaceholder.style.opacity = "0.3";
  dragTabPlaceholder.style.pointerEvents = "none";
}

function handleDragOver(e) {
  if (!draggedTab || this === draggedTab) return;

  e.preventDefault();
  e.dataTransfer.dropEffect = "move";

  const tabsContainer = document.getElementById("tabs");
  if (!dragTabPlaceholder.parentElement) {
    tabsContainer.insertBefore(dragTabPlaceholder, draggedTab);
  }

  const tabRect = this.getBoundingClientRect();
  const mouseX = e.clientX;
  let insertBefore = mouseX < (tabRect.left + tabRect.right) / 2;

  if (insertBefore) {
    if (this.previousElementSibling !== dragTabPlaceholder) {
      tabsContainer.insertBefore(dragTabPlaceholder, this);
    }
  } else {
    if (this.nextElementSibling !== dragTabPlaceholder) {
      tabsContainer.insertBefore(dragTabPlaceholder, this.nextElementSibling);
    }
  }

  dropTarget = this;
  this.classList.add("drag-over");
}

function handleDragEnd(e) {
  this.classList.remove("dragging");
  document.querySelectorAll(".drag-over").forEach((tab) => {
    tab.classList.remove("drag-over");
  });

  if (dragTabPlaceholder && dragTabPlaceholder.parentElement) {
    const tabsContainer = document.getElementById("tabs");
    const placeholderPosition = Array.from(tabsContainer.children).indexOf(
      dragTabPlaceholder,
    );

    if (placeholderPosition !== -1) {
      if (dragTabPlaceholder.nextElementSibling) {
        tabsContainer.insertBefore(
          draggedTab,
          dragTabPlaceholder.nextElementSibling,
        );
      } else {
        tabsContainer.appendChild(draggedTab);
      }
    }

    dragTabPlaceholder.parentElement.removeChild(dragTabPlaceholder);
  }

  draggedTab = null;
  dragTabPlaceholder = null;
  dropTarget = null;
}

function handleDrop(e) {
  e.preventDefault();
  e.stopPropagation();

  if (!e.dataTransfer.types.includes("application/x-tab")) {
    return;
  }

  this.classList.remove("drag-over");
}

document.addEventListener("DOMContentLoaded", function () {
  const style = document.createElement("style");
  style.innerHTML = `
    .tab-placeholder {
      background: rgba(100, 100, 100, 0.4);
      border: 2px dashed var(--accent-color);
    }
    .tab.dragging {
      opacity: 0.6;
    }
    .tab.drag-over {
      border: 2px solid var(--accent-color);
    }
  `;
  document.head.appendChild(style);
});

document.addEventListener("dragover", function (e) {
  if (!e.target.closest("#tabs")) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "none";
  }
});

document.addEventListener("drop", function (e) {
  e.preventDefault();

  if (
    !e.target.closest("#tabs") &&
    dragTabPlaceholder &&
    dragTabPlaceholder.parentElement
  ) {
    dragTabPlaceholder.parentElement.removeChild(dragTabPlaceholder);
  }
});

document.addEventListener("keydown", (e) => {
  if (
    (e.ctrlKey || e.metaKey) &&
    !isNaN(parseInt(e.key)) &&
    parseInt(e.key) > 0
  ) {
    e.preventDefault();
    const tabIndex = parseInt(e.key) - 1;
    const tabsArray = Array.from(tabs.children);
    if (tabIndex < tabsArray.length) {
      const targetTabId = tabsArray[tabIndex].dataset.id;
      switchTab(targetTabId);
    }
  }

  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "t") {
    e.preventDefault();
    createTab();
  }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "w") {
    e.preventDefault();
    closeCurrentTab(false);
  }
  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
    e.preventDefault();
    executeCurrentScript();
  }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
    e.preventDefault();
    saveCurrentScript();
  }

  if (
    e.altKey &&
    !e.metaKey &&
    !e.ctrlKey &&
    !e.shiftKey &&
    (e.key === "ArrowRight" || e.key === "ArrowLeft")
  ) {
    e.preventDefault();
    if (e.key === "ArrowRight" && typeof toggleSidebar !== "undefined") {
      toggleSidebar.click();
    } else if (
      e.key === "ArrowLeft" &&
      typeof workspaceToggleBtn !== "undefined"
    ) {
      workspaceToggleBtn.click();
    }
  }

  if (
    e.altKey &&
    !e.metaKey &&
    !e.ctrlKey &&
    !e.shiftKey &&
    (e.key === "ArrowUp" || e.key === "ArrowDown")
  ) {
    e.preventDefault();
    if (consoleLockActive) {
      let msg;
      switch (consoleLockReason) {
        case "multi":
          msg =
            "Multiple ports online; console locked until only one is active";
          break;
        case "zero":
          msg = "No ports online; console locked until Roblox is detected";
          break;
        case "empty":
          msg = "Console empty; will unlock automatically when output appears";
          break;
        default:
          msg = "Console locked";
      }
      showToast(msg, true);
      return;
    }
    if (e.key === "ArrowUp") expandConsole();
    else if (e.key === "ArrowDown") collapseConsole();
  }
});

function switchTab(id) {
  document
    .querySelectorAll(".tab")
    .forEach((t) => t.classList.remove("active"));
  document
    .querySelectorAll(".editor-wrapper")
    .forEach((e) => e.classList.remove("active"));
  const tab = Array.from(document.querySelectorAll(".tab")).find(
    (t) => t.dataset.id === id,
  );
  if (!tab) return;
  tab.classList.add("active");
  const editorWrapper = document.getElementById(`editor-${id}`);
  if (editorWrapper) {
    editorWrapper.classList.add("active");
    if (editors[id]) {
      setTimeout(() => {
        if (editors[id].refresh) editors[id].refresh();
        if (editors[id].focus) editors[id].focus();
      }, 10);
    }
  }
  currentTab = id;
}

function closeTab(forced, id) {
  const remainingTabIds = Object.keys(editors);
  const tab = Array.from(document.querySelectorAll(".tab")).find(
    (t) => t.dataset.id === id,
  );
  if (remainingTabIds.length === 1 && !forced) {
    return showToast("Cannot close the last tab", true);
  }

  if (tab) {
    const wasActive = tab.classList.contains("active");
    tab.remove();
    const editorWrapper = document.getElementById(`editor-${id}`);
    if (editorWrapper) {
      editorWrapper.remove();
    }
    delete editors[id];
    if (wasActive) {
      const remainingTabIds = Object.keys(editors);
      if (remainingTabIds.length) {
        switchTab(remainingTabIds[0]);
      } else {
        currentTab = null;
      }
    }
    if (typeof scheduleWorkspaceAutosave === "function")
      scheduleWorkspaceAutosave();
  }
}

function closeCurrentTab(forced) {
  if (currentTab) closeTab(forced, currentTab);
}

function saveCurrentScript() {
  if (!currentTab || !editors[currentTab]) {
    showToast("No script selected to save", true);
    return;
  }
  const tab = Array.from(document.querySelectorAll(".tab")).find(
    (t) => t.dataset.id === currentTab,
  );
  if (!tab) return;
  let scriptName = tab.dataset.realTabName;
  console.log(scriptName);
  if (scriptName === "Untitled") {
    openRenameDialog();
    return;
  }
  scriptName = scriptName.split(".")[0];
  saveScriptContent(tab, scriptName);
}

function saveScriptContent(tab, scriptName) {
  if (!scriptName || scriptName === "Untitled") {
    showToast("Script name is required and cannot be 'Untitled'", true);
    return;
  }

  const scriptContent = editors[currentTab].getValue();
  
  // Save to localStorage instead of file system
  const existingIndex = savedScripts.findIndex(s => s.title === scriptName);
  if (existingIndex !== -1) {
    savedScripts[existingIndex].script = scriptContent;
  } else {
    savedScripts.push({ title: scriptName, script: scriptContent });
  }
  
  persistSavedScripts();
  showToast(`Script "${scriptName}" saved successfully!`);
  
  closeCurrentTab(true);
  setTimeout(() => {
    createTab(scriptName, scriptContent);
  }, 100);

  if (sidebar.classList.contains("open") && !searchBox.value) {
    renderSidebar();
  }

  if (!sidebar.classList.contains("open") && typeof toggleSidebar !== "undefined") {
    toggleSidebar.click();
  }
}

document.getElementById("copyConsole").onclick = function () {
  const output = document.getElementById("consoleOutput").innerText;
  navigator.clipboard.writeText(output);
  showToast("Console output copied to clipboard");
};

function launchRoblox() {
  showToast("Roblox launch not available in browser mode", true);
}

document.getElementById("roblox-button").addEventListener("click", launchRoblox);
document.getElementById("save-button").addEventListener("click", saveCurrentScript);
document.getElementById("exec-button").addEventListener("click", executeCurrentScript);

async function loadupdated() {
  showToast("Loading scripts...");
  try {
    const scriptHub = localStorage.getItem("scriptHub") || "rscripts";

    let scriptbloxScripts = [];
    let rscriptsScripts = [];

    if (scriptHub === "both" || scriptHub === "scriptblox") {
      const res = await fetch("https://scriptblox.com/api/script/fetch");
      const data = await res.json();
      if (data && data.result && data.result.scripts) {
        scriptbloxScripts = data.result.scripts.map((s) => ({
          ...s,
          __source: "Scriptblox",
        }));
      }
    }

    if (scriptHub === "both" || scriptHub === "rscripts") {
      const res2 = await fetch(
        "https://rscripts.net/api/v2/scripts?page=1&orderBy=date",
      );
      const data2 = await res2.json();
      if (data2 && data2.scripts) {
        rscriptsScripts = data2.scripts.map((s) => ({
          ...s,
          __source: "Rscripts",
        }));
        console.log("Rscripts data:", data2);
      }
    }

    let merged = [];
    let i = 0,
      j = 0;
    while (i < scriptbloxScripts.length || j < rscriptsScripts.length) {
      if (i < scriptbloxScripts.length) merged.push(scriptbloxScripts[i++]);
      if (j < rscriptsScripts.length) merged.push(rscriptsScripts[j++]);
    }
    updatedScripts = merged;
    if (sidebar.classList.contains("open")) renderSidebar();
  } catch (err) {
    console.error("Error loading scripts:", err);
    const noupdated = document.createElement("div");
    noupdated.className = "script-item";
    noupdated.textContent =
      "There was an error. Most likely a ScriptBlox ratelimit.";
    scriptsList.appendChild(noupdated);
  }
}

async function fetchScriptContent(scriptId) {
  try {
    const directUrl = `https://scriptblox.com/raw/${scriptId}`;
    try {
      const directRes = await fetch(directUrl);
      if (directRes.ok) {
        const content = await directRes.text();
        if (
          content &&
          content.length > 0 &&
          !content.includes("<!DOCTYPE html>")
        ) {
          return content;
        }
      }
    } catch (directErr) {
      console.log("Direct fetch failed:", directErr);
    }

    const res = await fetch(`https://scriptblox.com/api/script/${scriptId}`);
    const data = await res.json();

    if (data && data.script) {
      return data.script;
    }

    if (data && data.result) {
      if (data.result.script) return data.result.script;
      if (data.result.content) return data.result.content;
    }

    return `-- Script for ${scriptId} could not be loaded\nloadstring(game:HttpGet("https://rawscripts.net/raw/Infinite-Yield_500"))()`;
  } catch (err) {
    console.error("Error fetching script:", err);
    return `-- Error fetching script: ${err.message}\nloadstring(game:HttpGet("https://rawscripts.net/raw/Infinite-Yield_500"))()`;
  }
}

let searchTimeout;
searchBox.addEventListener("input", (e) => {
  const val = e.target.value;
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    if (val.length === 0) {
      renderSidebar();
    } else if (val.length >= 2) {
      searchScripts(val);
    }
  }, 300);
});

async function searchScripts(query) {
  if (!query || query.length < 2) return;
  const thisSearchId = ++currentSearchId;
  scriptsList.innerHTML = "";
  let foundInSaved = false;
  const lowerQuery = query.toLowerCase();

  const searchingIndicator = document.createElement("div");
  searchingIndicator.className = "sidebar-category";
  searchingIndicator.textContent = "Searching...";
  scriptsList.appendChild(searchingIndicator);
  
  try {
    await new Promise((resolve) => setTimeout(resolve, 500));
    if (thisSearchId !== currentSearchId) return;

    const scriptHub = localStorage.getItem("scriptHub") || "both";

    let scriptbloxResults = [];
    let rscriptsResults = [];

    if (scriptHub === "both" || scriptHub === "scriptblox") {
      const searchUrl = `https://scriptblox.com/api/script/search?q=${encodeURIComponent(query)}&`;
      const response = await fetch(searchUrl);
      if (!response.ok) throw new Error(`${response.status}`);
      const data = await response.json();
      if (
        data &&
        data.result &&
        data.result.scripts &&
        data.result.scripts.length > 0
      ) {
        scriptbloxResults = data.result.scripts;
      }
    }

    if (scriptHub === "both" || scriptHub === "rscripts") {
      const rUrl = `https://rscripts.net/api/v2/scripts?q=${encodeURIComponent(query)}&page=1&orderBy=date`;
      const rRes = await fetch(rUrl);
      const rData = await rRes.json();
      if (rData && rData.scripts && rData.scripts.length > 0) {
        rscriptsResults = rData.scripts;
      }
    }

    scriptsList.innerHTML = "";
    scriptsList.appendChild(searchingIndicator);

    let maxLen = Math.max(scriptbloxResults.length, rscriptsResults.length);
    savedScripts.forEach((script) => {
      if (
        script.title.toLowerCase().includes(lowerQuery) ||
        (script.script && script.script.toLowerCase().includes(lowerQuery))
      ) {
        foundInSaved = true;
        const item = document.createElement("div");
        item.className = "script-item saved-script";
        const content = document.createElement("div");
        content.className = "script-content";
        const title = document.createElement("div");
        title.className = "script-title";
        title.textContent = script.title;
        content.appendChild(title);
        item.appendChild(content);
        item.onclick = () => createTab(script.title, script.script);
        item.oncontextmenu = (e) => showContextMenu(e, script.title);
        scriptsList.appendChild(item);
        maxLen++;
      }
    });
    
    for (let i = 0; i < maxLen; i++) {
      if (i < scriptbloxResults.length) {
        const item = await renderScriptItem(scriptbloxResults[i], "Scriptblox");
        scriptsList.appendChild(item);
      }
      if (i < rscriptsResults.length) {
        const item = await renderScriptItem(rscriptsResults[i], "Rscripts");
        scriptsList.appendChild(item);
      }
    }
    searchingIndicator.textContent = `Results (${maxLen})`;
  } catch (err) {
    if (thisSearchId === currentSearchId) {
      console.error("Error searching scripts:", err);
      searchingIndicator.textContent = "Results (Error)";
      const errorItem = document.createElement("div");
      errorItem.className = "script-item";
      errorItem.textContent = `Error searching: ${err.message}`;
      scriptsList.appendChild(errorItem);
    }
  }
}

window.onload = function () {
  console.log("Saved scripts:", savedScripts);
  loadSavedScripts();
  startLogWatcher();
  startFileWatcher();
  initPortSelector();

  try {
    const storedWorkspace = localStorage.getItem("workspaceSidebarOpen");
    if (storedWorkspace === null) {
      workspaceSidebar.classList.add("open");
      workspaceSidebarOpen = true;
    } else if (storedWorkspace === "true") {
      workspaceSidebar.classList.add("open");
      workspaceSidebarOpen = true;
      workspaceToggleBtn.classList.add("active");
    } else {
      workspaceSidebar.classList.remove("open");
      workspaceSidebarOpen = false;
      workspaceToggleBtn.classList.remove("active");
    }
  } catch (_) {}
  
  loadAutoExecuteScripts();
  updatedLoaded = false;
  loadWorkspaces();
  switchWorkspace(workspaces[0].id);
  createTab(
    "startup",
    'loadstring(game:HttpGet("https://rawscripts.net/raw/Infinite-Yield_500"))()',
  );
  const tabsToDelete = Array.from(tabs.children).filter(
    (tab) => tab.dataset.realTabName !== "startup",
  );
  tabsToDelete.forEach((tab) => {
    closeTab(true, tab.dataset.id);
  });
  showToast("Ready");
  const newTabBtn = document.getElementById("new-tab-btn");
  if (newTabBtn) {
    newTabBtn.addEventListener("click", () => createTab());
  }

  if (sidebarOpen || sidebar.classList.contains("open")) {
    try {
      renderSidebar();
    } catch (e) {
      console.warn("renderSidebar failed on load", e);
    }
  }
};

async function renderSidebar() {
  scriptsList.innerHTML = "";
  const savedCategory = document.createElement("div");
  savedCategory.className = "sidebar-category";
  savedCategory.textContent = "Saved scripts";
  scriptsList.appendChild(savedCategory);
  
  if (savedScripts.length === 0) {
    const item = document.createElement("div");
    item.className = "script-item saved-script disabled";

    const content = document.createElement("div");
    content.className = "script-content";

    const title = document.createElement("div");
    title.className = "script-title";
    title.textContent = "No saved scripts";
    content.appendChild(title);

    const desc = document.createElement("div");
    desc.className = "script-description";
    desc.textContent = "Create a new script to see it listed here.";
    desc.style.opacity = "0.7";
    content.appendChild(desc);

    item.appendChild(content);
    scriptsList.appendChild(item);
  } else {
    savedScripts.forEach((script) => {
      const item = document.createElement("div");
      item.className = "script-item saved-script";
      const content = document.createElement("div");
      content.className = "script-content";
      const title = document.createElement("div");
      title.className = "script-title";
      title.textContent = script.title;
      content.appendChild(title);
      item.appendChild(content);
      item.onclick = () => createTab(script.title, script.script);
      item.oncontextmenu = (e) => showContextMenu(e, script.title);
      if (isAutoExecuteScript(script.title)) {
        const indicator = document.createElement("span");
        indicator.className = "autoexecute-indicator";
        indicator.innerHTML = "⚡";
        content.appendChild(indicator);
      }
      scriptsList.appendChild(item);
    });
  }
  
  const updatedCategory = document.createElement("div");
  updatedCategory.className = "sidebar-category";
  updatedCategory.textContent = "Recently updated scripts";
  scriptsList.appendChild(updatedCategory);
  
  if (!updatedLoaded) {
    loadupdated();
    updatedLoaded = true;
  } else {
    if (updatedScripts.length > 0) {
      for (const script of updatedScripts) {
        const item = await renderScriptItem(
          script,
          script.__source ||
            (script._id && script.rawScript ? "Rscripts" : "Scriptblox"),
        );
        scriptsList.appendChild(item);
      }
    } else {
      loadupdated();
    }
  }
}

function getSettings() {
  return {
    glowMode: localStorage.getItem("glowMode") || "default",
    accentColor: localStorage.getItem("accentColor") || "#7FB4FF",
    vibrancyEnabled:
      localStorage.getItem("vibrancyEnabled") !== null
        ? localStorage.getItem("vibrancyEnabled") === "true"
        : true,
    vibrancyOpacity: parseInt(
      localStorage.getItem("vibrancyOpacity") || "50",
      10,
    ),
    scriptHub: localStorage.getItem("scriptHub") || "both",
    executor: localStorage.getItem("executorType") || "MacSploit",
  };
}

function applySettings() {
  const { glowMode, accentColor, vibrancyEnabled, vibrancyOpacity, scriptHub } =
    getSettings();
  document.body.classList.remove("glow-default", "glow-old", "glow-high");
  document.body.classList.add("glow-" + glowMode);
  document.documentElement.style.setProperty("--accent-color", accentColor);
  glowModeSelect.value = glowMode;
  
  vibrancyToggle.value = vibrancyEnabled ? "on" : "off";
  if (vibrancyOpacityInput) {
    vibrancyOpacityInput.value = vibrancyOpacity;
    if (vibrancyOpacityValue) {
      vibrancyOpacityValue.textContent = vibrancyEnabled
        ? vibrancyOpacity + "%"
        : "0%";
    }
    vibrancyOpacityInput.disabled = !vibrancyEnabled;
    if (vibrancyOpacityGroup)
      vibrancyOpacityGroup.classList.toggle("disabled", !vibrancyEnabled);
  }

  const effectiveOpacity = vibrancyEnabled ? (vibrancyOpacity / 100) * 0.8 : 0;
  document.documentElement.style.setProperty(
    "--vibrancy-opacity",
    effectiveOpacity.toString(),
  );
  
  if (scriptHubSelect) {
    scriptHubSelect.value = scriptHub;
  }
  
  if (executorSelect) {
    const executor = getSettings().executor;
    executorSelect.value = executor;
    if (executor === "Opiumware") setPortRange(8392, 8397);
    else if (executor === "Hydrogen") setPortRange(6969, 6969);
    else setPortRange(5553, 5563);
    try {
      updatePortUIState();
    } catch (err) {}
  }

  const msBtn = document.getElementById("updateMacSploit");
  if (msBtn) {
    if (executorSelect && executorSelect.value !== "MacSploit") {
      msBtn.style.display = "none";
    } else {
      msBtn.style.display = "";
    }
  }
}

function saveSettings() {
  localStorage.setItem("glowMode", glowModeSelect.value);
  localStorage.setItem("accentColor", `#${accentColorInput.value}`);
  localStorage.setItem("vibrancyEnabled", vibrancyToggle.value === "on");
  if (vibrancyOpacityInput) {
    localStorage.setItem("vibrancyOpacity", vibrancyOpacityInput.value);
  }
  if (scriptHubSelect) {
    localStorage.setItem("scriptHub", scriptHubSelect.value);
  }
  if (executorSelect) {
    localStorage.setItem("executorType", executorSelect.value);
  }
  applySettings();
}

vibrancyToggle.addEventListener("change", () => {
  const isEnabled = vibrancyToggle.value === "on";
  console.log("Vibrancy enabled:", isEnabled);
  
  if (vibrancyOpacityInput) {
    vibrancyOpacityInput.disabled = !isEnabled;
    if (vibrancyOpacityGroup)
      vibrancyOpacityGroup.classList.toggle("disabled", !isEnabled);
    if (vibrancyOpacityValue) {
      vibrancyOpacityValue.textContent = isEnabled
        ? vibrancyOpacityInput.value + "%"
        : "0%";
    }

    const val = parseInt(vibrancyOpacityInput.value, 10) || 0;
    const effective = isEnabled ? (val / 100) * 0.8 : 0;
    document.documentElement.style.setProperty(
      "--vibrancy-opacity",
      effective.toString(),
    );
  }
  saveSettings();
  applySettings();
});

if (vibrancyOpacityInput) {
  const handleOpacity = () => {
    const val = parseInt(vibrancyOpacityInput.value, 10);
    if (vibrancyOpacityValue) {
      if (vibrancyToggle.value !== "on") {
        vibrancyOpacityValue.textContent = "0%";
      } else {
        vibrancyOpacityValue.textContent = val + "%";
      }
    }

    if (vibrancyToggle.value === "on") {
      document.documentElement.style.setProperty(
        "--vibrancy-opacity",
        ((val / 100) * 0.8).toString(),
      );
    }
  };
  
  vibrancyOpacityInput.addEventListener("input", () => {
    handleOpacity();
    localStorage.setItem("vibrancyOpacity", vibrancyOpacityInput.value);
  });
  
  vibrancyOpacityInput.addEventListener("change", () => {
    saveSettings();
  });
}

glowModeSelect.addEventListener("change", saveSettings);

if (scriptHubSelect) {
  scriptHubSelect.addEventListener("change", () => {
    saveSettings();
    updatedLoaded = false;
    updatedScripts = [];
    if (sidebar.classList.contains("open")) {
      renderSidebar();
    }
  });
}

if (executorSelect) {
  executorSelect.addEventListener("change", () => {
    try {
      localStorage.setItem("executorType", executorSelect.value);
    } catch (e) {}

    if (executorSelect.value === "Opiumware") {
      setPortRange(8392, 8397);
    } else if (executorSelect.value === "Hydrogen") {
      setPortRange(6969, 6969);
    } else {
      setPortRange(5553, 5563);
    }
    updatePortUIState();
    saveSettings();
  });
}

updatePortUIState();

resetColorBtn.addEventListener("click", () => {
  localStorage.setItem("accentColor", "#7FB4FF");
  accentColorInput.value = "7FB4FF";
  applySettings();
});

settingsButton.addEventListener("click", () => {
  settingsPane.style.display = "";
  settingsPane.classList.remove("closing");
  settingsPane.classList.add("open");
  applySettings();
});

settingsPane.addEventListener("click", (e) => {
  if (e.target === settingsPane) {
    settingsPane.classList.remove("open");
    settingsPane.classList.add("closing");
    setTimeout(() => {
      settingsPane.classList.remove("closing");
      settingsPane.style.display = "none";
    }, 350);
  }
});

document.addEventListener("DOMContentLoaded", applySettings);
window.addEventListener("load", applySettings);

function openRenameDialog() {
  const renameDialog = document.getElementById("renameDialog");
  renameDialog.style.display = "";
  renameDialog.classList.remove("closing");
  renameDialog.classList.add("open");
  const renameInput = document.getElementById("renameInput");
  renameInput.value = "";
  renameInput.focus();
}

function closeRenameDialog() {
  const renameDialog = document.getElementById("renameDialog");
  renameDialog.classList.remove("open");
  renameDialog.classList.add("closing");
  setTimeout(() => {
    renameDialog.classList.remove("closing");
    renameDialog.style.display = "none";
  }, 350);
}

// Mock file watcher for browser environment
function startFileWatcher() {
  console.log("File watcher not available in browser mode");
}

function createBadge(text, className) {
  const badge = document.createElement("span");
  badge.className = className + " script-badge";
  badge.innerText = text;
  return badge;
}

function getScriptImage(script, source) {
  let img =
    script.image ||
    script.gameLogo ||
    (script.game && (script.game.imageUrl || script.game.imgurl));
  if (img && source === "Scriptblox" && img.startsWith("/images")) {
    return "https://scriptblox.com" + img;
  }
  return img;
}

function createDiscordBadge(url) {
  const badge = document.createElement("span");
  badge.className = "script-discord";
  badge.innerText = "Discord";
  badge.onclick = (e) => {
    e.stopPropagation();
    window.open(url, "_blank");
  };
  return badge;
}

function createGameNamePlain(name) {
  const el = document.createElement("div");
  el.className = "script-game";
  el.innerText = name;
  return el;
}

function createAuthor(user) {
  if (!user) return null;
  const el = document.createElement("div");
  el.className = "script-author";
  el.innerText = "By " + (user.username || user.name || "Unknown");
  if (user.verified) {
    el.appendChild(createBadge("✔ Verified", "script-verified"));
  }
  return el;
}

function createStats(script) {
  const el = document.createElement("div");
  el.className = "script-stats";
  let stats = [];
  if (typeof script.views === "number") stats.push(`👁️ ${script.views}`);
  if (typeof script.likes === "number") stats.push(`👍 ${script.likes}`);
  if (typeof script.dislikes === "number") stats.push(`👎 ${script.dislikes}`);
  if (stats.length) el.innerText = stats.join("   ");
  return el;
}

async function renderScriptItem(script, source) {
  if (
    source === "Rscripts" &&
    script._id &&
    (!script.description || !script.user || !script.game)
  ) {
    try {
      const res = await fetch(
        `https://rscripts.net/api/v2/script?id=${script._id}`,
      );
      const data = await res.json();
      if (data && data.script && data.script[0]) {
        script = { ...script, ...data.script[0] };
      }
    } catch (e) {}
  }

  if (
    source === "Scriptblox" &&
    script._id &&
    (!script.description || !script.owner || !script.game)
  ) {
    try {
      const res = await fetch(
        `https://scriptblox.com/api/script/${script._id}`,
      );
      const data = await res.json();
      if (data && data.result && data.result.script) {
        script = { ...script, ...data.result.script };
      }
    } catch (e) {}
  }
  
  const item = document.createElement("div");
  item.className = "script-item searched-script";

  let bg = getScriptImage(script, source);
  if (bg) {
    item.style.setProperty("--script-bg", `url('${bg}')`);
  } else {
    item.style.removeProperty("--script-bg");
  }

  const content = document.createElement("div");
  content.className = "script-content";

  const title = document.createElement("div");
  title.className = "script-title";
  title.innerText = script.title || "Unnamed Script";
  content.appendChild(title);

  const sourceDiv = document.createElement("div");
  sourceDiv.className = "script-source";
  sourceDiv.innerText = "Source: " + (source || script.__source || "Unknown");
  content.appendChild(sourceDiv);

  let gameName = (script.game && (script.game.name || script.game.title)) || "";
  if (gameName) content.appendChild(createGameNamePlain(gameName));

  if (script.description) {
    const desc = document.createElement("div");
    desc.className = "script-description";
    desc.innerText = script.description;
    content.appendChild(desc);
  }

  if (script.user || script.owner) {
    const author = createAuthor(script.user || script.owner);
    if (author) content.appendChild(author);
  }

  const meta = document.createElement("div");
  meta.className = "script-meta";
  if (script.keySystem || script.key)
    meta.appendChild(createBadge("Key Required", "script-key"));

  if (source === "Rscripts") {
    let discordUrl =
      script.discord ||
      (script.user && script.user.socials && script.user.socials.discordServer);
    if (discordUrl) {
      const discordBadge = createDiscordBadge(discordUrl);
      meta.appendChild(discordBadge);
    }
  }
  
  if (script.mobileReady)
    meta.appendChild(createBadge("Mobile", "script-mobile"));
  if (script.paid) meta.appendChild(createBadge("Paid", "script-paid"));
  content.appendChild(meta);

  const stats = createStats(script);
  if (stats && stats.innerText) content.appendChild(stats);
  item.appendChild(content);

  item.onclick = () => {
    if (script.script) {
      createTab(script.title, script.script);
    } else if (script.rawScript) {
      fetch(script.rawScript)
        .then((res) => res.text())
        .then((text) => createTab(script.title, text))
        .catch(() => createTab(script.title, "-- Error loading script"));
    } else if (script._id) {
      const loadingIndicator = document.createElement("div");
      loadingIndicator.className = "loading-indicator";
      loadingIndicator.textContent = "Loading...";
      item.appendChild(loadingIndicator);
      fetchScriptContent(script._id)
        .then((content) => {
          if (item.querySelector(".loading-indicator")) {
            item.querySelector(".loading-indicator").remove();
          }
          if (content) {
            createTab(script.title, content);
          } else {
            showToast("Couldn't load script content", true);
          }
        })
        .catch((err) => {
          if (item.querySelector(".loading-indicator")) {
            item.querySelector(".loading-indicator").remove();
          }
          showToast("Error: " + err.message, true);
        });
    } else {
      showToast("Script content not available", true);
    }
  };
  return item;
}

async function executeCurrentScript() {
  if (!currentTab || !editors[currentTab]) {
    showToast("No script selected", true);
    return;
  }
  const code = editors[currentTab].getValue();
  showToast("Executing: " + code.substring(0, 30) + "...");
  
  // Mock execution for browser environment
  setTimeout(() => {
    showToast("Script execution not available in browser mode", true);
  }, 500);
}

const accentColorInput = document.getElementById("accentColorInput");
const accentColorPicker = document.getElementById("accentColorPicker");

function isValidHex(hex) {
  return /^#?([0-9A-Fa-f]{6})$/.test(hex);
}

function normalizeHex(hex) {
  hex = hex.trim();
  if (!hex.startsWith("#")) {
    hex = "#" + hex;
  }
  return hex;
}

function handleAccentColorInput() {
  const hex = accentColorInput.value.trim();
  if (isValidHex(hex)) {
    const normalized = normalizeHex(hex);
    localStorage.setItem("accentColor", normalized);
    applySettings();
  }
}

if (accentColorInput) {
  accentColorInput.addEventListener("input", handleAccentColorInput);
  settingsButton.addEventListener("click", () => {
    const current = (localStorage.getItem("accentColor") || "#7FB4FF").replace(
      /^#/,
      "",
    );
    accentColorInput.value = current;
    if (accentColorPicker) {
      accentColorPicker.value = "#" + current;
    }
  });
}

if (accentColorPicker) {
  const stored = localStorage.getItem("accentColor") || "#7FB4FF";
  accentColorPicker.value = stored;
  accentColorPicker.addEventListener("input", () => {
    const val = accentColorPicker.value;
    if (isValidHex(val)) {
      const hexNoHash = val.replace(/^#/, "");
      if (accentColorInput) accentColorInput.value = hexNoHash.toUpperCase();
      localStorage.setItem("accentColor", val.toUpperCase());
      applySettings();
    }
  });
}

if (resetColorBtn && accentColorPicker) {
  resetColorBtn.addEventListener("click", () => {
    accentColorPicker.value = "#7FB4FF";
  });
}

document.getElementById("cancelRename").addEventListener("click", () => {
  closeRenameDialog();
});

document.getElementById("confirmRename").addEventListener("click", () => {
  const renameInput = document.getElementById("renameInput");
  const newName = renameInput.value.trim().split(".")[0];
  if (!newName) {
    showToast("Script name is required", true);
    renameInput.focus();
    return;
  }
  if (savedScripts.some((s) => s.title === newName)) {
    showToast(`Script "${newName}" already exists`, true);
    renameInput.focus();
    return;
  }
  const tab = Array.from(document.querySelectorAll(".tab")).find(
    (t) => t.dataset.id === currentTab,
  );
  if (!tab) {
    showToast("No script selected to save", true);
    return;
  }
  saveScriptContent(tab, newName);
  closeRenameDialog();
});

function loadWorkspaces() {
  workspaces = getLocalStorage("workspaces", [
    { id: "default", name: "Default", tabs: [] },
  ]);

  if (workspaces.length === 0) {
    workspaces = [{ id: "default", name: "Default", tabs: [] }];
  }

  currentWorkspace = getLocalStorage("currentWorkspace", "default");
  renderWorkspacesSidebar();
}

function saveWorkspaces() {
  setLocalStorage("workspaces", workspaces);
  setLocalStorage("currentWorkspace", currentWorkspace);
}

function renderWorkspacesSidebar() {
  if (!workspacesList) return;

  workspacesList.innerHTML = "";
  workspaces.forEach((workspace) => {
    const item = document.createElement("div");
    item.className = `workspace-item ${
      workspace.id === currentWorkspace ? "active" : ""
    } saved-script`;

    const name = document.createElement("span");
    name.textContent = workspace.name;
    item.appendChild(name);

    item.onclick = () => switchWorkspace(workspace.id);
    item.oncontextmenu = (e) => showWorkspaceContextMenu(e, workspace.id);

    workspacesList.appendChild(item);
  });
}

function createNewWorkspace() {
  if (workspaces.length >= 10) {
    showToast("Maximum workspaces reached (10)", true);
    return;
  }

  const id = "workspace_" + Date.now();
  const name = "Workspace " + (workspaces.length + 1);

  workspaces.push({
    id: id,
    name: name,
    tabs: [],
  });

  saveWorkspaces();
  renderWorkspacesSidebar();
  switchWorkspace(id);
}

function switchWorkspace(workspaceId) {
  saveCurrentWorkspaceTabs();

  currentWorkspace = workspaceId;
  saveWorkspaces();

  loadWorkspaceTabs();
  renderWorkspacesSidebar();
}

function saveCurrentWorkspaceTabs() {
  const currentWorkspaceObj = workspaces.find((w) => w.id === currentWorkspace);
  if (!currentWorkspaceObj) return;

  const tabsData = Array.from(tabs.children).map((tab) => {
    const tabId = tab.dataset.id;
    const editor = editors[tabId];
    return {
      id: tabId,
      name: tab.dataset.realTabName,
      content: editor ? editor.getValue() : "",
    };
  });

  currentWorkspaceObj.tabs = tabsData;
  saveWorkspaces();
}

function loadWorkspaceTabs() {
  Array.from(tabs.children).forEach((tab) => {
    closeTab(true, tab.dataset.id);
  });

  const workspace = workspaces.find((w) => w.id === currentWorkspace);
  if (!workspace) return;

  if (workspace.tabs.length > 0) {
    workspace.tabs.forEach((tabData) => {
      createTab(tabData.name, tabData.content);
    });
  } else {
    createTab();
  }
}

function renameWorkspace(workspaceId) {
  const workspaceItem = Array.from(
    document.querySelectorAll(".workspace-item"),
  ).find((item) => {
    return (
      item.querySelector("span").textContent ===
      workspaces.find((w) => w.id === workspaceId).name
    );
  });

  if (!workspaceItem) return;

  const titleElement = workspaceItem.querySelector("span");
  const originalName = titleElement.textContent;

  const input = document.createElement("input");
  input.type = "text";
  input.value = originalName;
  input.className = "rename-input";
  titleElement.replaceWith(input);
  input.focus();

  function handleRename() {
    const newName = input.value.trim();
    if (newName && newName !== originalName) {
      const workspace = workspaces.find((w) => w.id === workspaceId);
      if (workspace) {
        workspace.name = newName;
        saveWorkspaces();
        renderWorkspacesSidebar();
      }
    }
    titleElement.textContent = newName || originalName;
    input.replaceWith(titleElement);
  }

  input.addEventListener("blur", handleRename);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      handleRename();
    } else if (e.key === "Escape") {
      input.value = originalName;
      input.blur();
    }
  });
}

function deleteWorkspace(workspaceId) {
  if (workspaces.length <= 1) {
    showToast("Cannot delete the last workspace", true);
    return;
  }

  const workspace = workspaces.find((w) => w.id === workspaceId);
  if (!workspace) return;

  if (
    confirm(`Are you sure you want to delete workspace "${workspace.name}"?`)
  ) {
    const index = workspaces.findIndex((w) => w.id === workspaceId);
    if (index !== -1) {
      workspaces.splice(index, 1);

      if (workspaceId === currentWorkspace) {
        currentWorkspace = workspaces[0].id;
        loadWorkspaceTabs();
      }

      saveWorkspaces();
      renderWorkspacesSidebar();
    }
  }
}

workspaceToggleBtn.addEventListener("click", () => {
  workspaceSidebarOpen = !workspaceSidebarOpen;

  if (workspaceSidebarOpen) {
    workspaceSidebar.classList.add("open");
    workspaceToggleBtn.classList.add("active");
    try {
      localStorage.setItem("workspaceSidebarOpen", "true");
    } catch (_) {}
  } else {
    workspaceSidebar.classList.remove("open");
    workspaceToggleBtn.classList.remove("active");
    try {
      localStorage.setItem("workspaceSidebarOpen", "false");
    } catch (_) {}
  }
});

newWorkspaceBtn.addEventListener("click", createNewWorkspace);

window.addEventListener("load", () => {
  loadWorkspaces();
});

window.addEventListener("beforeunload", () => {
  saveCurrentWorkspaceTabs();
});

function addWorkspaceSidebar() {
  const container = document.querySelector(".container");
  if (!container) return;

  if (!document.getElementById("workspace-toggle-btn")) {
    const toggleBtn = document.getElementById("workspace-toggle-btn");
    toggleBtn.addEventListener("click", () => {
      workspaceSidebarOpen = !workspaceSidebarOpen;

      if (workspaceSidebarOpen) {
        workspaceSidebar.classList.add("open");
        toggleBtn.style.transform = "rotate(-360deg)";
        document.querySelector(".main-content").style.marginLeft = "200px";
      } else {
        workspaceSidebar.classList.remove("open");
        toggleBtn.style.transform = "rotate(360deg)";
        document.querySelector(".main-content").style.marginLeft = "0";
      }
    });

    document
      .getElementById("new-workspace-btn")
      .addEventListener("click", createNewWorkspace);
  }
}

function restructureDOM() {
  const body = document.body;
  const container = document.querySelector(".container");
  if (!container) return;

  const mainContent = document.createElement("div");
  mainContent.className = "main-content";

  Array.from(container.children).forEach((child) => {
    if (
      !child.classList.contains("sidebar") &&
      !child.classList.contains("workspace-sidebar")
    ) {
      mainContent.appendChild(child);
    }
  });

  container.appendChild(mainContent);
}

window.addEventListener("DOMContentLoaded", () => {
  restructureDOM();
  addWorkspaceSidebar();
  checkFirstTimeUser();

  try {
    const sOpen = localStorage.getItem("sidebarOpen");
    if (sOpen === "true") {
      if (!sidebar.classList.contains("open")) {
        sidebar.classList.add("open");
        sidebarOpen = true;
      }
    } else if (sOpen === "false") {
      if (sidebar.classList.contains("open")) {
        sidebar.classList.remove("open");
        sidebarOpen = false;
      }
    }
    const wOpen = localStorage.getItem("workspaceSidebarOpen");
    if (wOpen === "true") {
      if (!workspaceSidebar.classList.contains("open")) {
        workspaceSidebar.classList.add("open");
        workspaceSidebarOpen = true;
        workspaceToggleBtn.classList.add("active");
      }
    } else if (wOpen === "false") {
      if (workspaceSidebar.classList.contains("open")) {
        workspaceSidebar.classList.remove("open");
        workspaceSidebarOpen = false;
        workspaceToggleBtn.classList.remove("active");
      }
    }
  } catch (_) {}
});

window.addEventListener("DOMContentLoaded", () => {
  const threshold = 12;

  document.addEventListener("click", (e) => {
    try {
      const wsRect = workspaceSidebar.getBoundingClientRect();
      const sbRect = sidebar.getBoundingClientRect();

      if (
        e.clientX >= wsRect.right - threshold &&
        e.clientX <= wsRect.right + threshold
      ) {
        workspaceSidebar.classList.toggle("open");
        workspaceSidebarOpen = workspaceSidebar.classList.contains("open");
        try {
          localStorage.setItem(
            "workspaceSidebarOpen",
            workspaceSidebarOpen ? "true" : "false",
          );
        } catch (_) {}
        if (workspaceSidebarOpen) workspaceToggleBtn.classList.add("active");
        else workspaceToggleBtn.classList.remove("active");
        e.preventDefault();
        return;
      }

      if (
        e.clientX >= sbRect.left - threshold &&
        e.clientX <= sbRect.left + threshold
      ) {
        sidebar.classList.toggle("open");
        sidebarOpen = sidebar.classList.contains("open");
        try {
          localStorage.setItem("sidebarOpen", sidebarOpen ? "true" : "false");
        } catch (_) {}
        if (sidebarOpen) renderSidebar();
        e.preventDefault();
        return;
      }
    } catch (err) {}
  });
});

window.addEventListener("DOMContentLoaded", () => {
  try {
    // Mock version display for browser
    const el = document.getElementById("version");
    if (el) {
      el.textContent = "v4.1.2";
      el.setAttribute("title", "Version 4.1.2");
    }
  } catch (e) {}
});

let workspaceAutosaveTimer = null;
function scheduleWorkspaceAutosave() {
  if (workspaceAutosaveTimer) clearTimeout(workspaceAutosaveTimer);
  workspaceAutosaveTimer = setTimeout(() => {
    saveCurrentWorkspaceTabs();
  }, 500);
}