const fs = require("fs");
const path = require("path");
const os = require("os");
const fetch = require("node-fetch");
const chokidar = require("chokidar");
const { version: currentVersion } = require("./package.json");
const { exec } = require("child_process");
const START_PORT = 5553;
const END_PORT = 5563;
const net = require("net");
const zlib = require("zlib");
let serverPort = null;
let lastError = null;
let watcher = null;
let currentLogPath = null;
let filePosition = 0;
let checkLogInterval = null;

// Simple localStorage replacement for Node.js
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

function findLatestLogFile() {
  const homedir = require("os").homedir();
  const os = require("os");
  let logDir;
  
  // Determine log directory based on operating system
  switch (os.platform()) {
    case 'darwin': // macOS
      logDir = path.join(homedir, "Library", "Logs", "Roblox");
      break;
    case 'win32': // Windows
      logDir = path.join(homedir, "AppData", "Local", "Roblox", "logs");
      break;
    case 'linux': // Linux
      logDir = path.join(homedir, ".local", "share", "Roblox", "logs");
      break;
    default:
      console.log(`Unsupported platform: ${os.platform()}`);
      return null;
  }
  
  try {
    // Check if directory exists before trying to read it
    if (!fs.existsSync(logDir)) {
      console.log(`Roblox log directory not found: ${logDir}`);
      return null;
    }
    
    const files = fs
      .readdirSync(logDir)
      .filter((file) => file.endsWith(".log"))
      .map((file) => ({
        path: path.join(logDir, file),
        mtime: fs.statSync(path.join(logDir, file)).mtime,
      }))
      .sort((a, b) => b.mtime - a.mtime);

    return files.length > 0 ? files[0].path : null;
  } catch (err) {
    console.log(`Roblox log directory not accessible: ${logDir}`);
    return null;
  }
}

function switchToNewLogFile() {
  const newLogPath = findLatestLogFile();

  if (!newLogPath) {
    console.log("No log file found");
    return;
  }

  if (newLogPath !== currentLogPath) {
    console.log(`Switching to new log file: ${newLogPath}`);

    filePosition = 0;

    if (watcher) {
      watcher.close();
    }

    currentLogPath = newLogPath;

    try {
      const content = fs.readFileSync(currentLogPath, "utf8");
      const lines = content.split("\n").filter((line) => line.trim() !== "");
      filePosition = content.length;

      lines.forEach((line) => {
        console.log("LOG:", line);
      });
      console.log("Initial log content restored " + Date.now());
    } catch (err) {
      console.error("Error reading initial log content:", err);
    }
    watcher = chokidar.watch(currentLogPath, {
      persistent: true,
      ignoreInitial: true,
    });

    watcher.on("change", () => {
      try {
        const stats = fs.statSync(currentLogPath);
        if (stats.size < filePosition) {
          filePosition = 0;
        }

        const stream = fs.createReadStream(currentLogPath, {
          encoding: "utf8",
          start: filePosition,
        });

        let remaining = "";
        stream.on("data", (data) => {
          const lines = (remaining + data).split("\n");
          remaining = lines.pop();

          lines
            .filter((line) => line.trim() !== "")
            .forEach((line) => {
              try {
                console.log("LOG:", line);
              } catch (err) {
                console.error("Error sending log update:", err);
              }
            });
        });

        stream.on("end", () => {
          filePosition = stats.size;
        });

        stream.on("error", (err) => {
          console.error("Error reading log file:", err);
        });
      } catch (err) {
        console.error("Error handling log change:", err);
      }
    });

    watcher.on("error", (err) => {
      console.error("Log watcher error:", err);
    });
  }
}

function logstart() {
  switchToNewLogFile();

  checkLogInterval = setInterval(() => {
    switchToNewLogFile();
  }, 5000);

  return { success: true, path: currentLogPath };
}

