import fs from "fs";
import { RedisManager } from "../RedisManager";
import { ORDER_UPDATE, TRADE_ADDED } from "../types/index";
import { CANCEL_ORDER, CREATE_ORDER, GET_DEPTH, GET_OPEN_ORDERS, MessageFromApi, ON_RAMP, SET_BALANCES , GET_TICKERS} from "../types/fromApi";
import { Fill, Order, OrderBook } from "./OrderBook";
import {Client} from "pg"
export const BASE_CURRENCY = "USD";

const pgClient = new Client({
    user: "your_user",
    host: "localhost",
    database: "my_database",
    password: "your_password",
    port: 5432,
});

pgClient.connect();

interface UserBalance{
    [key:string]:{
        available:number;
        locked:number
    }
}

export class Engine{
    private orderBook: OrderBook[] = [];
    private balances : Map<string , UserBalance>= new Map();
    private pgClient:any
    constructor(){  
        this.pgClient = pgClient;
        console.log("constructor called");
        let snapshot = null
        try{
            if(process.env.WITH_SNAPSHOT){
                snapshot = fs.readFileSync("./snapshot.json");
            }
        }
        catch(e){
            console.log("No SnapShot Found");
        }

        if (snapshot) {
            const snapshotSnapshot = JSON.parse(snapshot.toString());
            this.orderBook = snapshotSnapshot.orderBook.map((o: any) => new OrderBook(o.baseAsset, o.bids, o.asks, o.lastTradeId, o.currentPrice));
            this.balances = new Map(snapshotSnapshot.balances);
        } else {
            this.orderBook.push(new OrderBook(`SOL`, [], [], 0, 0));
            this.orderBook.push(new OrderBook(`BTC`, [], [], 0, 0));
            this.orderBook.push(new OrderBook(`ETH`, [], [], 0, 0));
            this.orderBook.push(new OrderBook(`TETHER`, [], [], 0, 0));
            this.orderBook.push(new OrderBook(`MAX`, [], [], 0, 0));
            this.orderBook.push(new OrderBook(`POLYGON`, [], [], 0, 0));
            this.orderBook.push(new OrderBook(`BANANA`, [], [], 0, 0));
            this.orderBook.push(new OrderBook(`UNI`, [], [], 0, 0));
            this.orderBook.push(new OrderBook(`SHIB`, [], [], 0, 0));
            this.setBaseBalances();
        }
        setInterval(() => {
            this.saveSnapshot();
        }, 30000);
    }

    saveSnapshot() {
        const snapshotSnapshot = {
            orderBook: this.orderBook.map(o => o.getSnapShot()),
            balances: Array.from(this.balances.entries())
        }
        fs.writeFileSync("./snapshot.json", JSON.stringify(snapshotSnapshot));
    }


