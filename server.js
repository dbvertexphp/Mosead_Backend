const express = require("express");
const connectDB = require("./config/db");
const dotenv = require("dotenv");
const userRoutes = require("./routes/userRoutes");
const chatRoutes = require("./routes/chatRoutes");
const messageRoutes = require("./routes/messageRoutes");
const { companyDetails } = require("./routes/companydetailsRoutes.js");
const { notFound, errorHandler } = require("./middleware/errorMiddleware");
const path = require("path");
const cookieParser = require("cookie-parser");
const Message = require("./models/messageModel.js");
const User = require("./models/userModel.js");
const moment = require("moment-timezone");
const CryptoJS = require("crypto-js");
const Chat = require("./models/chatModel.js");
const { sendMessageNotification } = require("./utils/sendNotification");
const cors = require('cors');

dotenv.config();
connectDB();
const app = express();
app.use(cors());

app.use(express.json());

// app.get("/", (req, res) => {
//   res.send("API Running!");
// });

app.use(cookieParser());

app.use("/api/user", userRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/message", messageRoutes);
app.use("/api/app", companyDetails);

// --------------------------deployment------------------------------

const __dirname1 = path.resolve();
app.use(express.static(path.join(__dirname1, "")));
app.use("/uploads", express.static("uploads"));
app.use("/uploads", express.static("uploads/profiles"));
app.use("/uploads", express.static("uploads/media"));
app.use("/uploads", express.static("uploads/group"));

if (process.env.NODE_ENV == "production") {
  app.use(express.static(path.join(__dirname1, "/view")));

  app.get("*", (req, res) =>
    res.sendFile(path.resolve(__dirname1, "view", "index.html"))
  );
} else {
  app.get("/", (req, res) => {
    res.send("API is running..");
  });
}

// --------------------------deployment------------------------------

// Error Handling middlewares
//app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT;

const server = app.listen(
  PORT,
  console.log(`Server running on PORT ${PORT}...`.yellow.bold),
  console.log('Server Timestamp:', Date()),
);

const io = require("socket.io")(server, {
  pingTimeout: 60000,
  cors: {
    origin: process.env.BASE_URL,
    // credentials: true,
  },
});

const onlineUsers = new Map();
let userRooms = {};
const unjoinedMessages = {};

io.on("connection", (socket) => {
  console.log("Connected to socket.io");

  socket.on("setup", async (userData) => {
    socket.join(userData.userId);
    onlineUsers.set(userData.userId, socket.id);
    console.log(`${userData.userId} is online`);
    await User.findByIdAndUpdate(
      userData.userId,
      { status: "Online" },
      { new: true }
    );
    // Find all chat IDs where the user is a participant
    //     const userChats = await Chat.find({ users: userData.userId }).select("_id");
    //     const chatIds = userChats.map((chat) => chat._id);
    //     const unseenMessages = await Message.find({
    //       chat: { $in: chatIds }, // Use found chat IDs
    //       readBy: { $ne: userData.userId },
    //     });

    //     const messageArray = [];

    //     unseenMessages.forEach((message) => {
    //       message.readBy.push(userData.userId);
    //       message.save();
    //       messageArray.push(message);
    //     });
    //     socket.emit("messageReadConfirmation", messageArray);

    io.emit("userOnline", userData);
    socket.emit("connected", userData);
  });

  socket.on("joinChat", async (room) => {
    socket.join(room.chatId);
    console.log("User Joined Room: " + room.chatId);

    if (!userRooms[room.userId]) {
      userRooms[room.userId] = [];
    }
    userRooms[room.userId].push(room.chatId);

    // Fetch the latest message from the chat
    //     const chat = await Chat.findById(room.chatId).populate("latestMessage");
    //     if (chat && chat.latestMessage) {
    //       const decryptedContent = CryptoJS.AES.decrypt(
    //         chat.latestMessage.content,
    //         process.env.SECRET_KEY
    //       ).toString(CryptoJS.enc.Utf8);

    //       // Emit the latest message to the user
    //       socket.emit("latestMessage", {
    //         ...chat.latestMessage.toObject(),
    //         content: decryptedContent
    //       });
    //     }

    const unseenMessages = await Message.find({
      chat: room.chatId,
      readBy: { $ne: room.userId },
    });

    const messageArray = [];

    unseenMessages.forEach((message) => {
      message.readBy.push(room.userId);
      message.save();
      messageArray.push(message);
    });

    socket.emit("messageReadConfirmation", messageArray);
    socket.emit("joined", room);
  });

  socket.on("typing", (data) => {
    socket.to(data.chatId).emit("typing", data);
  });

  socket.on("stopTyping", (data) => {
    socket.to(data.chatId).emit("stopTyping", data);
  });

  socket.on("newMessage", async (newMessageReceived) => {
    const chat = await Chat.findById(newMessageReceived.chatId);
    if (!chat) {
      console.log("Chat not found");
      return;
    }

    // Update the latest message for the chat
//     chat.latestMessage = newMessageReceived._id;
//     await chat.save();


    socket
      .to(newMessageReceived.chatId)
      .emit("messageRecieved", newMessageReceived);

    const latestMessage = await Message.findById(chat.latestMessage);

    if (!latestMessage) {
      console.log("Latest message not found");
      return;
    }

    const messageContent = latestMessage.content;
    console.log("Latest Message Content:", messageContent);

    const usersToNotify = [];
    for (const userId of chat.users) {
      // Check if user has joined the room (using userRooms)
      const hasJoinedRoom =
        userRooms[userId] &&
        userRooms[userId].includes(newMessageReceived.chatId);

      // If the user hasn't joined the room, add them to the usersToNotify array
      if (!hasJoinedRoom) {
        usersToNotify.push(userId);
      }
    }

    for (const userId of usersToNotify) {
      try {
        const recipient = await User.findById(userId);

        if (!recipient) {
          console.log(`Recipient with ID ${userId} not found`);
          continue;
        }

        const receiverToken = recipient.firebase_token;

        if (!receiverToken) {
          console.log(`No Firebase token found for user ${userId}`);
          continue;
        }

        // Send notification using Firebase token
        const notificationResponse = await sendMessageNotification(
          receiverToken,
          recipient.name,
          newMessageReceived.chatId,
          recipient.profile_pic || null,
          chat.chatName || null,
          chat.group_picture || null,
          messageContent
        );

        console.log("Notification Response: ", notificationResponse);
      } catch (error) {
        console.log("Error sending notification: ", error);
      }
    }
  });

  socket.on("messageDelivered", async (data) => {
    const { messageId, chatId, userId } = data;
    try {
      const message = await Message.findById(messageId).populate("chat");
      if (!message) {
        console.log("Message not found");
        return;
      }
      message.deliveredTo.push(userId);
      await message.save();
      console.log(`Message ${messageId} marked as delivered to user ${userId}`);
      socket.to(chatId);
      socket.emit("messageDeliveryStatus", {
        messageId,
        deliveredTo: userId,
      });
    } catch (error) {
      console.log("Error in message delivery confirmation:", error.message);
    }
  });

  socket.on("messageRead", async (data) => {
    console.log("data", data);
    const userIds = data.readBy || data["readBy "] || [];
    console.log("userIds: ", userIds);

    try {
      const message = await Message.findById(data.messageId)
        .populate("sender", "-password")
        .populate("chat");

      if (!message) {
        return console.log("Message not found");
      }

      console.log("Current readBy: ", message.readBy);

      // Filter out userIds that are not already in message.readBy
      const newReadBy = userIds.filter((uid) => !message.readBy.includes(uid));
      console.log("newReadBy: ", newReadBy);

      if (newReadBy.length > 0) {
        message.readBy.push(...newReadBy);
        console.log("Updated readBy", message.readBy);
        await message.save();
        console.log("Message saved successfully");
      } else {
        console.log("No updates needed, all users already included in readBy");
      }

      const decryptedContent = CryptoJS.AES.decrypt(
        message.content,
        process.env.SECRET_KEY
      ).toString(CryptoJS.enc.Utf8);

      const decryptedMessage = {
        ...message.toObject(),
        content: decryptedContent,
      };
      socket
        .to(data.chatId)
        .emit("messageReadConfirmation", [decryptedMessage]);
    } catch (error) {
      console.log("Error in messageRead event: ", error.message);
    }
  });

  socket.on("onMessageDeletedForEveryone", async ({ messageIds, chatId }) => {
    try {
      if (!Array.isArray(messageIds) || messageIds.length === 0) {
        return console.log("No messages provided for deletion.");
      }
      io.to(chatId).emit("messagesDeletedForEveryone", { messageIds, chatId });
      console.log(
        `Messages ${messageIds.join(
          ", "
        )} deleted for everyone in chat ${chatId}`
      );
    } catch (error) {
      console.log(
        "Error in onMessageDeletedForEveryone event: ",
        error.message
      );
    }
  });

  socket.on("deleteChatRoom", async (data) => {
    const { chatId, userId } = data;

    try {
      // Find the chat by its ID
      const chat = await Chat.findById(chatId);

      if (!chat) {
        socket.emit("chatDeletedError", { message: "Chat not found" });
        return console.log("Chat not found");
      }

      // Check if the user is part of the chat before deleting
      if (!chat.users.includes(userId)) {
        socket.emit("chatDeletedError", {
          message: "You are not authorized to delete this chat",
        });
        return console.log("User not authorized to delete this chat");
      }

      // Delete the chat
      // await Chat.findByIdAndDelete(chatId);

      // Notify all users in the chat room that the chat has been deleted
      io.to(chatId).emit("chatDeleted", data);

      console.log(`Chat ${chatId} deleted successfully by user ${userId}`);
      socket.emit("chatDeleted", data);
    } catch (error) {
      console.log("Error in deleting chat room: ", error.message);
      socket.emit("chatDeletedError", { message: "Error deleting chat room" });
    }
  });

  socket.on("setOffline", async (userData) => {
    if (onlineUsers.has(userData.userId)) {
      onlineUsers.delete(userData.userId);
      const currentDate = moment();
      let istDate = currentDate
        .tz("Asia/Kolkata")
        .format("YYYY-MM-DDTHH:mm:ss.SSSZ");
      await User.findByIdAndUpdate(
        userData.userId,
        { status: istDate },
        { new: true }
      );
      console.log(`${userData.userId} is manually set to offline`);
      io.emit("userOffline", userData);
    }
  });

  socket.on("setOnline", async (userData) => {
    if (!onlineUsers.has(userData.userId)) {
      onlineUsers.set(userData.userId, socket.id);
      const currentDate = moment();
      let istDate = currentDate
        .tz("Asia/Kolkata")
        .format("YYYY-MM-DDTHH:mm:ss.SSSZ");

      await User.findByIdAndUpdate(
        userData.userId,
        { status: "online" },
        { new: true }
      );

      console.log(`${userData.userId} is manually set to online`);
      io.emit("userOnline", userData);
    }
  });

  socket.off("setup", async (userData) => {
    console.log("USER DISCONNECTED");
    socket.leave(userData.userId);
    if (onlineUsers.has(userData.userId)) {
      onlineUsers.delete(userData.userId);
      let istDate = currentDate
        .tz("Asia/Kolkata")
        .format("YYYY-MM-DDTHH:mm:ss.SSSZ");
      await User.findByIdAndUpdate(
        userData.userId,
        { status: istDate },
        { new: true }
      );
      io.emit("userOffline", userData);
    }
  });
});
