function notFound(req, res, next) {
  const error = new Error(`Route not found: ${req.method} ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
}

function errorHandler(error, req, res, next) {
  let statusCode = error.statusCode || 500;
  if (error.name === 'ValidationError' || error.name === 'CastError') statusCode = 422;
  if (error.name === 'MulterError' && error.code === 'LIMIT_FILE_SIZE') statusCode = 413;
  if (error.message === 'Only PDF and ePub files are allowed') statusCode = 400;
  if (error.code === 11000) statusCode = 409;
  if (statusCode >= 500) console.error(error);
  res.status(statusCode).json({
    success: false,
    message: statusCode >= 500 ? 'Internal server error' : error.message,
  });
}

module.exports = { notFound, errorHandler };