function logend() {
  if (watcher) {
    watcher.close();
  }
  if (checkLogInterval) {
    clearInterval(checkLogInterval);
  }
}

function runMacSploitInstall() {
  return new Promise((resolve, reject) => {
    const sentinel = path.join(os.tmpdir(), "macsploit_install_done");
    try {
      if (fs.existsSync(sentinel)) fs.unlinkSync(sentinel);
    } catch (_) {}

    const applescriptPath = path.join(os.tmpdir(), "macsploit_install.scpt");
    const bashCmd =
      'cd ~ && curl -s "https://git.raptor.fun/main/install.sh" | bash </dev/tty; echo $? > ' +
      JSON.stringify(sentinel);
    const applescript = `tell application "Terminal"\n  activate\n  do script ${JSON.stringify(bashCmd)}\nend tell\n`;
    try {
      fs.writeFileSync(applescriptPath, applescript, "utf8");
    } catch (err) {
      return reject(err);
    }

    exec(`osascript ${JSON.stringify(applescriptPath)}`, (error) => {
      if (error) {
        return reject(error);
      }

      const start = Date.now();
      const maxDurationMs = 1000 * 60 * 30;
      const pollInterval = 4000;
      const interval = setInterval(() => {
        try {
          if (fs.existsSync(sentinel)) {
            clearInterval(interval);
            let exitCode = "1";
            try {
              exitCode = fs.readFileSync(sentinel, "utf8").trim();
              fs.unlinkSync(sentinel);
            } catch (_) {}
            if (exitCode === "0") {
              console.log("MacSploit installation finished successfully.");
            } else {
              console.error(`MacSploit installer exited with code ${exitCode}.`);
            }
          } else if (Date.now() - start > maxDurationMs) {
            clearInterval(interval);
            console.warn("Timed out waiting for MacSploit installer to finish.");
          }
        } catch (e) {}
      }, pollInterval);
      resolve("started");
    });
  });
}

async function checkForUpdates() {
  try {
    const response = await fetch(
      "https://api.github.com/repos/Phantom8015/Tritium/releases/latest",
    );
    if (!response.ok) {
      throw new Error(response.statusText);
    }
    const data = await response.json();
    const latestVersion = data.tag_name.replace("v", "");

    const current = currentVersion.split(".").map(Number);
    const latest = latestVersion.split(".").map(Number);
    const macSploitVersion = await fetch(
      "https://www.raptor.fun/main/version.json",
    );
    const macSploitData = await macSploitVersion.json();
    const msVersion = macSploitData.relVersion;
    if (localStorage.getItem("macSploitVersion")) {
      if (localStorage.getItem("macSploitVersion") !== msVersion) {
        console.log(`A new version of MacSploit (${msVersion}) is available!`);
      }
    }

    localStorage.setItem("macSploitVersion", msVersion);

    for (let i = 0; i < 3; i++) {
      if (latest[i] > current[i]) {
        console.log(`A new version of Tritium (${latestVersion}) is available!`);
        break;
      }
    }
  } catch (error) {
    console.error("Error checking for updates:", error);
  }
}

async function msUpdate() {
  try {
    const output = await runMacSploitInstall();
    console.log(`MacSploit update output: ${output}`);
  } catch (error) {
    console.error("Update failed:", error);
  }
}

const EXECUTOR_KEY = "executorType";
if (!localStorage.getItem(EXECUTOR_KEY)) {
  localStorage.setItem(EXECUTOR_KEY, "MacSploit");
}

let _executorType = localStorage.getItem(EXECUTOR_KEY) || "MacSploit";

