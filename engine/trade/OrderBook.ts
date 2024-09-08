import { BASE_CURRENCY } from "./Engine";
// import { Engine } from "./Engine";
export interface Order{
    price : number,
    quantity:number,
    orderId : string,
    filled : number,
    side : "buy" | "sell",
    userId : string,
}

export interface Fill{
    price : string,
    qty : number,
    tradeId : number,
    otherUserId : string,
    marketOrderId : string
}

export class OrderBook{
    bids : Order[]
    asks : Order[]
    baseAsset : string
    quoteAsset : string = BASE_CURRENCY
    lastTradedId : number
    currentPrice : number

    constructor(baseAsset : string , bids:Order[] , asks:Order[] , lastTradedId : number , currentPrice : number){
        console.log(baseAsset); 
        this.bids = bids
        this.asks = asks
        this.baseAsset = baseAsset
        this.lastTradedId = lastTradedId || 0
        this.currentPrice = currentPrice || 0
    }

    ticker(){
        console.log(this.baseAsset , this.quoteAsset)
        return `${this.baseAsset}_${this.quoteAsset}`;
    }

    getSnapShot(){
        return{
            baseAsset : this.baseAsset,
            bids : this.bids,
            asks : this.asks,
            lastTradedIdthis :this.lastTradedId,
            currentPrice : this.currentPrice,
        }
    }


    addOrder(order:Order):{
        executedQty : number,
        fills : Fill[]
    }{
        console.log("Here to add order !");
        if(order.side === "buy"){
            const {executedQty , fills} = this.matchBid(order);
            // console.log(order); 
            order.filled = executedQty;
            if(executedQty === order.quantity){
                return{
                    executedQty,
                    fills
                }
            }
            order.quantity -= order.filled;
            order.filled = 0;
            console.log(order);
            this.bids.push(order);
            return{
                executedQty,
                fills
            }
        }else  {
            const {executedQty , fills} = this.matchAsk(order);
            order.filled = executedQty;
            if(executedQty === order.quantity){
                return {
                    executedQty,
                    fills
                }
            }
            order.quantity -= order.filled;
            order.filled = 0;
            console.log(order);
            this.asks.push(order);
            return{
                executedQty,
                fills
            }
        }
    }

    matchBid(order: Order): { fills: Fill[], executedQty: number } {
        const fills: Fill[] = [];
        let executedQty = 0;
    
        for (let i = 0; i < this.asks.length; i++) {
            if (this.asks[i].price <= order.price && executedQty < order.quantity) {
                const filledQty = Math.min(order.quantity - executedQty, this.asks[i].quantity);
                executedQty += filledQty;
                this.asks[i].filled += filledQty;
    
                fills.push({
                    price: this.asks[i].price.toString(),
                    qty: filledQty,
                    tradeId: this.lastTradedId++,
                    otherUserId: this.asks[i].userId,
                    marketOrderId: this.asks[i].orderId,
                });
    
                this.currentPrice = this.asks[i].price;
    
                // Update the ask quantity
                this.asks[i].quantity -= filledQty;
    
                // If the ask is fully filled, remove or reset it
                if (this.asks[i].quantity <= 0) {
                    this.asks[i].quantity = 0; 
                }
            }
        }
    
        return {
            fills,
            executedQty,
        };
    }
    

    matchAsk(order: Order): { fills: Fill[], executedQty: number } {
        const fills: Fill[] = [];
        let executedQty = 0;
    
        for (let i = 0; i < this.bids.length; i++) {
            if (this.bids[i].price >= order.price && executedQty < order.quantity) {
                const amountRemaining = Math.min(order.quantity - executedQty, this.bids[i].quantity);
                executedQty += amountRemaining;
                this.bids[i].filled += amountRemaining;
    
                fills.push({
                    price: this.bids[i].price.toString(),
                    qty: amountRemaining,
                    tradeId: this.lastTradedId++,
                    otherUserId: this.bids[i].userId,
                    marketOrderId: this.bids[i].orderId
                });
    
                // Update the bid quantity
                this.bids[i].quantity -= amountRemaining;
    
                // If the bid is fully filled, reset its quantity to 0
                if (this.bids[i].quantity <= 0) {
                    this.bids[i].quantity = 0;
                }
    
                this.currentPrice = this.bids[i].price;
            }
        }
    
        return {
            fills,
            executedQty
        };
    }
    


    getDepth(){
        const bids : [string , string] [] = [];
        const asks : [string , string] [] = [];
        const bidsObj : {[key : string ]: number} = {};
        const asksObj : {[key:string]:number} = {};

        for(let i = 0 ; i < this.bids.length ; i++){
            const order = this.bids[i];
            if(!bidsObj[order.price]){
                bidsObj[order.price] = 0;
            }
            bidsObj[order.price] +=  order.quantity;
        }

        for(let i = 0 ; i<this.asks.length ; i++){
            const order = this.asks[i];
            if(!asksObj[order.price]){
                asksObj[order.price] = 0;
            }
            asksObj[order.price] += order.quantity;
        }

        for(const price in bidsObj){
            bids.push([price , bidsObj[price].toString()]);
        }
        
        for(const price in asksObj){
            asks.push([price , asksObj[price].toString()]);
        }
        console.log("bids" , bids);
        console.log("asks" , asks); 
        return{
            bids,
            asks,
        };
    }

    getOpenOrders(userId : string):Order[]{
        const asks = this.asks.filter(x=>x.userId === userId); 
        const bids = this.bids.filter(x=> x.userId === userId );
        return [...asks , ...bids];
    }


    cancelBid(order: Order) {
        const index = this.bids.findIndex(x => x.orderId === order.orderId);
        if (index !== -1) {
            const price = this.bids[index].price;
            this.bids.splice(index, 1);
            return price
        }
    }

    cancelAsk(order: Order) {
        const index = this.asks.findIndex(x => x.orderId === order.orderId);
        if (index !== -1) {
            const price = this.asks[index].price;
            this.asks.splice(index, 1);
            return price
        }
    }
    
    removeZeroQtyDepth(){
        const updatedAsks =  this.asks;
        const updatedBids =  this.bids;
        for(let i = 0 ; i<updatedAsks.length ; i++){
            if(updatedAsks[i].quantity === 0){
                updatedAsks.splice(i , 1);
                i--;
            }
        }
        for(let i = 0 ; i<updatedBids.length ;i++){
            if(updatedBids[i].quantity === 0){
                updatedBids.splice(i,1);
                i--;
            }
        }

        this.asks = updatedAsks;
        this.bids = updatedBids; 
    }

} 