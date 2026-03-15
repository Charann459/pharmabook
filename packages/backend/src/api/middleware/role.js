const ROLES = {
  OWNER: 'owner',
  CASHIER: 'cashier',
  INV_MANAGER: 'inv_manager',
};

/**
 * Factory: returns middleware that allows only the specified roles.
 *
 * Usage:
 *   router.get('/reports', authenticate, requireRole('owner'), handler)
 *   router.post('/bills',  authenticate, requireRole('owner', 'cashier'), handler)
 */
const requireRole = (...allowedRoles) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthenticated' });
  }

  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({
      error: `Access denied. Required role: ${allowedRoles.join(' or ')}`,
    });
  }

  next();
};

module.exports = { requireRole, ROLES };
