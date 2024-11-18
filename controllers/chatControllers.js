const asyncHandler = require("express-async-handler");
const Chat = require("../models/chatModel");
const User = require("../models/userModel");
const uploadFile = require("../middleware/uploadCommanFile");
const CryptoJS = require("crypto-js");

//@description     Create or fetch One to One Chat
//@route           POST /api/chat/
//@access          Protected
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

//@description Fetch all chats for a user
//@route           GET /api/chat/
//@access          Protected
// const fetchChats = asyncHandler(async (req, res) => {
//   console.log(req.user._id);

//   try {
//     const chats = await Chat.find({ users: { $elemMatch: { $eq: req.user._id } } })
//       .populate("users", "-password")
//       .populate("groupAdmin", "-password")
//       .populate("latestMessage")
//       .sort({ updatedAt: -1 });

//     if (!chats || chats.length === 0) {
//       return res.status(404).json({ message: "No chats found.", status: false });
//     }

//     const populatedChats = await User.populate(chats, {
//       path: "latestMessage.sender",
//       select: "name profile_pic phone",
//     });

//     res.status(200).json(populatedChats);
//   } catch (error) {
//     console.error("Error fetching chats:", error);
//     res.status(500).json({ message: "Error fetching chats. Please try again later.", error: error.message });
//   }
// });

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

    // Send response with chats and additional users
    res.status(200).json({ chats: populatedChats, additionalUsers });
  } catch (error) {
    console.error("Error fetching chats:", error);
    res.status(500).json({
      message: "Error fetching chats. Please try again later.",
      error: error.message,
    });
  }
});

// const fetchChats = asyncHandler(async (req, res) => {
//   try {
//     // Step 1: Fetch chats where req.user._id is a participant
//     let chats = await Chat.find({ users: { $elemMatch: { $eq: req.user._id } } })
//       .populate("users", "-password")
//       .populate("groupAdmin", "-password")
//       .populate("latestMessage")
//       .sort({ updatedAt: -1 })
//       .exec();

//     // Step 2: Populate latestMessage.sender details
//     chats = await User.populate(chats, {
//       path: "latestMessage.sender",
//       select: "name profile_pic phone userIds",
//     });

//     // Step 3: Collect unique user IDs from all users' userIds arrays in the chats
//     let uniqueUserIds = new Set();
//     chats.forEach(chat => {
//       chat.users.forEach(user => {
//         if (user.userIds && user.userIds.length > 0) {
//           user.userIds.forEach(id => uniqueUserIds.add(id.toString()));
//         }
//       });
//     });

//     // Step 4: Fetch all users corresponding to these userIds
//     const additionalUsers = await User.find({ _id: { $in: Array.from(uniqueUserIds) } })
//       .select("name profile_pic phone userIds");

//     // Step 5: Send response with chats and additional users
//     res.status(200).json({ chats, additionalUsers });
//   } catch (error) {
//     res.status(400).json({ message: error.message });
//   }
// });

//@description     Create New Group Chat
//@route           POST /api/chat/group
//@access          Protected
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
        groupAdmin: req.user,
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

// @desc    Rename Group
// @route   PUT /api/chat/rename
// @access  Protected
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

// @desc    Remove user from Group
// @route   PUT /api/chat/groupremove
// @access  Protected
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

// @desc    Add user to Group / Leave
// @route   PUT /api/chat/groupadd
// @access  Protected
const addToGroup = asyncHandler(async (req, res) => {
  const { chatId, userId } = req.body;

  // check if the requester is admin

  const added = await Chat.findByIdAndUpdate(
    chatId,
    {
      $push: { users: userId },
    },
    {
      new: true,
    }
  )
    .populate("users", "-password")
    .populate("groupAdmin", "-password");

  if (!added) {
    res.status(404);
    throw new Error({ message: "Chat Not Found", status: false });
  } else {
    res.json({ data: added, status: true });
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
};
