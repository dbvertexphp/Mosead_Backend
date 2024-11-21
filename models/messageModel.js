const mongoose = require("mongoose");
const moment = require("moment-timezone");



const messageSchema = mongoose.Schema(
  {
    sender: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    content: { type: String, trim: true },
    chat: { type: mongoose.Schema.Types.ObjectId, ref: "Chat" },
    readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    media: [{ type: String }],
    deletedFor: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    createdAt: { type: Date, default: Date.now }, // Default to current time on creation
    updatedAt: { type: Date, default: Date.now },
  },
);

// Pre-save hook to set timestamps in Asia/Kolkata timezone before saving
messageSchema.pre('save', function(next) {
      const indiaTime = moment.tz("Asia/Kolkata");

      // Update createdAt and updatedAt to IST (Asia/Kolkata)
      if (!this.createdAt) {
        this.createdAt = indiaTime.toDate();
      }
      this.updatedAt = indiaTime.toDate();

      next();
    });

const Message = mongoose.model("Message", messageSchema);
module.exports = Message;
