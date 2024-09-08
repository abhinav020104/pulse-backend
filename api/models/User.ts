import mongoose, { Schema } from "mongoose";

const userSchema = new mongoose.Schema({
    UserId: {
        type: String,
        required: true,
    },
    Email:{
        type:String,
        required:true
    },
    FirstName: {
        type: String,
        required: true,
    },
    LastName: {
        type: String,
        required: true,
    },
    Password: {
        type: String,
        required: true,
    },
    Balance: {
        type: Number,
        required: true,
    },
    TransactionPin: {
        type: String,
        required: true,
    },
    MobileNumber:{
        type:Number,
        required:true 
    },
    Holdings: [{
        asset: {
            type: String,
            required: true,
        },
        quantity: {
            type: Number,
            required: true,
        },
        price:{
            type:Number,
            required: true,
        }
    }],
    token: {
        type: String,
    },
});

const User = mongoose.model("User", userSchema);

export default User;
