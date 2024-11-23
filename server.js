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

io.on("connection", (socket) => {
  console.log("Connected to socket.io");
  socket.on("setup", (userData) => {
    socket.join(userData.userId);
    socket.emit("connected",userData);
  });

  socket.on("joinChat", (room) => {
    socket.join(room.chatId);
    console.log("User Joined Room: " + room.chatId);
    socket.emit("joined", room);
  });
  socket.on("typing", (room) => {
    socket.in(room.chatId);
    socket.emit("typing", room);
  });
  socket.on("stopTyping", (room) => {
    socket.in(room.chatId);
    socket.emit("stopTyping", room)
  });

  socket.on("newMessage", (newMessageRecieved) => {
    var chat = newMessageRecieved.chat;

    if (!chat.users) return console.log("chat.users not defined");

    chat.users.forEach((user) => {
      if (user._id == newMessageRecieved.sender._id) return;

      socket.in(user._id).emit("messageRecieved", newMessageRecieved);
    });
  });

  socket.off("setup", () => {
    console.log("USER DISCONNECTED");
    socket.leave(userData._id);
  });
});
