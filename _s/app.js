var a;
(function() {

    var Card = Backbone.Model.extend({
        idAttribute: "_id",

        save: function(_, options) {
            var that = this;
            let saveFn = options.db.put;
            if (this.isNew()) {
                saveFn = options.db.post; 
            }
            saveFn(this.attributes).then(function(resp) {
                if (that.isNew()) {
                    that.set("_id", resp.id);
                }
                that.set("_rev", resp.rev);
                options.success(that);
            }).catch(function(err) {
                console.log(err);
            });
        }
    });

    var CardDetailView = Backbone.View.extend({
        initialize: function(options) {
            this.model = options.model;
            if (this.model.get('tags') === undefined) {
                this.model.set("tags", []);
            }
            this.db = options.db;
        },

        template: _.template($("#card-detail-view-template").html()),
        className: "card-detail-col",

        events: {
            "click .back-btn": "back",
            "click .view": "edit",
            "click .cancel-btn": "view",
            "click .save-btn": "save",
            "input .edit .description": "resize"
        },

        back: function() {
            window.history.back();
        },

        edit: function() {
            this.$el.find(".view").hide();
            let editEl = this.$el.find(".edit");
            editEl.show();
            this.resize(editEl.get(0));
        },

        view: function() {
            this.$el.find(".view").show();
            this.$el.find(".edit").hide();
        },

        save: function() {
            this.model.set("title", this.$el.find(".edit .title").val());
            this.model.set("description", this.$el.find(".edit .description").val());
            this.model.set("tags", this.$el.find(".edit .tags").val().split(" "));
            this.model.save(this.model.attributes, {db: this.db, success: (model) => {this.render()}});
        },

        resize: function(e) {
            let ta = this.$el.find(".edit .description").get(0);
            ta.style.height = "auto";
            ta.style.height = (ta.scrollHeight) + 'px';
        },

        render: function() {
            this.$el.html(this.template({ model: this.model.attributes }));
            return this;
        }
    });

    var CardSummaryView = Backbone.View.extend({
        className: "card-summary",

        template: _.template($("#card-summary-view-template").html()),

        render: function() {
            this.$el.html(this.template({ model: this.model }));
            return this;
        }
    });

    var SearchView = Backbone.View.extend({
        template: _.template($("#search-view-template").html()),
        className: "search-col",
        tagName: "div",

        events: {
            "keydown .search": "search",
            "keydown .new-card": "newCard"
        },

        search: function(e) {
            if (e.keyCode !== 13) return;
            let query = this.$el.find(".search").val();
            document.location = "#s/" + query;
        },

        newCard: function(e) {
            if (e.keyCode !== 13) return;
            let title = this.$el.find(".new-card").val();
            var parent = this;
            let card = new Card({ title: title });
            card.save(card.attributes, {db: parent.db, success: (model) => {
                parent.cards.push({
                    _id: model.id,
                    title: model.get("title")
                });
                parent.$el.find(".new-card").val("");
                parent.render();
                parent.$el.find(".new-card").focus();
            }});
        },

        initialize: function(options) {
            this.cards = options.cards;
            this.db = options.db;
            this.query = options.query;
        },

        render: function() {
            this.$el.html(this.template({ query: this.query }));
            let parent = this;
            _.each(this.cards, function(card) {
                var v = new CardSummaryView({ model: card });
                parent.$el.find('.items').append(v.render().$el);
            });
            return this;
        }
    });

    var FavouriteListView = Backbone.View.extend({
        className: "favs-list",
        initialize: function(options) {
            this.favs = options.favs;
            this.tags = options.tags;
        },

        template: _.template($("#favourite-list-view-template").html()),

        render: function() {
            this.$el.html(this.template({ tags: this.tags, saved: this.favs }));
            return this;
        }
    });

    var App = Backbone.Router.extend({
        app: $("#app"),

        initialize: function(options) {
            if (options.name === undefined || options.name === "") {
                options.name = "tam";
            }
            this.db = {
                favs: new PouchDB(options.name + "-favs"),
                cards: new PouchDB(options.name + "-cards")
            };
        },

        routes: {
            "": "favourites",
            "s": "search",
            "s/": "search",
            "s/:query": "search",
            "c/:id": "card",
        },

        favourites: function() {
            var root = this;

            this.db.favs.allDocs({ include_docs: true }).then(function(response) {
                let favs = [];
                response.rows.forEach(function(row) {
                    favs.push(row.doc);
                });
                function map(card) {
                    if (card.title && card.tags) {
                        card.tags.forEach((tag) => emit(tag, 1));
                    }
                }
                root.db.cards.query(map).then((r) => {
                    let tags = new Set();
                    r.rows.forEach((row) => {
                        tags.add(row.key);
                    });
                    let view = new FavouriteListView({ favs: favs, tags: tags });
                    root.app.html(view.render().el);
                });
            }).catch(function(error) {
                console.log(error);
            });
        },

        search: function(query) {
            let root = this;
            if (query === undefined || query === null || query === "") {
                this.db.cards.allDocs({ include_docs: true }).then((response) => {
                    let cards = [];
                    response.rows.forEach(function(row) {
                        cards.push(row.doc);
                    });
                    let view = new SearchView({ cards: cards, db: root.db.cards, query: { url: "", title: "" } });
                    root.app.html(view.render().el);
                }).catch((err) => console.log(err));
            } else {
                /*
                 The query is formed out of keywords separated by spaces.
                 The parameter is separated by colons.
                 */
                let qitems = query.split(" ");
                let selector = {};
                qitems.forEach(function(q) {
                    let chunks = q.split(":");
                    if (chunks.length === 1) {
                        selector["title"] = { title: { "$regex": chunks[0] } };
                    } else if (chunks.length === 2 && chunks[0] == "tags") {
                        selector["tags"] = { "$elemMatch": chunks[1] };
                    } else {
                        console.log("unsupported query");
                    }
                });
                this.db.cards.find({
                    selector: selector
                }).then(function(resp) {
                    let queryModel = {};
                    root.db.favs.find({ selector: { url: query } }).then(
                        (r) => {
                            if (r.docs.length > 0) {
                                queryModel = r.docs[0];
                            } else {
                                queryModel = { url: query };
                            }
                            let view = new SearchView({
                                cards: resp.docs,
                                db: root.db.cards,
                                query: queryModel
                            });
                            root.app.html(view.render().el);
                        }
                    );
                }).catch((err) => console.log(err));
            }
        },

        card: function(id) {
            var root = this;
            this.db.cards.get(id).then(function(card) {
                let model = new Card(card);
                let view = new CardDetailView({ model: model, db: root.db.cards });
                root.app.html(view.render().el);
            }).catch(function(error) {
                console.log(error);
            });
        }
    });

    a = new App({ name: "tam-default" });
    Backbone.history.start();
})();
