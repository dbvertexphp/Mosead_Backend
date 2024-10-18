const asyncHandler = require("express-async-handler");
const User = require("../models/userModel");
const generateToken = require("../config/generateToken");
const upload = require("../middleware/uploadMiddleware.js");
const { createConnectyCubeUser } = require("../utils/connectyCubeUtils.js");
const cookie = require("cookie");


const allUsers = asyncHandler(async (req, res) => {
  const keyword = req.query.search
    ? {
        $or: [
          { name: { $regex: req.query.search, $options: "i" } },
          { email: { $regex: req.query.search, $options: "i" } },
        ],
      }
    : {};

  const users = await User.find(keyword).find({ _id: { $ne: req.user._id } });
  res.send(users);
});

const registerUser = asyncHandler(async (req, res) => {
  const { phone, country_code } = req.body;

  if (!phone || !country_code) {
    res.status(400);
    throw new Error("Please Enter Phone number or country_code");
  }

  const userExists = await User.findOne({ phone });

  if (userExists) {
    res.status(400);
    throw new Error("User already exists");
  }

  // Generate a 4-digit random OTP
  const otp = generateOTP();

  const user = await User.create({
    phone,
    otp,
    country_code,
  });

  if (user) {
    res.status(201).json({
      _id: user._id,
      phone: user.phone,
      otp_verified: user.otp_verified,
      otp: user.otp,
      country_code: user.country_code,
      isAdmin: user.isAdmin,
      token: generateToken(user._id, user.role),
    });
  } else {
    res.status(400);
    throw new Error("User not found");
  }
});

const verifyOtp = asyncHandler(async (req, res) => {
  const { phone, otp } = req.body;

  try {
    const user = await User.findOne({ phone });
    console.log(user);

    if (!user) {
      throw new Error("User Not Found. ", 400);
    }

    if (user.otp_verified) {
      throw new Error("User is already OTP verified.", 400);
    }

    // Check if the provided OTP matches the OTP in the user document
    if (user.otp !== otp) {
      throw new Error("Invalid OTP.", 400);
    }

    //     const { id } = await createConnectyCubeUser(phone, user.name, user.role);

    // Update the user's otp_verified field to 1 (OTP verified)
    const result = await User.updateOne(
      { _id: user._id },
      {
        $set: {
          otp_verified: 1,
        },
      }
    );

    if (result.nModified > 0) {
      console.log("OTP verification status updated successfully.");
    } else {
      console.log(
        "No matching user found or OTP verification status already set."
      );
    }

    // Retrieve the updated user document
    const updatedUser = await User.findById(user._id);

    const authToken = generateToken(updatedUser._id, updatedUser.role);

    // Set the token in a cookie for 30 days
    res.setHeader(
      "Set-Cookie",
      cookie.serialize("Websitetoken", authToken, {
        httpOnly: true,
        expires: new Date(Date.now() + 60 * 60 * 24 * 30 * 1000), // 30 days
        path: "/",
      })
    );

    res.json({
      user: updatedUser,
      token: authToken,
      status: true,
    });
  } catch (error) {
    throw new Error(error.message, 500);
  }
});

const resendOTP = asyncHandler(async (req, res) => {
  const { phone } = req.body;

  // Generate a new OTP
  const newOTP = generateOTP();

  // Find the user by mobile number
  const user = await User.findOne({ phone });

  //   const type = "Resend";
  // sendOTP(user.first_name, mobile, newOTP);
  if (!user) {
    throw new Error("User Not Found. ", 400);
  }

  // Update the user's otp field with the new OTP
  const result = await User.updateOne(
    { _id: user._id },
    { $set: { otp: newOTP } }
  );

  // Send the new OTP to the user (you can implement this logic)

  res.json({
    message: "New OTP sent successfully.",
    newOTP,
    status: true,
  });
});

const getUserById = asyncHandler(async (req, res) => {
      const userId = req.headers.userID; // Get user ID from URL parameters

      // Find the user by ID
      const user = await User.findById(userId); // Exclude password from the response

      if (!user) {
        res.status(404);
        throw new Error("User not found");
      }

      res.status(200).json({
        _id: user._id,
        name: user.name,
        about: user.about,
        phone: user.phone,
        otp_verified: user.otp_verified,
        country_code: user.country_code,
        isAdmin: user.isAdmin,
        cb_id: user.cb_id, // Include cb_id in the response if needed
      });
});

const updateProfile = asyncHandler(async (req, res) => {
  const { name, about, phone } = req.body;
  const userId = req.headers.userID;

  if (!userId) {
    res.status(401);
    throw new Error("User not authorized");
  }


  // Find the user by ID
  const user = await User.findById(userId);

  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }

  const password = String(phone) + "28";
  const phoneString = String(phone);

  // Only create a ConnectyCube user if cb_id is not already set
  if (!user.cb_id) {
    const { id } = await createConnectyCubeUser(
      phoneString,
      phone,
      password,
      name,
      user.role
    );
    user.cb_id = id; // Save the ConnectyCube ID
  }

  // Update fields if provided
  if (name) {
    user.name = name;
  }
  if (about) {
    user.about = about;
  }
  if (phone) {
    // Check if another user with the same phone number exists
    const phoneExists = await User.findOne({ phone, _id: { $ne: userId } });
    if (phoneExists) {
      res.status(400);
      throw new Error("Phone number already in use by another user");
    }
    user.phone = phone;
  }

  // Save the updated user
  const updatedUser = await user.save();

  res.status(200).json({
    _id: updatedUser._id,
    name: updatedUser.name,
    about: updatedUser.about,
    phone: updatedUser.phone,
    otp_verified: updatedUser.otp_verified,
    country_code: updatedUser.country_code,
    isAdmin: updatedUser.isAdmin,
    cb_id: updatedUser.cb_id, // Include cb_id in the response if needed
    token: generateToken(updatedUser._id, updatedUser.role), // Generate token if needed
  });
});

const logoutUser = asyncHandler(async (req, res) => {
      const authHeader = req.headers.authorization;

      if (authHeader) {
        const token = authHeader.split(" ")[1]; // Extract token from "Bearer {token}"

        // Expire the cookie immediately
        res.setHeader(
          "Set-Cookie",
          cookie.serialize("Websitetoken", "", {
            httpOnly: true, // Set to true for security
            expires: new Date(0), // Set the expiration date to the past
            path: "/", // Specify the path for the cookie
          })
        );

        return res.json({ message: "Logout successful", status: true });
      } else {
        return res.status(401).json({ message: "Invalid token", status: false });
      }
    });

function generateOTP() {
  const min = 1000; // Minimum 4-digit number
  const max = 9999; // Maximum 4-digit number

  // Generate a random number between min and max (inclusive)
  const otp = Math.floor(Math.random() * (max - min + 1)) + min;

  return otp.toString(); // Convert the number to a string
}

const authUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email });

  if (user && (await user.matchPassword(password))) {
    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      isAdmin: user.isAdmin,
      pic: user.pic,
      token: generateToken(user._id),
    });
  } else {
    res.status(401);
    throw new Error("Invalid Email or Password");
  }
});

module.exports = {
  allUsers,
  registerUser,
  authUser,
  verifyOtp,
  resendOTP,
  updateProfile,
  getUserById,
  logoutUser
};
