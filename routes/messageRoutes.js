const express = require("express");
const {
  allMessages,
  sendMessage,
  clearMessages,
  deleteMessageForMe,
  deleteMessageForEveryone,
  clearAllMessages,
  forwardMessage
} = require("../controllers/messageControllers");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.route("/allMessages").post(protect, allMessages);
router.route("/sendMessage").post(protect, sendMessage);
router.route("/clearMessages").post(protect, clearMessages);
router.route("/deleteMessageForMe").post(protect, deleteMessageForMe);
router.route("/deleteMessageForEveryone").post(protect, deleteMessageForEveryone);
router.route("/clearAllMessages").post(protect, clearAllMessages);
router.route("/forwardMessage").post(protect, forwardMessage);

module.exports = router;
