var a;
(function() {

    var CardDetailView = Backbone.View.extend({
        template: _.template($("#card-detail-view-template").html()),
        className: "card-detail-col",

        events : {
            "click .back-btn": "back" 
        },

        back: function() {
            window.history.back();
        },

        initialize: function(options) {
            this.model = {
                id: 1,
                title: "Hello world",
                description: "Web applications often provide linkable, bookmarkable, shareable URLs for important locations in the app. Until recently, hash fragments (#page) were used to provide these permalinks, but with the arrival of the History API, it's now possible to use standard URLs (/page). Backbone.Router provides methods for routing client-side pages, and connecting them to actions and events. For browsers which don't yet support the History API, the Router handles graceful fallback and transparent translation to the fragment version of the URL. Getting Started When working on a web application that involves a lot of JavaScript, one of the first things you learn is to stop tying your data to the DOM. It's all too easy to create JavaScript applications that end up as tangled piles of jQuery selectors and callbacks, all trying frantically to keep data in sync between the HTML UI, your JavaScript logic, and the database on your server. For rich client-side applications, a more structured approach is often helpful. With Backbone, you represent your data as Models, which can be created, validated, destroyed, and saved to the server. Whenever a UI action causes an attribute of a model to change, the model triggers a change event; all the Views that display the model's state can be notified of the change, so that they are able to respond accordingly, re-rendering themselves with the new information. In a finished Backbone app, you don't have to write the glue code that looks into the DOM to find an element with a specific id, and update the HTML manually — when the model changes, the views simply update themselves. Philosophically, Backbone is an attempt to discover the minimal set of data-structuring (models and collections) and user interface (views and URLs) primitives that are generally useful when building web applications with JavaScript. In an ecosystem where overarching, decides-everything-for-you frameworks are commonplace, and many libraries require your site to be reorganized to suit their look, feel, and default behavior — Backbone should continue to be a tool that gives you the freedom to design the full experience of your web application. ",
            };
        },

        render: function() {
            this.$el.html(this.template(this.model));
            return this;
        }
    });

    var CardSummaryView = Backbone.View.extend({
        className: "card-summary",

        template: _.template($("#card-summary-view-template").html()),

        render: function() {
            this.$el.html(this.template(this.model));
            return this;
        }
    });

    var SearchView = Backbone.View.extend({
        template: _.template($("#search-view-template").html()),
        className: "search-col",
        tagName: "div",

        initialize: function(options) {
            this.cards = [
                { id: 1, title: "hello world" },
                { id: 1, title: "Another card" },
                { id: 1, title: "Yet Another card" }
            ];
        },

        render: function() {
            this.$el.html(this.template());
            let parent = this;
            _.each(this.cards, function(card) {
                var v = new CardSummaryView({ model: card });
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
            console.log(url, title);
            this.$el.find(".edit").hide();
            this.$el.find(".fav").show();
        },

        render: function() {
            this.$el.html(this.template(this.model));
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
            "s/:query": "search",
            "c/:id": "card",
        },

        favourites: function() {
            var root = this;
            this.db.favs.allDocs({include_docs: true}).then(function(response){
                console.log(response);
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
            let view = new SearchView();
            this.el.html(view.render().el);
        },

        card: function(id) {
            let view = new CardDetailView();
            this.el.html(view.render().el);
        }
    });

    a = new App({name: "tam-default"});
    Backbone.history.start();
})();
