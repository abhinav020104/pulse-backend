import axios from "axios";

const BASE_URL = "http://localhost:3000";
const TOTAL_BIDS = 50;
const TOTAL_ASK = 50;
const USER_IDS = ["1", "2", "3", "4", "5"]; // Array of different user IDs
const SYMBOLS = ["SOL_USD"]; // Array of different symbols
const MAX_REQUESTS_PER_SECOND = 2; // Adjust based on API rate limits

let requestQueue: (() => void)[] = [];
let isProcessing = false;

function rateLimitRequest(fn: () => Promise<any>) {
    return new Promise((resolve, reject) => {
        requestQueue.push(() => {
            fn().then(resolve).catch(reject).finally(() => processQueue());
        });
        if (!isProcessing) {
            processQueue();
        }
    });
}

function processQueue() {
    if (isProcessing || requestQueue.length === 0) {
        return;
    }
    isProcessing = true;
    let start = Date.now();
    let requestsInCurrentSecond = 0;
    
    const processNext = () => {
        if (requestsInCurrentSecond >= MAX_REQUESTS_PER_SECOND) {
            const delay = 1000 - (Date.now() - start);
            if (delay > 0) {
                setTimeout(() => {
                    requestsInCurrentSecond = 0;
                    start = Date.now();
                    processNext();
                }, delay);
                return;
            }
        }
        isProcessing = false;
        if (requestQueue.length > 0) {
            requestsInCurrentSecond++;
            const next = requestQueue.shift();
            next && next();
        }
    };
    
    processNext();
}

async function simulateMarketMaker(userId: string, symbol: string) {
    async function main() {
        const price = 129 + Math.random() * 10;
        const openOrders = await rateLimitRequest(() =>
            axios.get(`${BASE_URL}/api/v1/order/open?userId=${userId}&market=${symbol}`)
        );
        //@ts-ignore    
        const totalBids = openOrders.data.filter((o: any) => o.side === "buy").length;
        //@ts-ignore       
        const totalAsks = openOrders.data.filter((o: any) => o.side === "sell").length;
        //@ts-ignore
        const cancelledBids = await cancelBidsMoreThan(openOrders.data, price);
        //@ts-ignore
        const cancelledAsks = await cancelAsksLessThan(openOrders.data, price);

        let bidsToAdd = TOTAL_BIDS - totalBids - cancelledBids;
        let asksToAdd = TOTAL_ASK - totalAsks - cancelledAsks;

        while (bidsToAdd > 0 || asksToAdd > 0) {
            if (bidsToAdd > 0) {
                await rateLimitRequest(() =>
                    axios.post(`${BASE_URL}/api/v1/order`, {
                        market: symbol,
                        price: (price - Math.random() * 1).toFixed(1).toString(),
                        quantity: "1",
                        side: "buy",
                        userId: userId
                    })
                );
                bidsToAdd--;
            }
            if (asksToAdd > 0) {
                await rateLimitRequest(() =>
                    axios.post(`${BASE_URL}/api/v1/order`, {
                        market: symbol,
                        price: (price + Math.random() * 1).toFixed(1).toString(),
                        quantity: "1",
                        side: "sell",
                        userId: userId
                    })
                );
                asksToAdd--;
            }
        }

        await new Promise(resolve => setTimeout(resolve, 1000));

        main();
    }

    async function cancelBidsMoreThan(openOrders: any[], price: number) {
        let promises: any[] = [];
        openOrders.map(o => {
            if (o.side === "buy" && (o.price > price || Math.random() < 0.1)) {
                promises.push(rateLimitRequest(() =>
                    axios.delete(`${BASE_URL}/api/v1/order`, {
                        data: {
                            orderId: o.orderId,
                            market: symbol
                        }
                    })
                ));
            }
        });
        await Promise.all(promises);
        return promises.length;
    }

    async function cancelAsksLessThan(openOrders: any[], price: number) {
        let promises: any[] = [];
        openOrders.map(o => {
            if (o.side === "sell" && (o.price < price || Math.random() < 0.5)) {
                promises.push(rateLimitRequest(() =>
                    axios.delete(`${BASE_URL}/api/v1/order`, {
                        data: {
                            orderId: o.orderId,
                            market: symbol
                        }
                    })
                ));
            }
        });

        await Promise.all(promises);
        return promises.length;
    }

    main();
}

// Create and run market makers for each combination of user ID and symbol
USER_IDS.forEach(userId => {
    SYMBOLS.forEach(symbol => simulateMarketMaker(userId, symbol));
});
