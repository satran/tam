package main

import (
	"embed"
	"html/template"
	"net/http"
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
	http.HandleFunc("/app/", func(w http.ResponseWriter, r *http.Request) {
		http.ServeFile(w, r, "templates/app.html")
	})
	return srv, nil
}
