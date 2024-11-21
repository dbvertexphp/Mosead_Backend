const asyncHandler = require("express-async-handler");
const Message = require("../models/messageModel");
const User = require("../models/userModel");
const Chat = require("../models/chatModel");
const { upload, checkTotalSize } = require("../middleware/uploadMiddleware.js");
const CryptoJS = require("crypto-js");

const allMessages = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { chatId, page = 1, limit = 10, search = "" } = req.body;

  try {
    if (!chatId) {
      return res
        .status(400)
        .json({ message: "chatId is requires", status: false });
    }
    // Fetch messages matching the chat ID and not deleted for the user
    const query = {
      chat: chatId,
      deletedFor: { $nin: [userId] },
    };

    const messages = await Message.find(query)
      .sort({ createdAt: -1 }) // Sort messages by creation date, newest first
      .skip((page - 1) * limit) // Skip messages for previous pages
      .limit(limit) // Limit to the specified number of messages
      .populate("chat");

    // If no messages are found, return a message indicating so
    if (messages.length === 0) {
      return res.status(404).json({
        message: "No messages found for this chat.",
        status: false,
      });
    }

    // Decrypt and filter messages
    const filteredMessages = messages
      .map((message) => {
        const bytes = CryptoJS.AES.decrypt(
          message.content,
          process.env.SECRET_KEY
        );
        const originalContent = bytes.toString(CryptoJS.enc.Utf8);
        return {
          ...message.toObject(),
          content: originalContent,
        };
      })
      .filter((message) =>
        message.content.toLowerCase().includes(search.toLowerCase())
      );

    // Get the total count of messages for the given chat
    const totalMessages = await Message.countDocuments(query);
    const totalPages = Math.ceil(totalMessages / limit);

    res.json({
      messages: filteredMessages,
      page,
      limit,
      totalMessages,
      totalPages,
      status: true,
    });
  } catch (error) {
    res.status(400).json({ message: error.message, status: false });
  }
});

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

        const response = {
          ...message.toObject(),
          sender: message.sender._id,
        };

        res.json({
          message: "Message sent successfully",
          status: true,
          data: response, // Including the message object
        });
      } catch (error) {
        res.status(400);
        throw new Error(error.message);
      }
    });
  });
});

const clearMessages = asyncHandler(async (req, res) => {
  const { chatId } = req.body;

  try {
    // Delete all messages associated with the chatId
    await Message.deleteMany({ chat: chatId });

    // Update the latestMessage field in the chat to null
    await Chat.findByIdAndUpdate(chatId, { latestMessage: null });

    res.status(200).json({
      message: "All messages cleared successfully",
      status: true,
    });
  } catch (error) {
    res.status(400);
    throw new Error("Failed to clear messages: " + error.message);
  }
});

const deleteMessageForMe = asyncHandler(async (req, res) => {
  const { messageIds } = req.body;
  if (!messageIds || !Array.isArray(messageIds) || messageIds.length === 0) {
    return res.status(400).json({
      message: "Message IDs are required and should be an array",
      status: false,
    });
  }

  try {
    const updatedMessages = [];

    for (const messageId of messageIds) {
      const message = await Message.findById(messageId);
      if (!message) {
        // Skip if message not found
        continue;
      }

      // Add user to the 'deletedFor' array if not already included
      if (!message.deletedFor.includes(req.user._id)) {
        message.deletedFor.push(req.user._id);
        await message.save();
        updatedMessages.push(messageId);
      }
    }

    res.json({
      message: "Messages deleted for you successfully",
      updatedMessageIds: updatedMessages, // List of successfully processed message IDs
      status: true,
    });
  } catch (error) {
    res.status(500).json({ message: error.message, status: false });
  }
});

const deleteMessageForEveryone = asyncHandler(async (req, res) => {
  const { messageId } = req.body;
  if (!messageId) {
    return res
      .status(400)
      .json({ message: "Message ID is required", status: false });
  }

  try {
    const message = await Message.findById(messageId);

    if (!message) {
      return res
        .status(404)
        .json({ message: "Message not found", status: false });
    }

    // Ensure only the sender can delete the message for everyone
    if (message.sender.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        message: "You are not authorized to delete this message",
        status: false,
      });
    }

    // Delete the message from the database
    await Message.deleteOne({ _id: messageId });

    res.json({
      message: "Message deleted for everyone successfully",
      status: true,
    });
  } catch (error) {
    res.status(500).json({ message: error.message, status: false });
  }
});

const clearAllMessages = asyncHandler(async (req, res) => {
  const { chatId } = req.body;

  if (!chatId) {
    return res
      .status(400)
      .json({ message: "Chat ID is required", status: false });
  }

  try {
    // Update all messages in the chat to include the user's ID in the `deletedFor` array
    const result = await Message.updateMany(
      { chat: chatId, deletedFor: { $nin: [req.user._id] } }, // Only update messages not already deleted for the user
      { $push: { deletedFor: req.user._id } }
    );

    res.json({
      message: `All messages in the chat have been cleared for you successfully.`,
      status: true,
      updatedCount: result.nModified, // Number of messages updated
    });
  } catch (error) {
    res.status(500).json({ message: error.message, status: false });
  }
});

const forwardMessage = asyncHandler(async (req, res) => {
  const { messageIds, userIds } = req.body;
  // Validate input
  if (
    !messageIds ||
    !userIds ||
    !Array.isArray(messageIds) ||
    !Array.isArray(userIds)
  ) {
    return res.status(400).json({
      message: "Invalid input. messageIds and userIds must be arrays.",
      status: false,
    });
  }

  try {
    // Fetch messages to forward
    const messages = await Message.find({ _id: { $in: messageIds } })
      .populate("chat")
      .populate("sender", "name profile_pic");

    if (!messages.length) {
      return res.status(404).json({
        message: "No messages found to forward.",
        status: false,
      });
    }

    const newMessages = [];

    // Process each message and forward to each user
    for (const message of messages) {
      const decryptedContent = CryptoJS.AES.decrypt(
        message.content,
        process.env.SECRET_KEY
      ).toString(CryptoJS.enc.Utf16);

      for (const userId of userIds) {
        const newMessage = {
          sender: req.user._id,
          content: CryptoJS.AES.encrypt(
            decryptedContent,
            process.env.SECRET_KEY
          ).toString(), // Re-encrypt for forwarding
          chat: message.chat._id,
          media: message.media, // Forward media if any
        };

        const createdMessage = await Message.create(newMessage);

        // Populate the new message fields
        const populatedMessage = await createdMessage
          .populate("sender", "name profile_pic")
          .execPopulate();
        await populatedMessage.populate("chat").execPopulate();

        // Add to the response array
        newMessages.push({
          ...populatedMessage.toObject(),
          sender: populatedMessage.sender._id, // Only include sender ID
        });

        // Update the chat with the latest message
        await Chat.findByIdAndUpdate(message.chat._id, {
          latestMessage: createdMessage,
        });
      }
    }

    res.status(201).json({
      message: "Messages forwarded successfully.",
      status: true,
      data: newMessages,
    });
  } catch (error) {
    res.status(500).json({
      message: error.message || "An error occurred while forwarding messages.",
      status: false,
    });
  }
});

module.exports = {
  allMessages,
  sendMessage,
  clearMessages,
  deleteMessageForMe,
  deleteMessageForEveryone,
  clearAllMessages,
  forwardMessage,
};
