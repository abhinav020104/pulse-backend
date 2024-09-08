//TODO: Can we share the types between the ws layer and the engine?

import { Stream } from "stream"

// export type TickerUpdateMessage = {
//     stream: string, 
//     data: {
//         c?: string,
//         h?: string,
//         l?: string,
//         v?: string,
//         V?: string,
//         s?: string,
//         id: number,
//         e: "ticker"
//     }
// }

export type DepthUpdateMessage = {
    stream: string,
    data: {
        b?: [string, string][],
        a?: [string, string][],
        e: "depth"
    }
}

export type TradeAddedMessage = {
    stream: string,
    data: {
        e: "trade",
        t: number,
        m: boolean,
        p: string,
        q: string,
        s: string, // symbol
    }
}

export type tickerUpdateMessage ={
    stream:string,
    data:{
        e:"ticker",
        s:string,
        c:string
    }
}

export type klineMessage = {
    stream:string,
    data:{
        e:"kline",
        time:string,
        close:string,
        high:string,
        low:string,
        open:string,
    }
}


export type stats = {
    stream : string,
    data:{
        e:"24hstats",
        s: any,
        currentPrice: any,
        change24h: any,
        change24hPercentage: any,
        high24h: any,
        low24h: any,
        volume24h: any,
    }
}

export type  allTickers = {
    stream:string,
    data:{
        e:"allTickers",
        s:any,
        c:any,
    }
}
export type WsMessage = tickerUpdateMessage | DepthUpdateMessage | TradeAddedMessage | klineMessage | stats | allTickers;
