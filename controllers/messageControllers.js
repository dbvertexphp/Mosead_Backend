const asyncHandler = require("express-async-handler");
const Message = require("../models/messageModel");
const User = require("../models/userModel");
const Chat = require("../models/chatModel");
const CallHistory = require("../models/callHistoryModel.js");
const { upload, checkTotalSize } = require("../middleware/uploadMiddleware.js");
const CryptoJS = require("crypto-js");
const moment = require("moment-timezone");
const {
  sendMessageNotification,
  sendCallNotification,
} = require("../utils/sendNotification");

const allMessages = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { chatId, page = 1, limit = 25, search = "" } = req.body;

  try {
    if (!chatId) {
      return res
        .status(400)
        .json({ message: "chatId is required", status: false });
    }

    // Query to fetch messages for the chat and not deleted for the user
    const query = {
      chat: chatId,
      deletedFor: { $nin: [userId] },
    };

    // Get total message count for the chat
    const totalMessages = await Message.countDocuments(query);

    // Calculate how many messages to skip
    //   const skipMessages = (page - 1) * limit;

    let count = page * 25;

    // Fetch messages with correct pagination
    const messages = await Message.find(query)
      .sort({ createdAt: "desc" })
      .skip(count - 25)
      .limit(limit)
      .populate("chat");

    // messages.reverse();

    // If no messages are found, return a message indicating so
    if (messages.length === 0) {
      return res.status(404).json({
        message: "No messages found for this chat.",
        status: false,
      });
    }

    // Update `readBy` field directly in the database
    const messageIds = messages.map((message) => message._id);
    await Message.updateMany(
      { _id: { $in: messageIds }, readBy: { $nin: [userId] } },
      { $addToSet: { readBy: userId } }
    );

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

    // Calculate total pages
    const totalPages = Math.ceil(totalMessages / limit);

    res.json({
      messages: filteredMessages.reverse(), // Reverse to show oldest first in each page
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

      // Check if chatId is present, if not, return an error
      if (!chatId) {
        console.log("Chat ID is required");
        return res.sendStatus(400);
      }
      // Encrypt content if it's provided, otherwise set it to an empty string
      let encryptedContent = "";
      if (content) {
        encryptedContent = CryptoJS.AES.encrypt(
          content,
          process.env.SECRET_KEY
        ).toString();
      }

      const currentDate = moment();
      let istDate = currentDate
        .tz("Asia/Kolkata")
        .format("YYYY-MM-DDTHH:mm:ss.SSSZ");

      var newMessage = {
        sender: req.user._id,
        content: encryptedContent, // If content is empty, it will remain an empty string
        chat: chatId,
        media: [],
        readBy: [req.user._id],
        createdAt: istDate,
        updatedAt: istDate,
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

        message.content = decryptedContent(message.content);

        const response = {
          ...message.toObject(),
          sender: message.sender._id,
        };

        res.json({
          message: "Message sent successfully",
          status: true,
          data: response,
        });
      } catch (error) {
        res.status(400);
        throw new Error(error.message);
      }
    });
  });
});

const saveCallHistory = asyncHandler(async (req, res) => {
  try {
    const userId = req.user._id;
    const { call, chatId, duration } = req.body;

    // Validation
    if (!chatId || !call || !duration) {
      return res.status(400).json({ message: "All Fields is required" });
    }

    const currentDate = moment();
    let istDate = currentDate
      .tz("Asia/Kolkata")
      .format("YYYY-MM-DDTHH:mm:ss.SSSZ");

    const callHistory = new CallHistory({
      sender: userId,
      chat: chatId,
      call: call,
      duration: duration,
      createdAt: istDate,
      updatedAt: istDate,
    });

    const savedCallHistory = await callHistory.save();

    res.status(201).json({
      success: true,
      message: "Call history saved successfully",
      data: savedCallHistory,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "An error occurred while saving call history",
      error: error.message,
    });
  }
});

const callNotification = asyncHandler(async (req, res) => {
  const data = req.body;
  const { userId } = data;
  try {
    const user = await User.findById(userId);

    if (!user || !user.firebase_token) {
      return {
        success: false,
        message: "User not found or firebase_token is missing",
      };
    }

    const registrationToken = user.firebase_token;
    const notificationResponse = await sendCallNotification(
      data,
      registrationToken
    );

    // Respond with a success message
    res.status(200).json({
      message: "Data received successfully",
      data: notificationResponse,
      status: true,
    });
  } catch (error) {
    console.error("Error in callNotification:", error.message);

    // Respond with an error message
    res.status(500).json({
      message: "Failed to process notification",
      error: error.message,
      status: false,
    });
  }
});

