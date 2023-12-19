const mongoose = require("mongoose");

const connect = async () => {
  try {
    const con = await mongoose.connect(
      `mongodb+srv://prince2:6gGe1BFO9WZbYD6N@mern-stack-tutorial.v1nmjcm.mongodb.net/web-notifications?retryWrites=true&w=majority`
    );

    if (con) console.log("CONNECTED TO MONGODB SUCCESSFULLY");
  } catch (error) {
    console.log(
      `AN ERROR OCCURRED WHILE CONNECTING TO THE DATABASE ${error.message}`,
      error
    );
  }
};

module.exports = connect;
