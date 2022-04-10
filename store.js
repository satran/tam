/*
 * The data structure of a document will be in this format
 * _id        : default, needs to be there
 * content    : content of the card
 * type       : type of content, can be text, json, binary, image etc
 * _refs      : other references to this card. keys would be _ids of other cards, with values each line the reference is created
 * _tasks     : list of tasks defined in this card. Each task would be of this format {content, position, status}
 */
export class Store {
    db;
    name;

    constructor(name) {
        if (!name || name.length == 0) {
            name = "cards";
        }
        this.db = new PouchDB(name);
    }

    build() {
        let that = this;
        this.db.allDocs({ include_docs: true }).then(r => {
            r.rows.forEach(d => {
                let doc = d.doc;
                if (!doc.content) doc.content = "";
                let parsed = new Parser(doc.content).parse();
                doc.todos = parsed.todos;
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
                }).catch(function(err) {
                    console.log(err);
                });
            });
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
