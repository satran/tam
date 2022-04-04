package main

import (
	"embed"
	"html/template"
	"io"
	"log"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
)

type options struct {
	addr string
	dev  bool
}

type Opts func(o *options) *options

func WithDevServer(enable bool) Opts {
	return func(o *options) *options {
		o.dev = enable
		return o
	}
}

func WithServerAddr(addr string) Opts {
	return func(o *options) *options {
		if addr != "" {
			o.addr = addr
		}
		return o
	}
}

//go:embed _s templates
var contents embed.FS

// Server returns a http.Server configured to run a webserver
func Server(opts ...Opts) (*http.Server, error) {
	o := &options{
		addr: "localhost:8080",
	}
	for _, fn := range opts {
		o = fn(o)
	}
	_ = template.Must(template.ParseFS(contents, "templates/*"))
	srv := &http.Server{Addr: o.addr}

	if o.dev {
		http.Handle("/_s/", http.StripPrefix("/_s/", http.FileServer(http.Dir("_s"))))
	} else {
		http.Handle("/_s/", http.FileServer(http.FS(contents)))
	}
	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		http.ServeFile(w, r, "templates/index.html")
	})
	http.HandleFunc("/codejar/", func(w http.ResponseWriter, r *http.Request) {
		http.ServeFile(w, r, "templates/codejar.html")
	})
	http.HandleFunc("/cards/", func(w http.ResponseWriter, r *http.Request) {
		http.ServeFile(w, r, "templates/cards.html")
	})
	http.HandleFunc("/doc/", func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodGet {
			http.ServeFile(w, r, "data.txt")
		} else if r.Method == http.MethodPut {
			f, err := os.OpenFile("data.txt", os.O_WRONLY|os.O_TRUNC, os.ModePerm)
			if err != nil {
				log.Println(err)
				http.Error(w, err.Error(), http.StatusConflict)
				return
			}
			io.Copy(f, r.Body)
		}
	})

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

	http.HandleFunc("/ws", serveWS())
	return srv, nil
}
