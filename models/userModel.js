const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const moment = require("moment-timezone");

const { Schema } = mongoose;


const userSchema = mongoose.Schema({
  name: { type: "String", default: null },
  about: { type: "String", default: null },
  phone: { type: "Number", required: true },
  otp: { type: String, default: null },
  otp_verified: { type: Number, default: 0 },
  role: {
    type: String,
    required: true,
    enum: ["user", "admin"],
    default: "user",
  },
  firebase_token: { type: "String", required: true, default: "dummy_token" },
  cb_id: { type: "Number", default: null },
  country_code: { type: "Number", required: true },
  profile_pic: {
    type: "String",
    required: true,
    default:
      "https://icon-library.com/images/anonymous-avatar-icon/anonymous-avatar-icon-25.jpg",
  },
  isAdmin: {
    type: Boolean,
    required: true,
    default: false,
  },
  userIds: {
    type: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],
  },
  datetime: {
    type: String,
    default: () => moment().tz("Asia/Kolkata").format("YYYY-MMM-DD hh:mm:ss A"),
  },
});

const User = mongoose.model("User", userSchema);

module.exports = User;
