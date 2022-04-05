import {CodeJar} from '/_s/codejar.js';

var SearchBarView = Backbone.View.extend({
    template: _.template($('#search-bar-tmpl').html()),

    events: {
	'click .sync': "sync",
	'keypress .search': "search"
    },

    initialize: function(options) {
	this.db = options.db;
	this.remotedb = options.remotedb;
    },

    search: function(e) {
	if (e.keyCode !== 13) {
	    return;
	}
	let search = e.target.value;
	window.location = "#search/" + search;
    },

    sync: function(){
	this.db.sync(this.remotedb).on('change', function (change) {
	    console.log(change);
	}).on('error', function (err) {
	    console.log(err);
	});
    },

    render: function() {
	this.$el.html(this.template());
	return this;
    }
});

function clone(obj) {
    if (null == obj || "object" != typeof obj) return obj;
    var copy = obj.constructor();
    for (var attr in obj) {
        if (obj.hasOwnProperty(attr)) copy[attr] = obj[attr];
    }
    return copy;
}

var Card = Backbone.Model.extend({
    idAttribute: "_id",
    initialize: function(attributes, options) {
	this.db = options.db;
    },

    rename: function(newid, success) {
	let attrs = clone(this.attributes);
	attrs._id = newid;
	delete(attrs._rev);
	let parent = this;
	this.db.put(attrs).then(function (response) {
	    parent.db.remove(parent.attributes).then((_)=>{
		success(response.id);
	    })
	}).catch(function (err) {
	    console.log(err);
	});

    },

    save: function(arg){
	let callback = console.log;
	let attrs;
	if (typeof arg === "function") {
	    callback = arg;
	} else if (typeof arg === "object") {
	    attrs = arg;
	}
	if (attrs === undefined || attrs === null) {
	    attrs = this.attributes;
	}
	if (attrs._id === undefined){
	    attrs._id = this.attributes._id;
	}
	if (attrs._rev === undefined){
	    attrs._rev = this.attributes._rev;
	}
	let parent = this;
	this.db.put(attrs).then(function (response) {
	    callback(response.id);
	}).catch(function (err) {
	    console.log(err);
	});
    }
})

var CardSummaryView = Backbone.View.extend({
    className: "card-summary",
    template: _.template($('#card-summary-view-tmpl').html()),
    
    initialize: function(model, options) {
	this.model = model;
    },
    
    render: function() {
	this.$el.html(this.template({card: this.model}));
	return this;
    }
});

const highlight = (editor) => {
    let code = editor.innerHTML;
    // code = code.replace(/(\n?)(\s*.*:\n)/g, '$1<span class="header">$2</span>');
    editor.innerHTML = code
};

