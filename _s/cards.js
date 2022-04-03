import {CodeJar} from 'https://medv.io/codejar/codejar.js';

const highlight = (editor) => {
    let code = editor.innerHTML;
    // code = code.replace(/(\n?)(\s*.*:\n)/g, '$1<span class="header">$2</span>');
    editor.innerHTML = code
};

const db = new PouchDB('cards');

var SearchBarView = Backbone.View.extend({
    template: _.template($('#search-bar-tmpl').html()),

    initialize: function(options) {
	this.db = options.db;
    },

    render: function() {
	this.$el.html(this.template());
	return this;
    }
});

var CardNewView = Backbone.View.extend({
    className: "card new",
    template: _.template($('#card-new-view-tmpl').html()),
    events: {
	"click .save": "save",
	"click .cancel": "back"
    },

    initialize: function(options) {
	this.model = options.model;
	this.db = options.db;
    },

    save: function(){
	let parent = this;
	this.db.post({
	    content: this.jar.toString()
	}).then(function (response) {
	    window.location = '#view/'+response.id;
	}).catch(function (err) {
	    console.log(err);
	});
    },

    render: function() {
	this.$el.html(this.template({card: this.model}));
	this.jar = CodeJar(this.$el.find(".editor")[0], highlight);
	return this;
    }
});

var CardEditView = Backbone.View.extend({
    className: "card edit",
    template: _.template($('#card-edit-view-tmpl').html()),
    events: {
	"click .save": "save"
    },

    initialize: function(options) {
	this.model = options.model;
	this.db = options.db;
    },

    save: function(){
	let parent = this;
	this.db.put({
	    _id: parent.model._id,
	    _rev: parent.model._rev,
	    content: this.jar.toString()
	}).then(function (response) {
	    window.location = '#view/'+parent.model._id;
	}).catch(function (err) {
	    console.log(err);
	});
    },

    render: function() {
	this.$el.html(this.template({card: this.model}));
	this.jar = CodeJar(this.$el.find(".editor")[0], highlight);
	return this;
    }
});

var CardView = Backbone.View.extend({
    className: "card",
    template: _.template($('#card-view-tmpl').html()),

    initialize: function(options) {
	this.model = options.model;
	this.db = options.db;
    },

    render: function() {
	let attr = this.model;
	attr.content = marked.parse(attr.content);
	this.$el.html(this.template({card: attr}));
	return this;
    }
});

var Router = Backbone.Router.extend({
    initialize: function(options) {
    	this.db = db;
    	this.el = options.el;
    },

    routes: {
	"": "index",
	"edit/:id": "edit",
	"view/:id": "view",
	"new": "newCard",
	"search/:query": "search"
    },

    index: function() {
	console.log("index, not implemented");
    },

    newCard: function() {
	let v = new CardNewView({db: parent.db});
	this.el.html(v.render().$el);
    },
    
    edit: function(id) {
	let parent = this;
	this.db.get(id).then(function (doc) {
	    let v = new CardEditView({model: doc, db: parent.db});
	    parent.el.html(v.render().$el);
	}).catch(function (err) {
	    console.log(err);
	});
    },
        
    view: function(id) {
	let parent = this;
	this.db.get(id).then(function (doc) {
	    let v = new CardView({model: doc, db: parent.db});
	    parent.el.html(v.render().$el);
	}).catch(function (err) {
	    console.log(err);
	});
    },
    
    search: function(query) {
	console.log("search, not implemented");
    }
});

window.app = new Router({db: db, el: $("#container")});
let search = new SearchBarView({db: db, container: $("#container")});
$("#search-bar").html(search.render().el);

Backbone.history.start();
