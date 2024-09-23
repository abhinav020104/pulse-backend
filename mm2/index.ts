import axios from "axios";

const BASE_URL = "https://pulse-api-server.codewithabhinav.online";
const TOTAL_BIDS = 15;
const TOTAL_ASK = 15;
const MARKET = "SOL_USD";
const USER_ID = "3";

async function main() {
    let price = 290 + Math.random() * 10;
    const openOrders = await axios.get(`${BASE_URL}/api/v1/order/open?userId=${USER_ID}&market=${MARKET}`);

    const totalBids = openOrders.data.filter((o: any) => o.side === "buy").length;
    const totalAsks = openOrders.data.filter((o: any) => o.side === "sell").length;

    let bidsToAdd = TOTAL_BIDS - totalBids;
    let asksToAdd = TOTAL_ASK - totalAsks;

    while (bidsToAdd > 0 || asksToAdd > 0) {
        price = price + 30;
        if (asksToAdd > 0) {
            await axios.post(`${BASE_URL}/api/v1/order`, {
                market: MARKET,
                price: (price + Math.random() * 1).toFixed(1).toString(),
                quantity: Math.floor(35 + Math.random() * 10).toString(),
                side: "sell",
                userId: USER_ID
            });
            asksToAdd--;
            
            // Adding delay to simulate human behavior
            await delay(500, 1500); // Random delay between 500ms and 1500ms
        }
        if (bidsToAdd > 0) {
            price = price - 18;
            await axios.post(`${BASE_URL}/api/v1/order`, {
                market: MARKET,
                price: (price +   Math.random() * 1).toFixed(1).toString(),
                quantity: Math.floor(80 + Math.random() * 10).toString(),
                side: "buy",
                userId: USER_ID
            });
            bidsToAdd--;

            // Adding delay to simulate human behavior
            await delay(500, 1500); // Random delay between 500ms and 1500ms
        }
    }

    await new Promise(resolve => setTimeout(resolve, 1000));

    main();
}

// Function to create a random delay between min and max milliseconds
function delay(min: number, max: number) {
    const timeout = Math.floor(Math.random() * (max - min + 1) + min);
    return new Promise(resolve => setTimeout(resolve, timeout));
}

main();
