const config = require('../config');

function authMiddleware(req, res, next) {
    // Check for an Authorization header (this is a simplified example)
    //const token = req.headers.authorization;

    // In a real app, you'd verify the token format and signature (e.g., using JWT)
    //if (!token || token !== "MY_SECRET_TOKEN") {
    //    return res.status(401).json({ error: "Unauthorized" });
    //}

    // if ADMIN_MODE is not true, then return unauthorized
    if (!config.ADMIN_MODE) {
        return res.status(401).json({ error: "Unauthorized" });
    }

    // If authentication passed, move on to the next middleware or route handler
    next();
}

module.exports = { authMiddleware };