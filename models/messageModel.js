const mongoose = require("mongoose");

const messageSchema = mongoose.Schema({
  sender: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  content: { type: String, trim: true },
  chat: { type: mongoose.Schema.Types.ObjectId, ref: "Chat" },
  readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  deliveredTo: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  media: [{ type: String }],
  deletedFor: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  createdAt: { type: String },
  updatedAt: { type: String },
});

const Message = mongoose.model("Message", messageSchema);
module.exports = Message;
