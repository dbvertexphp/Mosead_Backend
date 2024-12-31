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
    token: "eYDVkTThQQall6TZol-m0I:APA91bEKPlUUT1yFTlsXzsWyRECPkP6KtzdVzeIZuz9miR-UOnXPO83xvSxzu9eF9ZBNu0htOy9E6zcaRMe19TTeGyKXGBb1-AzQY-u5s_TFM3rrFDjV4O0",
  };

  try {
    const response = await admin.messaging().send(message);
    return { success: true, response };
  } catch (error) {
    return { success: false, error };
  }
};

const sendCallNotification = async (data, registrationToken) => {
      try {
        // Convert all data fields to strings
        const formattedData = Object.entries(data).reduce((acc, [key, value]) => {
          acc[key] = String(value);
          return acc;
        }, {});

        const message = {
          data: formattedData,
          token: registrationToken,
        };

        const response = await admin.messaging().send(message);
        return { success: true, response };
      } catch (error) {
        console.error("Error sending call notification:", error);
        return { success: false, error };
      }
    };

module.exports = {
  sendMessageNotification,
  sendCallNotification,
};
