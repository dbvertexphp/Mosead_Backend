const asyncHandler = require("express-async-handler");
const Message = require("../models/messageModel");
const User = require("../models/userModel");
const Chat = require("../models/chatModel");
const { upload, checkTotalSize } = require("../middleware/uploadMiddleware.js");
const CryptoJS = require("crypto-js");

//@description     Get all Messages
//@route           GET /api/Message/:chatId
//@access          Protected
const allMessages = asyncHandler(async (req, res) => {
  try {
    const messages = await Message.find({ chat: req.params.chatId })
      .populate("sender", "name pic email")
      .populate("chat");
    // Decrypt each message's content
    const decryptedMessages = messages.map((message) => {
      const bytes = CryptoJS.AES.decrypt(
        message.content,
        process.env.SECRET_KEY
      );
      const originalContent = bytes.toString(CryptoJS.enc.Utf8);
      return { ...message.toObject(), content: originalContent }; // Replace encrypted content with decrypted
    });

    res.json(decryptedMessages);
  } catch (error) {
    res.status(400);
    throw new Error(error.message);
  }
});

//@description     Create New Message
//@route           POST /api/Message/
//@access          Protected
const sendMessage = asyncHandler(async (req, res) => {
  req.uploadPath = "uploads/media";

  upload(req, res, async (err) => {
    if (err) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
          message: "File too large. Maximum size per file is 16 MB.",
          status: false,
        });
      }
      return res.status(400).json({ message: err.message });
    }

    // Check total size of all uploaded files
    checkTotalSize(req, res, async () => {
      const { content, chatId } = req.body;

      if (!content || !chatId) {
        console.log("Invalid data passed into request");
        return res.sendStatus(400);
      }

      // Encrypt the content
      const encryptedContent = CryptoJS.AES.encrypt(
        content,
        process.env.SECRET_KEY
      ).toString();

      var newMessage = {
        sender: req.user._id,
        content: encryptedContent,
        chat: chatId,
        media: [],
      };

      // If media files are uploaded, save their paths to the newMessage object
      if (req.files && req.files.length > 0) {
        req.files.forEach((file) => {
          newMessage.media.push(`${req.uploadPath}/${file.filename}`); // Save the media file paths
        });
      }

      try {
        var message = await Message.create(newMessage);

        message = await message
          .populate("sender", "name profile_pic")
          .execPopulate();
        message = await message.populate("chat").execPopulate();
        message = await User.populate(message, {
          path: "chat.users",
          select: "name profile_pic phone",
        });

        await Chat.findByIdAndUpdate(req.body.chatId, {
          latestMessage: message,
        });

        res.json(message);
      } catch (error) {
        res.status(400);
        throw new Error(error.message);
      }
    });
  });
});

module.exports = { allMessages, sendMessage };
