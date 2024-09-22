require("dotenv").config();

const { Telegraf, Markup, session } = require("telegraf");
const Calendar = require("telegram-inline-calendar");
const { message } = require("telegraf/filters");
const moment = require("moment-timezone");
const mongoose = require("mongoose");
const Schema = mongoose.Schema;

process.env.NTBA_FIX_319 = 1;

try {
  // FUNCTIONS
  function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function Notification() {}

  // GENERAL
  const bot = new Telegraf(process.env.BOT_TOKEN);
  const lang = "ru";
  const timezone = "Europe/Amsterdam"; // client
  mongoose.connect("mongodb://127.0.0.1:27017/planner");

  // CALENDAR
  const calendar = new Calendar(bot, {
    date_format: "YYYY-MM-DD",
    language: lang,
    bot_api: "telegraf",
    close_calendar: true,
    start_week_day: 0,
    time_selector_mod: true,
    time_range: "00:00-23:59",
    time_step: "30m",
    start_date: "now",
    custom_start_msg: false,
  });

  // DB MODEL
  const model = new Schema(
    {
      text: String,
      date: String,
      delay: Number,
      user: { type: Schema.Types.ObjectId, ref: "User" },
      status: Number,
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

  // DATA FOR KEYBOARDS

  // JSONS
  const todos = require("./source/todos.json");
  const text = require("./source/lang.json");

  // KEYBOARDS

  // USER

  bot.telegram.setMyCommands([
    {
      command: "start",
      description: "Главная страница",
    },
    {
      command: "today",
      description: "Планы на сегодня",
    },
    {
      command: "tomorrow",
      description: "Планы на завтра",
    },
    {
      command: "expire",
      description: "Вышло время",
    },
  ]);
  bot.use(
    session({ defaultSession: () => ({ date: "", text: "", delay: "" }) }),
  );
  bot.start(async (ctx) => {
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
  });

  bot.command("today", async (ctx) => {
    const User = mongoose.model("user", user);

    const info = User.findOne({ telegram: ctx.from.id });

    const Post = mongoose.model("post", model);

    const start = moment().startOf("day").toDate();
    const end = moment().startOf("day").add(1, "day").toDate();

    const posts = await Post.find({
      user: info._id,
      createdAt: {
        $gte: start,
        $lt: end,
      },
    }).sort({ date: 1 });

    for (let index = 0; index < posts.length; index++) {
      await ctx.reply(`⏱Дата: ${posts[index].date}\n${posts[index].text}`);
    }
  });

  bot.command("tomorrow", async (ctx) => {
    const User = mongoose.model("user", user);

    const info = User.findOne({ telegram: ctx.from.id });

    const Post = mongoose.model("post", model);

    const start = moment().startOf("day").add(1, "day").toDate();
    const end = moment().startOf("day").add(2, "day").toDate();

    const posts = await Post.find({
      user: info._id,
      createdAt: {
        $gte: start,
        $lt: end,
      },
    }).sort({ date: 1 });

    for (let index = 0; index < posts.length; index++) {
      await ctx.reply(`⏱Дата: ${posts[index].date}\n${posts[index].text}`);
    }
  });

  bot.command("expire", async (ctx) => {
    const User = mongoose.model("user", user);

    const info = User.findOne({ telegram: ctx.from.id });

    const Post = mongoose.model("post", model);

    const start = moment("1970-01-01").startOf("day").toDate();
    const end = moment().startOf("day").toDate();

    const posts = await Post.find({
      user: info._id,
      createdAt: {
        $gte: start,
        $lt: end,
      },
    }).sort({ date: 1 });

    for (let index = 0; index < posts.length; index++) {
      await ctx.reply(`⏱Дата: ${posts[index].date}\n${posts[index].text}`);
    }
  });

  bot.on("callback_query", async (ctx) => {
    if (
      ctx.callbackQuery.message.message_id ==
      calendar.chats.get(ctx.callbackQuery.message.chat.id)
    ) {
      res = calendar.clickButtonCalendar(ctx.callbackQuery);
      if (res !== -1) {

        ctx.session.date = ctx.callbackQuery.data;

        // await ctx.reply(text[lang].delay);

        const User = mongoose.model("user", user);

        const info = User.findOne({ telegram: ctx.from.id });

        const Post = mongoose.model("post", model);

        const post = new Post({
          delay: ctx.session.delay,
          text: ctx.session.text,
          date: ctx.session.date.split("_")[1],
          user: info._id,
        });

        await post.save();

        await ctx.reply("👍");

        ctx.session.text = "";
        ctx.session.date = "";
      }
    }
  });

  bot.on(message("text"), async (ctx) => {
    if (ctx.session.text === "" || ctx.session.date === "") {
      ctx.session.text = ctx.message.text;
      calendar.startNavCalendar(ctx.message);
      return;
    }

    // if (!Number(ctx.message.text)) return;

    // ctx.session.delay = ctx.message.text;

    // console.log(ctx.session.date.split("_"));

    // const date = moment(ctx.session.date.split("_")[1]);

    // console.log(jun.tz(timezone).format());  // 5am PDT

    // const User = mongoose.model("user", user);

    // const info = User.findOne({telegram: ctx.from.id})

    // const Post = mongoose.model("post", model);

    // const post = new Post({
    //   delay: ctx.session.delay,
    //   text: ctx.session.text,
    //   date: new Date(date.tz(timezone).format().valueOf()),
    //   user: info._id,
    // });

    // await post.save();

    // await ctx.reply("👍");
  });

  // START BOT
  if (process.env.WEBHOOK === 0) {
    bot.launch({
      webhook: {
        domain: process.env.URL,
        port: process.env.PORT,
      },
    });
  } else {
    bot.launch();
  }

  // Enable graceful stop
  process.once("SIGINT", () => bot.stop("SIGINT"));
  process.once("SIGTERM", () => bot.stop("SIGTERM"));
} catch (error) {
  console.log(error);
}
