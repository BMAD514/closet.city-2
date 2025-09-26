const LEVELS = {
  INFO: 'info',
  ERROR: 'error',
  AUDIT: 'audit',
};

function log(level, message, context = {}) {
  const payload = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...context,
  };

  const serialized = JSON.stringify(payload);

  if (level === LEVELS.ERROR) {
    console.error(serialized);
  } else {
    console.log(serialized);
  }
}

function info(message, context) {
  log(LEVELS.INFO, message, context);
}

function error(message, context) {
  log(LEVELS.ERROR, message, context);
}

function audit(message, context) {
  log(LEVELS.AUDIT, message, context);
}

module.exports = {
  info,
  error,
  audit,
};
