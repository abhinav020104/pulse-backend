import axios from "axios";

const BASE_URL = "http://localhost:3000";
const TOTAL_BIDS = 50;
const TOTAL_ASK = 50;
const USER_IDS = ["1", "2", "3", "4", "5"];
const SYMBOLS = ["SOL_USD"];
const MAX_REQUESTS_PER_SECOND = 2;

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
        const price = 420 + Math.random() * 10;
        const openOrders = await rateLimitRequest(() =>
            axios.get(`${BASE_URL}/api/v1/order/open?userId=${userId}&market=${symbol}`)
        );

        //@ts-ignore    
        const totalBids = openOrders.data.filter((o: any) => o.side === "buy").length;
        //@ts-ignore       
        const totalAsks = openOrders.data.filter((o: any) => o.side === "sell").length;
        
        // Add a small delay between actions to mimic human-like behavior
        await new Promise(resolve => setTimeout(resolve, Math.random() * 500 + 500));

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
                        quantity: (60 + Math.random()*1).toFixed(1).toString(),
                        side: "buy",
                        userId: userId
                    })
                );
                bidsToAdd--;
                await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 500)); // Random delay
            }
            if (asksToAdd > 0) {
                await rateLimitRequest(() =>
                    axios.post(`${BASE_URL}/api/v1/order`, {
                        market: symbol,
                        price: (price + Math.random() * 1).toFixed(1).toString(),
                        quantity: (60 + Math.random()*1).toFixed(1).toString(),

                        side: "sell",
                        userId: userId
                    })
                );
                asksToAdd--;
                await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 500)); // Random delay
            }
        }

        // Wait a random amount of time before the next round to simulate market fluctuations
        await new Promise(resolve => setTimeout(resolve, Math.random() * 3000 + 2000));

        main();
    }

    async function cancelBidsMoreThan(openOrders: any[], price: number) {
        let promises: any[] = [];
        openOrders.map(o => {
            if (o.side === "buy" && (o.price > price + Math.random() * 0.5 || Math.random() < 0.2)) {
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
            if (o.side === "sell" && (o.price < price - Math.random() * 0.5 || Math.random() < 0.2)) {
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
