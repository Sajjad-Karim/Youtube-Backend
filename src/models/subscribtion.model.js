import mongoose, { Schema } from "mongoose";

const subscribtionSchema = new Schema({}, { timestamps: true });
export const Subscribtion = mongoose.model("Subscription", subscribtionSchema);
