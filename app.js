import { CodeJar } from './codejar.js';
import { Store, Parser, defaults } from './store.js';
import Fuse from './fuse.js';
import parse from './search-query-parser.js';

// Register worker to enable offline capabilities
const registerServiceWorker = async () => {
    if ('serviceWorker' in navigator) {
        try {
            const registration = await navigator.serviceWorker.register(
                '/worker.js'
            );
            if (registration.installing) {
                console.log('Service worker installing');
            } else if (registration.waiting) {
                console.log('Service worker installed');
            } else if (registration.active) {
                console.log('Service worker active');
            }
        } catch (error) {
            console.error(`Registration failed with ${error}`);
        }
    }
};

registerServiceWorker();
// End of worker registration

const queryOptions = { keywords: ['title', 'tags', 'content'] };
function parseQuery(query) {
    let parsed = parse(query, queryOptions);
    delete (parsed.exclude);
    delete (parsed.offsets);
    return parsed;
}

var ConfigCardView = Backbone.View.extend({
    className: "card config",
    template: _.template($('#config-card-view-tmpl').html()),
    events: {
        "click .save": "save"
    },

    initialize: function (options) {
        this.model = options.model;
        this.store = options.store;
    },

    save: function () {
        let fields = this.$el.find("input.field-value");
        for (let i = 0; i < fields.length; i++) {
            let value = fields[i].value;
            let key = fields[i].dataset["key"];
            this.model.fields[key].value = value;
        }
        this.store.saveRaw(this.model).then(r => console.log(r));
    },

    render: function () {
        this.$el.html(this.template({ model: this.model }));
        return this;
    }
});

var FavsMenuView = Backbone.View.extend({
    className: "group",

    template: _.template($('#favs-menu-tmpl').html()),

    initialize: function(options) {
        this.store = options.store;
    },

    render: function() {
        let that = this;
        this.store.db.find({selector: {fav: true}, fields: ["_id"]}).then(r=>{
            let favs = new Set();
            r.docs.forEach(doc => {
                favs.add(doc._id);
            })
            that.$el.html(that.template({ favs: favs }));
        })
        return this;
    }
});

var TagsMenuView = Backbone.View.extend({
    className: "group",

    template: _.template($('#tags-menu-tmpl').html()),

    initialize: function(options) {
        this.store = options.store;
    },

    render: function() {
        let that = this;
        this.store.db.find({selector: {tags: {$gte: 1}}, fields: ["tags"]}).then(r=>{
            let tags = new Set();
            r.docs.forEach(doc => {
                doc.tags.forEach(t => tags.add(t));
            })
            that.$el.html(that.template({ tags: tags }));
        })
        return this;
    }
});


var SideBarView = Backbone.View.extend({
    template: _.template($('#side-bar-tmpl').html()),

    events: {
        'click .back': "back",
        'keypress .search': "search"
    },

    initialize: function(options) {
        this.store = options.store;
    },

    search: function (e) {
        if (e.keyCode !== 13) {
            return;
        }
        let search = e.target.value;
        window.location = "#search/" + search;
    },

    back: function () {
        window.history.back();
    },

    toggle: function() {
        this.$el.toggle();
    },

    render: function () {
        var d = new Date();
        var today = d.toISOString().split("T")[0];
        this.$el.html(this.template({ today: today }));

        let favsv = new FavsMenuView({store: this.store});
        this.$el.find(".gen").append(favsv.render().$el);

        let tagsv = new TagsMenuView({store: this.store});
        this.$el.find(".gen").append(tagsv.render().$el);

        return this;
    }
});

