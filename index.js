const fs = require("fs");
const web_push = require("web-push");
const app = require("express")();
const cors = require("cors");
const dotenv = require("dotenv");
const body_parser = require("body-parser");
const connect = require("./mongo-connect");
const SubscribedUsers = require("./models/subscribed_users");

dotenv.config();

connect();

const port = process.env.PORT || 5000;

app.use(cors());
app.use(body_parser.json());
app.use(body_parser.urlencoded({ extended: true }));

const getKeys = () => {
  const rawKeys = fs.readFileSync("./keys.json", { encoding: "utf-8" });
  const jsonKeys = JSON.parse(rawKeys);

  return jsonKeys;
};

app.post("/generate-keys", (req, res) => {
  const keys = web_push.generateVAPIDKeys();

  if (keys) {
    try {
      fs.writeFileSync("./keys.json", JSON.stringify(keys, undefined, "\t"));
      console.log("Successfully updated keys.json");

      return res.status(201).json(keys);
    } catch (error) {
      console.log(`An error occurred`);
      return res.status(500).send("An error occurred");
    }
  }

  return res.status(500).send("An error occurred");
});

app.post("/notify", async (req, res) => {
  const body = req.body;

  if ((!body?.emails || body.emails?.length < 1) && !body.broadcastAll)
    return res
      .status(400)
      .send(
        "Please specify the correct request parameter. If the 'emails' parameter must be empty, make sure to specify the 'broadcastAll' parameter to 'true'"
      );

  console.log("Sending notification");
  const keys = getKeys();

  web_push.setVapidDetails(
    "https://prince-web-notifications.netlify.app",
    keys.publicKey,
    keys.privateKey
  );

  const emailsToUse = [];

  if (body.emails?.length > 0) {
    for (const email of body.emails) {
      const subscriber = await SubscribedUsers.findOne({ email }).catch((e) =>
        console.log(`Could not retrieve user: ${email} due to ${e.message}`)
      );
      if (!subscriber) {
        console.log(`User with email ${email} does not exist`);
        continue;
      }
      emailsToUse.push(subscriber);
    }
  } else if (body?.broadcastAll) {
    const allSubScribers = await SubscribedUsers.find().catch((e) =>
      console.log(`Could not retrieve users due to ${e.message}`)
    );

    allSubScribers.forEach((subscriber) => emailsToUse.push(subscriber));
  }

  const sendNotifications = async () => {
    for (const rawSubscriber of emailsToUse) {
      const subscriber = JSON.parse(JSON.stringify(rawSubscriber));

      if (!subscriber) continue;

      const email = subscriber.email;
      const subscriptions = subscriber.subscriptions;

      if (Array.isArray(subscriptions)) {
        for (const channel of subscriptions) {
          if (
            !channel?.endpoint ||
            !channel?.keys?.auth ||
            !channel?.keys?.p256dh
          ) {
            console.log(
              `Incomplete channel details for channel ${
                channel.endpoint ? channel.endpoint?.slice(0, 10) : ""
              } for user ${email}`
            );
            continue;
          }

          const pushed = await web_push
            .sendNotification(
              {
                endpoint: channel.endpoint,
                keys: {
                  p256dh: channel.keys.p256dh,
                  auth: channel.keys.auth,
                },
              },
              JSON.stringify({
                title:
                  body?.title || `This is from the server to user ${email}`,
                message:
                  body?.message ||
                  `This is a dummy message sent when there is no other message`,
                destinationURL:
                  body?.destinationURL || "https://prince-onuk.vercel.app",
              })
            )
            .catch((e) =>
              console.error(
                `Error sending notification to user ${email} channel ${
                  typeof channel?.endpoint === "string" &&
                  channel?.endpoint?.slice(0, 10)
                }...: ${e.message}`
              )
            );
          if (pushed)
            console.log(
              `Sucessfully sent message to user ${email} on channel ${channel?.endpoint?.slice(
                0,
                10
              )}...`
            );
        }
      } else {
        console.error(`User ${email} has no subscriptions`);
      }
    }
  };

  await sendNotifications();

  return res.status(200).send("Sent notifications successfully");
});

app.post("/subscribe", async (req, res) => {
  try {
    const body = req.body;

    if (!body.email)
      return res.status(400).send("Request body must contain email property");

    // * GET THE SUBSCRIPTION DETAILS FROM THE REQUEST BODY
    const subscription =
      body?.endpoint && body?.keys?.auth && body?.keys?.p256dh
        ? {
            endpoint: body.endpoint,
            keys: {
              p256dh: body.keys.p256dh,
              auth: body.keys.auth,
            },
          }
        : undefined;

    const existingUser = await SubscribedUsers.findOne({
      email: body.email,
    }).catch((e) => {
      throw new Error(`Could not create user '${body.email}': ${e.message}`);
    });

    // * IF USER DOES NOT EXIST, CREATE ONE
    if (!existingUser) {
      const createdUser = await SubscribedUsers.create({
        email: body.email,
        ...(subscription ? { subscriptions: [subscription] } : {}),
      }).catch((e) => {
        throw new Error(`Could not create user '${body.email}': ${e.message}`);
      });

      if (!createdUser) return res.status(500).send("Something went wrong");

      return res.status(201).json(createdUser);
    }

    // * IF THE SUBSCRIPTION OBJECT IS EMPTY
    if (subscription === undefined)
      return res
        .status(400)
        .send("Please update user with a valid subscription");

    const existingSubscriptions = JSON.parse(
      JSON.stringify(existingUser.subscriptions || [])
    );
    const subscriptionExists = existingSubscriptions.find(
      (existingSubscription) =>
        existingSubscription.endpoint === subscription.endpoint
    );

    // * IF THE SUBSCRIPTION ALREADY EXISTS, RETURN ERROR
    if (subscriptionExists)
      return res
        .status(400)
        .send("This subscription already exists under this user");

    // * UPDATE THE USER'S SUBSCRIPTION
    const updatedUser = await SubscribedUsers.updateOne(
      { email: body.email },
      {
        $push: {
          subscriptions: {
            $each: [subscription],
          },
        },
      }
    ).catch((e) => {
      throw new Error(`Could not update user '${body.email}': ${e.message}`);
    });

    if (!updatedUser) return res.status(500).send("Something went wrong");

    return res.status(200).json({
      message: "Updated user subscription successfully",
      data: updatedUser,
    });
  } catch (error) {
    return res.status(500).send(`${error.message}`);
  }
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
