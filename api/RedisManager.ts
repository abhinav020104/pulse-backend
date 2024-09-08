import { RedisClientType , createClient } from "redis";
import { MessageFromOrderBook } from "./types";
import { MessageToEngine } from "./types/to";

export class RedisManager{
    private client : RedisClientType;
    private publisher : RedisClientType;
    private static instance : RedisManager;

    private constructor(){
        this.client = createClient({
            // url: 'redis://redis:6379'
        });
        this.client.connect(); 
        this.publisher = createClient({
            // url: 'redis://redis:6379'
        });
        this.publisher.connect();
    }


    public static getInstance() {
        if(!this.instance){
            this.instance = new RedisManager(); 
        }
        return  this.instance; 
    }

    public sendAndAwait(message : MessageToEngine){
        return new Promise<MessageFromOrderBook>((resolve) => {
            const id = this.getRandomClient();
            this.client.subscribe(id , (message) => {
                this.client.unsubscribe(id);
                resolve(JSON.parse(message));
            });
            this.publisher.lPush("messages" , JSON.stringify({clientId : id  , message}));
        })
    }

    public getRandomClient(){
        return Math.random().toString(36).substring(2,15) + Math.random().toString(36).substring(2,15);
    }
}