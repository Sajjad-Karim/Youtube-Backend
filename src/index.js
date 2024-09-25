// require("dotenv").config({ path: "./env" });
import dotenv from "dotenv"; // to use import to dotenv we add -r dotenv/config in the package.json scripts
import connectDB from "./db/index.js";
import app from "./app.js";

dotenv.config({ path: "./env" });
connectDB()
  .then(() => {
    app.listen(process.env.PORT || 8000, () => {
      console.log(`Server listening on ${process.env.PORT}`);
    });
  })
  .catch((err) => console.log("MONGO DB Connection Failed"));

//you can set database connnection in the index.js file but the good practice is to create a new folder and file for the DB_CONNECTION (db(folder)-->index.js(connection BD)) and then import and call that connection file in the index.js file as shown in this example
/*
import mongoose from "mongoose";
import express from "express";
import { DB_NAME } from "./constants";
const app = express();
(async () => {
  try {
    await mongoose.connect(`${process.env.MONGODB_URL}/${DB_NAME}`);
    app.on("error", (error) => {
      console.log(`Error is ${error}`);
      throw error;
    });
    app.listen(process.env.PORT, () => {
      console.log(`App listening on ${process.env.PORT}`);
    });
  } catch (error) {
    console.error(`Error: ${error}`);
    throw error;
  }
})();
*/
