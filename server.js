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

dotenv.config();
connectDB();
const app = express();

app.use(express.json()); // to accept json data

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
  console.log(`Server running on PORT ${PORT}...`.yellow.bold)
);

const io = require("socket.io")(server, {
  pingTimeout: 60000,
  cors: {
    origin: process.env.BASE_URL,
    // credentials: true,
  },
});

const onlineUsers = new Map();

io.on("connection", (socket) => {
  console.log("Connected to socket.io");
  socket.on("setup", async (userData) => {
    socket.join(userData.userId);
    onlineUsers.set(userData.userId, socket.id);
    console.log(`${userData.userId} is online`);
    // Update the user's online status in the database
    await User.findByIdAndUpdate(
      userData.userId,
      { status: "Online" },
      { new: true }
    );
    io.emit("userOnline", userData);
    socket.emit("connected", userData);
  });

  socket.on("joinChat", (room) => {
    socket.join(room.chatId);
    console.log("User Joined Room: " + room.chatId);
    socket.emit("joined", room);
  });
  socket.on("typing", (room) => {
    socket.to(room).emit("typing", room);
  });
  socket.on("stopTyping", (room) => {
    socket.to(room).emit("stopTyping", room);
  });

  socket.on("newMessage", (newMessageRecieved) => {
    socket
      .to(newMessageRecieved.chatId)
      .emit("messageRecieved", newMessageRecieved);
  });

  socket.on("messageRead", async ({ messageId, userId }) => {
    try {
      const message = await Message.findById(messageId)
        .populate("sender", "-password")
        .populate("chat");

      if (!message) {
        return console.log("Message not found");
      }
      if (!message.readBy.includes(userId)) {
        message.readBy.push(userId);
        await message.save();
      }
      const chat = message.chat;
      chat.users.forEach((user) => {
        if (user._id.toString() === userId.toString()) return;
        socket.in(user._id).emit("messageReadConfirmation", message);
      });
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
      io.emit("userOffline", userData.userId);
    }
  });
});
