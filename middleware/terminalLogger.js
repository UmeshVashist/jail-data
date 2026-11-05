/**
 * middleware/terminalLogger.js
 * Advanced Real-Time Terminal Request, Status, and Error Diagnostic Logger
 * Provides color-coded visibility into all API calls, status codes, response times,
 * and detailed error stack traces directly in the terminal for local debugging.
 */

// ANSI Color Escape Sequences
const COLORS = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  italic: '\x1b[3m',
  underline: '\x1b[4m',
  
  // Foreground Colors
  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  
  // Bright Foreground Colors
  brightRed: '\x1b[91m',
  brightGreen: '\x1b[92m',
  brightYellow: '\x1b[93m',
  brightBlue: '\x1b[94m',
  brightMagenta: '\x1b[95m',
  brightCyan: '\x1b[96m',
  brightWhite: '\x1b[97m',
  
  // Background Colors
  bgRed: '\x1b[41m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m'
};

function getTimestamp() {
  const now = new Date();
  return now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function sanitizePayload(payload) {
  if (!payload || typeof payload !== 'object') return payload;
  const clone = Array.isArray(payload) ? [...payload] : { ...payload };
  for (const key of Object.keys(clone)) {
    if (/password|secret|token|credential/i.test(key)) {
      clone[key] = '********';
    } else if (typeof clone[key] === 'object' && clone[key] !== null) {
      clone[key] = sanitizePayload(clone[key]);
    }
  }
  return clone;
}

/**
 * Request & Response Logging Middleware
 */
function terminalRequestLogger(req, res, next) {
  const startTime = process.hrtime();
  let capturedResponseJson = null;
  let cachedUser = 'Guest';

  // Safely extract user before response finishes (NEVER access req.session inside res.on('finish') to avoid ERR_HTTP_HEADERS_SENT)
  try {
    if (req.user?.username) {
      cachedUser = req.user.username;
    } else if (req.session?.user?.username) {
      cachedUser = req.session.user.username;
    }
  } catch (e) {}

  // Intercept res.json to capture response message for diagnostic logging
  const originalJson = res.json.bind(res);
  res.json = function (body) {
    capturedResponseJson = body;
    try {
      if (req.user?.username) {
        cachedUser = req.user.username;
      } else if (req.session?.user?.username) {
        cachedUser = req.session.user.username;
      } else if (body?.user?.username) {
        cachedUser = body.user.username;
      }
    } catch (e) {}
    return originalJson(body);
  };

  res.on('finish', () => {
    const diff = process.hrtime(startTime);
    const durationMs = (diff[0] * 1e3 + diff[1] * 1e-6).toFixed(1);
    const statusCode = res.statusCode;
    const method = req.method.toUpperCase().padEnd(6, ' ');
    const url = req.originalUrl || req.url;
    const user = cachedUser || req.user?.username || 'Guest';

    // Skip verbose logs for static bundle assets to keep terminal clean
    if (url.startsWith('/assets/') || url.endsWith('.ico') || url.endsWith('.png') || url.endsWith('.map')) {
      return;
    }

    let statusBadge = '';
    let statusText = '';
    let color = COLORS.reset;

    if (statusCode >= 500) {
      color = COLORS.brightRed;
      statusBadge = '🔴';
      statusText = `${statusCode} SERVER ERROR`;
    } else if (statusCode >= 400) {
      color = COLORS.brightYellow;
      statusBadge = '🟡';
      statusText = `${statusCode} CLIENT ERROR`;
    } else if (statusCode >= 300) {
      color = COLORS.brightCyan;
      statusBadge = '🔵';
      statusText = statusCode === 304 ? '304 NOT MODIFIED' : `${statusCode} REDIRECT`;
    } else {
      color = COLORS.brightGreen;
      statusBadge = '🟢';
      statusText = `${statusCode} OK`;
    }

    const timeStr = `${COLORS.dim}[${getTimestamp()}]${COLORS.reset}`;
    const userBadge = user !== 'Guest' ? `${COLORS.magenta}[User: ${user}]${COLORS.reset}` : `${COLORS.dim}[Guest]${COLORS.reset}`;
    const durationStr = `${COLORS.dim}(${durationMs}ms)${COLORS.reset}`;

    // Main Log Line
    console.log(`${timeStr} ${statusBadge} ${color}${COLORS.bold}${statusText.padEnd(16, ' ')}${COLORS.reset} ${COLORS.bold}${method}${COLORS.reset} ${url} ${durationStr} ${userBadge}`);

    // If Client Error (4xx), display the error message returned
    if (statusCode >= 400 && statusCode < 500 && capturedResponseJson) {
      const errMsg = capturedResponseJson.message || capturedResponseJson.error || JSON.stringify(capturedResponseJson);
      console.log(`   ${COLORS.brightYellow}↳ Warning/Message:${COLORS.reset} ${COLORS.yellow}${errMsg}${COLORS.reset}`);
    }

    // If Server Error (5xx), display prominent diagnostic box
    if (statusCode >= 500) {
      const errMsg = capturedResponseJson?.message || capturedResponseJson?.error || 'Unknown Server Error';
      console.log(`\n${COLORS.brightRed}┌─────────────────────────── [500 SERVER ERROR DETAILS] ───────────────────────────${COLORS.reset}`);
      console.log(`${COLORS.brightRed}│ URL:${COLORS.reset}      ${req.method} ${url}`);
      console.log(`${COLORS.brightRed}│ User:${COLORS.reset}     ${user}`);
      console.log(`${COLORS.brightRed}│ Message:${COLORS.reset}  ${errMsg}`);
      if (req.query && Object.keys(req.query).length > 0) {
        console.log(`${COLORS.brightRed}│ Query:${COLORS.reset}    ${JSON.stringify(req.query)}`);
      }
      if (req.body && Object.keys(req.body).length > 0) {
        console.log(`${COLORS.brightRed}│ Body:${COLORS.reset}     ${JSON.stringify(sanitizePayload(req.body))}`);
      }
      console.log(`${COLORS.brightRed}└─────────────────────────────────────────────────────────────────────────────────${COLORS.reset}\n`);
    }
  });

  next();
}

/**
 * Centralized Express Error Handling Middleware
 * Placed at the very end of Express middleware chain
 */
function terminalErrorHandler(err, req, res, next) {
  const user = req.session?.user?.username || req.user?.username || 'Guest';
  const url = req.originalUrl || req.url;
  const method = req.method;

  console.log(`\n${COLORS.bgRed}${COLORS.brightWhite}${COLORS.bold} ❌ CRITICAL APPLICATION ERROR CAUGHT IN SERVER ❌ ${COLORS.reset}`);
  console.log(`${COLORS.brightRed}┌─────────────────────────────────────────────────────────────────────────────────${COLORS.reset}`);
  console.log(`${COLORS.brightRed}│ Route:${COLORS.reset}       [${method}] ${url}`);
  console.log(`${COLORS.brightRed}│ User:${COLORS.reset}        ${user}`);
  console.log(`${COLORS.brightRed}│ Error Type:${COLORS.reset}  ${err.name || 'Error'}`);
  console.log(`${COLORS.brightRed}│ Message:${COLORS.reset}     ${COLORS.bold}${err.message}${COLORS.reset}`);
  if (req.body && Object.keys(req.body).length > 0) {
    console.log(`${COLORS.brightRed}│ Request Body:${COLORS.reset} ${JSON.stringify(sanitizePayload(req.body))}`);
  }
  console.log(`${COLORS.brightRed}├─ STACK TRACE (File & Line Number):${COLORS.reset}`);
  if (err.stack) {
    const stackLines = err.stack.split('\n').slice(1, 8);
    stackLines.forEach(line => {
      console.log(`${COLORS.dim}│ ${line.trim()}${COLORS.reset}`);
    });
  }
  console.log(`${COLORS.brightRed}└─────────────────────────────────────────────────────────────────────────────────${COLORS.reset}\n`);

  if (!res.headersSent) {
    res.status(err.status || 500).json({
      success: false,
      message: err.message || 'Internal Server Error'
    });
  }
}

/**
 * Setup Process-Level Crash Protection & Diagnostics
 */
function setupProcessErrorDiagnostics() {
  process.on('uncaughtException', (err) => {
    console.error(`\n${COLORS.bgRed}${COLORS.brightWhite}${COLORS.bold} 💥 UNCAUGHT EXCEPTION (Process level) 💥 ${COLORS.reset}`);
    console.error(`${COLORS.brightRed}${err.message}${COLORS.reset}`);
    if (err.stack) {
      console.error(err.stack);
    }
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.error(`\n${COLORS.bgYellow}${COLORS.black}${COLORS.bold} ⚠️ UNHANDLED PROMISE REJECTION ⚠️ ${COLORS.reset}`);
    if (reason instanceof Error) {
      console.error(`${COLORS.yellow}${reason.message}${COLORS.reset}`);
      if (reason.stack) console.error(reason.stack);
    } else {
      console.error(reason);
    }
  });
}

module.exports = {
  terminalRequestLogger,
  terminalErrorHandler,
  setupProcessErrorDiagnostics,
  COLORS
};