    process({message , clientId} : {message:MessageFromApi , clientId:string}){
        switch (message.type){
            case CREATE_ORDER:
                try{
                    const {executedQty , fills , orderId} = this.createOrder(message.data.market , message.data.price , message.data.quantity , message.data.side, message.data.userId);
                    RedisManager.getInstance().sendToApi(clientId , {
                        type:"ORDER_PLACED",
                        payload: {
                            orderId,
                            executedQty,
                            fills
                        }
                    })
                } catch (e){
                    RedisManager.getInstance().sendToApi(clientId , {
                        type:"ORDER_CANCELLED",
                        payload:{
                            orderId : "",
                            executedQty : 0,
                            remainingQty:0
                        }
                    })
                }
                break;
            case CANCEL_ORDER:
                try{
                    const orderId = message.data.orderId;
                    const cancelMarket = message.data.market;
                    const cancelOrderBook = this.orderBook.find(o => o.ticker() === cancelMarket);
                    const quoteAsset = cancelMarket.split("_")[1];
                    console.log("quoteAsset" + quoteAsset); 
                    if(!cancelOrderBook){
                        throw new Error("No Order Book Found");
                    }

                    const order = cancelOrderBook.asks.find(o=>o.orderId === orderId) || cancelOrderBook.bids.find(o=>o.orderId === orderId);
                    if(!order){
                        console.log("No Order Found");
                        throw new Error("No Order Found");
                    }


                    if(order.side == "buy"){
                        const price = cancelOrderBook.cancelBid(order);
                        const leftQuantity = (order.quantity - order.filled) * order.price;
                        // @ts-ignore
                        this.balances.get(order.userId)[BASE_CURRENCY].available += leftQuantity;
                        // @ts-ignore
                        this.balances.get(order.userId)[BASE_CURRENCY].locked -= leftQuantity;
                        if(price){
                            this.sendUpdatedDepthAt(price.toString() , cancelMarket)
                        }
                    }else {
                        const price = cancelOrderBook.cancelAsk(order)
                        const leftQuantity = order.quantity - order.filled;
                        //@ts-ignore
                        this.balances.get(order.userId)[quoteAsset].available += leftQuantity;
                        //@ts-ignore
                        this.balances.get(order.userId)[quoteAsset].locked -= leftQuantity;
                        if (price) {
                            this.sendUpdatedDepthAt(price.toString(), cancelMarket);
                        }
                    }

                    RedisManager.getInstance().sendToApi(clientId, {
                        type: "ORDER_CANCELLED",
                        payload: {
                            orderId,
                            executedQty: 0,
                            remainingQty: 0
                        }
                    });


                } catch (e) {
                    console.log("Error while cancelling order", );
                    console.log(e);
                }
                break;
                case GET_OPEN_ORDERS:
                    try {
                        const openOrderbook = this.orderBook.find(o => o.ticker() === message.data.market);
                        if (!openOrderbook) {
                            throw new Error("No orderbook found");
                        }
                        const openOrders = openOrderbook.getOpenOrders(message.data.userId);
    
                        RedisManager.getInstance().sendToApi(clientId, {
                            type: "OPEN_ORDERS",
                            payload: openOrders
                        }); 
                    } catch(e) {
                        console.log(e);
                    }
                    break;
                case ON_RAMP:
                    const userId = message.data.userId;
                    const amount = Number(message.data.amount);
                    this.onRamp(userId, amount);
                    break;
                case GET_DEPTH:
                    try {
                        const market = message.data.market;
                        const orderbook = this.orderBook.find(o => o.ticker() === market);
                        if (!orderbook) {
                            throw new Error("No orderbook found");
                        }
                        RedisManager.getInstance().sendToApi(clientId, {
                            type: "DEPTH",
                            payload: orderbook.getDepth()
                        });
                    } catch (e) {
                        console.log(e);
                        RedisManager.getInstance().sendToApi(clientId, {
                            type: "DEPTH",
                            payload: {
                                bids: [],
                                asks: []
                            }
                        });
                    }
                    break;
                case SET_BALANCES:
                    try {
                        console.log(message.data.avaialableBalance);
                        console.log(message.data.id);
                        const userId = message.data.id;
                        const amount = Number(message.data.avaialableBalance);
                        console.log(typeof(amount));
                        const userBalance = this.balances.get(userId)
                        if(!userBalance){
                            this.balances.set(userId , {
                                [BASE_CURRENCY]:{
                                    available:amount,
                                    locked:0
                                },
                                "SOL": { available: 0, locked: 0 },
                                "BTC": { available: 0, locked: 0 }, 
                                "ETH": { available: 0, locked: 0 }, 
                                "TETHER": { available: 0, locked: 0 }, 
                                "SHIB": { available: 0, locked: 0 }, 
                                "MAX": { available: 0, locked: 0 }, 
                                "POLYGON": { available: 0, locked: 0 }, 
                                "BANANA": { available: 0, locked: 0 }, 
                                "UNI": { available: 0, locked: 0 } 
                            })
                        }else{
                            userBalance[BASE_CURRENCY].available += amount;
                            console.log(typeof(userBalance[BASE_CURRENCY].available))
                        }
                        RedisManager.getInstance().sendToApi(clientId, {
                            type: "BALANCE",
                            //@ts-ignore
                            payload: this.balances.get(userId),
                        });
                    }catch(e){
                        console.log(e);
                    }
                case GET_TICKERS:
                    try{
                        const allSymbols = this.orderBook.map((x) => {
                            console.log(x);
                            return {
                                symbol : x.baseAsset + "_" + x.quoteAsset,
                                currentPrice : x.currentPrice
                            }
                        })
                        RedisManager.getInstance().sendToApi(clientId , {
                            type:"TICKERS",
                            payload:{
                                tickers:allSymbols
                        }})
                        // console.log(allSymbols);
                    }catch(e){
                        console.log(e);
                        console.log("Error while getting tickers");
                    }
        }
    }
    addOrderbook(orderbook: OrderBook) {
        this.orderBook.push(orderbook);
    }

