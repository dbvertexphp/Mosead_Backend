const asyncHandler = require("express-async-handler");
const User = require("../models/userModel");
const generateToken = require("../config/generateToken");
const uploadFile = require("../middleware/uploadCommanFile.js");
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
  const { phone, country_code, firebase_token } = req.body;

  if (!phone || !country_code) {
    res.status(400);
    throw new Error("Please Enter Phone number or country_code");
  }

  let user = await User.findOne({ phone });

  const otp = generateOTP();

  if (user) {
    user.otp = otp;
    user.firebase_token = firebase_token;
    await user.save();
  } else {
    user = await User.create({
      phone,
      otp,
      country_code,
      firebase_token,
    });
  }

  if (user) {
    res.status(201).json({
      temp_otp: user.otp,
      status: true,
      message: "User registered successfully",
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

    if (!user) {
      throw new Error("User Not Found. ", 400);
    }

    // Check if the provided OTP matches the OTP in the user document
    if (user.otp !== otp) {
      throw new Error("Invalid OTP.", 400);
    }

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
      message: "OTP Verify successfully",
    });
  } catch (error) {
    throw new Error(error.message, 500);
  }
});

const loginUser = asyncHandler(async (req, res) => {
  const { phone } = req.body;

  // Validate the phone number
  if (!phone) {
    res.status(400);
    throw new Error("Please provide the phone number");
  }

  try {
    // Find user by phone number
    const user = await User.findOne({ phone });

    // If user is not found, send an error
    if (!user) {
      res.status(404);
      throw new Error("User not found");
    }

    // Check if the user role is admin
    if (user.role === "admin") {
      const authToken = generateToken(user._id, user.role);

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
        user,
        token: authToken,
        status: true,
        message: "Admin login successful",
      });
    } else {
      res.status(400);
      throw new Error("Unauthorized: Only admin can log in");
    }
  } catch (error) {
    res.status(500);
    throw new Error(error.message || "Server error");
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
    temp_otp: newOTP,
    status: true,
  });
});

const getUserById = asyncHandler(async (req, res) => {
  const { uid } = req.body;
  const userId = uid || req.headers.userID; // Get user ID from URL parameters

  // Find the user by ID
  const user = await User.findById(userId); // Exclude password from the response

  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }

  res.status(200).json({
    user,
    status: true,
    message: "Fetch User Details successfully",
  });
});

const updateProfile = asyncHandler(async (req, res) => {
  req.uploadPath = "uploads/profiles";
  uploadFile.single("profile_pic")(req, res, async (err) => {
    if (err) {
      return next(new ErrorHandler(err.message, 400));
    }
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

    const password = "mosead_" + String(phone) + "28";

    const phoneString = "mosead_" + String(phone);

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

    // Get the profile picture path if uploaded
    if (req.file) {
      user.profile_pic = `${req.uploadPath}/${req.file.filename}`;
    }

    // Save the updated user
    const updatedUser = await user.save();

    res.status(200).json({
      user: updatedUser,
      status: true,
      message: "User details update successfully",
    });
  });
});

const getUserProfileData = asyncHandler(async (req, res) => {
  const userId = req.headers.userID; // Get the userID from the request header

  if (!userId) {
    res.status(401);
    throw new Error("User not authorized");
  }

  // Find the user by ID
  const user = await User.findById(userId).select("-password"); // Select all fields except password

  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }

  // Return the user profile data
  res.status(200).json({
    user: user,
    status: true,
    message: "User profile retrieved successfully",
  });
});

const getUserDataByCbId = asyncHandler(async (req, res) => {
  const { cbId } = req.body; // Get the userID from the request header

  if (!cbId) {
    res.status(401);
    throw new Error("cbId not Found");
  }

  // Find the user by ID
  const user = await User.find({ cb_id: cbId }).select("-password"); // Select all fields except password

  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }

  // Return the user profile data
  res.status(200).json({
    user: user,
    status: true,
    message: "User profile retrieved successfully",
  });
});

const logoutUser = asyncHandler(async (req, res) => {
  const authHeader = req.headers.authorization;

  if (authHeader) {
    const token = authHeader.split(" ")[1];

    const userId = req.headers.userID;

    await User.updateOne(
      { _id: userId },
      { $set: { otp_verified: 0, firebase_token: "" } }
    );

    // Expire the cookie immediately
    res.setHeader(
      "Set-Cookie",
      cookie.serialize("Websitetoken", "", {
        httpOnly: true,
        expires: new Date(0),
        path: "/",
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

const getUserDetailsByPhones = asyncHandler(async (req, res) => {
  const userId = req.headers.userID;
  const { numbers, name } = req.body;

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        status: false,
        message: "User not found.",
      });
    }

    // Create the search query object
    let searchQuery = {};

    if (numbers && numbers.length > 0) {
      searchQuery.phone = { $in: numbers };
    }

    if (name) {
      searchQuery.name = { $regex: name, $options: "i" }; // case-insensitive search
    }

    if (!numbers && !name) {
      // If neither 'numbers' nor 'name' are provided, get the users from 'userIds'
      searchQuery = { _id: { $in: user.userIds } };
    }

    // Search for users based on phone numbers and/or name or userIds
    const users = await User.find(searchQuery);

    if (users.length === 0) {
      return res.status(404).json({
        status: false,
        message: "No users found for the provided search criteria.",
        data: [],
      });
    }

    const userIdsToAdd = users
      .map((otherUser) => otherUser._id)
      .filter((id) => !id.equals(user._id)); // Ensure no self-reference

    if (userIdsToAdd.length > 0) {
      await User.updateOne(
        { _id: user._id },
        { $addToSet: { userIds: { $each: userIdsToAdd } } }
      );

      // Refetch the updated user data and populate the `userIds` field
      const updatedUser = await User.findById(user._id).populate("userIds");

      return res.status(200).json({
        status: true,
        message: "User IDs added successfully to the main user.",
        data: updatedUser,
      });
    } else {
      // If no new unique user IDs were added, still return the user data with populated `userIds`
      const populatedUser = await User.findById(user._id).populate("userIds");

      res.status(200).json({
        status: true,
        message: "No new unique user IDs to add.",
        data: populatedUser,
      });
    }
  } catch (error) {
    console.error("Error fetching or updating users:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

const getAllUsers = asyncHandler(async (req, res) => {
      const { page = 1, limit = 10, search = "" } = req.query;

      // Convert page and limit to integers
      const pageNumber = parseInt(page, 10);
      const limitNumber = parseInt(limit, 10);

      // Create a search query
      const searchQuery = search
        ? {
            $or: [
              { name: { $regex: search, $options: "i" } },
            ],
          }
        : {};

      // Count total users for pagination
      const totalUsers = await User.countDocuments(searchQuery);

      // Fetch users with pagination and search
      const users = await User.find(searchQuery)
        .skip((pageNumber - 1) * limitNumber)
        .limit(limitNumber);

      res.status(200).json({
        status: true,
        totalUsers,
        currentPage: pageNumber,
        totalPages: Math.ceil(totalUsers / limitNumber),
        users,
      });
});


module.exports = {
  allUsers,
  registerUser,
  authUser,
  verifyOtp,
  resendOTP,
  updateProfile,
  getUserById,
  logoutUser,
  getUserDetailsByPhones,
  getUserProfileData,
  getUserDataByCbId,
  loginUser,
  getAllUsers
};
