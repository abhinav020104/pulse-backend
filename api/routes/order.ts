import { Router } from "express";
import { RedisManager } from "../RedisManager";
import { CREATE_ORDER , CANCEL_ORDER , ON_RAMP , GET_OPEN_ORDERS } from "../types";

export const OrderRouter = Router();

OrderRouter.post("/" , async(req , res) => {
    const {market , price , quantity , side , userId} = req.body;
    const response = await RedisManager.getInstance().sendAndAwait({
        type : CREATE_ORDER,
        data: {
            market ,
            price ,
            quantity,
            side,
            userId,
        }
    });
    res.json(response.payload);
});

OrderRouter.delete("/" , async(req , res)=>{
    const {orderId , market} = req.body;
    const response = await RedisManager.getInstance().sendAndAwait({
        type:CANCEL_ORDER,
        data:{
            orderId,
            market
        }
    });
    res.json(response.payload); 
})

OrderRouter.get("/open" , async(req , res)=>{
    console.log(req.query.userId , req.query.market)
    const response = await RedisManager.getInstance().sendAndAwait({
        type:GET_OPEN_ORDERS ,
        data:{
            userId : req.query.userId as string,
            market : req.query.market as string,
        }
    })
    res.json(response.payload);
})