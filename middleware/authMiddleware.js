const jwt = require("jsonwebtoken");
const User = require("../models/userModel.js");
const asyncHandler = require("express-async-handler");

const protect = asyncHandler(async (req, res, next) => {
  let token;

  // Check if the authorization header contains a Bearer token
  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
    try {
      // Extract the token
      token = req.headers.authorization.split(" ")[1];

      // Decode the token and verify it using the secret
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Attach user info to request object
      req.user = await User.findById(decoded.user_id).select("-password");

      // Set user ID in headers for later use
      req.headers.userID = decoded.user_id;  // This sets userID in the headers
      req.headers.role = decoded.role;       // Also set role for access checks if needed

      next();  // Proceed to next middleware or route
    } catch (error) {
      console.error("Token verification error:", error);
      res.status(401).json({
        message: "Not authorized, token failed",
        status: false,
      });
    }
  } else {
    res.status(401).json({
      message: "Not authorized, no token provided",
      status: false,
    });
  }
});

module.exports = { protect };
