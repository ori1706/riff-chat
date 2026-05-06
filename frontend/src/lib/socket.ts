import { io, type Socket } from "socket.io-client";
import { API_BASE } from "./apiBase";

export function createSocket(token: string): Socket {
  return io(API_BASE || window.location.origin, {
    path: "/socket.io/",
    auth: { token },
    transports: ["websocket", "polling"],
    autoConnect: true,
    reconnectionDelay: 1200,
    reconnectionDelayMax: 8000,
    randomizationFactor: 0.5,
  });
}
