const asyncHandler = require("express-async-handler");
const Chat = require("../models/chatModel");
const User = require("../models/userModel");
const uploadFile = require("../middleware/uploadCommanFile");
const CryptoJS = require("crypto-js");
const GroupReport = require("../models/reportGroupModel");

const accessChat = asyncHandler(async (req, res) => {
  const { userId } = req.body;

  if (!userId) {
    console.log("UserId param not sent with request");
    return res.sendStatus(400);
  }

  // Check if chat already exists between the users
  let isChat = await Chat.find({
    isGroupChat: false,
    $and: [
      { users: { $elemMatch: { $eq: req.user._id } } },
      { users: { $elemMatch: { $eq: userId } } },
    ],
  })
    .populate("users", "-password")
    .populate("latestMessage");

  // If chat exists, return it
  if (isChat.length > 0) {
    // Ensure that the latest message sender is populated
    isChat = await User.populate(isChat, {
      path: "latestMessage.sender",
      select: "name profile_pic phone",
    });
    return res.status(200).json({ FullChat: isChat[0], status: true });
  } else {
    // If chat doesn't exist, create it
    const chatData = {
      chatName: "sender",
      isGroupChat: false,
      users: [req.user._id, userId],
    };

    try {
      const createdChat = await Chat.create(chatData);

      // Populate necessary fields for the new chat
      const FullChat = await Chat.findOne({ _id: createdChat._id })
        .populate("users", "-password")
        .populate("latestMessage")
        .populate({
          path: "latestMessage.sender",
          select: "name profile_pic phone",
        });

      return res.status(200).json({ FullChat: FullChat, status: true });
    } catch (error) {
      res.status(400);
      throw new Error(error.message);
    }
  }
});

const chatDelete = asyncHandler(async (req, res) => {
  const { chatId } = req.body;

  if (!chatId) {
    console.log("ChatId param not sent with request");
    return res.sendStatus(400);
  }

  try {
    // Find the chat by its ID
    const chat = await Chat.findById(chatId);

    if (!chat) {
      return res.status(404).json({
        message: "Chat not found",
        status: false,
      });
    }

    // Check if the user is part of the chat before deleting
    if (!chat.users.includes(req.user._id)) {
      return res.status(403).json({
        message: "You are not authorized to delete this chat",
        status: false,
      });
    }

    // Delete the chat
    await Chat.findByIdAndDelete(chatId);

    res.status(200).json({
      message: "Chat deleted successfully",
      status: true,
    });
  } catch (error) {
    res.status(400);
    throw new Error(error.message);
  }
});

const fetchChats = asyncHandler(async (req, res) => {
  try {
    // Fetch the main user data
    const user = await User.findById(req.user._id);

    // Fetch chats where the user is a participant
    let chats = await Chat.find({
      users: { $elemMatch: { $eq: req.user._id } },
      isGroupChat: false,
    })
      .populate("users", "-password")
      .populate("groupAdmin", "-password")
      .populate("latestMessage")
      .sort({ updatedAt: -1 });

    // Filter chats to include only those with a latestMessage ID
    chats = chats.filter((chat) => chat.latestMessage);

    if (!chats || chats.length === 0) {
      return res
        .status(404)
        .json({ message: "No chats found.", status: false });
    }

    // Populate latestMessage sender details
    const populatedChats = await User.populate(chats, {
      path: "latestMessage.sender",
      select: "_id",
    });

    // Decrypt the latestMessage content and modify the response
    const modifiedChats = populatedChats.map((chat) => {
      const chatObj = chat.toObject();

      if (chatObj.latestMessage && chatObj.latestMessage.content) {
        try {
          const bytes = CryptoJS.AES.decrypt(
            chatObj.latestMessage.content,
            process.env.SECRET_KEY
          );
          const decryptedContent = bytes.toString(CryptoJS.enc.Utf8);
          chatObj.latestMessage.content = decryptedContent; // Replace encrypted content with decrypted content
        } catch (error) {
          console.error("Error decrypting latestMessage:", error);
        }
      }

      if (chatObj.latestMessage && chatObj.latestMessage.sender) {
        chatObj.latestMessage.sender = chatObj.latestMessage.sender._id;
      }

      return chatObj;
    });

    // Send response with chats and additional users
    res.status(200).json({ chats: modifiedChats, status: true });
  } catch (error) {
    console.error("Error fetching chats:", error);
    res.status(500).json({
      message: "Error fetching chats. Please try again later.",
      error: error.message,
    });
  }
});

const getMyGroups = asyncHandler(async (req, res) => {
  try {
    // Fetch the main user data
    const user = await User.findById(req.user._id);

    // Check if userIds exist in the user document
    const additionalUsers = user.userIds
      ? await User.find(
          { _id: { $in: user.userIds } },
          "name profile_pic phone"
        )
      : [];

    // Fetch chats where the user is a participant
    const chats = await Chat.find({
      users: { $elemMatch: { $eq: req.user._id } },
      isGroupChat: true,
    })
      .populate("users", "-password")
      .populate("groupAdmin", "-password")
      .populate("latestMessage")
      .sort({ updatedAt: -1 });

    if (!chats || chats.length === 0) {
      return res
        .status(404)
        .json({ message: "No chats found.", status: false });
    }

    // Populate latestMessage sender details
    const populatedChats = await User.populate(chats, {
      path: "latestMessage.sender",
      select: "name profile_pic phone",
    });

    const modifiedChats = populatedChats.map((chat) => {
      const chatObj = chat.toObject();

      if (chatObj.latestMessage && chatObj.latestMessage.content) {
        try {
          const bytes = CryptoJS.AES.decrypt(
            chatObj.latestMessage.content,
            process.env.SECRET_KEY
          );
          const decryptedContent = bytes.toString(CryptoJS.enc.Utf8);
          chatObj.latestMessage.content = decryptedContent; // Replace encrypted content with decrypted content
        } catch (error) {
          console.error("Error decrypting latestMessage content:", error);
        }
      }
      return chatObj;
    });

    // Send response with chats and additional users
    res.status(200).json({ chats: modifiedChats, additionalUsers });
  } catch (error) {
    console.error("Error fetching chats:", error);
    res.status(500).json({
      message: "Error fetching chats. Please try again later.",
      error: error.message,
    });
  }
});

