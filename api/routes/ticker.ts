import { Router } from "express";
import { RedisManager } from "../RedisManager";
export const tickerRouter = Router();

tickerRouter.get("/" ,async(req , res)=>{
    // const {userId} = req.body
    const response = await RedisManager.getInstance().sendAndAwait({
        type:"GET_TICKERS"
        // data:userId
    })
    return res.status(200).json({
        success:true,
        data:response
    })
})