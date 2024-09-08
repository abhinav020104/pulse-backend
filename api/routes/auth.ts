import { Router } from "express";
import User from "../models/User"
import bcrypt from "bcrypt"
export const authRouter = Router();
import jwt from "jsonwebtoken"
import Razorpay from "razorpay";
import crypto from "crypto"
function generateUserId() {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const firstChar = letters[Math.floor(Math.random() * letters.length)];
    const numbers = Math.floor(Math.random() * 100000).toString().padStart(5, '0');
    return firstChar + numbers;
}
authRouter.post("/login" , async(req:any , res:any) =>{
    try{
    const {userId , password} = req.body;
    const userDetails = await User.findOne({UserId:userId})
    const JWT_SECRET = "PULSE";
    if(!userDetails){
        return res.status(404).json({
            success:false,
            message:"Invalid User ID",
        })
    }
    if(await bcrypt.compare(password , userDetails.Password)){
        const token = jwt.sign({UserId:userId , Password:password} , JWT_SECRET);
        userDetails.token = token;
        return res.status(200).json({
            success:true,
            message:"Login Successfull !",  
            data:userDetails
        })
    }else{
        return res.status(401).json({
            success:false,
            message:"Invalid password"
        })
    }
    }catch(error){
        console.log(error);
        return res.status(500).json({
            success:false,
            message:"Error while logging in !",
        })
    }   
})

authRouter.post("/signup" , async(req:any , res:any)=>{
    try{
        const {FirstName , LastName , Email , MobileNumber ,Password , ConfirmPassword , TransactionPin} = req.body;
        const existingUser = await User.findOne({Email:Email});
        if(existingUser){
            return res.status(401).json({
                success:false,
                message:"User Already Exists With This Email Address !",
            })
        }
        if(Password != ConfirmPassword){
            return res.status(404).json({
                success:false,
                message:"Passwords do-not match !",
            })
        }
        const userId = generateUserId();
        const hashedPassword = await bcrypt.hash(Password , 10);
        const hashedTransactionPin = await bcrypt.hash(TransactionPin , 10);
        const newUser = await User.create({UserId:userId , FirstName , LastName , Email , MobileNumber:MobileNumber , Password:hashedPassword , TransactionPin:hashedTransactionPin , Balance:0});
        return res.status(200).json({
            success:true,   
            message:"User SignUp Successfull !",
            data:newUser,
        })
    }catch(e){
        console.log(e);
        return res.status(400).json({
            success:false,
            message:"Error While User Signup !",
        })
    }
})
authRouter.post("/order" , async(req:any  , res:any) => {
    try{
        const razorpay = new Razorpay({
            key_id:"rzp_test_QVPFTAZ7OOAQ1V",
            key_secret:"PQckY6iYQWDbMvBSGFtnz7w5"
        })
        const options = req.body;
        const order = await razorpay.orders.create(options);
        if(!order){
            return res.status(404).json({
                success:false,
                message:"Failed to create order",
            })
        }
        return res.status(200).json({
            success:true,
            message:"Order created successfully !",
            data:order,
        })
    }catch(error){
        console.log(error);
        console.log("Razorpay Order Creation Failed !")
    }
})
authRouter.post("/validate" , async(req:any , res:any) =>{
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
      req.body;
  
    const sha = crypto.createHmac("sha256", "PQckY6iYQWDbMvBSGFtnz7w5");
    //order_id + "|" + razorpay_payment_id
    sha.update(`${razorpay_order_id}|${razorpay_payment_id}`);
    const digest = sha.digest("hex");
    if (digest !== razorpay_signature) {
      return res.status(400).json({ msg: "Transaction is not legit!" });
    }
  
    res.json({
      msg: "success",
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
    });
})

authRouter.put("/deposit" , async(req:any , res:any) => {
    const {userId , amount} = req.body;
    try{
        const userDetails = await User.findOne({UserId:userId});
        if(!userDetails){
            return res.status(404).json({
                success:false,
                message:"Invalid User ID !" 
            })
        }
        //@ts-ignore
        const total = parseFloat(amount) + parseFloat(userDetails.Balance);
        const details = await User.findOneAndUpdate({UserId:userId} , {Balance:total} , {new:true});
        return res.status(200).json({
            success:true,
            message:"Deposit Successfull !",
            data:details
        })
    }catch(error){
        console.log(error);
        console.log("Failed to deposit !");
        return res.status(404).json({
            success:false,
            message:"Deposit Failed !"
        })
    }
})


authRouter.post("/getUserDetails" , async(req:any , res:any) => {
    const {token} = req.body
    console.log(token)
    try{
        const decoded = jwt.verify(token , "PULSE");
        //@ts-ignore
        const userDetails = await User.findOne({UserId:decoded.UserId}); 
        if(!userDetails){
            return res.status(403).json({
                success:false,
                message:"Invalid Session , Please Login Again",
            })
        }else{
            return res.status(200).json({
                success:true,
                message:"Token Verification Successfull !",
                data:userDetails
            })
        }
    }catch(error){
        console.log(error);
        console.log("Token Verification Failed !");
        return res.status(404).json({
            success:false,
            message:"Token Verification Failed !",
        })
    }
})