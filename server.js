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
  socket.on("setup", (userData) => {
    socket.join(userData.userId);
    onlineUsers.set(userData.userId, socket.id);
    console.log(`${userData.userId} is online`);
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
      socket.to(newMessageRecieved.chatId).emit("messageRecieved", newMessageRecieved);
  });

  socket.on("messageRead", async ({ messageId, userId }) => {
    try {
      // Find the message by ID and add the userId to the 'readBy' array if not already there
      const message = await Message.findById(messageId)
        .populate("sender", "-password")
        .populate("chat");

      if (!message) {
        return console.log("Message not found");
      }

      // Add userId to the 'readBy' array if it isn't already present
      if (!message.readBy.includes(userId)) {
        message.readBy.push(userId);
        await message.save(); // Save the updated message with new 'readBy' list
      }

      // Emit message read confirmation to all users in the chat except the one who read it
      const chat = message.chat;
      chat.users.forEach((user) => {
        if (user._id.toString() === userId.toString()) return; // Skip the user who read the message
        socket.in(user._id);
        socket.emit("messageReadConfirmation", message);
      });
    } catch (error) {
      console.log("Error in messageRead event: ", error.message);
    }
  });

  socket.on("setOffline", (userData) => {
    if (onlineUsers.has(userData.userId)) {
      onlineUsers.delete(userData.userId);
      console.log(`${userData.userId} is manually set to offline`);
      io.emit("userOffline", userData);
    }
  });

  socket.off("setup", (userData) => {
    console.log("USER DISCONNECTED");
    socket.leave(userData.userId);
    if (onlineUsers.has(userData.userId)) {
      onlineUsers.delete(userData.userId);
      io.emit("userOffline", userData.userId);
    }
  });
});
