// Final error-handling middleware — must be mounted last, after all routes.
// Never leaks a stack trace once NODE_ENV=production.
function errorHandler(err, _req, res, _next) {
  console.error(err);
  const isProd = process.env.NODE_ENV === 'production';
  const message = err.expose ? err.message : 'Khalad server ah ayaa dhacay.';
  res.status(err.status || 500).json(isProd ? { error: message } : { error: message, detail: err.message });
}

module.exports = { errorHandler };