var TodosView = Backbone.View.extend({
    className: "todos",
    template: _.template($('#todos-view-tmpl').html()),

    initialize: function (options) {
        this.todos = options.todos;
        this.parser = new Parser();
    },

    render: function () {
        for (let id in this.todos) {
            for (let i in this.todos[id]) {
                this.todos[id][i].html = this.parser.parse(this.todos[id][i].text);
            }
        }
        this.$el.html(this.template({ todos: this.todos }));
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

    initialize: function (attributes, options) {
        this.store = options.store;
    },

    rename: function (newid, success) {
        let attrs = clone(this.attributes);
        this.store.renameCard(attrs, newid)
            .then(response => {
                success(response.id);
            })
            .catch(function (err) {
                console.log(err);
            });
    },

    save: function (arg) {
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
        if (attrs._id === undefined) {
            attrs._id = this.attributes._id;
        }
        if (attrs._rev === undefined) {
            attrs._rev = this.attributes._rev;
        }
        let that = this;
        this.store.saveCard(attrs).then((resp) => {
            callback(resp.id);
        });
    }
});

var CardSummaryView = Backbone.View.extend({
    className: "card-summary",
    template: _.template($('#card-summary-view-tmpl').html()),

    initialize: function (model, options) {
        this.model = model;
    },

    render: function () {
        this.$el.html(this.template({ card: this.model }));
        return this;
    }
});

const highlight = (editor) => {
    let code = editor.innerHTML;
    // code = code.replace(/(\n?)(\s*.*:\n)/g, '$1<span class="header">$2</span>');
    editor.innerHTML = code;
};

var CardEditView = Backbone.View.extend({
    className: "card edit",
    template: _.template($('#card-edit-view-tmpl').html()),
    events: {
        "click .cancel": "cancel",
        "click .save": "save",
    },

    initialize: function (model, options) {
        this.model = model;
    },

    cancel: function () {
        localStorage.removeItem(this.model.id);
        if (this.model.attributes._rev === undefined) {
            // This is rendering a new document
            window.history.back();
        } else {
            window.location = "#view/" + this.model.id;
        }
    },

    save: function () {
        let title = this.$el.find(".title").val();
        let tags = this.$el.find(".tags").val().trim();
        let oldid = this.model.id;
        if (tags.length > 0) {
            this.model.set("tags", tags.split(" "));
        } else {
            this.model.set("tags", undefined);
        }
        if (this.model.id && title !== this.model.id) {
            // rename file
            this.model.rename(title, (id) => {
                localStorage.removeItem(oldid);
                window.location = "#view/" + id;
            });
            return;
        }
        this.model.set('_id', title.trim());
        this.model.save((id) => {
            localStorage.removeItem(oldid);
            window.location = "#view/" + id;
        });
    },

    render: function () {
        let content = localStorage.getItem(this.model.id);
        if (content) {
            if (confirm('Draft exists, should I restore it?')) {
                this.model.set("content", content);
            } else {
                localStorage.removeItem(this.model.id);
            }
        }
        this.$el.html(this.template({ card: this.model.attributes }));
        this.jar = CodeJar(
            this.$el.find(".editor")[0],
            highlight,
            {
                spellcheck: true
            }
        );
        let that = this;
        let cancel;
        this.jar.onUpdate(code => {
            if (cancel) clearTimeout(cancel);
            cancel = setTimeout(() => {
                that.model.set('content', code);
                localStorage.setItem(this.model.id, code);
            }, 500);
        });
        return this;
    }
});

var CardRefView = Backbone.View.extend({
    className: "ref",

    initialize: function (options) {
        this.parser = new Parser();
    },

    render: function (key, lines) {
        let content = "# [[" + key + "]]\n";
        for (let i in lines) {
            let line = lines[i];
            // No need indents, this could cause some problem in rendering
            line = line.replace(/^\s*/, "");
            // Same for headings
            line = line.replace(/^\s*\#* ?/, "");
            content += line + "\n";
        }
        this.$el.html(this.parser.parse(content));
        return this;
    }
});

var CardView = Backbone.View.extend({
    className: "card",
    template: _.template($('#card-view-tmpl').html()),

    initialize: function (options) {
        this.model = options.model;
        this.store = options.store;
        this.index = options.index;
        this.parser = new Parser();
    },

    eval: function (content) {
        if (!content) return "";
        let tmpl = _.template(content);
        return tmpl({ card: this.model, search: _.bind(this.search, this) });
    },

    search: function (query) {
        let ret = [];
        let rows = this.index.search(parseQuery(query));
        for (let i = 0; i < rows.length; i++) {
            ret.push({ title: rows[i].item.title });
        }
        return ret;
    },

    renderRefs: function (refs) {
        for (let key in this.model.refs) {
            let refview = new CardRefView().render(key, this.model.refs[key]);
            this.$el.find(".refs-content").append(refview.$el);
        }
    },

    render: function () {
        let attr = clone(this.model);
        let content = this.eval(attr.content);
        content = this.parser.parse(content);
        attr.content = content;

        this.$el.html(this.template({ card: attr, refs: this.model.refs }));
        if (this.model.refs) this.renderRefs();
        return this;
    }
});


var Router = Backbone.Router.extend({
    initialize: function (options) {
        this.store = options.store;
        this.el = options.el;
        this.index = options.index;
        this.backlinks = options.backlinks;
    },

    routes: {
        "": "root",
        "@:/:id": "config",
        "edit/:id": "edit",
        "view/:id": "view",
        "new": "newCard",
        "todos": "todos",
        "search/:query": "search"
    },

    config: function (id) {
        let that = this;
        this.store.get("@:/" + id).then(function (doc) {
            let v = new ConfigCardView({ model: doc, store: that.store });
            that.el.html(v.render().$el);
        }).catch(function (err) {
            if (err.status !== 404) {
                console.log(err);
                return;
            }
            let v = new ConfigCardView({ model: defaults[id], store: that.store });
            that.el.html(v.render().$el);
        });
    },

    root: function () {
        let that = this;
        this.store.settings().then(function (doc) {
            if (doc.fields["start-card"].value) {
                that.view(doc.fields["start-card"].value);
                return;
            } else {
                that.view(defaults.settings.fields["start-card"].value);
            }
        }).catch(function (err) {
            console.log(err);
            that.view(defaults.settings.fields["start-card"].value);
        });
    },

    newCard: function () {
        let model = new Card({}, { store: this.store });
        let v = new CardEditView(model);
        this.el.html(v.render().$el);
    },

    edit: function (id) {
        let that = this;
        this.store.get(id).then(function (doc) {
            let model = new Card(doc, { store: that.store });
            let v = new CardEditView(model);
            that.el.html(v.render().$el);
        }).catch(function (err) {
            if (err.status !== 404) {
                console.log(err);
                return;
            }
            let model = new Card({ _id: id }, { store: that.store });
            let v = new CardEditView(model);
            that.el.html(v.render().$el);
        });
    },

    view: function (id) {
        let that = this;
        this.store.get(id).then(function (doc) {
            let v = new CardView({ store: that.store, model: doc, index: that.index });
            that.el.html(v.render().$el);
        }).catch(function (err) {
            if (err.status !== 404) {
                console.log(err);
                return;
            }
            let v = new CardView({ model: { _id: id, content: "_Card doesn't exist, edit it to create it._" }, index: that.index, backlinks: that.backlinks });
            that.el.html(v.render().$el);
        });
    },

    todos: function () {
        let that = this;
        this.store.todos().then(todos => {
            let v = new TodosView({ todos: todos });
            that.el.html(v.render().$el);
        });
    },

    search: function (query) {
        let that = this;
        this.el.html('');
        index.search(parseQuery(query)).forEach(card => {
            let v = new CardSummaryView({ _id: card.item.title });
            that.el.append(v.render().$el);
        });
    }
});

function loadApp(store, index) {
    window.app = new Router({ store: store, el: $("#container"), index: index });
    let search = new SideBarView({ store: store, container: $("#container") });
    $("#side-bar").html(search.render().el);
    $("#menu-btn").click(e=>{
        $("#side-bar").toggle();
    })
    Backbone.history.start();
}

let store = new Store('cards');
window.store = store;
store.sync();

let index = new Fuse([], {
    keys: ['title', 'content', 'tags'],
    threshold: 0
});

store.all().then(r => {
    r.rows.forEach(d => {
        let doc = d.doc;
        doc.title = doc._id; // just to make the search easier
        delete doc._id;
        index.add(doc);
    });
    loadApp(store, index);
    window.index = index;
});
