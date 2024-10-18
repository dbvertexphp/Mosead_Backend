const ConnectyCube = require("connectycube");
const dotenv = require("dotenv");

dotenv.config();

const CREDENTIALS = {
  appId: process.env.CAPPID,
  authKey: process.env.AUTHKEY,
  authSecret: process.env.AUTHSECRET,
};

if (!CREDENTIALS.appId || !CREDENTIALS.authKey || !CREDENTIALS.authSecret) {
  throw new Error("ConnectyCube credentials are not set correctly");
}

ConnectyCube.init(CREDENTIALS);

async function createConnectyCubeUser(
  phoneString,
  phone,
  password,
  name,
  role
) {
  try {
    const session = await ConnectyCube.createSession();

    const userProfile = {
      login: phoneString,
      password: password,
      full_name: name,
      phone: phone,
      tag_list: [role],
      token: session.token,
    };

    const user = await ConnectyCube.users.signup(userProfile);
    return {
      token: session.token,
      id: user.user.id,
    };
  } catch (error) {
    console.error("ConnectyCube API Error:", error); // Log the full error details for debugging

    if (error.info && error.info.errors) {
      // Extract specific errors from ConnectyCube response
      const connectyCubeError = error.info.errors;

      if (
        connectyCubeError.base &&
        connectyCubeError.base.includes("email must be unique")
      ) {
        throw new Error("Email already exists");
      } else if (
        connectyCubeError.login &&
        connectyCubeError.login.includes("has already been taken")
      ) {
        throw new Error("Phone number already in use on ConnectyCube");
      } else {
        throw new Error(
          "ConnectyCube API error: " + JSON.stringify(connectyCubeError)
        );
      }
    } else {
      throw new Error("ConnectyCube user creation failed");
    }
  }
}

module.exports = {
  createConnectyCubeUser,
};
