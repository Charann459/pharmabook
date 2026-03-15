/**
 * Joi validation middleware factory.
 *
 * Usage:
 *   router.post('/login', validate(schemas.login), handler)
 *
 * target: 'body' | 'query' | 'params'
 */
const validate = (schema, target = 'body') => (req, res, next) => {
  const { error, value } = schema.validate(req[target], { abortEarly: false, stripUnknown: true });

  if (error) {
    return res.status(400).json({
      error: 'Validation failed',
      details: error.details.map((d) => d.message),
    });
  }

  req[target] = value;
  next();
};

module.exports = { validate };
