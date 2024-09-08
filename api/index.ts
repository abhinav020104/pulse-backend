import express from "express"
import cors from "cors"
import { OrderRouter } from "./routes/order"
import { depthRouter } from "./routes/depth"
import { tickerRouter } from "./routes/ticker"
import { tradesRouter } from "./routes/trades"
import { klineRouter } from "./routes/kline"
import { authRouter } from "./routes/auth"
import { router } from "./routes/setBalances"
import dbConnect from "./db/database"
const app = express();

app.use(cors());

app.use(express.json());

app.use("/api/v1/order", OrderRouter);
app.use("/api/v1/depth", depthRouter);
app.use("/api/v1/trades", tradesRouter);
app.use("/api/v1/klines", klineRouter);
app.use("/api/v1/tickers", tickerRouter);
app.use("/api/v1/auth" , authRouter);
app.use("/api/v1/setbalances" , router);
app.get("/",(req , res)=>{
    return res.status(200).json({
        sucess:true,
        message:"You landed on a test route"
    })
})
app.listen(3000, () => {
    console.log("Server is running on port 3000");
});

dbConnect();

