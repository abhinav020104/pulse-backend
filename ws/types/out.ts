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

export type tickerUpdateMessage = {
    stream:string,
    data:{
        e:"ticker",
        s:string,
        c:string
    }
}

export type OutgoingMessage = tickerUpdateMessage | DepthUpdateMessage | TradeAddedMessage;