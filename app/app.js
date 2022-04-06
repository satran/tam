import {CodeJar} from './codejar.js';
import Fuse from './fuse.js';

const keys = {
    settings: "@:/settings"
}
const defaultConfig = {
    "settings": {
	"_id": keys.settings,
	"fields": {
	    "remote-database": {
		"key": "Remote Database",
		"value": ""
	    },
	    "start-card": {
		"key": "Start Card",
		"value": "Start"
	    }
	}
    }
}
function getDefaultConfig(id) {
    if (!defaultConfig.hasOwnProperty(id)) return {};
    return defaultConfig[id];
}

const queryOptions = {keywords: ['title', 'tags', 'content']}
function parseQuery(query) {
    let parsed = parse(query, queryOptions);
    delete(parsed.exclude);
    delete(parsed.offsets);
    return parsed;
}

var ConfigCardView = Backbone.View.extend({
    className: "card config",
    template: _.template($('#config-card-view-tmpl').html()),
    events: {
	"click .save": "save"
    },
    
    initialize: function(options) {
	this.model = options.model;
	this.db = options.db;
    },

    save: function() {
	let fields = this.$el.find("input.field-value");
	for (let i=0; i<fields.length; i++) {
	    let value = fields[i].value;
	    let key = fields[i].dataset["key"];
	    this.model.fields[key].value = value;
	}
	this.db.put(this.model).then(r => console.log(r));
    },
    
    render: function() {
	this.$el.html(this.template({model: this.model}));
	return this;
    }
});


var SearchBarView = Backbone.View.extend({
    template: _.template($('#search-bar-tmpl').html()),

    events: {
	'click .sync': "sync",
	'click .back': "back",
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

    back: function() {
	window.history.back();
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
	let that = this;
	this.db.put(attrs).then(function (response) {
	    that.db.remove(that.attributes).then((_)=>{
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
	let that = this;
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
	let tags = this.$el.find(".tags").val().trim();
	if (tags.length>0){
	    this.model.set("tags", tags.split(" "));
	} else {
	    this.model.set("tags", undefined);
	}
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
	let that = this;
	let cancel;
	this.jar.onUpdate(code => {
	    if (cancel) clearTimeout(cancel);
            cancel = setTimeout(() => {
		that.model.set('content', code);
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
	let rows = this.index.search(parseQuery(query));
	for (let i=0; i<rows.length; i++) {
	    ret.push({title: rows[i].item.title})
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
	"@:/:id": "config",
	"edit/:id": "edit",
	"view/:id": "view",
	"new": "newCard",
	"search/:query": "search"
    },

    config: function(id) {
	let that = this;
	this.db.get("@:/"+id).then(function (doc) {
	    let v = new ConfigCardView({model: doc, db: that.db});
	    that.el.html(v.render().$el);
	}).catch(function (err) {
	    if (err.status !== 404) {
		console.log(err);
		return;
	    }
	    let v = new ConfigCardView({model: defaultConfig[id], db: that.db});
	    that.el.html(v.render().$el);
	});
    },

    root: function() {
	let that = this;
	this.db.get(keys.settings).then(function (doc) {
	    if (doc.fields["start-card"].value) {
		that.view(doc.fields["start-card"].value);
		return;
	    } else {
		that.view("Start");
	    }
	}).catch(function (err) {
	    console.log(err);
	    that.view("Start");
	});
    },

    newCard: function() {
	let model = new Card({}, {db: this.db});
	let v = new CardEditView(model, {db: this.db});
	this.el.html(v.render().$el);
    },
    
    edit: function(id) {
	let that = this;
	this.db.get(id).then(function (doc) {
	    let model = new Card(doc, {db: that.db});
	    let v = new CardEditView(model, {db: that.db});
	    that.el.html(v.render().$el);
	}).catch(function (err) {
	    if (err.status !== 404) {
		console.log(err);
		return;
	    }
	    let model = new Card({_id: id}, {db: that.db});
	    let v = new CardEditView(model, {db: that.db});
	    that.el.html(v.render().$el);
	});
    },
    
    view: function(id) {
	let that = this;
	this.db.get(id).then(function (doc) {
	    let v = new CardView({model: doc, db: that.db, index: that.index});
	    that.el.html(v.render().$el);
	}).catch(function (err) {
	    if (err.status !== 404) {
		console.log(err);
		return;
	    }
	    let v = new CardView({model: {_id: id, content: "_Card doesn't exist, edit it to create it._"}, db: that.db, index: that.index});
	    that.el.html(v.render().$el);
	});
    },
    
    search: function(query) {
	let that = this;
	this.el.html('');
	index.search(parseQuery(query)).forEach(card => {
	    let v = new CardSummaryView({_id: card.item.title});
	    that.el.append(v.render().$el);
	});
    }
});

function loadApp(db, index) {
    window.app = new Router({db: db, el: $("#container"), index: index});
    let search = new SearchBarView({db: db, container: $("#container")});
    $("#search-bar").html(search.render().el);

    Backbone.history.start();
}

const db = new PouchDB('cards');
window.db = db;
db.get(keys.settings).then(function (doc) {
    let remoteHost = doc.fields["remote-database"].value;
    const remoteDB = new PouchDB(remoteHost);
    db.sync(remoteDB, {
	live: true
    }).on('change', function (change) {
	console.log(change);
    }).on('error', function (err) {
	console.log(err);
    });
});

db.allDocs({include_docs: true}).then(r => {
    let index = new Fuse([], {
	keys: ['title', 'content', 'tags'],
	threshold: 0
    });
    db.allDocs({include_docs: true}).then(r => {
	r.rows.forEach(d => {
	    let doc = d.doc;
	    doc.title = doc._id; // just to make the search easier
	    delete doc._id;
	    index.add(doc);
	})
    })
    window.index = index;
    loadApp(db, index);
});

