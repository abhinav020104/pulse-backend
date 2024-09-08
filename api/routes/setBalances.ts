import { Router } from "express";
import { RedisManager } from "../RedisManager";

export const router = Router();

router.post("/" , async(req:any , res:any) =>{
    const {userId , amount} = req.body;
    console.log(userId , amount);
    const parsedAmount = Number(amount);
    console.log(typeof(parsedAmount))
    try{
        const response = await RedisManager.getInstance().sendAndAwait({
            type:"SET_BALANCES",
            data:{
                id:userId,
                avaialableBalance:parsedAmount
        }
        })
        console.log("here");
        return res.status(200).json({
            success:true,
            message:"Balance Updated Successfully !"
        })
    }catch(error){
        console.log(error);
        console.log("Balance Update Failed in engine !");
    }
});