package main

import (
	"context"
	"flag"
	"log"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"os/signal"
)

func main() {
	addr := flag.String("addr", "127.0.0.1:8080", "addr and port to serve from")
	flag.Parse()
	srv := &http.Server{Addr: *addr}
	http.Handle("/", http.FileServer(http.Dir("app")))
	username := os.Getenv("DBUSER")
	password := os.Getenv("DBPASS")
	remote, err := url.Parse("http://localhost:5984")
	if err != nil {
		panic(err)
	}
	proxyH := func(p *httputil.ReverseProxy) func(http.ResponseWriter, *http.Request) {
		return func(w http.ResponseWriter, r *http.Request) {
			log.Println(r.URL)
			r.Host = remote.Host
			w.Header().Set("X-Ben", "Rad")
			r.SetBasicAuth(username, password)
			p.ServeHTTP(w, r)
		}
	}

	proxy := httputil.NewSingleHostReverseProxy(remote)
	http.Handle("/db/", http.StripPrefix("/db/", http.HandlerFunc(proxyH(proxy))))

	go func() {
		log.Printf("Starting server %s", *addr)
		if err := srv.ListenAndServe(); err != nil {
			log.Fatal(err)
		}
	}()

	c := make(chan os.Signal, 1)
	signal.Notify(c, os.Interrupt)
	<-c
	log.Println("shutting down")
	if err := srv.Shutdown(context.TODO()); err != nil {
		panic(err)
	}

}
