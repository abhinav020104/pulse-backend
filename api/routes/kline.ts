import { Client } from "pg";
import { Router } from "express";
import { RedisManager } from "../RedisManager";

const pgClient = new Client({
    user : "your_user",
    host:"localhost",
    database:"my_database",
    password:"your_password",
    port:5432,
});
    
pgClient.connect();


export const klineRouter  = Router();

klineRouter.get("/" , async(req , res) => {
    const {market , interval , startTime , endTime} = req.query;
    let query;
    switch(interval){
        case "1m" :
            query = `SELECT * FROM sol_1m WHERE "end" >= $1 AND "end" <= $2`;
            break;
        case '1h':
            query = `SELECT * FROM sol_1h WHERE  "end" >= $1 AND "end" <= $2`;
            break;
        case '1w':
            query = `SELECT * FROM sol_1w WHERE "end" >= $1 AND "end" <= $2`;
            break;
        default:
            return res.status(400).send('Invalid interval');
    }

    try {
        //@ts-ignore
        const result = await pgClient.query(query, [new Date(startTime * 1000 as string), new Date(endTime * 1000 as string)]);
        res.json(result.rows.map(x => ({
            //@ts-ignore
            close: x.close,
            //@ts-ignore
            end: x.end,
            //@ts-ignore
            high: x.high,
            //@ts-ignore
            low: x.low,
            //@ts-ignore
            open: x.open,
            //@ts-ignore
            quoteVolume: x.quoteVolume,
            //@ts-ignore
            start: x.start,
            //@ts-ignore
            trades: x.trades,
            //@ts-ignore
            volume: x.volume,
        })));
    } catch (err) {
        console.log(err);
        res.status(500).send(err);
    }

})