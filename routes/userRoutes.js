const express = require("express");
const {
  registerUser,
  allUsers,
  verifyOtp,
  resendOTP,
  updateProfile,
  getUserById,
  logoutUser,
  getUserDetailsByPhones
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
router.route("/logout").post(protect, logoutUser);
router.route("/auth/getUserDetailsByPhones").post(getUserDetailsByPhones);


module.exports = router;
