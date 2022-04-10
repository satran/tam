/*
 * The data structure of a document will be in this format
 * _id        : default, needs to be there
 * content    : content of the card
 * type       : type of content, can be text, json, binary, image etc
 * refs       : other references to this card. keys would be _ids of other cards, with values each line the reference is created
 * todos      : list of tasks defined in this card. Each task would be of this format {content, position, status}
 */

const keys = {
    settings: "@:/settings"
};

export const defaults = {
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
};

export class Store {
    db;
    remotedb;

    constructor(name) {
        if (!name || name.length == 0) {
            name = "cards";
        }
        this.db = new PouchDB(name);
    }

    sync() {
        let that = this;
        this.db.get(keys.settings).then(function(doc) {
            let remoteHost = doc.fields["remote-database"].value;
            that.remoteDB = new PouchDB(remoteHost);
            that.db.sync(that.remoteDB, {
                live: true
            }).on('change', function(change) {
                console.log(change);
            }).on('error', function(err) {
                console.log(err);
            });
        });
    }

    settings() {
        return this.db.get(keys.settings);
    }

    build() {
        let that = this;
        this.db.allDocs({ include_docs: true }).then(r => {
            r.rows.forEach(d => {
                let doc = d.doc;
                that.save(doc);
            });
        });
    }

    renameCard(doc, newid) {
        return new Promise((resolve, reject) => {
            let oldid = doc._id;
            let oldrev = doc._rev;
            doc._id = newid;
            delete (doc._rev);
            let that = this;
            this.db.put(doc).then(function(response) {
                doc._id = oldid;
                doc._rev = oldrev;
                that.db.remove(doc)
                    .then(resp => {
                        resolve(response);
                    })
                    .catch(err => reject(err));
            }).catch(err => reject(err));
        });
    }

    saveRaw(doc) {
        return this.db.put(doc);
    }

    saveCard(doc) {
        return new Promise((resolve, reject) => {
            if (!doc.content) doc.content = "";
            let parsed = new Parser(doc.content).parse();
            if (parsed.todos.length > 0) {
                doc.todos = parsed.todos;
            } else {
                // this is to make it easier to query all cards
                // which have todos
                doc.todos = null;
            }
            let that = this;
            that.db.put(doc).then(function(response) {
                for (let other in parsed.refs) {
                    that.db.get(other).then(d => {
                        if (!d.refs) d.refs = {};
                        d.refs[doc._id] = parsed.refs[other];
                        that.db.put(d).then(()=>console.log(other));
                    }).catch(err => {
                        if (err.status !== 404) {
                            console.log(err);
                            return;
                        }
                        // if the document doesn't exist, let's just create it
                        // so that we have the refs generated
                        let d = {
                            _id: other,
                            content: "",
                            refs: {}
                        };
                        d.refs[doc._id] = parsed.refs[other];
                        that.db.put(d)
                            .then(()=>console.log(other))
                            .catch(err => console.log(err));
                    });
                }
                resolve(response);
            }).catch(function(err) {
                reject(err);
            });
        });
    }

    get(id) {
        return this.db.get(id);
    }

    all() {
        return this.db.allDocs({ include_docs: true });
    }

    todos() {
        return this.db.find({
            selector: {"todos": {"$gt": null}},
            fields: ["_id", "todos"]
        });
    }
}

export class Parser {
    text = "";

    constructor(text) {
        this.text = text;
    }

    parse() {
        let todos = [];
        let refs = {};
        let lines = this.text.split('\n');
        for(let i in lines) {
            let line = lines[i];
            let todoMatch = line.match(/^\s*\- \[ \]/);
            if (todoMatch && todoMatch.length == 1) {
                todos.push(line.trim());
            }
            let links = line.match(/\[\[([^\]]*)\]\]/g);
            if (links && links.length >0){
                for(let j in links) {
                    let matched = links[j].match(/\[\[([^|]*).*\]\]/);
                    console.log(matched);
                    if (!matched || matched.length != 2) {
                        continue;
                    }
                    let other = matched[1];
                    if(!refs.hasOwnProperty(other)){
                        refs[other] = [];
                    }
                    refs[other].push(line);
                }
            }
        }
        return {todos: todos, refs: refs};
    }
}