var CardEditView = Backbone.View.extend({
    className: "card edit",
    template: _.template($('#card-edit-view-tmpl').html()),
    events: {
	"click .cancel": "cancel",
	"click .save": "save",
    },

    initialize: function(model, options) {
	this.model = model;
	this.db = options.db;
    },

    cancel: function() {
	if (this.model.attributes._rev === undefined) {
	    // This is rendering a new document
	    window.history.back();
	} else {
	    window.location = "#view/" + this.model.id;
	}
    },

    save: function() {
	let title = this.$el.find(".title").val();
	if (this.model.id && title !== this.model.id) {
	    // rename file
	    this.model.rename(title, (id) => {window.location = "#view/"+id});
	    return;
	}
	this.model.set('_id', title.trim());
	this.model.save((id) => {window.location = "#view/"+id});
    },

    render: function() {
	this.$el.html(this.template({card: this.model.attributes}));
	this.jar = CodeJar(
	    this.$el.find(".editor")[0],
	    highlight,
	    {
		indentOn: /[({\[\-]$/,
		spellcheck: true
	    }
	);
	let parent = this;
	let cancel;
	this.jar.onUpdate(code => {
	    if (cancel) clearTimeout(cancel);
            cancel = setTimeout(() => {
		parent.model.set('content', code);
            }, 500);
	});
	return this;
    }
});



function convertBracesToLinks(match, p1, p2, offset, string) {
    return '<a href="#view/' + p1 +'">' + p2 + '</a>';
}

function convertBracesToLinksWithoutTitle(match, p1, offset, string) {
    return '<a href="#view/' + p1 +'">' + p1 + '</a>';
}

var CardView = Backbone.View.extend({
    className: "card",
    template: _.template($('#card-view-tmpl').html()),

    initialize: function(options) {
	this.model = options.model;
	this.db = options.db;
	this.index = options.index;
	this.parser = new showdown.Converter({
	    simplifiedAutoLink: true,
	    tables: true,
	    tasklists: true,
	    smartIndentationFix: true,
	    simpleLineBreaks: true,
	    ellipsis: false
	});
    },

    eval: function(content) {
	let tmpl = _.template(content);
	return tmpl({card: this.model, search: _.bind(this.search, this)});
    },

    search: function(query) {
	let ret = [];
	let rows = this.index.search(query);
	for (let i=0; i<rows.length; i++) {
	    ret.push({title: rows[i].ref})
	}
	return ret;
    },

    render: function() {
	let attr = clone(this.model);
	let content = this.eval(attr.content);
	content = content.replaceAll(/\[\[([^\[\]\|]*)\]\]/g , convertBracesToLinksWithoutTitle);
	content = content.replaceAll(/\[\[([^\[\]\|]*)\|([^\[\]\|]*)\]\]/g , convertBracesToLinks);
	content = this.parser.makeHtml(content);
	attr.content = content;
	this.$el.html(this.template({card: attr}));
	return this;
    }
});

var Router = Backbone.Router.extend({
    initialize: function(options) {
    	this.db = db;
    	this.el = options.el;
	this.index = options.index;
    },

    routes: {
	"": "root",
	"edit/:id": "edit",
	"view/:id": "view",
	"new": "newCard",
	"search/:query": "search"
    },

    root: function() {
	let parent = this;
	const settingsID = "#:settings";
	this.db.get(settingsID).then(function (doc) {
	    if (doc.DefaultCard !== undefined) {
		parent.view(doc.DefaultCard);
		return;
	    } else {
		parent.view("Start");
	    }
	}).catch(function (err) {
	    console.log(err);
	    parent.view("Start");
	});
    },

    newCard: function() {
	let model = new Card({}, {db: this.db});
	let v = new CardEditView(model, {db: this.db});
	this.el.html(v.render().$el);
    },
    
    edit: function(id) {
	let parent = this;
	this.db.get(id).then(function (doc) {
	    let model = new Card(doc, {db: parent.db});
	    let v = new CardEditView(model, {db: parent.db});
	    parent.el.html(v.render().$el);
	}).catch(function (err) {
	    if (err.status !== 404) {
		console.log(err);
		return;
	    }
	    let model = new Card({_id: id}, {db: parent.db});
	    let v = new CardEditView(model, {db: parent.db});
	    parent.el.html(v.render().$el);
	});
    },
    
    view: function(id) {
	let parent = this;
	this.db.get(id).then(function (doc) {
	    let v = new CardView({model: doc, db: parent.db, index: parent.index});
	    parent.el.html(v.render().$el);
	}).catch(function (err) {
	    if (err.status !== 404) {
		console.log(err);
		return;
	    }
	    let v = new CardView({model: {_id: id, content: "_Card doesn't exist, edit it to create it._"}, db: parent.db, index: parent.index});
	    parent.el.html(v.render().$el);
	});
    },
    
    search: function(query) {
	let that = this;
	this.el.html('');
	index.search(query).forEach(card => {
	    let v = new CardSummaryView({_id: card.ref});
	    that.el.append(v.render().$el);
	});
    }
});

function loadApp(db, remoteDB, index) {
    window.app = new Router({db: db, el: $("#container"), index: index});
    let search = new SearchBarView({
	db: db,
	remotedb: remoteDB,
	container: $("#container")
    });
    $("#search-bar").html(search.render().el);

    Backbone.history.start();
}

const db = new PouchDB('cards');
window.db = db;
const remoteDB = new PouchDB('http://' + window.location.host + '/db/cards');

db.sync(remoteDB, {
    live: true
}).on('change', function (change) {
    console.log(change);
}).on('error', function (err) {
    console.log(err);
});

db.allDocs({include_docs: true}).then(r => {
    let index = lunr(function() {
	this.ref('title');
	this.field('title');
	this.field('content');
	r.rows.forEach((d) => {
	    let doc = d.doc;
	    doc.title = doc._id; // just to make the search easier
	    delete doc._id;
	    this.add(doc);
	}, this);
    });
    window.index = index;
    loadApp(db, remoteDB, index);
});