const getAllCallHistoryByUser = asyncHandler(async (req, res) => {
  try {
    const userId = req.user._id;

    // Fetch call history for the logged-in user
    const callHistories = await CallHistory.find({ sender: userId })
      .populate("sender", "name phone profile_pic")
      .populate({
        path: "chat",
        populate: {
          path: "users"
        },
      })
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      message: "User's call history retrieved successfully",
      data: callHistories,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "An error occurred while retrieving user's call history",
      error: error.message,
    });
  }
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
  const { messageIds } = req.body;

  // Validate messageIds
  if (!messageIds || !Array.isArray(messageIds) || messageIds.length === 0) {
    return res.status(400).json({
      message: "Message IDs are required and should be an array",
      status: false,
    });
  }

  try {
    const failedDeletes = [];
    const successfulDeletes = [];

    // Loop through each messageId
    for (const messageId of messageIds) {
      const message = await Message.findById(messageId);

      // If the message does not exist, add it to failedDeletes and continue
      if (!message) {
        failedDeletes.push({ messageId, reason: "Message not found" });
        continue;
      }

      // Ensure only the sender can delete the message for everyone
      if (message.sender.toString() !== req.user._id.toString()) {
        failedDeletes.push({
          messageId,
          reason: "Not authorized to delete this message",
        });
        continue;
      }

      // Delete the message from the database
      await Message.deleteOne({ _id: messageId });
      successfulDeletes.push(messageId);
    }

    res.json({
      message: "Messages processed for deletion",
      successfulDeletes,
      failedDeletes,
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
  const { messageIds, userIds, chatIds } = req.body;

  // Validate input
  if (
    !messageIds ||
    !userIds ||
    !chatIds ||
    !Array.isArray(messageIds) ||
    !Array.isArray(userIds) ||
    !Array.isArray(chatIds) ||
    userIds.length !== chatIds.length
  ) {
    return res.status(400).json({
      message:
        "Invalid input. messageIds, userIds, and chatIds must be arrays of equal length.",
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
    const currentDate = moment();
    const istDate = currentDate
      .tz("Asia/Kolkata")
      .format("YYYY-MM-DDTHH:mm:ss.SSSZ");

    // Process each message and forward to each user with corresponding chat ID
    for (const message of messages) {
      const decryptedContent = CryptoJS.AES.decrypt(
        message.content,
        process.env.SECRET_KEY
      ).toString(CryptoJS.enc.Utf8);

      for (let i = 0; i < userIds.length; i++) {
        const userId = userIds[i];
        const chatId = chatIds[i];

        const newMessage = {
          sender: req.user._id,
          content: CryptoJS.AES.encrypt(
            decryptedContent,
            process.env.SECRET_KEY
          ).toString(), // Re-encrypt for forwarding
          chat: chatId, // Update with the corresponding chat ID
          media: message.media, // Forward media if any
          readBy: [req.user._id],
          createdAt: istDate,
          updatedAt: istDate,
        };

        const createdMessage = await Message.create(newMessage);

        // Populate the new message fields
        const populatedMessage = await createdMessage
          .populate("sender", "name profile_pic")
          .populate("chat");

        // Add to the response array with decrypted content
        newMessages.push({
          ...populatedMessage.toObject(),
          content: decryptedContent, // Decrypted content is added directly here
          sender: populatedMessage.sender._id,
        });

        // Update the chat with the latest message
        await Chat.findByIdAndUpdate(chatId, {
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

const decryptedContent = (encryptedContent) => {
  if (!encryptedContent || encryptedContent === "") {
    return ""; // Return empty string if no content is encrypted or if it's empty
  }

  const bytes = CryptoJS.AES.decrypt(encryptedContent, process.env.SECRET_KEY);
  const originalContent = bytes.toString(CryptoJS.enc.Utf8);

  // Check if decryption result is empty, in case of invalid decryption
  if (!originalContent) {
    return ""; // You can also return an error or a custom message if needed
  }

  return originalContent;
};

module.exports = {
  allMessages,
  sendMessage,
  clearMessages,
  deleteMessageForMe,
  deleteMessageForEveryone,
  clearAllMessages,
  forwardMessage,
  saveCallHistory,
  getAllCallHistoryByUser,
  callNotification,
};
