const express = require("express");
const {
  registerUser,
  allUsers,
  verifyOtp,
  resendOTP,
  updateProfile,
  getUserById,
  logoutUser,
  getUserDetailsByPhones,
  getUserProfileData
} = require("../controllers/userControllers");
const { protect } = require("../middleware/authMiddleware");
const Authorization = require("../middleware/Authorization.middleware.js");


const router = express.Router();


router.route("/auth/signInWithPhone").post(registerUser);
router.route("/auth/verifyOTP").post(verifyOtp);
router.route("/auth/resendOTP").post(resendOTP);
router.route("/setUserData").post(protect ,updateProfile);
router.route("/getUserData").post(protect, getUserById);
router.route("/getAllUsers").get(protect, allUsers);
router.route("/getUserProfileData").get(protect, getUserProfileData);
router.route("/logout").post(protect, logoutUser);
router.route("/auth/getUserDetailsByPhones").post(protect, getUserDetailsByPhones);


module.exports = router;
