const push = require("web-push");
const fs = require("fs");

const keys = push.generateVAPIDKeys();

if (keys) {
  try {
    fs.writeFileSync("./keys.json", JSON.stringify(keys, undefined, "\t"));
    console.log("Successfully updated keys.json");
  } catch (error) {
    console.log(`An error occurred`);
  }
}
