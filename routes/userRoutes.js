const express = require("express");
const {
  registerUser,
  allUsers,
  verifyOtp,
  resendOTP,
  updateProfile,
  getUserById,
  logoutUser,
} = require("../controllers/userControllers");
const { protect } = require("../middleware/authMiddleware");
const Authorization = require("../middleware/Authorization.middleware.js");


const router = express.Router();


router.route("/register").post(registerUser);
router.route("/verifyOtp").post(verifyOtp);
router.route("/resendOTP").post(resendOTP);
router.route("/updateProfile").post(protect ,updateProfile);
router.route("/getUserById").get(protect, getUserById);
router.route("/getAllUsers").get(protect, allUsers);
router.route("/logoutUser").post(protect, logoutUser);


module.exports = router;
