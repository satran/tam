// An example Backbone application contributed by
// [Jérôme Gravel-Niquet](http://jgn.me/). This demo uses a simple
// [LocalStorage adapter](backbone.localStorage.html)
// to persist Backbone models within your browser.

// Load the application once the DOM is ready, using `jQuery.ready`:
$(function(){

    // Card Model
    // ----------

    // Our basic **Card** model has `title`, `order`, and `done` attributes.
    var Card = Backbone.Model.extend({

        // Default attributes for the card item.
        defaults: function() {
            return {
                title: "empty card...",
                order: Cards.nextOrder(),
                done: false
            };
        },

        // Toggle the `done` state of this card item.
        toggle: function() {
            this.save({done: !this.get("done")});
        }

    });

    // Card Collection
    // ---------------

    // The collection of cards is backed by *localStorage* instead of a remote
    // server.
    var CardList = Backbone.Collection.extend({

        // Reference to this collection's model.
        model: Card,

        // Save all of the card items under the `"cards-backbone"` namespace.
        localStorage: new Backbone.LocalStorage("cards-backbone"),

        // Filter down the list of all card items that are finished.
        done: function() {
            return this.where({done: true});
        },

        // Filter down the list to only card items that are still not finished.
        remaining: function() {
            return this.where({done: false});
        },

        // We keep the Cards in sequential order, despite being saved by unordered
        // GUID in the database. This generates the next order number for new items.
        nextOrder: function() {
            if (!this.length) return 1;
            return this.last().get('order') + 1;
        },

        // Cards are sorted by their original insertion order.
        comparator: 'order'

    });

    // Create our global collection of **Cards**.
    var Cards = new CardList;

    // Card Item View
    // --------------

    // The DOM element for a card item...
    var CardView = Backbone.View.extend({

        //... is a list tag.
        tagName:  "div",
        className: "card",

        // Cache the template function for a single item.
        template: _.template($('#item-template').html()),

        // The DOM events specific to an item.
        events: {
            "click .toggle"   : "toggleDone",
            "dblclick .view"  : "edit",
            "click a.destroy" : "clear",
            "keypress .edit"  : "updateOnEnter",
            "blur .edit"      : "close"
        },

        // The CardView listens for changes to its model, re-rendering. Since there's
        // a one-to-one correspondence between a **Card** and a **CardView** in this
        // app, we set a direct reference on the model for convenience.
        initialize: function() {
            this.listenTo(this.model, 'change', this.render);
            this.listenTo(this.model, 'destroy', this.remove);
        },

        // Re-render the titles of the card item.
        render: function() {
            this.$el.html(this.template(this.model.toJSON()));
            this.$el.toggleClass('done', this.model.get('done'));
            this.input = this.$('.edit');
            return this;
        },

        // Toggle the `"done"` state of the model.
        toggleDone: function() {
            this.model.toggle();
        },

        // Switch this view into `"editing"` mode, displaying the input field.
        edit: function() {
            this.$el.addClass("editing");
            this.input.focus();
        },

        // Close the `"editing"` mode, saving changes to the card.
        close: function() {
            var value = this.input.val();
            if (!value) {
                this.clear();
            } else {
                this.model.save({title: value});
                this.$el.removeClass("editing");
            }
        },

        // If you hit `enter`, we're through editing the item.
        updateOnEnter: function(e) {
            if (e.keyCode == 13) this.close();
        },

        // Remove the item, destroy the model.
        clear: function() {
            this.model.destroy();
        }

    });

    // The Application
    // ---------------

    // Our overall **AppView** is the top-level piece of UI.
    var AppView = Backbone.View.extend({

        // Instead of generating a new element, bind to the existing skeleton of
        // the App already present in the HTML.
        el: $("#cardapp"),

        // Our template for the line of statistics at the bottom of the app.
        statsTemplate: _.template($('#stats-template').html()),

        // Delegated events for creating new items, and clearing completed ones.
        events: {
            "keypress #new-card":  "createOnEnter",
            "click #clear-completed": "clearCompleted",
            "click #toggle-all": "toggleAllComplete"
        },

        // At initialization we bind to the relevant events on the `Cards`
        // collection, when items are added or changed. Kick things off by
        // loading any preexisting cards that might be saved in *localStorage*.
        initialize: function() {

            this.input = this.$("#new-card");
            this.allCheckbox = this.$("#toggle-all")[0];

            this.listenTo(Cards, 'add', this.addOne);
            this.listenTo(Cards, 'reset', this.addAll);
            this.listenTo(Cards, 'all', this.render);

            this.footer = this.$('footer');
            this.main = $('#main');

            Cards.fetch();
        },

        // Re-rendering the App just means refreshing the statistics -- the rest
        // of the app doesn't change.
        render: function() {
            var done = Cards.done().length;
            var remaining = Cards.remaining().length;

            if (Cards.length) {
                this.main.show();
                this.footer.show();
                this.footer.html(this.statsTemplate({done: done, remaining: remaining}));
            } else {
                this.main.hide();
                this.footer.hide();
            }

            this.allCheckbox.checked = !remaining;
        },

        // Add a single card item to the list by creating a view for it, and
        // appending its element to the `<ul>`.
        addOne: function(card) {
            var view = new CardView({model: card});
            this.$("#card-list").append(view.render().el);
        },

        // Add all items in the **Cards** collection at once.
        addAll: function() {
            Cards.each(this.addOne, this);
        },

        // If you hit return in the main input field, create new **Card** model,
        // persisting it to *localStorage*.
        createOnEnter: function(e) {
            if (e.keyCode != 13) return;
            if (!this.input.val()) return;

            Cards.create({title: this.input.val()});
            this.input.val('');
        },

        // Clear all done card items, destroying their models.
        clearCompleted: function() {
            _.invoke(Cards.done(), 'destroy');
            return false;
        },

        toggleAllComplete: function () {
            var done = this.allCheckbox.checked;
            Cards.each(function (card) { card.save({'done': done}); });
        }

    });

    // Finally, we kick things off by creating the **App**.
    var App = new AppView;

});
