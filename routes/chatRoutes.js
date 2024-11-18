const express = require("express");
const {
  accessChat,
  fetchChats,
  createGroupChat,
  removeFromGroup,
  addToGroup,
  renameGroup,
  getMyGroups,
  chatDelete
} = require("../controllers/chatControllers");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.route("/accessChat").post(protect, accessChat);
router.route("/chatDelete").post(protect, chatDelete);
router.route("/fetchChats").get(protect, fetchChats);
router.route("/getMyGroups").get(protect, getMyGroups);
router.route("/group").post(protect, createGroupChat);
router.route("/rename").put(protect, renameGroup);
router.route("/groupremove").put(protect, removeFromGroup);
router.route("/groupadd").put(protect, addToGroup);

module.exports = router;
