function notFound(req, res, next) {
  const error = new Error('API route not found');
  error.statusCode = 404;
  next(error);
}

function errorHandler(error, req, res, next) {
  let statusCode = error.statusCode || 500;
  let message = error.message;
  if (error.name === 'ValidationError' || error.name === 'CastError') {
    statusCode = 422;
    message = 'The supplied data is invalid';
  }
  if (error.name === 'MulterError' && error.code === 'LIMIT_FILE_SIZE') statusCode = 413;
  if (error.name === 'MulterError' && ['LIMIT_FILE_COUNT', 'LIMIT_PART_COUNT', 'LIMIT_FIELD_COUNT', 'LIMIT_FIELD_KEY', 'LIMIT_FIELD_VALUE'].includes(error.code)) statusCode = 400;
  if (error.message === 'Only PDF and ePub files are allowed') statusCode = 400;
  if (error.message === 'Invalid file name') statusCode = 400;
  if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
    statusCode = 400;
    message = 'Malformed JSON body';
  }
  if (error.code === 11000) statusCode = 409;
  if (statusCode >= 500) console.error(error);
  res.status(statusCode).json({
    success: false,
    message: statusCode >= 500 ? 'Internal server error' : (message || 'Request failed'),
  });
}

module.exports = { notFound, errorHandler };
