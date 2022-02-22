var d = {};

(function () {
    function initDB(path) {
	var db = {};
	db.items = new PouchDB(path+'-items');
	db.meta = new PouchDB(path+'-meta');
	return db
    }
    

    console.log("hello world");
    let path = "satran";
    d = initDB(path);


    let Item = Backbone.Model.extend({});

    let ItemList = Backbone.Collection.extend({
	model: Item,
    });

    var ItemView = Backbone.View.extend({
	tagName:  "div",
	template: _.template($('#item-view-template').html()),
	events: {
	},
	initialize: function() {
	},

	render: function() {
	},

    });

    var AppView = Backbone.View.extend({
	el: $("#app"),
	events: {},

	initialize: function() {
	},

	render: function() {
	},

    });

    var App = new AppView;

})();

