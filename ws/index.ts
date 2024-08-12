import WebSocket, { WebSocketServer } from "ws";
import { UserManager } from "./UserManager";

const wss = new WebSocketServer({port:3001} , ()=>{
    console.log("Websocker server started ! ");
})

wss.on("connection" , (ws)=>{
    console.log("new connection established"); 
    UserManager.getInstance().addUser(ws); 
})

wss.on("error", (error) => {
    console.error('WebSocket server error:', error);
});