async function ligma(scriptContent) {
  const executor = _executorType || "MacSploit";

  if (executor === "MacSploit") {
    for (let port = START_PORT; port <= END_PORT; port++) {
      try {
        await new Promise((resolve, reject) => {
          const socket = net.createConnection(
            { host: "127.0.0.1", port },
            () => {
              serverPort = port;
              socket.destroy();
              resolve();
            },
          );
          socket.on("error", reject);
          socket.setTimeout(500, () => reject(new Error("Timeout")));
        });
        if (serverPort) break;
      } catch (err) {
        lastError = err.message;
      }
    }

    if (!serverPort) {
      throw new Error(
        `Could not locate TCP server on ports ${START_PORT}-${END_PORT}. Last error: ${lastError}`,
      );
    }

    console.log(`✅ Server found on port ${serverPort}`);
    console.log(scriptContent);
    const header = Buffer.alloc(16, 0);
    header.writeUInt32LE(Buffer.byteLength(scriptContent) + 1, 8);
    net
      .createConnection(serverPort, "127.0.0.1")
      .on("connect", function () {
        this.write(
          Buffer.concat([header, Buffer.from(scriptContent), Buffer.from([0])]),
        );
        this.end();
      })
      .setTimeout(3000);
    return;
  }

  if (executor === "Opiumware") {
    const Ports = [8392, 8393, 8394, 8395, 8396, 8397];
    let ConnectedPort = null;
    let Stream = null;

    for (const P of Ports) {
      try {
        Stream = await new Promise((Resolve, Reject) => {
          const Socket = net.createConnection(
            { host: "127.0.0.1", port: P },
            () => Resolve(Socket),
          );
          Socket.on("error", Reject);
          Socket.setTimeout(1000, () => Reject(new Error("Timeout")));
        });
        console.log(`Successfully connected to Opiumware on port: ${P}`);
        ConnectedPort = P;
        break;
      } catch (Err) {
        console.log(`Failed to connect to port ${P}: ${Err.message}`);
      }
    }

    if (!Stream) throw new Error("Failed to connect on Opiumware ports");

    if (scriptContent !== "NULL") {
      try {
        scriptContent = "OpiumwareScript " + scriptContent;
        await new Promise((Resolve, Reject) => {
          zlib.deflate(
            Buffer.from(scriptContent, "utf8"),
            (Err, Compressed) => {
              if (Err) return Reject(Err);
              Stream.write(Compressed, (WriteErr) => {
                if (WriteErr) return Reject(WriteErr);
                console.log(`Script sent (${Compressed.length} bytes)`);
                Resolve();
              });
            },
          );
        });
      } catch (Err) {
        Stream.destroy();
        throw new Error(`Error sending script: ${Err.message}`);
      }
    }

    Stream.end();
    return `Successfully connected to Opiumware on port: ${ConnectedPort}`;
  }

  if (executor === "Hydrogen") {
    const HYDRO_PORT = 6969;
    const url = `http://127.0.0.1:${HYDRO_PORT}/execute`;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: String(scriptContent || ""),
        timeout: 5000,
      });

      const text = await res.text().catch(() => "");
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${text}`);
      }
      return { status: "success", port: HYDRO_PORT, response: text };
    } catch (err) {
      throw new Error(`Hydrogen HTTP send failed: ${err.message}`);
    }
  }
}

function processData(data) {
  let code;
  if (
    data &&
    typeof data === "object" &&
    Object.prototype.hasOwnProperty.call(data, "code")
  ) {
    code = data.code;
  } else {
    code = data;
  }

  if (typeof code !== "string") {
    code = String(code ?? "");
  }

  console.log(code);
  return ligma(code).catch((err) => console.log(err));
}

// Start the application
console.log("Tritium started");
checkForUpdates();
logstart();

// Simple command line interface
const readline = require('readline');
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log("Enter 'execute <script>' to run a script, or 'quit' to exit:");

rl.on('line', (input) => {
  const trimmed = input.trim();
  if (trimmed === 'quit') {
    logend();
    rl.close();
    process.exit(0);
  } else if (trimmed.startsWith('execute ')) {
    const script = trimmed.substring(8);
    processData(script);
  } else {
    console.log("Unknown command. Use 'execute <script>' or 'quit'");
  }
});