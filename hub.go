package main

import (
	"log"
	"math/rand"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

const letterBytes = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"
const (
	letterIdxBits = 6                    // 6 bits to represent a letter index
	letterIdxMask = 1<<letterIdxBits - 1 // All 1-bits, as many as letterIdxBits
)

func randomStr(n int) string {
	b := make([]byte, n)
	for i := 0; i < n; {
		if idx := int(rand.Int63() & letterIdxMask); idx < len(letterBytes) {
			b[i] = letterBytes[idx]
			i++
		}
	}
	return string(b)
}

type Hub struct {
	*sync.Mutex
	registered map[*Client]bool
	index      map[string]*Client

	broadcast chan *Message
}

type Message struct {
	data     []byte
	clientID string
}

func newHub() *Hub {
	return &Hub{
		Mutex:      &sync.Mutex{},
		registered: make(map[*Client]bool),
		index:      make(map[string]*Client),
		broadcast:  make(chan *Message),
	}
}

func (h *Hub) run() {
	for {
		select {
		case message := <-h.broadcast:
			for client := range h.registered {
				if client.ID == message.clientID {
					continue
				}
				select {
				case client.send <- message:
				default:
					close(client.send)
					delete(h.registered, client)
				}
			}
		}
	}
}

func (h *Hub) newClient(conn *websocket.Conn) *Client {
	c := &Client{
		ID:   randomStr(5),
		hub:  h,
		conn: conn,
		send: make(chan *Message),
	}
	h.Lock()
	defer h.Unlock()
	h.registered[c] = true
	h.index[c.ID] = c

	return c
}

type Client struct {
	ID   string
	hub  *Hub
	conn *websocket.Conn
	send chan *Message
}

func (c *Client) write() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		c.conn.Close()
	}()
	for {
		select {
		case message, ok := <-c.send:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				// The hub closed the channel.
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			w, err := c.conn.NextWriter(websocket.TextMessage)
			if err != nil {
				return
			}
			w.Write(message.data)
		case <-ticker.C:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

const (
	// Time allowed to write a message to the peer.
	writeWait = 10 * time.Second
	// Time allowed to read the next pong message from the peer.
	pongWait = 60 * time.Second
	// Send pings to peer with this period. Must be less than pongWait.
	pingPeriod = (pongWait * 9) / 10
	// Maximum message size allowed from peer.
	maxMessageSize = 512
)

var (
	newline = []byte{'\n'}
	space   = []byte{' '}
)

func (c *Client) read() {
	//c.conn.SetReadLimit(maxMessageSize)
	c.conn.SetReadDeadline(time.Now().Add(pongWait))
	c.conn.SetPongHandler(func(string) error { c.conn.SetReadDeadline(time.Now().Add(pongWait)); return nil })
	for {
		_, message, err := c.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("error: %v", err)
			}
			break
		}
		c.hub.broadcast <- &Message{
			data:     message,
			clientID: c.ID,
		}
	}
}

func serveWS() http.HandlerFunc {
	h := newHub()
	go h.run()

	var upgrader = websocket.Upgrader{
		ReadBufferSize:  1024,
		WriteBufferSize: 1024,
	}

	return func(w http.ResponseWriter, r *http.Request) {
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			log.Println("err: ", err)
		}
		c := h.newClient(conn)
		go c.write()
		go c.read()
	}
}
