var a;
(function() {

    var CardDetailView = Backbone.View.extend({
        template: _.template($("#card-view-template").html()),

        initialize: function(options) {
            this.el = options.el;
        },

        render: function() {
            this.el.html(this.template());
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

        initialize: function(options) {
            this.cards = [
                { title: "hello world" },
                { title: "Another card" },
                { title: "Yet Another card" }
            ];
        },

        render: function() {
            this.$el.html(this.template());
            let parent = this;
            _.each(this.cards, function(card) {
                var v = new CardSummaryView({ model: card });
                parent.$el.find('.items').append(v.render().$el);
            });
        }
    });

    var FavouriteView = Backbone.View.extend({
        tagName: "span",

        template: _.template($("#favourite-view-template").html()),

        render: function() {
            this.$el.html(this.template(this.model));
            return this;
        }
    });

    var FavouriteListView = Backbone.View.extend({
        className: "favs-list",
        initialize: function() {
            this.items = [
                { url: "s/tags:next", title: "Next" },
                { url: "s/tags:follow-up", title: "Follow Up" }
            ];
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

        routes: {
            "fav": "favourites",
            "s/:query": "search",
            "c/:id": "card",
        },

        favourites: function() {
            let view = new FavouriteListView();
            this.el.html(view.render().el);
        },

        search: function(query) {
            let view = new SearchView({ el: this.el });
            view.render();
        },

        card: function(id) {
            let view = new CardDetailView({ el: this.el });
            view.render();
        }
    });

    a = new App();
    Backbone.history.start();
})();
