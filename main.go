package main

import (
	"context"
	"flag"
	"log"
	"os"
	"os/signal"
)

func main() {
	addr := flag.String("addr", "127.0.0.1:8080", "addr and port to serve from")
	dev := flag.Bool("dev", false, "enable development mode")
	flag.Parse()
	srv, err := Server(WithServerAddr(*addr), WithDevServer(*dev))
	if err != nil {
		log.Fatal(err)
	}
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
