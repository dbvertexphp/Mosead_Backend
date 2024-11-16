const asyncHandler = require("express-async-handler");
const Message = require("../models/messageModel");
const User = require("../models/userModel");
const Chat = require("../models/chatModel");
const upload = require("../middleware/uploadMiddleware.js");

//@description     Get all Messages
//@route           GET /api/Message/:chatId
//@access          Protected
const allMessages = asyncHandler(async (req, res) => {
  try {
    const messages = await Message.find({ chat: req.params.chatId })
      .populate("sender", "name pic email")
      .populate("chat");
    res.json(messages);
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
      return next(new ErrorHandler(err.message, 400)); // Handle file upload error
    }
    const { content, chatId } = req.body;

    if (!content || !chatId) {
      console.log("Invalid data passed into request");
      return res.sendStatus(400);
    }

    var newMessage = {
      sender: req.user._id,
      content: content,
      chat: chatId,
      media: [],
    };

    // If media files are uploaded, save their paths to the newMessage object
    if (req.files && req.files.length > 0) {
      req.files.forEach(file => {
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

      await Chat.findByIdAndUpdate(req.body.chatId, { latestMessage: message });

      res.json(message);
    } catch (error) {
      res.status(400);
      throw new Error(error.message);
    }
  });
});

module.exports = { allMessages, sendMessage };
