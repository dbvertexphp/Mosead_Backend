const mongoose = require("mongoose");

const callHistorySchema = mongoose.Schema(
  {
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    chat: { type: mongoose.Schema.Types.ObjectId, ref: "Chat", required: true },
    call: {
      type: String, // "audio" or "video"
      enum: ["audio", "video"],
      required: true,
    },
    duration: {
      type: Number,
      default: 0,
    },
    createdAt: { type: String, required: true },
    updatedAt: { type: String, required: true },
  },
);

const CallHistory = mongoose.model("CallHistory", callHistorySchema);
module.exports = CallHistory;
