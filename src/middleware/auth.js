function gatewayAuth(gatewayApiKey) {
  if (!gatewayApiKey) return (req, reply, next) => next();
  return function (req, reply, next) {
    const auth = req.headers.authorization;
    const token = auth && auth.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token || token !== gatewayApiKey) {
      return reply.status(401).send({
        error: { message: 'Invalid or missing gateway API key', type: 'unauthorized' },
      });
    }
    next();
  };
}

module.exports = { gatewayAuth };
