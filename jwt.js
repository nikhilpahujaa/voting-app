const jwt = require('jsonwebtoken');

// Middleware to authenticate JWT
const jwtAuthMiddleware = (req, res, next) => {
    // Check if the Authorization header is present
    const authorization = req.headers.authorization;
    if (!authorization) {
        return res.status(401).json({ error: 'Token Not Found' });
    }

    // Extract the JWT token from the Authorization header
    const token = authorization.split(' ')[1];
    if (!token) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        // Verify the JWT token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        console.log('Decoded JWT:', decoded); // Log the decoded token data

        // Attach user information to the request object
        req.user = decoded;
        next();
    } catch (err) {
        console.error('JWT verification error:', err);
        res.status(401).json({ error: 'Invalid token' });
    }
};

// Function to generate JWT token
const generateToken = (userData) => {
    // Generate a new JWT token using user data, with an expiration time of 3000 seconds
    return jwt.sign(userData, process.env.JWT_SECRET, { expiresIn: 3000 });
};

module.exports = { jwtAuthMiddleware, generateToken };
