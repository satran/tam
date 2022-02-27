var a;
(function() {

    var CardDetailView = Backbone.View.extend({
        initialize: function(options) {
            this.model = options.model;
            if (this.model.tags === undefined) {
                this.model.tags = [];
            }
            this.db = options.db;
        },

        template: _.template($("#card-detail-view-template").html()),
        className: "card-detail-col",

        events : {
            "click .back-btn": "back",
            "click .view": "edit",
            "click .edit .cancel-btn": "view",
            "click .edit .save-btn": "save",
            "input .edit .description": "resize"
        },

        back: function() {
            window.history.back();
        },

        edit: function(){
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
            let title= this.$el.find(".edit .title").val();
            let desc = this.$el.find(".edit .description").val();
            let rawtags = this.$el.find(".edit .tags").val();
            let data = {
                _id: this.model._id,
                _rev: this.model._rev,
                title: title,
                description: desc,
                tags: rawtags.split(" ")
            };
            let parent = this;
            this.db.put(data).then(function(resp){
                data._rev = resp.rev;
                parent.model = data;
                parent.render();
            }).catch(function(err){
                console.log(err);
            });
        },

        resize: function(e) {
            let ta = this.$el.find(".edit .description").get(0);
            ta.style.height = "auto";
            ta.style.height = (ta.scrollHeight) + 'px';
        },

        render: function() {
            this.$el.html(this.template({model: this.model}));
            return this;
        }
    });

    var CardSummaryView = Backbone.View.extend({
        className: "card-summary",

        template: _.template($("#card-summary-view-template").html()),

        render: function() {
            this.$el.html(this.template({model: this.model}));
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

        search: function(e){
            if(e.keyCode !== 13) return;
            let query = this.$el.find(".search").val();
            document.location = "#s/" + query;
        },

        newCard: function(e) {
            if (e.keyCode !== 13) return;
            let title = this.$el.find(".new-card").val();
            var parent = this;
            this.db.post({
                title: title
            }).then(function(resp){
                if (!resp.ok) {
                    console.log("couldn't save");
                }
                parent.cards.push({
                    _id: resp.id,
                    title: title
                });
                parent.$el.find(".new-card").val("");
                parent.render();
                parent.$el.find(".new-card").focus();
            }).catch(function(error){
                console.log(error);
            });
        },

        initialize: function(options) {
            this.cards = options.cards;
            this.db = options.db;
            this.query = options.query;
        },

        render: function() {
            this.$el.html(this.template({query: this.query}));
            let parent = this;
            _.each(this.cards, function(card) {
                var v = new CardSummaryView({ model: card});
                parent.$el.find('.items').append(v.render().$el);
            });
            return this;
        }
    });

    var FavouriteView = Backbone.View.extend({
        tagName: "span",

        template: _.template($("#favourite-view-template").html()),

        events: {
            "click .edit-btn": "toggleEdit",
            "keydown .edit input": "save"
        },

        toggleEdit: function() {
            this.$el.find(".fav").hide();
            this.$el.find(".edit").show();
            this.$el.find(".edit").find("input[name=title]").focus();
        },

        save: function(e){
            if (e.keyCode !== 13) return;
            let url = this.$el.find("input[name=url]").val();
            let title = this.$el.find("input[name=title]").val();
            //TODO: implement save changes to db
            console.log(url, title);
            this.$el.find(".edit").hide();
            this.$el.find(".fav").show();
        },

        render: function() {
            this.$el.html(this.template({model: this.model}));
            return this;
        }
    });

    var FavouriteListView = Backbone.View.extend({
        className: "favs-list",
        initialize: function(options) {
            this.items = options.items;
        },

        template: _.template($("#favourite-list-view-template").html()),

        render: function() {
            this.$el.html(this.template());
            let parent = this;
            _.each(this.items, function(item) {
                var itemView = new FavouriteView({ model: item });
                parent.$el.find('.custom').append(itemView.render().$el);
            });
            return this;
        }
    });

    var App = Backbone.Router.extend({
        el: $("#app"),

        initialize: function(options){
            if(options.name === undefined || options.name === ""){
                options.name = "tam";
            }
            this.db = {
                favs: new PouchDB(options.name + "-favs"),
                cards: new PouchDB(options.name + "-cards")
            };
        },

        routes: {
            "": "favourites",
            "fav": "favourites",
            "s": "search",
            "s/:query": "search",
            "c/:id": "card",
        },

        favourites: function() {
            var root = this;
            this.db.favs.allDocs({include_docs: true}).then(function(response){
                let favs = [];
                response.rows.forEach(function(row){
                    favs.push(row.doc);
                });
                let view = new FavouriteListView({items: favs});
                root.el.html(view.render().el);
            }).catch(function(error){
                console.log(error);
            });
        },

        search: function(query) {
            let root = this;
            if (query !== undefined && query !== "") {
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
                    let view = new SearchView({ cards: resp.docs, db: root.db.cards, query: query});
                    root.el.html(view.render().el);
                }).catch((err) => console.log(err));
            } else {
                this.db.cards.allDocs({ include_docs: true }).then(function(response) {
                    let cards = [];
                    response.rows.forEach(function(row) {
                        cards.push(row.doc);
                    });
                    let view = new SearchView({ cards: cards, db: root.db.cards });
                    root.el.html(view.render().el);
                }).catch((err) => console.log(err));
            }
        },

        card: function(id) {
            var root = this;
            this.db.cards.get(id).then(function(card) {
                let view = new CardDetailView({model: card, db: root.db.cards});
                root.el.html(view.render().el);
            }).catch(function(error) {
                console.log(error);
            });
        }
    });

    a = new App({name: "tam-default"});
    Backbone.history.start();
})();
