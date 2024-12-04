const mongoose = require("mongoose");

const messageSchema = mongoose.Schema({
  sender: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  content: { type: String, trim: true },
  chat: { type: mongoose.Schema.Types.ObjectId, ref: "Chat" },
  readBy: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      validate: {
        validator: function (value) {
          // Ensure value is not null or undefined
          return value !== null && value !== undefined;
        },
        message: "readBy field cannot contain null or undefined values.",
      },
    },
  ],
  media: [{ type: String }],
  deletedFor: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  createdAt: { type: String },
  updatedAt: { type: String },
});

const Message = mongoose.model("Message", messageSchema);
module.exports = Message;
