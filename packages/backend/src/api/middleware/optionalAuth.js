const jwt = require('jsonwebtoken');
const { jwt: jwtCfg } = require('../../config/env');

/**
 * Optional JWT parser for rate limiting.
 * If token is valid, attaches decoded payload to req.rateLimitUser.
 * If token is missing/invalid, request continues normally.
 */
const optionalAuth = (req, res, next) => {
    const authHeader = req.headers.authorization || '';

    if (!authHeader.startsWith('Bearer ')) {
        return next();
    }

    const token = authHeader.slice(7);

    try {
        const payload = jwt.verify(token, jwtCfg.secret);
        req.rateLimitUser = payload;
    } catch (err) {
        // Ignore invalid/expired token here.
        // Protected routes still use authenticate() and will reject invalid tokens.
    }

    return next();
};

module.exports = { optionalAuth };