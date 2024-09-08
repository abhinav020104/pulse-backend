import { Router } from "express";
import { RedisManager } from "../RedisManager";
import { CREATE_ORDER , CANCEL_ORDER , ON_RAMP , GET_OPEN_ORDERS } from "../types";
import User from "../models/User";
export const OrderRouter = Router();
    //@ts-ignore
const updateHoldings = async (userId, market, quantity , price) => {
    //@ts-ignore
const user = await User.findOne({UserId:userId});
    if (!user) {
        throw new Error("User not found");
    }
    //@ts-ignore
    const existingHolding = user.Holdings.find(holding => holding.asset === market);
    const transactionAmount = quantity*price;
    user.Balance = user.Balance - transactionAmount;
    if (existingHolding) {
        existingHolding.quantity += quantity;
        existingHolding.price  = (existingHolding.price + price) / 2;
    } else {
        //@ts-ignore
        user.Holdings.push({
            asset: market,
            quantity:quantity,
            price:price
        });
    }
    await user.save();
};

OrderRouter.post("/", async (req, res) => {
    const { market, price, quantity, side, userId } = req.body;
    
    try {
        const response = await RedisManager.getInstance().sendAndAwait({
            type: CREATE_ORDER,
            data: {
                market,
                price,
                quantity,
                side,
                userId,
            }
        });
        if (userId !== "1" && userId !== "2" && userId !== "3" && userId !== "5") {
            if (side === "buy") {
                //@ts-ignore
                if (response.payload.executedQty) {
                    let total = 0;
                    //@ts-ignore
                    for (let i = 0; i < response.payload.fills.length; i++) {
                        //@ts-ignore
                        total += Number(response.payload.fills[i].price);
                    }
                    //@ts-ignore
                    let totalFills = response.payload.fills.length;
                    let averagePrice = Number(total / totalFills);
                    await updateHoldings(userId, market, Number(quantity), averagePrice);
                }
                res.json(response.payload);
            } else {
                //@ts-ignore
                if (response.payload.executedQty) {
                    let total = 0;
                    //@ts-ignore
                    for (let i = 0; i < response.payload.fills.length; i++) {
                        //@ts-ignore
                        total += Number(response.payload.fills[i].price);
                    }
                    //@ts-ignore
                    let totalFills = response.payload.fills.length;
                    let averagePrice = Number(total / totalFills);
                    await updateHoldings(userId, market, (Number(quantity) * -1), averagePrice);
                }
                res.json(response.payload);
            }
        } else {
            res.json(response.payload); // If userId is 1, 2, or 3, just return the payload without modifying holdings.
        }
    } catch (error:any) {
        console.log(error); 
        res.status(500).json({ error: error.message });
    }
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


OrderRouter.post("/getholdings" , async(req , res)=>{
    const {userId} = req.body;
    try{
        const HoldingDetails = await User.findOne({UserId : userId});
        if(!HoldingDetails){
            return res.status(404).json({
                sucess:false,
                message:"Invalid User Id"
            })
        }else{
            return res.status(200).json({
                sucess:true,
                message:"Holdings Fetched Successfully !",
                data:HoldingDetails.Holdings
            })
        }
    }catch(error:any){
        console.log("Error while fetching user holdings");
        console.log(error);
    } 
})