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
	"time"
)

func main() {
	addr := flag.String("addr", "127.0.0.1:8080", "addr and port to serve from")
	useTLS := flag.Bool("tls", false, "use TLS")
	cert := flag.String("cert", "", "part to the cert")
	key := flag.String("key", "", "path for the cert key")
	dir := flag.String("dir", ".", "path to serve static content")
	flag.Parse()

	remote, err := url.Parse("http://localhost:5984")
	if err != nil {
		panic(err)
	}
	proxyH := func(p *httputil.ReverseProxy) func(http.ResponseWriter, *http.Request) {
		return func(w http.ResponseWriter, r *http.Request) {
			log.Println(r.URL)
			r.Host = remote.Host
			p.ServeHTTP(w, r)
		}
	}

	proxy := httputil.NewSingleHostReverseProxy(remote)
	http.Handle("/db/", http.StripPrefix("/db/", http.HandlerFunc(proxyH(proxy))))

	srv := &http.Server{
		Addr:         *addr,
		ReadTimeout:  time.Second,
		WriteTimeout: 2 * time.Second,
	}
	http.Handle("/", http.FileServer(http.Dir(*dir)))

	go func() {
		log.Printf("Starting server %s", *addr)
		if *useTLS {
			srv.Addr = ":443"
			err = srv.ListenAndServeTLS(*cert, *key)
			if err != nil {
				log.Fatal(err)
			}
		} else {
			srv.Addr = ":8080"
			err = srv.ListenAndServe()
			if err != nil {
				log.Fatal(err)
			}
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