    createOrder(market: string, price: string, quantity: string, side: "buy" | "sell", userId: string) {
        console.log("Creating Order");
        const orderbook = this.orderBook.find(o => o.ticker() === market)
        const baseAsset = market.split("_")[0];
        const quoteAsset = market.split("_")[1];

        if (!orderbook) {
            throw new Error("No orderbook found");
        }

        this.checkAndLockFunds(baseAsset, quoteAsset, side, userId, quoteAsset, price, quantity);
        console.log("Funds Checked");
        const order: Order = {
            price: Number(price),
            quantity: Number(quantity),
            orderId: Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15),
            filled: 0,
            side,
            userId
        }
        orderbook.removeZeroQtyDepth();
        const { fills, executedQty } = orderbook.addOrder(order);
        this.sendUpdatedDepthAt(price , market);
        this.updateBalance(userId, baseAsset, quoteAsset, side, fills, executedQty);
        this.createDbTrades(fills, market, userId);
        this.updateDbOrders(order, executedQty, fills, market);
        this.publishWsDepthUpdates(fills, price, side, market);
        this.publishWsTrades(fills, userId, market);
        this.publish24hStats(market);
        RedisManager.getInstance().publishMessage(`ticker@${market}`,{
            stream:`{ticker@${market}}`,
            data:{
                e:"ticker",
                c:orderbook.currentPrice.toString(),
                s:orderbook.baseAsset + "_" + orderbook.quoteAsset,
            }
        })
        RedisManager.getInstance().publishMessage(`ticker@${market}` , {
            stream:`{ticker@${market}}`,
            data:{
                e:"allTickers",
                c:orderbook.currentPrice.toString(),
                s:orderbook.baseAsset + "_" + orderbook.quoteAsset,
            }
        })
        this.pollDatabase(market);
        orderbook.removeZeroQtyDepth();
        return { executedQty, fills, orderId: order.orderId };
    }
    updateDbOrders(order: Order, executedQty: number, fills: Fill[], market: string) {
        RedisManager.getInstance().pushMessage({
            type: ORDER_UPDATE,
            data: {
                orderId: order.orderId,
                executedQty: executedQty,
                market: market,
                price: order.price.toString(),
                quantity: order.quantity.toString(),
                side: order.side,
            }
        });

        fills.forEach(fill => {
            RedisManager.getInstance().pushMessage({
                type: ORDER_UPDATE,
                data: {
                    orderId: fill.marketOrderId,
                    executedQty: fill.qty
                }
            });
        });
    }

    createDbTrades(fills: Fill[], market: string, userId: string) {
        fills.forEach(fill => {
            RedisManager.getInstance().pushMessage({
                type: TRADE_ADDED,
                data: {
                    market: market,
                    id: fill.tradeId.toString(),
                    isBuyerMaker: fill.otherUserId === userId, // TODO: Is this right?
                    price: fill.price,
                    quantity: fill.qty.toString(),
                    quoteQuantity: (fill.qty * Number(fill.price)).toString(),
                    timestamp: Date.now()
                }
            });
        });
    }

    publishWsTrades(fills: Fill[], userId: string, market: string) {
        fills.forEach(fill => {
            RedisManager.getInstance().publishMessage(`trade@${market}`, {
                stream: `trade@${market}`,
                data: {
                    e: "trade",
                    t: fill.tradeId,
                    m: fill.otherUserId === userId, // TODO: Is this right?
                    p: fill.price,
                    q: fill.qty.toString(),
                    s: market,
                }
            });
        });
    }

    sendUpdatedDepthAt(price: string, market: string) {
        const orderbook = this.orderBook.find(o => o.ticker() === market);
        if (!orderbook) {
            return;
        }
        const depth = orderbook.getDepth();
        const updatedBids = depth?.bids.filter(x => (x[0] === price));
        const updatedAsks = depth?.asks.filter(x => (x[0] === price));
        
        RedisManager.getInstance().publishMessage(`depth@${market}`, {
            stream: `depth@${market}`,
            data: {
                a: updatedAsks.length ? updatedAsks : [[price, "0"]],
                b: updatedBids.length ? updatedBids : [[price, "0"]],
                e: "depth"
            }
        });
    }

    publishWsDepthUpdates(fills: Fill[], price: string, side: "buy" | "sell", market: string) {
        const orderbook = this.orderBook.find(o => o.ticker() === market);
        if (!orderbook) {
            return;
        }
        const depth = orderbook.getDepth();
    
        if (side === "buy") {
            const updatedAsks = depth.asks.filter(x => fills.map(f => f.price).includes(x[0]));
            const updatedBid = depth.bids.find(x => x[0] === price);
    
            RedisManager.getInstance().publishMessage(`depth@${market}`, {
                stream: `depth@${market}`,
                data: {
                    a: updatedAsks.length ? updatedAsks : [],
                    b: updatedBid ? [updatedBid] : [],
                    e: "depth"
                }
            });
        }
    
        if (side === "sell") {
            const updatedBids = depth.bids.filter(x => fills.map(f => f.price).includes(x[0]));
            const updatedAsk = depth.asks.find(x => x[0] === price);
    
            RedisManager.getInstance().publishMessage(`depth@${market}`, {
                stream: `depth@${market}`,
                data: {
                    a: updatedAsk ? [updatedAsk] : [],
                    b: updatedBids.length ? updatedBids : [],
                    e: "depth"
                }
            });
        }
    }
    
    updateBalance(userId: string, baseAsset: string, quoteAsset: string, side: "buy" | "sell", fills: Fill[], executedQty: number) {
        if (side === "buy") {
            fills.forEach(fill => {
                // Update quote asset balance
                //@ts-ignore
                this.balances.get(fill.otherUserId)[quoteAsset].available = this.balances.get(fill.otherUserId)?.[quoteAsset].available + (fill.qty * fill.price);

                //@ts-ignore
                this.balances.get(userId)[quoteAsset].locked = this.balances.get(userId)?.[quoteAsset].locked - (fill.qty * fill.price);

                // Update base asset balance

                //@ts-ignore
                this.balances.get(fill.otherUserId)[baseAsset].locked = this.balances.get(fill.otherUserId)?.[baseAsset].locked - fill.qty;

                //@ts-ignore
                this.balances.get(userId)[baseAsset].available = this.balances.get(userId)?.[baseAsset].available + fill.qty;

            });
            
        } else {
            fills.forEach(fill => {
                // Update quote asset balance
                //@ts-ignore
                this.balances.get(fill.otherUserId)[quoteAsset].locked = this.balances.get(fill.otherUserId)?.[quoteAsset].locked - (fill.qty * fill.price);

                //@ts-ignore
                this.balances.get(userId)[quoteAsset].available = this.balances.get(userId)?.[quoteAsset].available + (fill.qty * fill.price);

                // Update base asset balance

                //@ts-ignore
                this.balances.get(fill.otherUserId)[baseAsset].available = this.balances.get(fill.otherUserId)?.[baseAsset].available + fill.qty;

                //@ts-ignore
                this.balances.get(userId)[baseAsset].locked = this.balances.get(userId)?.[baseAsset].locked - (fill.qty);

            });
        }
    }

    async publish24hStats(market: string) {
        let Tempmarket = market.toLowerCase();
        const baseAsset = Tempmarket.split("_")[0];
        try {
            // Query to fetch the last 24 hours data from the _1m table
            const query = `
        SELECT 
            MIN(close) AS low24h,
            MAX(close) AS high24h,
            SUM(volume) AS volume24h,
            (SELECT close FROM ${baseAsset}_1h ORDER BY "end" DESC LIMIT 1) AS currentPrice,
            (SELECT open FROM ${baseAsset}_1h ORDER BY "end" ASC LIMIT 1) AS open24h
        FROM ${baseAsset}_1m
        WHERE "end" >= NOW() - INTERVAL '24 hours'`;
    
            // Execute the query
            const { rows } = await this.pgClient.query(query);
            const data = rows[0];
            console.log(data);
            // Calculate 24h change

            const change24h = Number(data.currentprice) - Number(data.open24h);
            const change24hPercentage = (change24h / Number(data.open24h)) * 100;
    
            // Return the 24h stats
            RedisManager.getInstance().publishMessage(`24hdata@${market}` , {
            stream:`24hdata@${market}`,
                data:{
                    e:"24hstats",
                    s: market,
                    currentPrice: data.currentprice,
                    change24h: change24h.toFixed(2),
                    change24hPercentage: change24hPercentage.toFixed(2),
                    high24h: data.high24h,
                    low24h: data.low24h,
                    volume24h: data.volume24h
                }
            })
            // return {
            //     symbol: market,
            //     currentPrice: data.currentPrice,
            //     change24h: change24h.toFixed(2),
            //     change24hPercentage: change24hPercentage.toFixed(2),
            //     high24h: data.high24h,
            //     low24h: data.low24h,
            //     volume24h: data.volume24h
            // };
        } catch (error) {
            console.error("Error fetching 24h stats:", error);
            throw error;
        }
    }

    
    checkAndLockFunds(
        baseAsset: string,
        quoteAsset: string,
        side: "buy" | "sell",
        userId: string,
        ticker: string,
        price: string,
        quantity: string
    ) {
        const userBalance = this.balances.get(userId);
        if (!userBalance) {
            throw new Error("User balance not found");
        }
    
        const availableBase = userBalance[baseAsset]?.available || 0;
        const availableQuote = userBalance[quoteAsset]?.available || 0;
    
        if (side === "sell" && availableBase === 0) {
            throw new Error("Insufficient base asset balance to sell");
        }
    
        if (side === "buy") {
            const requiredQuote = Number(price) * Number(quantity);
            if (availableQuote < requiredQuote) {
                throw new Error("Insufficient quote asset balance to buy");
            }
            userBalance[quoteAsset].available -= requiredQuote;
            userBalance[quoteAsset].locked += requiredQuote;
        } else if (side === "sell") {
            if (availableBase < Number(quantity)) {
                throw new Error("Insufficient base asset balance to sell");
            }
            userBalance[baseAsset].available -= Number(quantity);
            userBalance[baseAsset].locked += Number(quantity);
        }
    }
    
    


    onRamp(userId: string, amount: number) {
        const userBalance = this.balances.get(userId);
        if (!userBalance) {
            this.balances.set(userId, {
                [BASE_CURRENCY]: {
                    available: amount,
                    locked: 0
                }
            });
        } else {
            userBalance[BASE_CURRENCY].available += amount;
        }
    }
    async pollDatabase(market:string) {
        market.toLowerCase();
        const baseAsset = market.split("_")[0]
        try {
            const queries = [
                `SELECT * FROM ${baseAsset}_1m ORDER BY "end" DESC LIMIT 1`,
                `SELECT * FROM ${baseAsset}_1h ORDER BY "end" DESC LIMIT 1`,
                `SELECT * FROM ${baseAsset}_1w ORDER BY "end" DESC LIMIT 1`
            ];

            const [sol1mData, sol1hData, sol1wData] = await Promise.all(
                queries.map(query => this.pgClient.query(query))
            );

            // console.log("sol_1m Data:", sol1mData.rows);
            // console.log("sol_1h Data:", sol1hData.rows);
            // console.log("sol_1w Data:", sol1wData.rows);
            RedisManager.getInstance().publishMessage(`kline@${market}` , {
                stream:`kline@${market}`,
                data:{
                    e:"kline",
                    time:sol1hData.rows[0].end,
                    close:sol1hData.rows[0].close,
                    open:sol1hData.rows[0].open,
                    high:sol1hData.rows[0].high,
                    low:sol1hData.rows[0].low
                }
            });
            // Process the fetched data as needed
        } catch (error) {
            console.error("Error polling database:", error);
        }
    }
    setBaseBalances() {
        this.balances.set("1", {
            [BASE_CURRENCY]: { available: 100000000000000, locked: 0 },
            "SOL": { available: 100000000000000, locked: 0 },
            "BTC": { available: 500000000, locked: 0 }, // Default for BTC
            "ETH": { available: 2000000000, locked: 0 }, // Default for ETH
            "TETHER": { available: 100000000, locked: 0 }, // Default for TETHER
            "SHIB": { available: 1000000000000, locked: 0 }, // Default for SHIB
            "MAX": { available: 3000000000, locked: 0 }, // Default for MAX
            "POLYGON": { available: 5000000000, locked: 0 }, // Default for POLYGON
            "BANANA": { available: 10000000000, locked: 0 }, // Default for BANANA
            "UNI": { available: 100000000, locked: 0 } // Default for UNI
        });
        
        this.balances.set("2", {
            [BASE_CURRENCY]: { available: 100000000000000, locked: 0 },
            "SOL": { available: 100000000000000, locked: 0 },
            "BTC": { available: 500000000, locked: 0 }, // Default for BTC
            "ETH": { available: 2000000000, locked: 0 }, // Default for ETH
            "TETHER": { available: 100000000, locked: 0 }, // Default for TETHER
            "SHIB": { available: 1000000000000, locked: 0 }, // Default for SHIB
            "MAX": { available: 3000000000, locked: 0 }, // Default for MAX
            "POLYGON": { available: 5000000000, locked: 0 }, // Default for POLYGON
            "BANANA": { available: 10000000000, locked: 0 }, // Default for BANANA
            "UNI": { available: 100000000, locked: 0 } // Default for UNI
        });
        
        this.balances.set("3", {
            [BASE_CURRENCY]: { available: 100000000000000, locked: 0 },
            "SOL": { available: 100000000000000, locked: 0 },
            "BTC": { available: 500000000, locked: 0 }, // Default for BTC
            "ETH": { available: 2000000000, locked: 0 }, // Default for ETH
            "TETHER": { available: 100000000, locked: 0 }, // Default for TETHER
            "SHIB": { available: 1000000000000, locked: 0 }, // Default for SHIB
            "MAX": { available: 3000000000, locked: 0 }, // Default for MAX
            "POLYGON": { available: 5000000000, locked: 0 }, // Default for POLYGON
            "BANANA": { available: 10000000000, locked: 0 }, // Default for BANANA
            "UNI": { available: 100000000, locked: 0 } // Default for UNI
        });
        
        this.balances.set("4", {
            [BASE_CURRENCY]: { available: 100000000000000, locked: 0 },
            "SOL": { available: 100000000000000, locked: 0 },
            "BTC": { available: 500000000, locked: 0 }, // Default for BTC
            "ETH": { available: 2000000000, locked: 0 }, // Default for ETH
            "TETHER": { available: 100000000, locked: 0 }, // Default for TETHER
            "SHIB": { available: 1000000000000, locked: 0 }, // Default for SHIB
            "MAX": { available: 3000000000, locked: 0 }, // Default for MAX
            "POLYGON": { available: 5000000000, locked: 0 }, // Default for POLYGON
            "BANANA": { available: 10000000000, locked: 0 }, // Default for BANANA
            "UNI": { available: 100000000, locked: 0 } // Default for UNI
        });
        
        this.balances.set("5", {
            [BASE_CURRENCY]: { available: 100000000000000, locked: 0 },
            "SOL": { available: 100000000000000, locked: 0 },
            "BTC": { available: 500000000, locked: 0 }, // Default for BTC
            "ETH": { available: 2000000000, locked: 0 }, // Default for ETH
            "TETHER": { available: 100000000, locked: 0 }, // Default for TETHER
            "SHIB": { available: 1000000000000, locked: 0 }, // Default for SHIB
            "MAX": { available: 3000000000, locked: 0 }, // Default for MAX
            "POLYGON": { available: 5000000000, locked: 0 }, // Default for POLYGON
            "BANANA": { available: 10000000000, locked: 0 }, // Default for BANANA
            "UNI": { available: 100000000, locked: 0 } // Default for UNI
        });
        
    }

}