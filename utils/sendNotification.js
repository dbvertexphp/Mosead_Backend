const admin = require("firebase-admin");
const serviceAccount = require("../serviceAccountKey.json");
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const sendMessageNotification = async (
  token,
  sender_name,
  room_id,
  user_id,
  user_profile_url = null,
  unread_messages,
  group_name,
  group_photo_url = null
) => {
  const message = {
    data: {
      sender_name: String(sender_name),
      room_id: String(room_id),
      user_id: String(user_id),
      unread_messages: String(unread_messages),
      group_name: String(group_name),
      ...(user_profile_url && { user_profile_url: String(user_profile_url) }),
      ...(group_photo_url && { group_photo_url: String(group_photo_url) }),
    },
    token: token,
  };

  try {
    const response = await admin.messaging().send(message);
    return { success: true, response };
  } catch (error) {
    return { success: false, error };
  }
};

const sendCallNotification = async (
  registrationToken,
  title,
  body,
  imageUrl = null
) => {
  const message = {
    data: {
      title,
      body,
      imageUrl: imageUrl || undefined, // Only include image if it's provided
    },
    token: registrationToken,
  };

  try {
    const response = await admin.messaging().send(message);
    return { success: true, response };
  } catch (error) {
    return { success: false, error };
  }
};

module.exports = {
  sendMessageNotification,
  sendCallNotification,
};
