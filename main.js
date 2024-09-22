require("dotenv").config();

const { Telegraf, Markup, session } = require("telegraf");
const Calendar = require("telegram-inline-calendar");
const { message } = require("telegraf/filters");
const mongoose = require("mongoose");
const moment = require("moment");
const Schema = mongoose.Schema;

try {
  // GENERAL
  const bot = new Telegraf(process.env.BOT_TOKEN);
  const lang = "ru";
  mongoose.connect("mongodb://127.0.0.1:27017/planner");

  // CALENDAR
  const calendar = new Calendar(bot, {
    date_format: "YYYY-MM-DD",
    language: lang,
    bot_api: "telegraf",
    close_calendar: true,
    start_week_day: 0,
    time_selector_mod: true,
    time_range: "00:00-22:59",
    time_step: "1h",
    start_date: "now",
    custom_start_msg: false,
  });

  // DB MODEL
  const model = new Schema(
    {
      text: String,
      date: String,
      date_int: Number,
      message_id: Number,
      status: Number,
      user: { type: Schema.Types.ObjectId, ref: "User" },
    },
    { timestamps: true },
  );

  const user = new Schema(
    {
      telegram: Number,
      username: String,
    },
    { timestamps: true },
  );

  // FUNCTIONS
  function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

//   async function Update() {
//     try {
//         console.log('update 2 sec');
//         const Post = mongoose.model("post", model);
  
//         const posts = await Post.find({
//           message_id: null,
//           status: null,
//         }).sort({ date: 1 }).populate('user');

//         console.log(posts);
  
//         let message_id = [];
//         for (let index = 0; index < posts.length; index++) {
//           let update = await bot.telegram.sendMessage(
//             posts[index].user.telegram,
//             `${posts[index].date}\n\n${posts[index].text}`,
//           );
//           await bot.telegram.pinChatMessage(posts[index].user.telegram, update.message_id);
//           message_id.push(update.message_id);
//         }
  
//         for (let index = 0; index < posts.length; index++) {
//           await Post.findOneAndUpdate(
//             { _id: posts[index]._id },
//             { message_id: message_id[index] },
//           );
//         }

//         setTimeout(Update, 2000)
//       } catch (error) {
//         console.log(error);
//       }
//   }

  // JSONS
  const todos = require("./source/todos.json");
  const text = require("./source/lang.json");

  // USER

//   Update()
  bot.telegram.setMyCommands([
    {
      command: "start",
      description: "Главная страница",
    },
    {
      command: "update",
      description: "обновить список напоминаний на день",
    },
  ]);
  bot.use(session({ defaultSession: () => ({ date: "", text: "" }) }));
  bot.start(async (ctx) => {
    try {
      const DB = mongoose.model("user", user);

      await DB.findOneAndUpdate(
        {
          telegram: ctx.chat.id,
        },
        {
          telegram: ctx.from.id,
          username: ctx.from.username,
        },
        {
          new: true,
          upsert: true,
        },
      );

      await ctx.reply(
        `${text[lang].start}:\n\n${todos[getRandomInt(0, todos.length - 1)].todo[lang]}`,
      );
    } catch (error) {}
  });

  bot.command("plans", async (ctx) => {
    try {
        await ctx.deleteMessage()

        const User = mongoose.model("user", user);
  
        const info = await User.findOne({ telegram: ctx.from.id });
  
        const Post = mongoose.model("post", model);

        const posts = await Post.find({
          user: info._id, 
          message_id: null,
          status: null,
        }).sort({ date: 1 });
  
        let message_id = [];
        for (let index = 0; index < posts.length; index++) {
          let update = await ctx.reply(
            `${posts[index].date}\n\n${posts[index].text}`,
          );
          await ctx.pinChatMessage(update.message_id);
          message_id.push(update.message_id);
        }
  
        for (let index = 0; index < posts.length; index++) {
          await Post.findOneAndUpdate(
            { _id: posts[index]._id },
            { message_id: message_id[index] },
          );
        }
      } catch (error) {}
  });

  bot.on("callback_query", async (ctx) => {
    try {
      if (
        ctx.callbackQuery.message.message_id ==
        calendar.chats.get(ctx.callbackQuery.message.chat.id)
      ) {
        res = calendar.clickButtonCalendar(ctx.callbackQuery);
        if (res !== -1) {
          ctx.session.date = ctx.callbackQuery.data;

          const User = mongoose.model("user", user);

          const info = await User.findOne({ telegram: ctx.from.id });

          const Post = mongoose.model("post", model);

          const post = new Post({
            delay: ctx.session.delay,
            text: ctx.session.text,
            date_int: moment(ctx.session.date.split("_")[1]).valueOf(),
            date: ctx.session.date.split("_")[1],
            user: info._id,
          });

          await post.save();

          await ctx.reply("👍");

          ctx.session.text = "";
          ctx.session.date = "";
        }
      }
    } catch (error) {}
  });

  bot.on(message("text"), async (ctx) => {
    try {
      await ctx.deleteMessage();

      if (ctx.session.text === "" || ctx.session.date === "") {
        ctx.session.text = ctx.message.text;
        calendar.startNavCalendar(ctx.message);
        return;
      }
    } catch (error) {}
  });

  bot.reaction(["👍", "👎"], async (ctx) => {
    try {
      const DB = mongoose.model("post", model);

      const posts = await DB.findOneAndUpdate(
        {
          message_id: ctx.update.message_id,
        },
        {
          status: (ctx.update.message_reaction.new_reaction[0].emoji === '👍') ? 1 : 2,
        },
      );

      await ctx.unpinChatMessage(ctx.update.message_id);
    } catch (error) {}
  });

  // START BOT
  if (process.env.WEBHOOK === 0) {
    bot.launch({
      webhook: {
        domain: process.env.URL,
        port: process.env.PORT,
      },
      allowedUpdates: ["message", "message_reaction", "callback_query"],
    });
  } else {
    bot.launch({
      allowedUpdates: ["message", "message_reaction", "callback_query"],
    });
  }

  // Enable graceful stop
  process.once("SIGINT", () => bot.stop("SIGINT"));
  process.once("SIGTERM", () => bot.stop("SIGTERM"));
} catch (error) {
  console.log(error);
}
