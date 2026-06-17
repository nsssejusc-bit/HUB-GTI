import { createContext, useContext, useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { useAuth } from "./AuthContext";

const SocketContext = createContext(null);
const ConnectedCtx  = createContext(false);
const UnreadCtx     = createContext(0);

// Roles que recebem notificações de novos chamados
const NOTIFY_ROLES = ["TECHNICIAN", "ADMIN"];

// Título base da aba (sem badge de não lidos)
const BASE_TITLE = document.title || "HelpDesk";

export function SocketProvider({ children }) {
  const { user, refreshUser } = useAuth();
  const socketRef   = useRef(null);
  const userRef     = useRef(user);       // evita closure stale no handler do socket
  const [connected, setConnected] = useState(false);
  const [unread,    setUnread]    = useState(0);

  // Mantém userRef sempre atualizado sem recriar o socket
  useEffect(() => { userRef.current = user; }, [user]);

  // Pede permissão de notificação assim que um técnico/admin faz login
  useEffect(() => {
    if (user && NOTIFY_ROLES.includes(user.role)) {
      if (typeof Notification !== "undefined" && Notification.permission === "default") {
        Notification.requestPermission();
      }
    }
  }, [user?.id]);

  // Badge no título da aba
  useEffect(() => {
    document.title = unread > 0 ? `(${unread}) ${BASE_TITLE}` : BASE_TITLE;
  }, [unread]);

  // Zera badge quando o técnico foca na aba
  useEffect(() => {
    const handleFocus = () => setUnread(0);
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, []);

  // Conexão WebSocket
  useEffect(() => {
    if (!user) {
      socketRef.current?.disconnect();
      socketRef.current = null;
      setConnected(false);
      return;
    }

    const socket = io({
      path: "/socket.io",
      transports: ["websocket", "polling"],
      withCredentials: true,
    });
    socketRef.current = socket;

    socket.on("connect",    () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));

    socket.on("ticket:created", (data) => {
      const u = userRef.current;
      if (!u || !NOTIFY_ROLES.includes(u.role)) return;

      // Técnico com núcleo definido: filtra por núcleo
      if (
        u.role === "TECHNICIAN" &&
        u.nucleoResponsavel &&
        data.nucleoResponsavel &&
        data.nucleoResponsavel !== u.nucleoResponsavel
      ) return;

      // Incrementa badge só se a aba não estiver em foco
      if (!document.hasFocus()) {
        setUnread((n) => n + 1);
      }

      // Notificação do sistema operacional
      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        const body = [data.department, data.category, data.subcategory]
          .filter(Boolean)
          .join(" · ");

        const notif = new Notification(`🔔 Novo chamado — ${data.ticketNumber}`, {
          body,
          icon: "/favicon.ico",
          tag:  data.ticketNumber,   // evita duplicatas para o mesmo chamado
        });

        // Clicar na notificação traz o browser para o foco
        notif.onclick = () => {
          window.focus();
          notif.close();
        };
      }
    });

    socket.on("user:updated", (data) => {
      if (data.id === userRef.current?.id) {
        refreshUser();
      }
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
    };
  }, [user?.id]);

  return (
    <SocketContext.Provider value={socketRef}>
      <ConnectedCtx.Provider value={connected}>
        <UnreadCtx.Provider value={unread}>
          {children}
        </UnreadCtx.Provider>
      </ConnectedCtx.Provider>
    </SocketContext.Provider>
  );
}

export function useSocket()          { return useContext(SocketContext); }
export function useSocketConnected() { return useContext(ConnectedCtx);  }
export function useUnreadCount()     { return useContext(UnreadCtx);     }