const createGroupChat = asyncHandler(async (req, res) => {
  req.uploadPath = "uploads/group";
  uploadFile.single("group_picture")(req, res, async (err) => {
    if (err) {
      return next(new ErrorHandler(err.message, 400));
    }
    if (!req.body.users || !req.body.name) {
      return res.status(400).send({ message: "Please Fill all the feilds" });
    }

    var users = JSON.parse(req.body.users);

    if (users.length < 2) {
      return res
        .status(400)
        .send("More than 2 users are required to form a group chat");
    }

    users.push(req.user);

    // Get the profile picture path if uploaded
    const group_picture = req.file
      ? `${req.uploadPath}/${req.file.filename}`
      : null;

    try {
      const groupChat = await Chat.create({
        chatName: req.body.name,
        users: users,
        isGroupChat: true,
        groupAdmin: req.user._id,
        group_picture: group_picture,
      });

      const fullGroupChat = await Chat.findOne({ _id: groupChat._id })
        .populate("users", "-password")
        .populate("groupAdmin", "-password");

      res.status(200).json({ data: fullGroupChat, status: true });
    } catch (error) {
      res.status(400);
      throw new Error(error.message);
    }
  });
});

const updateGroupPicture = asyncHandler(async (req, res) => {
  req.uploadPath = "uploads/group";

  uploadFile.single("group_picture")(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ message: err.message, status: false });
    }

    const { chatId } = req.body;

    if (!chatId) {
      return res
        .status(400)
        .json({ message: "Chat ID is required", status: false });
    }

    // Get the new group picture path
    const group_picture = req.file
      ? `${req.uploadPath}/${req.file.filename}`
      : null;

    if (!group_picture) {
      return res.status(400).json({
        message: "Please upload a valid group picture",
        status: false,
      });
    }

    try {
      // Update the group picture in the database
      const updatedChat = await Chat.findByIdAndUpdate(
        chatId,
        { group_picture: group_picture },
        { new: true } // Return the updated document
      )
        .populate("users", "-password")
        .populate("groupAdmin", "-password");

      if (!updatedChat) {
        return res
          .status(404)
          .json({ message: "Chat not found", status: false });
      }

      res.status(200).json({
        message: "Group picture updated successfully",
        data: updatedChat,
        status: true,
      });
    } catch (error) {
      res.status(500).json({
        message: "Failed to update group picture",
        error: error.message,
        status: false,
      });
    }
  });
});

const renameGroup = asyncHandler(async (req, res) => {
  const { chatId, chatName } = req.body;

  const updatedChat = await Chat.findByIdAndUpdate(
    chatId,
    {
      chatName: chatName,
    },
    {
      new: true,
    }
  )
    .populate("users", "-password")
    .populate("groupAdmin", "-password");

  if (!updatedChat) {
    res.status(404);
    throw new Error("Chat Not Found");
  } else {
    res.json({ data: updatedChat, status: true });
  }
});

const removeFromGroup = asyncHandler(async (req, res) => {
  const { chatId, userId } = req.body;

  // check if the requester is admin

  const removed = await Chat.findByIdAndUpdate(
    chatId,
    {
      $pull: { users: userId },
    },
    {
      new: true,
    }
  )
    .populate("users", "-password")
    .populate("groupAdmin", "-password");

  if (!removed) {
    res.status(404);
    throw new Error("Chat Not Found");
  } else {
    res.json({ data: removed, status: true });
  }
});

const addToGroup = asyncHandler(async (req, res) => {
  const { chatId, userIds } = req.body;

  if (!chatId || !Array.isArray(userIds) || userIds.length === 0) {
    return res.status(400).json({
      message:
        "Invalid request. Please provide a valid chatId and userIds array.",
      status: false,
    });
  }

  try {
    // Add multiple users to the group
    const updatedChat = await Chat.findByIdAndUpdate(
      chatId,
      {
        $addToSet: { users: { $each: userIds } }, // Ensures no duplicates
      },
      {
        new: true, // Returns the updated document
      }
    )
      .populate("users", "-password")
      .populate("groupAdmin", "-password");

    if (!updatedChat) {
      return res.status(404).json({
        message: "Chat not found",
        status: false,
      });
    }

    res.status(200).json({
      message: "Users added to the group successfully",
      data: updatedChat,
      status: true,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to add users to the group",
      error: error.message,
      status: false,
    });
  }
});

const reportGroupChat = asyncHandler(async (req, res) => {
  const { chatId, reason } = req.body;

  // Validation
  if (!chatId || !reason) {
    return res
      .status(400)
      .json({ message: "Group ID and reason are required" });
  }

  try {
    // Check if the group exists
    const groupChat = await Chat.findById(chatId);
    if (!groupChat) {
      return res.status(404).json({ message: "Group not found" });
    }

    // Create a report
    const report = await GroupReport.create({
      chatId,
      reportedBy: req.user._id,
      reason,
    });

    res.status(201).json({
      message: "Group chat reported successfully",
      data: report,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = {
  accessChat,
  fetchChats,
  createGroupChat,
  renameGroup,
  addToGroup,
  removeFromGroup,
  getMyGroups,
  chatDelete,
  reportGroupChat,
  updateGroupPicture,
};
