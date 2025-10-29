const { ZodError } = require('zod');

const formatZodIssues = (issues) =>
  issues.map((issue) => ({
    path: issue.path.join('.'),
    message: issue.message,
    code: issue.code
  }));

const buildValidationMiddleware = (schema, property) => {
  return (req, res, next) => {
    try {
      const parsed = schema.parse(req[property]);
      res.locals[`${property}Validated`] = parsed;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          error: 'ValidationError',
          details: formatZodIssues(error.issues)
        });
      }

      return next(error);
    }
  };
};

const validateBody = (schema) => buildValidationMiddleware(schema, 'body');
const validateQuery = (schema) => buildValidationMiddleware(schema, 'query');
const validateParams = (schema) => buildValidationMiddleware(schema, 'params');

module.exports = {
  validateBody,
  validateQuery,
  validateParams
};
