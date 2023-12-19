const mongoose = require("mongoose");

const schema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
  },
  subscriptions: {
    type: [
      {
        endpoint: String,
        keys: {
          p256dh: String,
          auth: String,
        },
      },
    ],
    required: false,
  },
});
const SubscribedUsers = mongoose.model("subscribed-user", schema);

module.exports = SubscribedUsers;
