import express from "express"
import cors from "cors"

import { OrderRouter } from "./routes/order"
import { depthRouter } from "./routes/depth"
import { tickerRouter } from "./routes/ticker"
import { tradesRouter } from "./routes/trades"
import { klineRouter } from "./routes/kline"

const app = express();

app.use(cors());

app.use(express.json());

app.use("/api/v1/order", OrderRouter);
app.use("/api/v1/depth", depthRouter);
app.use("/api/v1/trades", tradesRouter);
app.use("/api/v1/klines", klineRouter);
app.use("/api/v1/tickers", tickerRouter);


app.listen(3000, () => {
    console.log("Server is running on port 3000");
});